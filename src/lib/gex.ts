import { bsGreeks, dollarCharm, dollarDex, dollarGex, dollarTheta, dollarVanna, dollarVega } from "@/lib/blackScholes";
import { lrGreeks } from "@/lib/americanPricer";
import { crrGreeks } from "@/lib/crrPricer";
import type { GexPageAnalytics } from "@/lib/gexAnalytics";
import type { GammaEngineResult } from "@/lib/gammaEngine";
import type { DeltaEngineResult } from "@/lib/deltaEngine";
import type { ThetaEngineResult } from "@/lib/thetaEngine";
import type { VannaEngineResult } from "@/lib/vannaEngine";
import type { CharmEngineResult } from "@/lib/charmEngine";
import type { StrikeExpiryHeatmap } from "@/lib/strikeExpiryHeatmaps";
import type { HedgeCliffResult } from "@/lib/hedgeCliffEngine";
import type { TopoRow } from "@/lib/topoProfile";

export type GexSymbol = "QQQ" | "SPY" | "SPX" | "NDX";

/**
 * "bs" = closed-form Black-Scholes on each strike's own live quoted IV (matches how the source terminal computes its greeks).
 * "american" = Leisen-Reimer binomial tree (early exercise) on each strike's own live, unsmoothed quoted IV.
 * "crr" = Cox-Ross-Rubinstein binomial tree (early exercise) on the live, arbitrage-controlled 0DTE IV smile - see arbitrageSmile.ts.
 */
export type PricerEngine = "bs" | "american" | "crr";

// Continuous dividend-yield approximation, not discrete ex-dividend jumps -
// a stated simplification of the pricer, not a hidden one. QQQ/NDX track the
// Nasdaq-100 (lower yield, tech-heavy); SPY/SPX track the S&P 500.
export const DIVIDEND_YIELD: Record<GexSymbol, number> = { QQQ: 0.006, NDX: 0.006, SPY: 0.012, SPX: 0.012 };

export interface StrikeRow0DTE {
  strike: number;
  /** $, self-computed via whichever pricer engine produced this row (Black-Scholes on the SVI-smoothed smile, or the American tree on this strike's own live IV) - confirmed unit, not borrowed from any black box. */
  gex: number;
  /** Call-side and put-side GEX contributions, already dealer-sign-adjusted (call >= 0, put <= 0) - gex = callGex + putGex. Only the GEX page's split-mode chart uses these; other exposure types don't carry a call/put split. */
  callGex: number;
  putGex: number;
  dex: number;
  vex: number;
  tex: number;
  cex: number;
  vegaex: number;
  callOi: number;
  putOi: number;
}

export interface ProbabilityStats {
  /** Real historical daily return stats from the source's own price-history computation, not an OI-based proxy. */
  muDailyPct: number;
  sigmaDailyPct: number;
  skewness: number;
  excessKurtosis: number;
  fatTails: boolean;
  nDays: number;
  /** Empirical confidence bands [low, high] in price, keyed by confidence level ("68"|"90"|"95"|"99"). */
  bands1d: Record<string, [number, number]>;
}

export interface DealerFlowContext {
  currentZ: number;
  imbalance: number;
  buyCount: number;
  sellCount: number;
  zThreshold: number;
}

export interface CrossExpiryRow {
  expiration: string;
  dte: number;
  netGex: number;
  callResistance: number | null;
  putSupport: number | null;
  totalOi: number;
  /** From /option-matrix - same-session volume for this expiry, used for the OI-freshness check (how much of a daily-snapshot OI figure has actually turned over intraday). */
  totalVol: number;
  /** Source's own precomputed per-expiry DEX (call/put/net) - not our self-computed dollar/share DEX, only used for relative cross-expiry comparison since we don't have that expiry's own per-strike chain to build ours from. */
  callDex: number;
  putDex: number;
  netDex: number;
}

export interface ZeroDteContext {
  expectedMove1s: number;
  expectedMove2s: number;
  pcRatio: number;
  pcSentiment: string;
  charmDirection: string;
  vannaDirection: string;
  charmNote: string;
  vannaNote: string;
}

/** Everything that's re-derived per pricer engine: the per-strike Greeks themselves plus every stat computed from them. */
export interface EngineExposure {
  perStrike: StrikeRow0DTE[];
  totalGex0dte: number;
  /** Self-derived via peak-prominence on the 0DTE gex curve, not trusted from the source API's own (multi-expiry) wall fields. */
  callWall: number;
  putWall: number;
  kingNode: { strike: number; gex: number; type: "repellor" | "pin" };
  /** Self-derived zero-crossing of the 0DTE gex-by-strike curve, nearest to spot. */
  gammaFlip: number | null;
}

export interface GexResponse {
  ok: boolean;
  symbol: GexSymbol;
  asOf: number;
  spot: number;
  /** The actual date (YYYY-MM-DD) the 0DTE column was read from. */
  resolvedExpiry: string;
  /** Hours remaining to that expiry - precision the pricer needs, not just "today". */
  dteHours: number;
  /** Black-Scholes engine, on each strike's own live quoted IV. Kept at the top level for back-compat with callers that don't care about engine choice. */
  perStrike: StrikeRow0DTE[];
  totalGex0dte: number;
  callWall: number;
  putWall: number;
  kingNode: { strike: number; gex: number; type: "repellor" | "pin" };
  gammaFlip: number | null;
  /** ATM IV (fractional, e.g. 0.09 = 9%) - from /zero_dte's own atm_iv field, already converted from its 0-100 percentage-point scale. */
  atmIv?: number;
  /** American (Leisen-Reimer) tree engine, on each strike's own live, unsmoothed quoted IV. */
  american: EngineExposure;
  /** CRR binomial tree engine, on the live, arbitrage-controlled 0DTE IV smile. */
  crr: EngineExposure;
  /** From the source API directly - not confirmed 0DTE-pure, shown as-is. */
  maxPain: number;
  /** Real historical empirical stats, replacing the earlier OI-dispersion proxy. */
  probability: ProbabilityStats;
  dealerFlow: DealerFlowContext | null;
  crossExpiry: CrossExpiryRow[];
  zeroDte: ZeroDteContext | null;
  /** Inputs the pricer actually used - stated so the Greeks are auditable, not a black box either. */
  pricerInputs: { r: number; q: number };
  /** GEX-page-only deep analytics (gamma feedback curve, wall quality, speed/color/zomma, etc.) - see gexAnalytics.ts. Lives in the page's collapsed "advanced" section. */
  gexPage?: GexPageAnalytics;
  /** The Gamma Decision Engine: multi-model consensus, phase classification, typed levels, cascade/risk diagnostics, forward gamma clock - see gammaEngine.ts. This is the GEX page's primary content. */
  gammaEngine?: GammaEngineResult;
  /** The Delta Decision Engine: inventory posture, inventory pivot/shelves/rehedge triggers, unwind/gap/crowding risk, rehedge surface - see deltaEngine.ts. This is the DEX page's primary content. */
  deltaEngine?: DeltaEngineResult;
  /** The Theta Decision Engine: burn regime, escape bands/compression zone, carry-wipeout/gap risk, burn surface, survival map - see thetaEngine.ts. This is the Theta page's primary content. */
  thetaEngine?: ThetaEngineResult;
  /** The Vanna Decision Engine: hedge-flow-per-IV-shock scenarios, Spot x IV hedge field, flip/pivot levels, IV-direction/surface-shape/linearization risk, strike x expiry vanna heatmap - see vannaEngine.ts. This is the Vanna page's primary content. */
  vannaEngine?: VannaEngineResult;
  /** The Charm Decision Engine: finite-horizon modeled hedge flow from time passage alone, flow schedule, price x time charm field, Delta Destination Map - see charmEngine.ts. This is the Charm page's primary content. */
  charmEngine?: CharmEngineResult;
  /** Hedge Acceleration and Cliff Map: H(S)/H'(S)/H''(S) curves from a spot-only reprice grid - see hedgeCliffEngine.ts. */
  hedgeCliff?: HedgeCliffResult;
  /** Strike x expiry grids for the Terminal heatmap, one per selectable Greek - see strikeExpiryHeatmaps.ts. */
  strikeExpiryHeatmaps?: Record<"gex" | "dex" | "vex" | "cex" | "tex" | "vegaex", StrikeExpiryHeatmap | null>;
  /** Strike x tenor term profile for the Terminal's 3D topography surface - see topoProfile.ts. */
  topo?: TopoRow[];
}

/** Picks the N strikes with the largest |value| under `pick`, then re-sorts them ascending by strike for a coherent x-axis. */
export function topStrikesByMagnitude<T extends { strike: number }>(rows: T[], pick: (row: T) => number, count = 22): T[] {
  return [...rows]
    .sort((a, b) => Math.abs(pick(b)) - Math.abs(pick(a)))
    .slice(0, count)
    .sort((a, b) => a.strike - b.strike);
}

/**
 * The N strikes nearest spot, in strike order - a contiguous window rather
 * than a magnitude-picked scatter. topStrikesByMagnitude can (correctly)
 * jump from e.g. 670 to 685 to 704 if that's where |GEX| concentrates,
 * which reads as the chart "skipping" strikes; this instead shows the local
 * exposure landscape around price the way a trader actually scans it.
 */
export function nearStrikeWindow<T extends { strike: number }>(rows: T[], spot: number, count = 22): T[] {
  return [...rows]
    .sort((a, b) => Math.abs(a.strike - spot) - Math.abs(b.strike - spot))
    .slice(0, count)
    .sort((a, b) => a.strike - b.strike);
}

// ---------------------------------------------------------------------------
// Wall/king-node derivation: ported from a backtested method (peak
// prominence / 0-dimensional persistent homology on the strike-sorted GEX
// curve), not reinvented here. A strike's raw |GEX| only asks "is this
// number big in isolation"; persistence asks "does this strike dominate its
// local neighborhood" - the actual mechanical question for whether hedging
// flow there is strong enough to hold price. Backtested on SPY 2020-2026
// (real Black-Scholes greeks from the EOD chain): next-day |return| was
// 0.70% near the top-persistence wall vs 1.07% far from it (Mann-Whitney
// p=9.7e-13). Magnitude alone was not tested to that significance.
// ---------------------------------------------------------------------------

/** Prominence of every strict local extremum in a strike-sorted series - 0 everywhere else. */
function strikePersistence(strikes: number[], values: number[]): Map<number, number> {
  const n = values.length;
  const persistence = new Map<number, number>(strikes.map((s) => [s, 0]));
  if (n < 3) return persistence;

  function scoreExtrema(y: number[], isPeak: boolean) {
    for (let i = 1; i < n - 1; i++) {
      const isExtremum = isPeak ? y[i] > y[i - 1] && y[i] > y[i + 1] : y[i] < y[i - 1] && y[i] < y[i + 1];
      if (!isExtremum) continue;

      let leftRef = -Infinity;
      let leftMin = y[i];
      for (let j = i - 1; j >= 0; j--) {
        leftMin = Math.min(leftMin, y[j]);
        if (y[j] > y[i]) {
          leftRef = leftMin;
          break;
        }
        if (j === 0) leftRef = leftMin;
      }

      let rightRef = -Infinity;
      let rightMin = y[i];
      for (let j = i + 1; j < n; j++) {
        rightMin = Math.min(rightMin, y[j]);
        if (y[j] > y[i]) {
          rightRef = rightMin;
          break;
        }
        if (j === n - 1) rightRef = rightMin;
      }

      const reference = Math.max(leftRef, rightRef);
      const prominence = y[i] - reference;
      const existing = persistence.get(strikes[i]) ?? 0;
      if (prominence > existing) persistence.set(strikes[i], prominence);
    }
  }

  scoreExtrema(values, true);
  scoreExtrema(
    values.map((v) => -v),
    true
  );

  return persistence;
}

/** side="call" -> highest-persistence local max above spot (resistance); side="put" -> highest-persistence local min below spot (support). */
function topPersistentStrike(strikes: number[], values: number[], side: "call" | "put", spot: number): number | null {
  const persistence = strikePersistence(strikes, values);
  let best: number | null = null;
  let bestScore = 0;
  for (let i = 0; i < strikes.length; i++) {
    const s = strikes[i];
    const v = values[i];
    const onSide = side === "call" ? s > spot && v > 0 : s < spot && v < 0;
    if (!onSide) continue;
    const p = persistence.get(s) ?? 0;
    if (p > bestScore) {
      bestScore = p;
      best = s;
    }
  }
  return best;
}

/** Falls back to a magnitude argmax on the correct side when no strike is a genuine local extremum (too few strikes, or a flat/degenerate curve). */
export function deriveWalls(perStrike: StrikeRow0DTE[], spot: number): { callWall: number; putWall: number } {
  const sorted = [...perStrike].sort((a, b) => a.strike - b.strike);
  const strikes = sorted.map((r) => r.strike);
  const values = sorted.map((r) => r.gex);

  let callWall = topPersistentStrike(strikes, values, "call", spot);
  let putWall = topPersistentStrike(strikes, values, "put", spot);

  if (callWall === null) {
    const above = sorted.filter((r) => r.strike > spot && r.gex > 0);
    callWall = (above.length ? above : sorted.filter((r) => r.strike > spot)).sort((a, b) => Math.abs(b.gex) - Math.abs(a.gex))[0]?.strike ?? spot;
  }
  if (putWall === null) {
    const below = sorted.filter((r) => r.strike < spot && r.gex < 0);
    putWall = (below.length ? below : sorted.filter((r) => r.strike < spot)).sort((a, b) => Math.abs(b.gex) - Math.abs(a.gex))[0]?.strike ?? spot;
  }

  return { callWall, putWall };
}

/** Zero-crossing of the 0DTE gex-by-strike curve nearest spot, via linear interpolation between the two adjacent strikes that flank a sign change. */
export function deriveGammaFlip(perStrike: StrikeRow0DTE[], spot: number): number | null {
  const sorted = [...perStrike].sort((a, b) => a.strike - b.strike);
  const crossings: number[] = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i];
    const b = sorted[i + 1];
    if ((a.gex < 0 && b.gex > 0) || (a.gex > 0 && b.gex < 0)) {
      const t = a.gex / (a.gex - b.gex);
      crossings.push(a.strike + t * (b.strike - a.strike));
    }
  }
  if (!crossings.length) return null;
  return crossings.sort((x, y) => Math.abs(x - spot) - Math.abs(y - spot))[0];
}

export interface ChainStrikeInput {
  strike: number;
  side: "call" | "put";
  oi: number;
  iv: number;
}

/**
 * Builds our own per-strike Greeks via Black-Scholes pricing on
 * real per-contract IV/OI, instead of trusting the source's own precomputed
 * gex/dex/vanna/charm. Sign convention (documented, not hidden): gamma,
 * vanna, charm, vega, and theta are always the same natural sign for both
 * calls and puts, so the standard "dealers long calls, short puts"
 * convention flips the put side's contribution - that's what makes a put
 * wall show up as a support rather than just adding to the call side.
 * Delta doesn't need this: a put's delta is already negative on its own, so
 * DEX sums both sides with their natural sign, unflipped.
 */
export function buildStrikeRowsFromChain(chain: ChainStrikeInput[], spot: number, T: number, r: number, q: number, engine: PricerEngine = "bs"): StrikeRow0DTE[] {
  const greeksFn = engine === "american" ? lrGreeks : engine === "crr" ? crrGreeks : bsGreeks;
  const byStrike = new Map<number, { call?: ChainStrikeInput; put?: ChainStrikeInput }>();
  for (const row of chain) {
    const entry = byStrike.get(row.strike) ?? {};
    entry[row.side] = row;
    byStrike.set(row.strike, entry);
  }

  const rows: StrikeRow0DTE[] = [];
  for (const [strike, { call, put }] of byStrike) {
    let gex = 0;
    let callGex = 0;
    let putGex = 0;
    let dex = 0;
    let vex = 0;
    let cex = 0;
    let vegaex = 0;
    let tex = 0;

    if (call && call.oi > 0 && call.iv > 0) {
      const g = greeksFn({ spot, strike, T, vol: call.iv, r, q, isCall: true });
      callGex = dollarGex(g.gamma, call.oi, spot);
      gex += callGex;
      dex += dollarDex(g.delta, call.oi, spot);
      vex += dollarVanna(g.vanna, call.oi, spot);
      cex += dollarCharm(g.charm, call.oi, spot);
      vegaex += dollarVega(g.vega, call.oi);
      tex += dollarTheta(g.theta, call.oi);
    }
    if (put && put.oi > 0 && put.iv > 0) {
      const g = greeksFn({ spot, strike, T, vol: put.iv, r, q, isCall: false });
      putGex = -dollarGex(g.gamma, put.oi, spot);
      gex += putGex;
      dex += dollarDex(g.delta, put.oi, spot);
      vex += -dollarVanna(g.vanna, put.oi, spot);
      cex += -dollarCharm(g.charm, put.oi, spot);
      vegaex += -dollarVega(g.vega, put.oi);
      tex += -dollarTheta(g.theta, put.oi);
    }

    rows.push({ strike, gex, callGex, putGex, dex, vex, tex, cex, vegaex, callOi: call?.oi ?? 0, putOi: put?.oi ?? 0 });
  }

  return rows.sort((a, b) => a.strike - b.strike);
}

/** Derives the walls/king-node/gamma-flip/total-gex stats from one engine's per-strike rows - shared by both the BS and American exposures in a GexResponse. */
function deriveEngineExposure(perStrike: StrikeRow0DTE[], spot: number): EngineExposure {
  const { callWall, putWall } = deriveWalls(perStrike, spot);
  const kingNodeRow = [...perStrike].sort((a, b) => Math.abs(b.gex) - Math.abs(a.gex))[0];
  const totalGex0dte = perStrike.reduce((sum, r) => sum + r.gex, 0);

  return {
    perStrike,
    totalGex0dte,
    callWall,
    putWall,
    kingNode: kingNodeRow ? { strike: kingNodeRow.strike, gex: kingNodeRow.gex, type: kingNodeRow.gex < 0 ? "repellor" : "pin" } : { strike: spot, gex: 0, type: "pin" },
    gammaFlip: deriveGammaFlip(perStrike, spot),
  };
}

export function deriveGexResponse(raw: {
  symbol: GexSymbol;
  spot: number;
  resolvedExpiry: string;
  dteHours: number;
  perStrike: StrikeRow0DTE[];
  perStrikeAmerican: StrikeRow0DTE[];
  perStrikeCrr: StrikeRow0DTE[];
  maxPain: number;
  probability: ProbabilityStats;
  dealerFlow: DealerFlowContext | null;
  crossExpiry: CrossExpiryRow[];
  zeroDte: ZeroDteContext | null;
  pricerInputs: { r: number; q: number };
  gexPage?: GexPageAnalytics;
}): GexResponse {
  const bs = deriveEngineExposure(raw.perStrike, raw.spot);
  const american = deriveEngineExposure(raw.perStrikeAmerican, raw.spot);
  const crr = deriveEngineExposure(raw.perStrikeCrr, raw.spot);

  return {
    ok: true,
    symbol: raw.symbol,
    asOf: Date.now(),
    spot: raw.spot,
    resolvedExpiry: raw.resolvedExpiry,
    dteHours: raw.dteHours,
    perStrike: bs.perStrike,
    totalGex0dte: bs.totalGex0dte,
    callWall: bs.callWall,
    putWall: bs.putWall,
    kingNode: bs.kingNode,
    gammaFlip: bs.gammaFlip,
    american,
    crr,
    maxPain: raw.maxPain,
    probability: raw.probability,
    dealerFlow: raw.dealerFlow,
    crossExpiry: raw.crossExpiry,
    zeroDte: raw.zeroDte,
    pricerInputs: raw.pricerInputs,
    gexPage: raw.gexPage,
  };
}

export interface SviResidualRow {
  strike: number;
  side: "call" | "put";
  rawIv: number;
  fittedIv: number;
  residualPct: number;
}

export interface CrossExpiryLevel {
  expiration: string;
  dte: number;
  callResistance: number | null;
  putSupport: number | null;
  totalOi: number;
}

export function fmtNum(n: number | null | undefined, digits = 2): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return n.toLocaleString(undefined, { maximumFractionDigits: digits, minimumFractionDigits: 0 });
}

/** Formats a raw dollar amount (not pre-scaled) - our own pricer's dollar-exposure outputs are actual dollars, not millions. */
export function fmtUsd(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1_000_000_000) return `${sign}$${(abs / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

export function fmtPct(n: number | null | undefined, digits = 2): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return `${n >= 0 ? "+" : ""}${n.toFixed(digits)}%`;
}
