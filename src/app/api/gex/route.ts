import { NextResponse, type NextRequest } from "next/server";

const ALLOWED_SYMBOLS = new Set(["QQQ", "SPX"]);

// Upstream allows 1 request per 10s per symbol - cache responses across all
// callers (both GEX and DEX tabs hit the same symbol) so normal tab-switching
// never re-triggers its rate limit.
const CACHE_TTL_MS = 12_000;
const cache = new Map<string, { data: unknown; expiresAt: number }>();

// Two callers can ask for the same symbol microseconds apart - Blind Spots
// fires QQQ+SPX concurrently, React dev-mode double-fires effects, a tab
// switch can race a still-loading fetch. Without de-duping, both requests
// see a cold cache and both hit the upstream, and the second one alone trips
// "1 request per 10s per symbol" even though nothing was actually wrong.
// Sharing the in-flight promise means concurrent callers get one real
// upstream call between them, not one each.
const inflight = new Map<string, Promise<UpstreamResult>>();

interface UpstreamPayload {
  ok?: boolean;
  selection?: { book?: string };
  retryAfterMs?: number;
}

interface UpstreamResult {
  ok: boolean;
  status: number;
  data: UpstreamPayload | null;
  retryAfterMs?: number;
}

async function fetchUpstream(symbol: string, base: string, key: string): Promise<UpstreamResult> {
  // dte=0 pinned explicitly, on top of book=0dte - the upstream's own default
  // selection has been observed to lag onto a later expiry (5 calendar days
  // out) while dte=0 consistently resolves to the true nearest book. Every
  // page (GEX, DEX, Hedge Pressure, Blind Spots) must read the same book.
  const upstream = await fetch(`${base}/greeks?symbol=${symbol}&book=0dte&dte=0&key=${key}`, {
    headers: { "bypass-tunnel-reminder": "true" },
    cache: "no-store",
  });
  const data: UpstreamPayload | null = await upstream.json().catch(() => null);

  if (upstream.ok && data && data.selection?.book !== "0dte") {
    return { ok: false, status: 409, data: null };
  }

  return { ok: upstream.ok, status: upstream.status, data, retryAfterMs: data?.retryAfterMs };
}

/** One real upstream call per symbol at a time, shared by every concurrent caller. */
async function fetchUpstreamShared(symbol: string, base: string, key: string): Promise<UpstreamResult> {
  const existing = inflight.get(symbol);
  if (existing) return existing;

  const promise = (async () => {
    let result = await fetchUpstream(symbol, base, key);
    // A cold cache during the upstream's own 10s rate-limit window means
    // every caller would otherwise see a 502 - one retry, waiting exactly as
    // long as the upstream says to, covers that case.
    if (!result.ok && result.status === 429) {
      await new Promise((r) => setTimeout(r, Math.min(11_000, result.retryAfterMs ?? 3000)));
      result = await fetchUpstream(symbol, base, key);
    }
    return result;
  })();

  inflight.set(symbol, promise);
  try {
    return await promise;
  } finally {
    inflight.delete(symbol);
  }
}

export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get("symbol")?.toUpperCase() ?? "";
  if (!ALLOWED_SYMBOLS.has(symbol)) {
    return NextResponse.json({ ok: false, error: "unsupported_symbol" }, { status: 400 });
  }

  const base = process.env.GEX_API_BASE;
  const key = process.env.GEX_API_KEY;
  if (!base || !key) {
    return NextResponse.json({ ok: false, error: "gex_api_not_configured" }, { status: 500 });
  }

  const cached = cache.get(symbol);
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json(cached.data);
  }

  const result = await fetchUpstreamShared(symbol, base, key);

  if (!result.ok || !result.data) {
    // Serve stale data rather than an error if we have any on hand.
    if (cached) return NextResponse.json(cached.data);
    return NextResponse.json({ ok: false, error: "upstream_error", status: result.status }, { status: 502 });
  }

  cache.set(symbol, { data: result.data, expiresAt: Date.now() + CACHE_TTL_MS });
  return NextResponse.json(result.data);
}
