import { NextResponse, type NextRequest } from "next/server";
import {
  buildStrikeRowsFromChain,
  deriveGexResponse,
  DIVIDEND_YIELD,
  type ChainStrikeInput,
  type CrossExpiryRow,
  type DealerFlowContext,
  type GexResponse,
  type GexSymbol,
  type ProbabilityStats,
  type ZeroDteContext,
} from "@/lib/gex";
import { fitSvi, sviImpliedVol, type SviPoint } from "@/lib/svi";
import { buildArbitrageControlledSmile } from "@/lib/arbitrageSmile";
import { computeGexPageAnalytics } from "@/lib/gexAnalytics";
import { computeGammaEngine, computeIvSurfaceFitError } from "@/lib/gammaEngine";
import { computeDeltaEngine } from "@/lib/deltaEngine";
import { computeThetaEngine, parseThetaHeatmap } from "@/lib/thetaEngine";
import { computeVannaEngine, type VannaSurfacePoint } from "@/lib/vannaEngine";
import { computeCharmEngine, type CharmSurfacePoint } from "@/lib/charmEngine";
import { buildGexHeatmap, fromCharmHeatmap, fromThetaHeatmap, fromVannaHeatmap, fromZeroDteOnly, withSelfComputedNearestColumn, type GexSurfacePoint } from "@/lib/strikeExpiryHeatmaps";
import { computeHedgeCliffMap } from "@/lib/hedgeCliffEngine";
import { buildTopoProfile } from "@/lib/topoProfile";

// The source API silently falls back to SPX's own data for any ticker it
// doesn't actually carry (confirmed directly: IWM/DIA/NVDA/AAPL/MSFT/TSLA/
// META/GOOGL/AMZN all returned SPX's exact spot/strikes under their own
// name, no error). Only these four gave genuinely distinct spot prices.
const ALLOWED_SYMBOLS = new Set<GexSymbol>(["QQQ", "SPY", "SPX", "NDX"]);

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
  atm_iv?: number;
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
  rows?: {
    expiration: string;
    dte: number;
    net_gex: number;
    call_resistance: number | null;
    put_support: number | null;
    total_oi: number;
    total_vol?: number;
    call_dex?: number;
    put_dex?: number;
    net_dex?: number;
  }[];
  error?: string | null;
}

interface GexAggRaw {
  max_pain?: number;
  error?: string | null;
}

interface ChartRaw {
  candles?: { time: string; open: number; high: number; low: number; close: number; volume: number }[];
  error?: string | null;
}

interface ThetaRaw {
  total_tex?: number;
  call_tex?: number;
  put_tex?: number;
  expiries?: { exp: string; label: string; dte: number }[];
  rows?: { strike: number; call_cells: number[]; put_cells: number[]; total: number }[];
  error?: string | null;
}

interface VannaSurfaceRaw {
  spot?: number;
  points?: { strike: number; dte: number; vanna: number; is_put: boolean }[];
  error?: string | null;
}

interface CharmSurfaceRaw {
  spot?: number;
  points?: { strike: number; dte: number; charm: number; is_put: boolean }[];
  error?: string | null;
}

interface GexSurfaceRaw {
  spot?: number;
  call_wall?: number;
  put_wall?: number;
  points?: { strike: number; dte: number; gex: number; is_put: boolean }[];
  error?: string | null;
}

/** Fetches the railway endpoints we actually need, builds our own per-strike Greeks (Black-Scholes + American tree, both on real IV) instead of trusting the source's precomputed ones. */
async function buildZeroDteResponse(symbol: GexSymbol, base: string, key: string) {
  const [zeroDteResult, probabilityResult, matrixResult, anomaliesResult, gexResult, chartResult, thetaResult, vannaSurfaceResult, charmSurfaceResult, gexSurfaceResult, r] = await Promise.all([
    fetchYyy(`/zero_dte?ticker=${symbol}`, base, key),
    fetchYyy(`/probability?ticker=${symbol}`, base, key),
    // 4s used to be the budget here, but /option-matrix's own measured
    // latency is ~14s and /probability already blocks this response
    // unconditionally for ~9-10s - a 4s cutoff meant this endpoint (and
    // everything downstream of it: cross-expiry stack, 0DTE gamma control,
    // 0DTE-next-expiry confluence) lost to its own timeout on nearly every
    // request, confirmed directly against live traffic. Raising the budget
    // doesn't add net latency (probability's own unconditional wait already
    // exceeds it) and lets real data through most of the time instead.
    fetchYyyWithTimeout(`/option-matrix?ticker=${symbol}`, base, key, 18000),
    fetchYyy(`/dealer_anomalies?ticker=${symbol}`, base, key),
    fetchYyy(`/gex?ticker=${symbol}`, base, key),
    fetchYyyWithTimeout(`/chart?ticker=${symbol}&interval=5min`, base, key, 6000),
    fetchYyyWithTimeout(`/theta?ticker=${symbol}`, base, key, 15000),
    fetchYyyWithTimeout(`/vanna_surface?ticker=${symbol}`, base, key, 12000),
    fetchYyyWithTimeout(`/charm_surface?ticker=${symbol}`, base, key, 12000),
    fetchYyyWithTimeout(`/gex_surface?ticker=${symbol}`, base, key, 12000),
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

  // Single-slice SVI fit (this is one expiry, not a multi-expiry SSVI surface),
  // OI-weighted so liquid strikes anchor the fit more than thin ones. The
  // smoothed `chain` feeds the scenario/analytics engines (they reprice whole
  // hypothetical grids, where one bad quote would propagate) - but the
  // DISPLAYED per-strike rows are now built from rawChain, each contract's own
  // live quoted IV. The SVI-fitted IVs measurably deviate from the quoted ones
  // strike-by-strike, which is exactly why the per-strike GEX bars never quite
  // matched the source terminal's own calculated greeks.
  const sviPoints: SviPoint[] = rawChain
    .filter((row) => row.iv > 0)
    .map((row) => ({ k: Math.log(row.strike / forward), w: row.iv * row.iv * T, weight: Math.max(1, row.oi) }));
  const sviParams = fitSvi(sviPoints);
  const chain: ChainStrikeInput[] = rawChain.map((row) => ({
    ...row,
    iv: row.iv > 0 ? sviImpliedVol(sviParams, row.strike, forward, T) : 0,
  }));

  const perStrike = buildStrikeRowsFromChain(rawChain, spot, T, r, q, "bs");
  const perStrikeAmerican = buildStrikeRowsFromChain(rawChain, spot, T, r, q, "american");
  const arbChain = buildArbitrageControlledSmile(rawChain, forward, T);
  const perStrikeCrr = buildStrikeRowsFromChain(arbChain, spot, T, r, q, "crr");

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
        totalVol: row.total_vol ?? 0,
        callDex: row.call_dex ?? 0,
        putDex: row.put_dex ?? 0,
        netDex: row.net_dex ?? 0,
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

  // Source's atm_iv is on a 0-100 percentage-point scale (e.g. 28.3), not
  // the fractional scale (0.283) every per-contract iv/vol figure in this
  // app uses - confirmed directly against the same /zero_dte payload's own
  // strike_data ivs, which ARE fractional. Divide by 100 before it reaches
  // any vol-as-decimal function (touch probability, etc).
  const atmIv = (zeroDteRaw.atm_iv ?? 20) / 100;

  let recentVolume5m: number | null = null;
  let recentVolume15m: number | null = null;
  let recentVolume30m: number | null = null;
  if (chartResult.ok) {
    const c = chartResult.data as ChartRaw;
    if (!c.error && c.candles?.length) {
      recentVolume5m = c.candles[c.candles.length - 1].volume;
      recentVolume15m = c.candles.slice(-3).reduce((s, candle) => s + candle.volume, 0);
      recentVolume30m = c.candles.slice(-6).reduce((s, candle) => s + candle.volume, 0);
    }
  }

  const response = deriveGexResponse({
    symbol,
    spot,
    resolvedExpiry: zeroDteRaw.expiry ?? "",
    dteHours,
    perStrike,
    perStrikeAmerican,
    perStrikeCrr,
    maxPain,
    probability,
    dealerFlow,
    crossExpiry,
    zeroDte,
    pricerInputs: { r, q },
  });

  response.atmIv = atmIv;

  response.gexPage = computeGexPageAnalytics({
    chain,
    perStrike,
    spot,
    r,
    q,
    dteHours,
    atmIv,
    expectedMove1s: zeroDte?.expectedMove1s ?? null,
    callWall: response.callWall,
    putWall: response.putWall,
    totalGex0dte: response.totalGex0dte,
    crossExpiry,
    recentVolume5m,
    sviParams,
    forward,
  });

  response.gammaEngine = computeGammaEngine({
    symbol,
    chain,
    perStrike,
    spot,
    r,
    q,
    dteHours,
    atmIv,
    expectedMove1s: zeroDte?.expectedMove1s ?? null,
    callWall: response.callWall,
    putWall: response.putWall,
    totalGex0dte: response.totalGex0dte,
    crossExpiry,
    recentVolume5m,
    sviParams,
    forward,
    skew: response.gexPage.impliedMoments.skewness,
    kurtExcess: response.gexPage.impliedMoments.excessKurtosis,
    flowImbalance: dealerFlow?.imbalance ?? null,
    validContracts: chain.filter((row) => row.oi > 0 && row.iv > 0).length,
    ivSurfaceFitError: computeIvSurfaceFitError(rawChain, sviParams, forward, T),
    pricerEngineLabel: "Closed-form Black-Scholes greeks on each contract's live quoted 0DTE IV (American/CRR trees available via the page's engine toggle for the static table)",
  });

  response.deltaEngine = computeDeltaEngine({
    symbol,
    chain,
    perStrike,
    spot,
    r,
    q,
    dteHours,
    atmIv,
    expectedMove1s: zeroDte?.expectedMove1s ?? null,
    crossExpiry,
    recentVolume5m,
    recentVolume15m,
    recentVolume30m,
    sviParams,
    forward,
    flowImbalance: dealerFlow?.imbalance ?? null,
    netGexSign: Math.sign(response.totalGex0dte),
    validContracts: chain.filter((row) => row.oi > 0 && row.iv > 0).length,
    invalidContracts: rawChain.filter((row) => !(row.oi > 0 && row.iv > 0)).length,
  });

  let thetaHeatmap = null;
  if (thetaResult.ok) {
    const t = thetaResult.data as ThetaRaw;
    if (!t.error) thetaHeatmap = parseThetaHeatmap(t);
  }

  response.thetaEngine = computeThetaEngine({
    symbol,
    chain,
    perStrike,
    spot,
    r,
    q,
    dteHours,
    expectedMove1s: zeroDte?.expectedMove1s ?? null,
    crossExpiry,
    thetaHeatmap,
    flowImbalance: dealerFlow?.imbalance ?? null,
    validContracts: chain.filter((row) => row.oi > 0 && row.iv > 0).length,
  });

  let vannaSurfacePoints: VannaSurfacePoint[] = [];
  if (vannaSurfaceResult.ok) {
    const v = vannaSurfaceResult.data as VannaSurfaceRaw;
    if (!v.error && v.points?.length) {
      vannaSurfacePoints = v.points.map((p) => ({ strike: p.strike, dte: p.dte, vanna: p.vanna, isPut: p.is_put }));
    }
  }

  response.vannaEngine = computeVannaEngine({
    symbol,
    chain,
    perStrike,
    spot,
    r,
    q,
    dteHours,
    atmIv,
    forward,
    sviParams,
    vannaSurfacePoints,
    recentVolume5m,
    recentVolume15m,
    flowImbalance: dealerFlow?.imbalance ?? null,
    netGexSign: Math.sign(response.totalGex0dte),
    validContracts: chain.filter((row) => row.oi > 0 && row.iv > 0).length,
    invalidContracts: rawChain.filter((row) => !(row.oi > 0 && row.iv > 0)).length,
  });

  let charmSurfacePoints: CharmSurfacePoint[] = [];
  if (charmSurfaceResult.ok) {
    const c = charmSurfaceResult.data as CharmSurfaceRaw;
    if (!c.error && c.points?.length) {
      charmSurfacePoints = c.points.map((p) => ({ strike: p.strike, dte: p.dte, charm: p.charm, isPut: p.is_put }));
    }
  }

  response.charmEngine = computeCharmEngine({
    symbol,
    chain,
    perStrike,
    spot,
    r,
    q,
    dteHours,
    forward,
    sviParams,
    charmSurfacePoints,
    expectedMove1s: zeroDte?.expectedMove1s ?? null,
    recentVolume5m,
    recentVolume15m,
    flowImbalance: dealerFlow?.imbalance ?? null,
    netGexSign: Math.sign(response.totalGex0dte),
    validContracts: chain.filter((row) => row.oi > 0 && row.iv > 0).length,
    invalidContracts: rawChain.filter((row) => !(row.oi > 0 && row.iv > 0)).length,
  });

  let gexSurfacePoints: GexSurfacePoint[] = [];
  if (gexSurfaceResult.ok) {
    const g = gexSurfaceResult.data as GexSurfaceRaw;
    if (!g.error && g.points?.length) {
      gexSurfacePoints = g.points.map((p) => ({ strike: p.strike, dte: p.dte, gex: p.gex, isPut: p.is_put }));
    }
  }

  response.strikeExpiryHeatmaps = {
    gex: withSelfComputedNearestColumn(buildGexHeatmap(gexSurfacePoints), perStrike, "gex"),
    dex: fromZeroDteOnly(perStrike, "dex", `${dteHours < 24 ? "0DTE" : response.resolvedExpiry}`),
    vex: withSelfComputedNearestColumn(fromVannaHeatmap(response.vannaEngine?.heatmap ?? null), perStrike, "vex"),
    cex: withSelfComputedNearestColumn(fromCharmHeatmap(response.charmEngine?.heatmap ?? null), perStrike, "cex"),
    tex: withSelfComputedNearestColumn(fromThetaHeatmap(response.thetaEngine?.thetaHeatmap ?? null), perStrike, "tex"),
    vegaex: fromZeroDteOnly(perStrike, "vegaex", `${dteHours < 24 ? "0DTE" : response.resolvedExpiry}`),
  };

  response.topo = buildTopoProfile({
    gexPoints: gexSurfacePoints,
    charmHm: response.charmEngine?.heatmap ?? null,
    vannaHm: response.vannaEngine?.heatmap ?? null,
    thetaHm: response.thetaEngine?.thetaHeatmap ?? null,
    perStrike,
    spot,
  });

  response.hedgeCliff = computeHedgeCliffMap({
    chain,
    spot,
    r,
    q,
    dteHours,
    flowImbalance: dealerFlow?.imbalance ?? null,
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

  const targetData = result.data as GexResponse;

  cache.set(symbol, { data: targetData, expiresAt: Date.now() + CACHE_TTL_MS });
  return NextResponse.json(targetData);
}
