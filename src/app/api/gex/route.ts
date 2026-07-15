import { after, NextResponse, type NextRequest } from "next/server";
import {
  buildStrikeRowsFromChain,
  deriveGexResponse,
  DIVIDEND_YIELD,
  type ChainStrikeInput,
  type CrossExpiryRow,
  type DealerFlowContext,
  type GexResponse,
  type GexSymbol,
  type IvSmilePoint,
  type ProbabilityStats,
  type ZeroDteContext,
} from "@/lib/gex";
import { fitSvi, sviImpliedVol, type SviPoint } from "@/lib/svi";
import { computeGexPageAnalytics } from "@/lib/gexAnalytics";
import { computeGammaEngine, computeIvSurfaceFitError } from "@/lib/gammaEngine";
import { computeDeltaEngine } from "@/lib/deltaEngine";
import { computeThetaEngine, parseThetaHeatmap } from "@/lib/thetaEngine";
import { computeVannaEngine, type VannaSurfacePoint } from "@/lib/vannaEngine";
import { computeCharmEngine, type CharmSurfacePoint } from "@/lib/charmEngine";
import { fromHeatmapEndpoint, type HeatmapEndpointRaw, type HeatmapMetric } from "@/lib/strikeExpiryHeatmaps";
import { computeEffectiveGex } from "@/lib/effectiveGexEngine";
import { buildTopoProfile } from "@/lib/topoProfile";

// The source API silently falls back to SPX's own data for any ticker it
// doesn't actually carry (confirmed directly: IWM/DIA/NVDA/AAPL/MSFT/TSLA/
// META/GOOGL/AMZN all returned SPX's exact spot/strikes under their own
// name, no error). Only these four gave genuinely distinct spot prices.
const ALLOWED_SYMBOLS = new Set<GexSymbol>(["QQQ", "SPY", "SPX", "NDX"]);

// Upstream latency, measured directly against each endpoint: /zero_dte ~1.5s,
// /gex ~2.9s, /dealer_anomalies ~0.3s, /probability ~9.6s, /option-matrix
// ~14.3s - the last two are genuinely slow server-side computations, not
// something a shorter client-side cache or fewer tree steps fixes.
//
// The response is therefore TIERED: "core" is everything computable from
// /zero_dte + /gex alone (~3-4s upstream: live spot, per-strike Greeks on
// live quoted IVs, walls, IV smile, effective GEX) and "full" adds the slow
// endpoints and the decision engines built on them. The page renders on
// core immediately and hydrates with full when it lands; polling the core
// tier is what keeps spot/Greeks live between full refreshes.
type Tier = "core" | "full";
const CORE_TTL_MS = 5_000;
const FULL_TTL_MS = 30_000;
// Serve an expired-but-recent copy instantly and revalidate after the
// response is sent (stale-while-revalidate) - but never one this old:
// pre-open leftovers from the prior session shouldn't render as "data".
const MAX_STALE_MS = 10 * 60_000;
const cache = new Map<string, { data: GexResponse; fetchedAt: number }>();
const inflight = new Map<string, Promise<{ ok: boolean; status: number; data: GexResponse | null }>>();

function tierTtl(tier: Tier) {
  return tier === "core" ? CORE_TTL_MS : FULL_TTL_MS;
}

function cacheKeyFor(symbol: GexSymbol, tier: Tier, movePctOverride?: number) {
  return `${symbol}:${tier}${movePctOverride !== undefined ? `:${movePctOverride}` : ""}`;
}

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

// Placeholder for the core tier - real historical stats only ship with the
// full tier (/probability is one of the slow endpoints core exists to skip).
const EMPTY_PROBABILITY: ProbabilityStats = { muDailyPct: 0, sigmaDailyPct: 0, skewness: 0, excessKurtosis: 0, fatTails: false, nDays: 0, bands1d: {} };

interface CoreBuild {
  response: GexResponse;
  rawChain: ChainStrikeInput[];
  chain: ChainStrikeInput[];
  sviParams: ReturnType<typeof fitSvi>;
  forward: number;
  T: number;
  spot: number;
  perStrike: ReturnType<typeof buildStrikeRowsFromChain>;
  atmIv: number;
  dteHours: number;
  zeroDte: ZeroDteContext | null;
  q: number;
}

/** Everything derivable from the /zero_dte chain alone: self-computed per-strike Greeks on live quoted IVs, walls, IV smile, effective GEX. Shared by both tiers so the numbers can never disagree between them. */
function assembleCore(symbol: GexSymbol, zeroDteRaw: ZeroDteRaw, maxPain: number, r: number, movePctOverride?: number): CoreBuild | null {
  if (zeroDteRaw.error || !zeroDteRaw.spot || !zeroDteRaw.strike_data?.length) return null;

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

  const perStrike = buildStrikeRowsFromChain(rawChain, spot, T, r, q);

  const ivSmileByStrike = new Map<number, { call?: number; put?: number }>();
  for (const row of rawChain) {
    if (row.oi <= 0 || row.iv <= 0) continue;
    const entry = ivSmileByStrike.get(row.strike) ?? {};
    entry[row.side] = row.iv;
    ivSmileByStrike.set(row.strike, entry);
  }
  const ivSmile: IvSmilePoint[] = [...ivSmileByStrike.entries()]
    .map(([strike, { call, put }]) => ({
      strike,
      callIv: call ?? null,
      putIv: put ?? null,
      fittedIv: sviImpliedVol(sviParams, strike, forward, T),
    }))
    .sort((a, b) => a.strike - b.strike);

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

  // Source's atm_iv is on a 0-100 percentage-point scale (e.g. 28.3), not
  // the fractional scale (0.283) every per-contract iv/vol figure in this
  // app uses - confirmed directly against the same /zero_dte payload's own
  // strike_data ivs, which ARE fractional. Divide by 100 before it reaches
  // any vol-as-decimal function (touch probability, etc).
  const atmIv = (zeroDteRaw.atm_iv ?? 20) / 100;

  const response = deriveGexResponse({
    symbol,
    spot,
    resolvedExpiry: zeroDteRaw.expiry ?? "",
    dteHours,
    perStrike,
    maxPain,
    probability: EMPTY_PROBABILITY,
    dealerFlow: null,
    crossExpiry: [],
    zeroDte,
    pricerInputs: { r, q },
  });

  response.atmIv = atmIv;
  response.ivSmile = ivSmile;

  // Scenario move defaults to spanning the same +/-15 strikes shown on the
  // Chart/Heatmap (not a fixed 1%) - a tiny move barely reaches past the
  // first few visible strikes, so most of the displayed window would look
  // identical to the static snapshot. Uses this expiry's own strike
  // spacing (median gap between consecutive strikes) x 15, unless the
  // caller passed an explicit override (the Chart's own %-move input).
  const sortedStrikes = [...new Set(perStrike.map((r2) => r2.strike))].sort((a, b) => a - b);
  const strikeGaps = sortedStrikes.slice(1).map((s, i) => s - sortedStrikes[i]).filter((g) => g > 0).sort((a, b) => a - b);
  const strikeInterval = strikeGaps.length ? strikeGaps[Math.floor(strikeGaps.length / 2)] : 1;
  const autoMovePct = Math.min(0.5, (strikeInterval * 15) / spot);
  const scenarioMovePct = movePctOverride !== undefined && movePctOverride > 0 ? Math.min(0.5, movePctOverride / 100) : autoMovePct;

  response.effectiveGex = computeEffectiveGex({
    chain,
    perStrike,
    spot,
    T,
    r,
    q,
    sviParams,
    forward,
    moveUpPct: scenarioMovePct,
    moveDownPct: scenarioMovePct,
  });

  return { response, rawChain, chain, sviParams, forward, T, spot, perStrike, atmIv, dteHours, zeroDte, q };
}

/** The fast tier: /zero_dte + /gex only (~3-4s upstream vs ~15-20s for the full pipeline). Live spot and self-computed per-strike Greeks - what the page polls to stay live. */
async function buildCoreResponse(symbol: GexSymbol, base: string, key: string, movePctOverride?: number): Promise<{ ok: boolean; status: number; data: GexResponse | null }> {
  const [zeroDteResult, gexResult, r] = await Promise.all([
    fetchYyy(`/zero_dte?ticker=${symbol}`, base, key),
    fetchYyy(`/gex?ticker=${symbol}`, base, key),
    fetchRiskFreeRate(),
  ]);

  if (!zeroDteResult.ok) return { ok: false, status: zeroDteResult.status, data: null };

  let maxPain = 0;
  if (gexResult.ok) {
    const g = gexResult.data as GexAggRaw;
    if (!g.error) maxPain = g.max_pain ?? 0;
  }

  const core = assembleCore(symbol, zeroDteResult.data as ZeroDteRaw, maxPain, r, movePctOverride);
  if (!core) return { ok: false, status: 502, data: null };
  return { ok: true, status: 200, data: core.response };
}

/** Fetches the railway endpoints we actually need, builds our own per-strike Greeks (Black-Scholes + American tree, both on real IV) instead of trusting the source's precomputed ones. */
async function buildZeroDteResponse(symbol: GexSymbol, base: string, key: string, movePctOverride?: number): Promise<{ ok: boolean; status: number; data: GexResponse | null }> {
  const [zeroDteResult, probabilityResult, matrixResult, anomaliesResult, gexResult, chartResult, thetaResult, vannaSurfaceResult, charmSurfaceResult, heatmapResult, r] = await Promise.all([
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
    // Dedicated per-strike x per-expiry heatmap for all six Greeks in one
    // call - real per-expiry granularity (0DTE through ~8 DTE, including
    // dates /gex_surface's own dte set skips) instead of the older per-Greek
    // surface endpoints, which disagreed with each other and with the
    // source's own dashboard. See strikeExpiryHeatmaps.ts. Now the sole
    // source for the Chart/Heatmap/Cross-Expiry/Topo sections - a longer
    // budget than the old 12s cuts down on empty views from a slow request.
    fetchYyyWithTimeout(`/heatmap?ticker=${symbol}`, base, key, 18000),
    fetchRiskFreeRate(),
  ]);

  if (!zeroDteResult.ok || !probabilityResult.ok) {
    return { ok: false, status: Math.max(zeroDteResult.status, probabilityResult.status), data: null };
  }

  const zeroDteRaw = zeroDteResult.data as ZeroDteRaw;
  const probabilityRaw = probabilityResult.data as ProbabilityRaw;

  let maxPain = 0;
  if (gexResult.ok) {
    const g = gexResult.data as GexAggRaw;
    if (!g.error) maxPain = g.max_pain ?? 0;
  }

  const core = assembleCore(symbol, zeroDteRaw, maxPain, r, movePctOverride);
  if (!core || probabilityRaw.error) {
    return { ok: false, status: 502, data: null };
  }
  const { response, rawChain, chain, sviParams, forward, T, spot, perStrike, atmIv, dteHours, zeroDte, q } = core;

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

  // assembleCore built the response with core-tier stubs for these - the
  // slow-endpoint data replaces them now that it's actually here.
  response.probability = probability;
  response.dealerFlow = dealerFlow;
  response.crossExpiry = crossExpiry;

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

  // /heatmap now backs almost the entire Terminal page (Chart/Heatmap/
  // Topo/Cross-Expiry all read from it) - it's also the one endpoint that's
  // intermittently timed out under its original budget, confirmed directly
  // (same symbol, back-to-back requests, one clean 200 then one timeout).
  // A single retry here costs one extra round trip only on that failure
  // path, instead of leaving the whole page's walls/charts empty for this
  // request and the next 30s of cache.
  let finalHeatmapResult = heatmapResult;
  if (!finalHeatmapResult.ok) {
    finalHeatmapResult = await fetchYyyWithTimeout(`/heatmap?ticker=${symbol}`, base, key, 18000);
  }
  const heatmapRaw = finalHeatmapResult.ok ? (finalHeatmapResult.data as HeatmapEndpointRaw) : null;
  const metrics: HeatmapMetric[] = ["gex", "dex", "vex", "cex", "tex", "vegaex"];
  const heatmapGrids = Object.fromEntries(metrics.map((m) => [m, fromHeatmapEndpoint(heatmapRaw, m)])) as Record<HeatmapMetric, ReturnType<typeof fromHeatmapEndpoint>>;

  response.strikeExpiryHeatmaps = heatmapGrids;
  response.topo = buildTopoProfile(heatmapGrids, spot);

  return { ok: true, status: 200, data: response };
}

/** Builds the requested tier, deduped per cacheKey so concurrent requests share one upstream trip, and writes the result into the cache. */
async function refreshCache(tier: Tier, symbol: GexSymbol, base: string, key: string, movePctOverride: number | undefined, cacheKey: string) {
  const existing = inflight.get(cacheKey);
  if (existing) return existing;

  const promise = (tier === "core" ? buildCoreResponse(symbol, base, key, movePctOverride) : buildZeroDteResponse(symbol, base, key, movePctOverride)).then((result) => {
    if (result.ok && result.data) cache.set(cacheKey, { data: result.data, fetchedAt: Date.now() });
    return result;
  });
  inflight.set(cacheKey, promise);
  try {
    return await promise;
  } finally {
    inflight.delete(cacheKey);
  }
}

export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get("symbol")?.toUpperCase() as GexSymbol | undefined;
  if (!symbol || !ALLOWED_SYMBOLS.has(symbol)) {
    return NextResponse.json({ ok: false, error: "unsupported_symbol" }, { status: 400 });
  }

  // tier=core -> the fast /zero_dte-only build; anything else keeps the
  // original full pipeline, so existing callers are unaffected.
  const tier: Tier = request.nextUrl.searchParams.get("tier") === "core" ? "core" : "full";

  // Optional override for the Effective GEX/Shadow Gamma scenario move size
  // (percent, e.g. "2.5") - the Chart's own %-move input. Absent or invalid
  // falls back to the auto-computed +/-15-strike default.
  const movePctRaw = request.nextUrl.searchParams.get("movePct");
  const movePctOverride = movePctRaw !== null && Number.isFinite(Number(movePctRaw)) ? Number(movePctRaw) : undefined;
  const cacheKey = cacheKeyFor(symbol, tier, movePctOverride);

  const base = process.env.YYY_API_BASE;
  const key = process.env.YYY_API_KEY;
  if (!base || !key) {
    return NextResponse.json({ ok: false, error: "gex_api_not_configured" }, { status: 500 });
  }

  const now = Date.now();
  const cached = cache.get(cacheKey);
  if (cached && now - cached.fetchedAt < tierTtl(tier)) {
    return NextResponse.json(cached.data);
  }

  // A fresh FULL response is a strict superset of core (same assembleCore
  // numbers) - serve it instead of paying another upstream round trip.
  if (tier === "core") {
    const fullCached = cache.get(cacheKeyFor(symbol, "full", movePctOverride));
    if (fullCached && now - fullCached.fetchedAt < FULL_TTL_MS) {
      return NextResponse.json(fullCached.data);
    }
  }

  // Stale-while-revalidate: an expired-but-recent copy renders instantly;
  // the refetch runs after this response is sent and warms the cache for
  // the next poll. Bounded by MAX_STALE_MS so genuinely old data blocks.
  if (cached && now - cached.fetchedAt < MAX_STALE_MS) {
    after(() => refreshCache(tier, symbol, base, key, movePctOverride, cacheKey).catch(() => {}));
    return NextResponse.json(cached.data);
  }

  const result = await refreshCache(tier, symbol, base, key, movePctOverride, cacheKey);

  if (!result.ok || !result.data) {
    if (cached) return NextResponse.json(cached.data);
    return NextResponse.json({ ok: false, error: "upstream_error", status: result.status }, { status: 502 });
  }

  return NextResponse.json(result.data);
}
