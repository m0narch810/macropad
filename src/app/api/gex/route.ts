import { NextResponse, type NextRequest } from "next/server";

const ALLOWED_SYMBOLS = new Set(["QQQ", "SPX"]);

// Upstream allows 1 request per 10s per symbol - cache responses across all
// callers (both GEX and DEX tabs hit the same symbol) so normal tab-switching
// never re-triggers its rate limit.
const CACHE_TTL_MS = 12_000;
const cache = new Map<string, { data: unknown; expiresAt: number }>();

async function fetchUpstream(symbol: string, base: string, key: string) {
  const upstream = await fetch(`${base}/greeks?symbol=${symbol}&key=${key}`, {
    headers: { "bypass-tunnel-reminder": "true" },
    cache: "no-store",
  });
  const data = await upstream.json().catch(() => null);
  return { ok: upstream.ok, status: upstream.status, data };
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

  let result = await fetchUpstream(symbol, base, key);

  // A cold cache during the upstream's own 10s rate-limit window (e.g. right
  // after a deploy, or two symbols first-loading close together) means every
  // caller would otherwise see a 502 - one short retry covers that case.
  if (!result.ok && result.status === 429) {
    await new Promise((r) => setTimeout(r, 3000));
    result = await fetchUpstream(symbol, base, key);
  }

  if (!result.ok || !result.data) {
    // Serve stale data rather than an error if we have any on hand.
    if (cached) return NextResponse.json(cached.data);
    return NextResponse.json({ ok: false, error: "upstream_error", status: result.status }, { status: 502 });
  }

  cache.set(symbol, { data: result.data, expiresAt: Date.now() + CACHE_TTL_MS });
  return NextResponse.json(result.data);
}
