import { NextResponse, type NextRequest } from "next/server";
import { deriveGexResponse, type GexSymbol, type StrikeRow0DTE } from "@/lib/gex";

const ALLOWED_SYMBOLS = new Set<GexSymbol>(["QQQ", "SPY"]);
const GREEKS = ["gex", "dex", "vex", "tex", "cex", "vegaex"] as const;

// Upstream allows 1 request per 10s per symbol - cache responses across all
// callers (both GEX and DEX tabs hit the same symbol) so normal tab-switching
// never re-triggers its rate limit.
const CACHE_TTL_MS = 12_000;
const cache = new Map<string, { data: unknown; expiresAt: number }>();

// Two callers can ask for the same symbol microseconds apart - Blind Spots
// fires QQQ+SPY concurrently, React dev-mode double-fires effects, a tab
// switch can race a still-loading fetch. Sharing the in-flight promise means
// concurrent callers get one real upstream call between them, not one each.
const inflight = new Map<string, Promise<{ ok: boolean; status: number; data: unknown }>>();

interface HeatmapExpiry {
  date: string;
  label: string;
  dte: number;
}

interface HeatmapGrid {
  rows: { strike: number; cells: (number | null)[] }[];
  max_abs: number;
}

interface HeatmapResponse {
  spot?: number;
  strikes?: number[];
  expiries?: HeatmapExpiry[];
  grids?: Record<string, HeatmapGrid>;
  error?: string | null;
}

interface GexAggResponse {
  spot?: number;
  max_pain?: number;
  strike_data?: { strike: number; call_oi: number; put_oi: number }[];
  error?: string | null;
}

async function fetchYyy(path: string, base: string, key: string) {
  const res = await fetch(`${base}${path}`, {
    headers: { "yyy-access-key": key, Accept: "application/json" },
    cache: "no-store",
  });
  const data = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, data };
}

/** Merges /gex (aggregate OI + max pain) with /heatmap (per-strike, per-expiry greeks), keeping only the true nearest (0DTE) expiry column. */
async function buildZeroDteResponse(symbol: GexSymbol, base: string, key: string) {
  const [gexResult, heatmapResult] = await Promise.all([
    fetchYyy(`/gex?ticker=${symbol}`, base, key),
    fetchYyy(`/heatmap?ticker=${symbol}`, base, key),
  ]);

  if (!gexResult.ok || !heatmapResult.ok) {
    return { ok: false, status: Math.max(gexResult.status, heatmapResult.status), data: null };
  }

  const gexRaw = gexResult.data as GexAggResponse;
  const heatmapRaw = heatmapResult.data as HeatmapResponse;
  if (gexRaw.error || heatmapRaw.error || !heatmapRaw.expiries?.length || !heatmapRaw.grids) {
    return { ok: false, status: 502, data: null };
  }

  // The nearest listed expiry is index 0 - expiries come back sorted ascending by date.
  const zeroDteIndex = 0;
  const resolvedExpiry = heatmapRaw.expiries[zeroDteIndex].date;

  const oiByStrike = new Map<number, { callOi: number; putOi: number }>();
  for (const row of gexRaw.strike_data ?? []) {
    oiByStrike.set(row.strike, { callOi: row.call_oi ?? 0, putOi: row.put_oi ?? 0 });
  }

  const strikesInOrder = heatmapRaw.grids.gex?.rows.map((r) => r.strike) ?? [];
  const perStrike: StrikeRow0DTE[] = strikesInOrder.map((strike) => {
    const cellAt = (greek: (typeof GREEKS)[number]) => {
      const row = heatmapRaw.grids![greek]?.rows.find((r) => r.strike === strike);
      return row?.cells[zeroDteIndex] ?? 0;
    };
    const oi = oiByStrike.get(strike) ?? { callOi: 0, putOi: 0 };
    return {
      strike,
      gex: cellAt("gex"),
      dex: cellAt("dex"),
      vex: cellAt("vex"),
      tex: cellAt("tex"),
      cex: cellAt("cex"),
      vegaex: cellAt("vegaex"),
      callOi: oi.callOi,
      putOi: oi.putOi,
    };
  });

  const response = deriveGexResponse({
    symbol,
    spot: heatmapRaw.spot ?? gexRaw.spot ?? 0,
    resolvedExpiry,
    perStrike,
    maxPain: gexRaw.max_pain ?? 0,
  });

  return { ok: true, status: 200, data: response };
}

async function fetchShared(symbol: GexSymbol, base: string, key: string) {
  const existing = inflight.get(symbol);
  if (existing) return existing;

  const promise = buildZeroDteResponse(symbol, base, key);
  inflight.set(symbol, promise);
  try {
    return await promise;
  } finally {
    inflight.delete(symbol);
  }
}

export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get("symbol")?.toUpperCase() as GexSymbol | undefined;
  if (!symbol || !ALLOWED_SYMBOLS.has(symbol)) {
    return NextResponse.json({ ok: false, error: "unsupported_symbol" }, { status: 400 });
  }

  const base = process.env.YYY_API_BASE;
  const key = process.env.YYY_API_KEY;
  if (!base || !key) {
    return NextResponse.json({ ok: false, error: "gex_api_not_configured" }, { status: 500 });
  }

  const cached = cache.get(symbol);
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json(cached.data);
  }

  const result = await fetchShared(symbol, base, key);

  if (!result.ok || !result.data) {
    if (cached) return NextResponse.json(cached.data);
    return NextResponse.json({ ok: false, error: "upstream_error", status: result.status }, { status: 502 });
  }

  cache.set(symbol, { data: result.data, expiresAt: Date.now() + CACHE_TTL_MS });
  return NextResponse.json(result.data);
}
