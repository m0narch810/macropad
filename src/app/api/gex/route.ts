import { NextResponse, type NextRequest } from "next/server";
import {
  buildStrikeRowsFromChain,
  deriveGexResponse,
  type ChainStrikeInput,
  type CrossExpiryRow,
  type DealerFlowContext,
  type GexSymbol,
  type ProbabilityStats,
  type ZeroDteContext,
} from "@/lib/gex";
import { fitSvi, sviImpliedVol, type SviPoint } from "@/lib/svi";

// The source API silently falls back to SPX's own data for any ticker it
// doesn't actually carry (confirmed directly: IWM/DIA/NVDA/AAPL/MSFT/TSLA/
// META/GOOGL/AMZN all returned SPX's exact spot/strikes under their own
// name, no error). Only these four gave genuinely distinct spot prices.
const ALLOWED_SYMBOLS = new Set<GexSymbol>(["QQQ", "SPY", "SPX", "NDX"]);

// Continuous dividend-yield approximation, not discrete ex-dividend jumps -
// a stated simplification of the pricer, not a hidden one. QQQ/NDX track the
// Nasdaq-100 (lower yield, tech-heavy); SPY/SPX track the S&P 500.
const DIVIDEND_YIELD: Record<GexSymbol, number> = { QQQ: 0.006, NDX: 0.006, SPY: 0.012, SPX: 0.012 };

// Upstream latency, measured directly against each endpoint: /zero_dte ~1.5s,
// /gex ~2.9s, /dealer_anomalies ~0.3s, /probability ~9.6s, /option-matrix
// ~14.3s - the last two are genuinely slow server-side computations, not
// something a shorter client-side cache or fewer tree steps fixes. Cache
// the assembled response longer (this is 0DTE analytics, not tick data) so
// most requests hit cache instead of re-paying that cost.
const CACHE_TTL_MS = 30_000;
const cache = new Map<string, { data: unknown; expiresAt: number }>();
const inflight = new Map<string, Promise<{ ok: boolean; status: number; data: unknown }>>();

/** option-matrix (cross-expiry table) is supplementary, not required to render GEX/DEX/Hedge Pressure - don't let its ~14s upstream latency hold up the whole response. */
async function fetchYyyWithTimeout(path: string, base: string, key: string, timeoutMs: number) {
  return Promise.race([
    fetchYyy(path, base, key),
    new Promise<{ ok: false; status: number; data: null }>((resolve) => setTimeout(() => resolve({ ok: false, status: 504, data: null }), timeoutMs)),
  ]);
}

// The risk-free rate barely moves intraday - reuse this project's existing
// FRED integration (already used elsewhere for macro data) instead of a
// hardcoded guess, cached for an hour since it's a daily-frequency series.
let rateCache: { value: number; expiresAt: number } | null = null;

async function fetchRiskFreeRate(): Promise<number> {
  if (rateCache && rateCache.expiresAt > Date.now()) return rateCache.value;
  const apiKey = process.env.FRED_API_KEY;
  if (!apiKey) return 0.04; // stated fallback, not silently wrong: FRED not configured
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

interface ZeroDteRaw {
  spot?: number;
  expiry?: string;
  dte_hours?: number;
  expected_move_1s?: number;
  expected_move_2s?: number;
  pc_ratio?: number;
  pc_sentiment?: string;
  charm_direction?: string;
  vanna_direction?: string;
  charm_note?: string;
  vanna_note?: string;
  strike_data?: { strike: number; side: "call" | "put"; oi: number; iv: number }[];
  error?: string | null;
}

interface ProbabilityRaw {
  mu_daily_pct?: number;
  sigma_daily_pct?: number;
  skewness?: number;
  excess_kurtosis?: number;
  fat_tails?: boolean;
  n_days?: number;
  bands_1d?: Record<string, [number, number]>;
  error?: string | null;
}

interface DealerAnomaliesRaw {
  current_z?: number;
  imbalance?: number;
  buy_count?: number;
  sell_count?: number;
  z_threshold?: number;
  error?: string | null;
}

interface OptionMatrixRaw {
  rows?: { expiration: string; dte: number; net_gex: number; call_resistance: number | null; put_support: number | null; total_oi: number }[];
  error?: string | null;
}

interface GexAggRaw {
  max_pain?: number;
  error?: string | null;
}

/** Fetches the four railway endpoints we actually need, builds our own per-strike Greeks via CRR on real IV instead of trusting the source's precomputed ones. */
async function buildZeroDteResponse(symbol: GexSymbol, base: string, key: string) {
  const [zeroDteResult, probabilityResult, matrixResult, anomaliesResult, gexResult, r] = await Promise.all([
    fetchYyy(`/zero_dte?ticker=${symbol}`, base, key),
    fetchYyy(`/probability?ticker=${symbol}`, base, key),
    fetchYyyWithTimeout(`/option-matrix?ticker=${symbol}`, base, key, 4000),
    fetchYyy(`/dealer_anomalies?ticker=${symbol}`, base, key),
    fetchYyy(`/gex?ticker=${symbol}`, base, key),
    fetchRiskFreeRate(),
  ]);

  if (!zeroDteResult.ok || !probabilityResult.ok) {
    return { ok: false, status: Math.max(zeroDteResult.status, probabilityResult.status), data: null };
  }

  const zeroDteRaw = zeroDteResult.data as ZeroDteRaw;
  const probabilityRaw = probabilityResult.data as ProbabilityRaw;
  if (zeroDteRaw.error || probabilityRaw.error || !zeroDteRaw.spot || !zeroDteRaw.strike_data?.length) {
    return { ok: false, status: 502, data: null };
  }

  const spot = zeroDteRaw.spot;
  const dteHours = zeroDteRaw.dte_hours ?? 0;
  const T = Math.max(dteHours, 0.05) / 24 / 365; // floor to ~3 minutes so the tree never sees T=0

  const q = DIVIDEND_YIELD[symbol];
  const forward = spot * Math.exp((r - q) * T);

  const rawChain: ChainStrikeInput[] = zeroDteRaw.strike_data.map((row) => ({
    strike: row.strike,
    side: row.side,
    oi: row.oi ?? 0,
    iv: row.iv ?? 0,
  }));

  // Single-slice SVI fit (this is one expiry, not a multi-expiry SSVI surface)
  // smooths the raw per-contract IV before it reaches the pricer - a bad
  // quote on one thin strike can't swing that strike's Greeks on its own.
  // OI-weighted so liquid strikes anchor the fit more than thin ones.
  const sviPoints: SviPoint[] = rawChain
    .filter((row) => row.iv > 0)
    .map((row) => ({ k: Math.log(row.strike / forward), w: row.iv * row.iv * T, weight: Math.max(1, row.oi) }));
  const sviParams = fitSvi(sviPoints);
  const chain: ChainStrikeInput[] = rawChain.map((row) => ({
    ...row,
    iv: row.iv > 0 ? sviImpliedVol(sviParams, row.strike, forward, T) : 0,
  }));

  const perStrike = buildStrikeRowsFromChain(chain, spot, T, r, q);

  const probability: ProbabilityStats = {
    muDailyPct: probabilityRaw.mu_daily_pct ?? 0,
    sigmaDailyPct: probabilityRaw.sigma_daily_pct ?? 1.5,
    skewness: probabilityRaw.skewness ?? 0,
    excessKurtosis: probabilityRaw.excess_kurtosis ?? 0,
    fatTails: probabilityRaw.fat_tails ?? false,
    nDays: probabilityRaw.n_days ?? 0,
    bands1d: probabilityRaw.bands_1d ?? {},
  };

  let dealerFlow: DealerFlowContext | null = null;
  if (anomaliesResult.ok) {
    const a = anomaliesResult.data as DealerAnomaliesRaw;
    if (!a.error && a.current_z !== undefined) {
      dealerFlow = {
        currentZ: a.current_z,
        imbalance: a.imbalance ?? 0,
        buyCount: a.buy_count ?? 0,
        sellCount: a.sell_count ?? 0,
        zThreshold: a.z_threshold ?? 2,
      };
    }
  }

  let crossExpiry: CrossExpiryRow[] = [];
  if (matrixResult.ok) {
    const m = matrixResult.data as OptionMatrixRaw;
    if (!m.error && m.rows) {
      crossExpiry = m.rows.map((row) => ({
        expiration: row.expiration,
        dte: row.dte,
        netGex: row.net_gex,
        callResistance: row.call_resistance,
        putSupport: row.put_support,
        totalOi: row.total_oi,
      }));
    }
  }

  const zeroDte: ZeroDteContext | null =
    zeroDteRaw.expected_move_1s !== undefined
      ? {
          expectedMove1s: zeroDteRaw.expected_move_1s,
          expectedMove2s: zeroDteRaw.expected_move_2s ?? 0,
          pcRatio: zeroDteRaw.pc_ratio ?? 0,
          pcSentiment: zeroDteRaw.pc_sentiment ?? "",
          charmDirection: zeroDteRaw.charm_direction ?? "",
          vannaDirection: zeroDteRaw.vanna_direction ?? "",
          charmNote: zeroDteRaw.charm_note ?? "",
          vannaNote: zeroDteRaw.vanna_note ?? "",
        }
      : null;

  let maxPain = 0;
  if (gexResult.ok) {
    const g = gexResult.data as GexAggRaw;
    if (!g.error) maxPain = g.max_pain ?? 0;
  }

  const response = deriveGexResponse({
    symbol,
    spot,
    resolvedExpiry: zeroDteRaw.expiry ?? "",
    dteHours,
    perStrike,
    maxPain,
    probability,
    dealerFlow,
    crossExpiry,
    zeroDte,
    pricerInputs: { r, q },
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
