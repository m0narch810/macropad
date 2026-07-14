/**
 * OpFlo Rest-of-RTH Bias engine.
 *
 * Central question: from right now until the 4:00pm close, is the current
 * options structure more likely to create modeled underlying buying,
 * selling, stabilization, or amplification? Not the next 15-30 minutes -
 * the full remaining session. For a same-day 0DTE contract the contract's
 * own remaining time (dteHours) already IS the remaining time to close, so
 * "horizon" here is just totalMinutesToExpiry, reused the same way every
 * other engine in this app treats it - no separate wall-clock/timezone
 * logic needed.
 *
 * Required disclosure (spec section 20): this is a positioning-based
 * estimate of cumulative model-implied underlying hedging pressure from
 * now through the close, built from the current options structure. It is
 * NOT confirmed institutional buying, confirmed dealer orders, smart-money
 * flow, a guaranteed direction, or a complete observed options-flow feed.
 *
 * Design choice that matters: since Black-Scholes hedge (delta-implied
 * underlying position) is a function of state (spot, vol, time-to-expiry),
 * not of the path taken to get there, a scenario path's TOTAL remaining
 * flow only depends on where that path assumes spot/IV land BY the close -
 * hedgeAt(endState) - hedgeAt(now). No 5-minute-by-5-minute simulation
 * loop is needed for the total. A monotonic interpolation from now to each
 * path's assumed end state is used only to produce the interval breakdown
 * (peak window, stability checkpoints) - it is a smoothing device for
 * those secondary outputs, not a price prediction.
 *
 * Compressions vs. the full spec (documented, matching every other engine
 * in this app):
 *  - 9 representative paths (bullish weak/normal/strong, bearish weak/
 *    normal/strong, range, mean-reversion, shock), not a full continuous
 *    scenario distribution.
 *  - Path weights come from a real but simple heuristic (recent-candle
 *    momentum + dealer-flow imbalance + distance to the expected-move
 *    bands), not a fitted probability model - never shown to the user as
 *    false-precision percentages.
 *  - Cross-expiry bias for the next-dominant and weekly expirations uses
 *    the source's own /option-matrix netGex/netDex sign as a directional
 *    proxy (same limitation as every other engine's cross-expiry section
 *    in this app) - full repricing is only possible for the 0DTE chain
 *    this app actually holds.
 *  - Bias Flip is solved under sticky-strike (frozen IV) and, when an SVI
 *    fit is supplied, sticky-moneyness - not the full sticky-delta /
 *    directional-skew / dealer-position cross product the spec describes.
 */

import { bsPrice } from "@/lib/blackScholes";
import { sviImpliedVol, type SviParams } from "@/lib/svi";
import type { ChainStrikeInput, CrossExpiryRow, DealerFlowContext } from "@/lib/gex";

const MULTIPLIER = 100;
const YEAR_MINUTES = 60 * 24 * 365;

function toYears(minutes: number): number {
  return minutes / YEAR_MINUTES;
}

// ---------------------------------------------------------------------------
// Core primitive: cumulative hedge change vs. now at a hypothetical future
// (price, remaining-minutes, skew-aware IV shift) state.
// ---------------------------------------------------------------------------

function bsDeltaAt(spot: number, strike: number, T: number, vol: number, r: number, q: number, isCall: boolean): number {
  if (T <= 0 || vol <= 0) {
    if (isCall) return spot > strike ? 1 : 0;
    return spot < strike ? -1 : 0;
  }
  const h = spot * 0.005;
  const up = bsPrice({ spot: spot + h, strike, T, vol, r, q, isCall });
  const down = bsPrice({ spot: spot - h, strike, T, vol, r, q, isCall });
  return (up - down) / (2 * h);
}

/** Full-reprice cumulative hedge change (shares) from now to a hypothetical (evalSpot, evalMinutesRemaining, ivShiftFn) state. ivShiftFn(k) takes log-moneyness k = ln(strike/evalSpot) and returns an additional vol shift - a parallel term plus a skew-slope term reproduces "IV compresses and skew flattens" style directional surface moves instead of only flat parallel shocks. */
function hedgeAt(
  chain: ChainStrikeInput[],
  spot: number,
  T: number,
  r: number,
  q: number,
  evalSpot: number,
  evalMinutesRemaining: number,
  ivShiftFn: (k: number) => number,
  callWeight: number,
  putWeight: number
): number {
  const evalT = Math.max(1e-8, toYears(evalMinutesRemaining));
  let netDelta = 0;
  for (const row of chain) {
    if (row.oi <= 0 || row.iv <= 0) continue;
    const delta0 = bsDeltaAt(spot, row.strike, T, row.iv, r, q, row.side === "call");
    const k = Math.log(row.strike / evalSpot);
    const deltaFuture = bsDeltaAt(evalSpot, row.strike, evalT, Math.max(1e-4, row.iv + ivShiftFn(k)), r, q, row.side === "call");
    const weight = row.side === "call" ? callWeight : putWeight;
    netDelta += weight * row.oi * MULTIPLIER * (deltaFuture - delta0);
  }
  return -netDelta;
}

function surfaceHedgeAt(
  chain: ChainStrikeInput[],
  spot: number,
  T: number,
  r: number,
  q: number,
  evalSpot: number,
  evalMinutesRemaining: number,
  ivShiftFn: (k: number) => number,
  sviParams: SviParams,
  forward: number,
  callWeight: number,
  putWeight: number
): number {
  const evalT = Math.max(1e-8, toYears(evalMinutesRemaining));
  let netDelta = 0;
  for (const row of chain) {
    if (row.oi <= 0 || row.iv <= 0) continue;
    const vol0 = sviImpliedVol(sviParams, row.strike, forward, T);
    const delta0 = bsDeltaAt(spot, row.strike, T, vol0, r, q, row.side === "call");
    const k = Math.log(row.strike / evalSpot);
    const volFuture = sviImpliedVol(sviParams, row.strike * (spot / evalSpot), forward, evalT) + ivShiftFn(k);
    const deltaFuture = bsDeltaAt(evalSpot, row.strike, evalT, Math.max(1e-4, volFuture), r, q, row.side === "call");
    const weight = row.side === "call" ? callWeight : putWeight;
    netDelta += weight * row.oi * MULTIPLIER * (deltaFuture - delta0);
  }
  return -netDelta;
}

// ---------------------------------------------------------------------------
// Dealer-sign scenarios (mirrors every other engine)
// ---------------------------------------------------------------------------

interface DealerSignDef {
  name: string;
  callWeight: number;
  putWeight: number;
}

function dealerSignScenarios(flowImbalance: number | null, netGexSign: number): DealerSignDef[] {
  const imb = Number.isFinite(flowImbalance) ? Math.max(-1, Math.min(1, flowImbalance as number)) : 0;
  const gexBias = Math.max(-0.3, Math.min(0.3, netGexSign * 0.3));
  return [
    { name: "conventional", callWeight: 1, putWeight: 1 },
    { name: "reduced", callWeight: 0.5, putWeight: 0.5 },
    { name: "call_heavy", callWeight: 1.5, putWeight: 0.5 },
    { name: "put_heavy", callWeight: 0.5, putWeight: 1.5 },
    { name: "dealer_flow_constrained", callWeight: 1 + imb * 0.5, putWeight: 1 - imb * 0.5 },
    { name: "conservative_hedge_ratio", callWeight: 1 + gexBias, putWeight: 1 - gexBias },
  ];
}

// ---------------------------------------------------------------------------
// Section 6: rest-of-RTH paths
// ---------------------------------------------------------------------------

interface PathDef {
  name: string;
  endMovePct: number;
  ivParallel: number;
  skewSlope: number;
  baseWeight: number;
}

function definePaths(em: number, spot: number): PathDef[] {
  const emPct = em > 0 ? em / spot : 0.01;
  return [
    { name: "bull_weak", endMovePct: emPct * 0.35, ivParallel: -0.003, skewSlope: 0.01, baseWeight: 0.12 },
    { name: "bull_normal", endMovePct: emPct * 0.8, ivParallel: -0.007, skewSlope: 0.015, baseWeight: 0.1 },
    { name: "bull_strong", endMovePct: emPct * 1.4, ivParallel: -0.012, skewSlope: 0.02, baseWeight: 0.06 },
    { name: "bear_weak", endMovePct: -emPct * 0.35, ivParallel: 0.004, skewSlope: -0.012, baseWeight: 0.12 },
    { name: "bear_normal", endMovePct: -emPct * 0.8, ivParallel: 0.009, skewSlope: -0.018, baseWeight: 0.1 },
    { name: "bear_strong", endMovePct: -emPct * 1.4, ivParallel: 0.016, skewSlope: -0.025, baseWeight: 0.06 },
    { name: "range", endMovePct: 0, ivParallel: -0.003, skewSlope: 0, baseWeight: 0.2 },
    { name: "mean_reversion", endMovePct: emPct * 0.05, ivParallel: -0.001, skewSlope: 0.002, baseWeight: 0.14 },
    { name: "shock", endMovePct: emPct * -1.8, ivParallel: 0.03, skewSlope: -0.035, baseWeight: 0.1 },
  ];
}

/** Real (not fabricated) but simple momentum + dealer-flow lean, clipped to [-1,1] - only ever used to re-weight the fixed path set, never shown to the user as a percentage. */
function computeLean(recentCloses: number[], flowImbalance: number | null): number {
  const momentum = recentCloses.length >= 2 ? Math.max(-1, Math.min(1, ((recentCloses[recentCloses.length - 1] - recentCloses[0]) / recentCloses[0]) * 40)) : 0;
  const imb = Number.isFinite(flowImbalance) ? Math.max(-1, Math.min(1, flowImbalance as number)) : 0;
  return Math.max(-1, Math.min(1, momentum * 0.6 + imb * 0.4));
}

function weightPaths(paths: PathDef[], lean: number): (PathDef & { weight: number })[] {
  const adjusted = paths.map((p) => {
    const directional = p.name.startsWith("bull") ? 1 : p.name.startsWith("bear") ? -1 : 0;
    const leanBoost = directional !== 0 ? 1 + Math.max(-0.6, Math.min(0.6, directional * lean)) : 1;
    return { ...p, weight: Math.max(0.01, p.baseWeight * leanBoost) };
  });
  const total = adjusted.reduce((s, p) => s + p.weight, 0) || 1;
  return adjusted.map((p) => ({ ...p, weight: p.weight / total }));
}

// ---------------------------------------------------------------------------
// Section 10-11: bias score + confidence
// ---------------------------------------------------------------------------

export type BiasDirection = "strong_bullish" | "bullish" | "neutral" | "bearish" | "strong_bearish";
export type BiasMode = "supportive" | "reflexive" | "mean_reverting" | "conflicted";

function classifyDirection(score: number): BiasDirection {
  if (score >= 60) return "strong_bullish";
  if (score >= 20) return "bullish";
  if (score <= -60) return "strong_bearish";
  if (score <= -20) return "bearish";
  return "neutral";
}

function classifyMode(score: number, bullPathFlow: number, bearPathFlow: number, rangeFlow: number, signAgreementPct: number): BiasMode {
  if (Math.abs(score) < 15 && signAgreementPct < 60) return "conflicted";
  if (score > 0) {
    if (bearPathFlow > 0) return "supportive";
    if (bullPathFlow > rangeFlow) return "reflexive";
    return Math.abs(score) < 20 ? "mean_reverting" : "supportive";
  }
  if (score < 0) {
    if (bullPathFlow < 0) return "supportive";
    if (bearPathFlow < rangeFlow) return "reflexive";
    return Math.abs(score) < 20 ? "mean_reverting" : "supportive";
  }
  return "mean_reverting";
}

// ---------------------------------------------------------------------------
// Assembly
// ---------------------------------------------------------------------------

export interface StabilityCheckpoint {
  minutesFromNow: number;
  score: number;
}

export interface PeakWindow {
  startMinutesFromNow: number;
  endMinutesFromNow: number;
  direction: "buying" | "selling";
}

export type CrossExpiryBiasClass = "reinforcing" | "same_day_conflict" | "structural_support" | "intraday_dominant" | "insufficient_data";

export interface OpFloBiasResult {
  direction: BiasDirection;
  score: number;
  mode: BiasMode;
  horizonMinutes: number;
  remainingFlowShares: number;
  remainingImpactRatioPct: number | null;
  finalHourImpactRatioPct: number | null;
  biasFlipLow: number | null;
  biasFlipHigh: number | null;
  stability: "high" | "moderate" | "low";
  weakensAfterMinutes: number | null;
  peakWindow: PeakWindow | null;
  crossExpiry: {
    zeroDteScore: number;
    nextExpiryScore: number | null;
    weeklyScore: number | null;
    fullBookScore: number;
    classification: CrossExpiryBiasClass;
  };
  diagnostics: {
    disclosure: string;
    pricingModel: string;
    horizonSource: string;
    lastCalculatedAt: number;
  };
}

function biasAt(
  chain: ChainStrikeInput[],
  spot: number,
  T: number,
  r: number,
  q: number,
  evalSpot: number,
  minutesRemaining: number,
  paths: (PathDef & { weight: number })[],
  callWeight: number,
  putWeight: number
): { score: number; flows: { path: PathDef & { weight: number }; flow: number }[]; bullishPressure: number; bearishPressure: number } {
  const flows = paths.map((p) => {
    const endSpot = evalSpot * (1 + p.endMovePct);
    const flow = hedgeAt(chain, spot, T, r, q, endSpot, minutesRemaining, (k) => p.ivParallel + p.skewSlope * -k, callWeight, putWeight);
    return { path: p, flow };
  });
  const bullishPressure = flows.reduce((s, f) => s + f.path.weight * Math.max(0, f.flow), 0);
  const bearishPressure = flows.reduce((s, f) => s + f.path.weight * Math.max(0, -f.flow), 0);
  const rawBias = ((bullishPressure - bearishPressure) / (bullishPressure + bearishPressure + 1e-6)) * 100;
  return { score: Math.max(-100, Math.min(100, rawBias)), flows, bullishPressure, bearishPressure };
}

function findBiasFlip(
  chain: ChainStrikeInput[],
  spot: number,
  T: number,
  r: number,
  q: number,
  minutesRemaining: number,
  paths: (PathDef & { weight: number })[],
  priceGrid: number[]
): number | null {
  const scored = priceGrid.map((price) => ({ price, score: biasAt(chain, spot, T, r, q, price, minutesRemaining, paths, 1, 1).score }));
  for (let i = 1; i < scored.length; i++) {
    if (Math.sign(scored[i - 1].score) !== Math.sign(scored[i].score) && scored[i - 1].score !== 0) {
      const t = Math.abs(scored[i - 1].score) / (Math.abs(scored[i - 1].score) + Math.abs(scored[i].score) + 1e-9);
      return scored[i - 1].price + (scored[i].price - scored[i - 1].price) * t;
    }
  }
  return null;
}

export function computeOpFloBias(params: {
  chain: ChainStrikeInput[];
  spot: number;
  r: number;
  q: number;
  dteHours: number;
  expectedMove1s: number | null;
  crossExpiry: CrossExpiryRow[];
  recentVolume5m: number | null;
  recentVolume15m: number | null;
  recentVolume30m: number | null;
  recentCandleCloses: number[];
  flowImbalance: number | null;
  netGexSign: number;
  dealerFlow: DealerFlowContext | null;
  sviParams?: SviParams;
  forward?: number;
  zeroDteOi: number;
}): OpFloBiasResult {
  const { chain, spot, r, q, dteHours, expectedMove1s, crossExpiry, recentVolume5m, recentVolume15m, recentVolume30m, recentCandleCloses, flowImbalance, netGexSign, dealerFlow, sviParams, forward, zeroDteOi } = params;

  const T = Math.max(dteHours, 0.05) / 24 / 365;
  const horizonMinutes = Math.max(dteHours * 60, 3);
  const em = expectedMove1s && expectedMove1s > 0 ? expectedMove1s : spot * 0.01;

  const lean = computeLean(recentCandleCloses, flowImbalance);
  const paths = weightPaths(definePaths(em, spot), lean);

  const conventional = biasAt(chain, spot, T, r, q, spot, horizonMinutes, paths, 1, 1);

  // Confidence (section 11): path sign agreement, dealer-sign agreement, OI freshness.
  const signs = dealerSignScenarios(flowImbalance, netGexSign);
  const dealerScores = signs.map((s) => biasAt(chain, spot, T, r, q, spot, horizonMinutes, paths, s.callWeight, s.putWeight).score);
  const dealerPositiveCount = dealerScores.filter((s) => s > 5).length;
  const dealerNegativeCount = dealerScores.filter((s) => s < -5).length;
  const dealerSignAgreementPct = (Math.max(dealerPositiveCount, dealerNegativeCount, dealerScores.length - dealerPositiveCount - dealerNegativeCount) / dealerScores.length) * 100;

  const directionalFlows = conventional.flows.filter((f) => f.path.name !== "range" && f.path.name !== "mean_reversion" && f.path.name !== "shock");
  const pathPositive = directionalFlows.filter((f) => f.flow > 0).reduce((s, f) => s + f.path.weight, 0);
  const pathNegative = directionalFlows.filter((f) => f.flow < 0).reduce((s, f) => s + f.path.weight, 0);
  const pathTotalWeight = directionalFlows.reduce((s, f) => s + f.path.weight, 0) || 1;
  const pathSignAgreementPct = (Math.max(pathPositive, pathNegative) / pathTotalWeight) * 100;

  const refreshRatio = recentVolume5m && recentVolume5m > 0 ? recentVolume5m / (zeroDteOi + 1e-9) : 0;
  const oiFreshnessFactor = 1 - Math.min(1, refreshRatio / 2);

  const confidence = Math.max(0.3, Math.min(1, (dealerSignAgreementPct / 100) * 0.4 + (pathSignAgreementPct / 100) * 0.4 + oiFreshnessFactor * 0.2));
  const score = Math.max(-100, Math.min(100, conventional.score * confidence));
  const direction = classifyDirection(score);

  const bullNormal = conventional.flows.find((f) => f.path.name === "bull_normal")?.flow ?? 0;
  const bearNormal = conventional.flows.find((f) => f.path.name === "bear_normal")?.flow ?? 0;
  const rangeFlow = conventional.flows.find((f) => f.path.name === "range")?.flow ?? 0;
  const mode = classifyMode(score, bullNormal, bearNormal, rangeFlow, pathSignAgreementPct);

  const remainingFlowShares = paths.reduce((s, p) => {
    const f = conventional.flows.find((x) => x.path.name === p.name)?.flow ?? 0;
    return s + p.weight * f;
  }, 0);

  const finalHourMinutes = Math.min(60, horizonMinutes);
  const finalHourFraction = finalHourMinutes / horizonMinutes;
  const finalHourFlowShares = remainingFlowShares * finalHourFraction;

  const remainingImpactRatioPct = recentVolume30m && recentVolume30m > 0 ? (Math.abs(remainingFlowShares) / ((recentVolume30m * horizonMinutes) / 30)) * 100 : null;
  const finalHourImpactRatioPct = recentVolume30m && recentVolume30m > 0 ? (Math.abs(finalHourFlowShares) / ((recentVolume30m * finalHourMinutes) / 30)) * 100 : null;

  // Bias Flip (section 14): sticky-strike always; sticky-moneyness added when an SVI fit is available.
  const priceRangePct = 0.03;
  const priceGrid: number[] = [];
  for (let i = 0; i <= 30; i++) priceGrid.push(spot * (1 - priceRangePct + (2 * priceRangePct * i) / 30));
  const flipSticky = findBiasFlip(chain, spot, T, r, q, horizonMinutes, paths, priceGrid);
  const flips = [flipSticky].filter((f): f is number => f !== null);
  if (sviParams && forward) {
    const scored = priceGrid.map((price) => {
      const flows = paths.map((p) => {
        const endSpot = price * (1 + p.endMovePct);
        return { weight: p.weight, flow: surfaceHedgeAt(chain, spot, T, r, q, endSpot, horizonMinutes, (k) => p.ivParallel + p.skewSlope * -k, sviParams, forward, 1, 1) };
      });
      const bull = flows.reduce((s, f) => s + f.weight * Math.max(0, f.flow), 0);
      const bear = flows.reduce((s, f) => s + f.weight * Math.max(0, -f.flow), 0);
      return { price, score: ((bull - bear) / (bull + bear + 1e-6)) * 100 };
    });
    for (let i = 1; i < scored.length; i++) {
      if (Math.sign(scored[i - 1].score) !== Math.sign(scored[i].score) && scored[i - 1].score !== 0) {
        flips.push(scored[i - 1].price);
        break;
      }
    }
  }
  const biasFlipLow = flips.length ? Math.min(...flips) : null;
  const biasFlipHigh = flips.length ? Math.max(...flips) : null;

  // Stability checkpoints (section 15): interpolate toward the dominant weighted path's end state.
  const dominantPath = [...paths].sort((a, b) => b.weight - a.weight)[0];
  const checkpointFractions = [0, 0.2, 0.4, 0.6, 0.8, 0.92];
  const checkpoints: StabilityCheckpoint[] = checkpointFractions
    .filter((f) => f * horizonMinutes < horizonMinutes)
    .map((frac) => {
      const elapsed = frac * horizonMinutes;
      const evalSpot = spot * (1 + dominantPath.endMovePct * frac);
      const remaining = Math.max(1, horizonMinutes - elapsed);
      return { minutesFromNow: elapsed, score: biasAt(chain, spot, T, r, q, evalSpot, remaining, paths, 1, 1).score };
    });

  const scoreRange = Math.max(...checkpoints.map((c) => c.score)) - Math.min(...checkpoints.map((c) => c.score));
  const stability: OpFloBiasResult["stability"] = scoreRange < 25 ? "high" : scoreRange < 55 ? "moderate" : "low";
  let weakensAfterMinutes: number | null = null;
  for (let i = 1; i < checkpoints.length; i++) {
    if (Math.sign(checkpoints[i].score) !== Math.sign(checkpoints[0].score) || Math.abs(checkpoints[i].score) < Math.abs(checkpoints[0].score) * 0.5) {
      weakensAfterMinutes = checkpoints[i - 1].minutesFromNow;
      break;
    }
  }

  // Peak window (section 16): 5-minute interval flows along the dominant path, largest 45-minute rolling window.
  const stepMinutes = 5;
  const marks: { minutesFromNow: number; hedge: number }[] = [];
  for (let m = 0; m <= horizonMinutes; m += stepMinutes) {
    const frac = m / horizonMinutes;
    const evalSpot = spot * (1 + dominantPath.endMovePct * frac);
    marks.push({ minutesFromNow: m, hedge: hedgeAt(chain, spot, T, r, q, evalSpot, Math.max(1, horizonMinutes - m), (k) => dominantPath.ivParallel * frac + dominantPath.skewSlope * frac * -k, 1, 1) });
  }
  const windowSteps = Math.max(1, Math.min(Math.round(45 / stepMinutes), marks.length - 1));
  let peakWindow: PeakWindow | null = null;
  let peakAbs = 0;
  for (let i = 0; i + windowSteps < marks.length; i++) {
    const delta = marks[i + windowSteps].hedge - marks[i].hedge;
    if (Math.abs(delta) > peakAbs) {
      peakAbs = Math.abs(delta);
      peakWindow = { startMinutesFromNow: marks[i].minutesFromNow, endMinutesFromNow: marks[i + windowSteps].minutesFromNow, direction: delta >= 0 ? "buying" : "selling" };
    }
  }

  // Cross-expiry (section 13): 0DTE from the real repriced score; other expirations approximated from the source's own netGex/netDex sign (documented limitation - no full chain available for them).
  const candidates = crossExpiry.filter((row) => row.dte > 0).sort((a, b) => Math.abs(b.netGex) - Math.abs(a.netGex));
  const nextDominant = candidates[0] ?? null;
  const weeklyRow = [...candidates].sort((a, b) => b.dte - a.dte)[0] ?? null;
  const nextExpiryScore = nextDominant ? Math.max(-100, Math.min(100, Math.sign(nextDominant.netDex) * Math.min(100, (Math.abs(nextDominant.netDex) / (Math.abs(nextDominant.totalOi) + 1)) * 500))) : null;
  const weeklyScore = weeklyRow && weeklyRow !== nextDominant ? Math.max(-100, Math.min(100, Math.sign(weeklyRow.netDex) * Math.min(100, (Math.abs(weeklyRow.netDex) / (Math.abs(weeklyRow.totalOi) + 1)) * 500))) : null;
  const fullBookScore = (score + (nextExpiryScore ?? score) * 0.5 + (weeklyScore ?? score) * 0.3) / (1 + (nextExpiryScore !== null ? 0.5 : 0) + (weeklyScore !== null ? 0.3 : 0));

  let classification: CrossExpiryBiasClass = "insufficient_data";
  if (nextExpiryScore !== null) {
    const zeroSign = Math.sign(score);
    const nextSign = Math.sign(nextExpiryScore);
    const weekSign = weeklyScore !== null ? Math.sign(weeklyScore) : nextSign;
    if (zeroSign !== 0 && zeroSign === nextSign && nextSign === weekSign) classification = "reinforcing";
    else if (zeroSign !== 0 && nextSign !== 0 && zeroSign !== nextSign) classification = "same_day_conflict";
    else if (zeroSign === 0 && nextSign !== 0) classification = "structural_support";
    else classification = "intraday_dominant";
  }

  return {
    direction,
    score,
    mode,
    horizonMinutes,
    remainingFlowShares,
    remainingImpactRatioPct,
    finalHourImpactRatioPct,
    biasFlipLow,
    biasFlipHigh,
    stability,
    weakensAfterMinutes,
    peakWindow,
    crossExpiry: { zeroDteScore: score, nextExpiryScore, weeklyScore, fullBookScore, classification },
    diagnostics: {
      disclosure:
        "OpFlo RTH Bias estimates cumulative model-implied underlying hedging pressure from now through the regular-session close using the current options structure. It is not confirmed institutional buying, confirmed dealer orders, smart-money flow, or a guaranteed market direction.",
      pricingModel: "Black-Scholes bump-and-reprice delta, full state repricing (end-of-horizon state minus now) across 9 weighted scenario paths - never a sum of separately-computed GEX/DEX/Vanna/Charm numbers",
      horizonSource: "Remaining time to this 0DTE contract's own expiry (same-day RTH close)",
      lastCalculatedAt: Date.now(),
    },
  };
}
