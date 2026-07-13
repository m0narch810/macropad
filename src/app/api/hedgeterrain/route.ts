import { NextResponse, type NextRequest } from "next/server";
import {
  computeGammaFlipBand,
  computeHedgeAcceleration,
  computeHedgeBasin,
  computeHedgeCliffs,
  computeHedgeGrid,
  DIVIDEND_YIELD,
  type ChainStrikeInput,
  type CrossExpiryLevel,
  type GexSymbol,
  type SviResidualRow,
} from "@/lib/gex";
import { fitSvi, sviImpliedVol, type SviPoint } from "@/lib/svi";

const ALLOWED_SYMBOLS = new Set<GexSymbol>(["QQQ", "SPY", "SPX", "NDX"]);

// This grid is expensive (a full reprice sweep, not a single point) and the
// upstream chain data doesn't change fast - cache longer than the main GEX
// route so navigating this page doesn't re-pay both the upstream latency
// and the grid computation on every load.
const CACHE_TTL_MS = 60_000;
const cache = new Map<string, { data: unknown; expiresAt: number }>();
const inflight = new Map<string, Promise<{ ok: boolean; status: number; data: unknown }>>();

let rateCache: { value: number; expiresAt: number } | null = null;

async function fetchRiskFreeRate(): Promise<number> {
  if (rateCache && rateCache.expiresAt > Date.now()) return rateCache.value;
  const apiKey = process.env.FRED_API_KEY;
  if (!apiKey) return 0.04;
  try {
    const res = await fetch(
      `https://api.stlouisfed.org/fred/series/observations?series_id=DTB4WK&api_key=${apiKey}&file_type=json&sort_order=desc&limit=1`,
      { cache: "no-store" }
    );
    const json = await res.json();
    const raw = json.observations?.[0]?.value;
    const value = raw && raw !== "." ? Number(raw) / 100 : 0.04;
    rateCache = { value, expiresAt: Date.now() + 60 * 60 * 1000 };
    return value;
  } catch {
    return 0.04;
  }
}

async function fetchYyy(path: string, base: string, key: string) {
  const res = await fetch(`${base}${path}`, {
    headers: { "yyy-access-key": key, Accept: "application/json" },
    cache: "no-store",
  });
  const data = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, data };
}

async function fetchYyyWithTimeout(path: string, base: string, key: string, timeoutMs: number) {
  return Promise.race([
    fetchYyy(path, base, key),
    new Promise<{ ok: false; status: number; data: null }>((resolve) => setTimeout(() => resolve({ ok: false, status: 504, data: null }), timeoutMs)),
  ]);
}

interface ZeroDteRaw {
  spot?: number;
  expiry?: string;
  dte_hours?: number;
  strike_data?: { strike: number; side: "call" | "put"; oi: number; iv: number }[];
  error?: string | null;
}

interface OptionMatrixRaw {
  rows?: { expiration: string; dte: number; call_resistance: number | null; put_support: number | null; total_oi: number }[];
  error?: string | null;
}

export interface HedgeTerrainResponse {
  ok: boolean;
  symbol: GexSymbol;
  asOf: number;
  spot: number;
  resolvedExpiry: string;
  dteHours: number;
  grid: ReturnType<typeof computeHedgeGrid>;
  cliffs: ReturnType<typeof computeHedgeCliffs>;
  basin: ReturnType<typeof computeHedgeBasin>;
  acceleration: ReturnType<typeof computeHedgeAcceleration>;
  gammaFlipBand: ReturnType<typeof computeGammaFlipBand>;
  sviResiduals: SviResidualRow[];
  crossExpiry: CrossExpiryLevel[];
}

async function buildHedgeTerrain(symbol: GexSymbol, base: string, key: string) {
  const [zeroDteResult, matrixResult, r] = await Promise.all([
    fetchYyy(`/zero_dte?ticker=${symbol}`, base, key),
    fetchYyyWithTimeout(`/option-matrix?ticker=${symbol}`, base, key, 4000),
    fetchRiskFreeRate(),
  ]);

  if (!zeroDteResult.ok) {
    return { ok: false, status: zeroDteResult.status, data: null };
  }

  const zeroDteRaw = zeroDteResult.data as ZeroDteRaw;
  if (zeroDteRaw.error || !zeroDteRaw.spot || !zeroDteRaw.strike_data?.length) {
    return { ok: false, status: 502, data: null };
  }

  const spot = zeroDteRaw.spot;
  const dteHours = zeroDteRaw.dte_hours ?? 0;
  const T = Math.max(dteHours, 0.05) / 24 / 365;
  const q = DIVIDEND_YIELD[symbol];
  const forward = spot * Math.exp((r - q) * T);

  const rawChain: ChainStrikeInput[] = zeroDteRaw.strike_data.map((row) => ({
    strike: row.strike,
    side: row.side,
    oi: row.oi ?? 0,
    iv: row.iv ?? 0,
  }));

  const sviPoints: SviPoint[] = rawChain
    .filter((row) => row.iv > 0)
    .map((row) => ({ k: Math.log(row.strike / forward), w: row.iv * row.iv * T, weight: Math.max(1, row.oi) }));
  const sviParams = fitSvi(sviPoints);

  const smoothedChain: ChainStrikeInput[] = rawChain.map((row) => ({
    ...row,
    iv: row.iv > 0 ? sviImpliedVol(sviParams, row.strike, forward, T) : 0,
  }));

  const sviResiduals: SviResidualRow[] = rawChain
    .filter((row) => row.iv > 0 && row.oi > 0)
    .map((row) => {
      const fittedIv = sviImpliedVol(sviParams, row.strike, forward, T);
      return {
        strike: row.strike,
        side: row.side,
        rawIv: row.iv,
        fittedIv,
        residualPct: fittedIv > 0 ? ((row.iv - fittedIv) / fittedIv) * 100 : 0,
      };
    })
    .sort((a, b) => Math.abs(b.residualPct) - Math.abs(a.residualPct))
    .slice(0, 20);

  const grid = computeHedgeGrid(smoothedChain, spot, dteHours, r, q);
  const gridAtNow = grid.filter((p) => p.hoursAhead === 0);
  const cliffs = computeHedgeCliffs(gridAtNow);
  const basin = computeHedgeBasin(gridAtNow, cliffs);
  const acceleration = computeHedgeAcceleration(gridAtNow);
  const gammaFlipBand = computeGammaFlipBand(smoothedChain, spot, T, r, q);

  let crossExpiry: CrossExpiryLevel[] = [];
  if (matrixResult.ok) {
    const m = matrixResult.data as OptionMatrixRaw;
    if (!m.error && m.rows) {
      crossExpiry = m.rows.map((row) => ({
        expiration: row.expiration,
        dte: row.dte,
        callResistance: row.call_resistance,
        putSupport: row.put_support,
        totalOi: row.total_oi,
      }));
    }
  }

  const response: HedgeTerrainResponse = {
    ok: true,
    symbol,
    asOf: Date.now(),
    spot,
    resolvedExpiry: zeroDteRaw.expiry ?? "",
    dteHours,
    grid,
    cliffs,
    basin,
    acceleration,
    gammaFlipBand,
    sviResiduals,
    crossExpiry,
  };

  return { ok: true, status: 200, data: response };
}

async function fetchShared(symbol: GexSymbol, base: string, key: string) {
  const existing = inflight.get(symbol);
  if (existing) return existing;

  const promise = buildHedgeTerrain(symbol, base, key);
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
