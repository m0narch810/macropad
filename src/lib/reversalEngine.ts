/**
 * Reversal Levels engine - cross-Greek synthesis, not another single-Greek
 * page. Central output: the single best price zone where option
 * positioning and current price behavior suggest a meaningful reversal is
 * most likely, plus (rarely) one genuinely strong backup zone.
 *
 * Section 1 of the spec is the load-bearing design constraint: never add
 * raw GEX + DEX + Vanna + Charm + Theta together (different units). Every
 * number here is "how many underlying shares would theoretically need to
 * be bought or sold," computed by ONE unified full-reprice primitive,
 * unifiedHedgeAt(), that reprices the whole chain at a hypothetical
 * (price, time-elapsed, IV shift) triple and diffs against right now. That
 * single function naturally folds in gamma (from the price term), vanna
 * (from the IV term), charm (from the time term), and their interactions -
 * it is not a sum of the other five engines' separately-computed numbers.
 * Theta is used differently here: not as hedge flow, but to answer whether
 * the option structure will still exist by the time price could plausibly
 * arrive (Theta Survival).
 *
 * A "Dealer Reversal Well" is a restoring zero-crossing of that field:
 * modeled buying below the center, modeled selling above it - a
 * stabilizing pin, not an amplifying one. Everything downstream (well
 * depth, Brake-and-Release, arrival-adjusted force, convergence
 * clustering, live absorption) exists to grade candidate wells and decide
 * whether one deserves the Projected / Armed / Trade-Ready label.
 *
 * Stated scope simplifications (documented, not hidden, matching the
 * posture of gammaEngine.ts/deltaEngine.ts/thetaEngine.ts/vannaEngine.ts/
 * charmEngine.ts):
 *  - Cross-expiry resonance uses the source's own per-expiry netGex/netDex
 *    sign (from /option-matrix) as a direction-agreement check only - a
 *    full chain for the next-dominant expiry isn't available, so this
 *    cannot confirm the OTHER expiry's zone sits at the same price, only
 *    that its structure points the same stabilizing/destabilizing way.
 *  - The always-one-level fallback hierarchy is a real but compressed
 *    3-tier version of the spec's 7-tier list: (1) a genuine restoring
 *    dealer-reversal-well from this engine's own math, cross-checked
 *    against cross-expiry direction; (2) GEX pin-basin / DEX inventory-
 *    pivot alignment from the already-computed gamma/delta engines; (3)
 *    expected-move boundary aligned with a charm pivot. Max pain, largest
 *    OI, walls, and round numbers alone are never used, per the spec's
 *    explicit "never fall back to" list.
 *  - Counterfactual Convergence runs a representative scenario set (6
 *    dealer-sign weightings x {IV unchanged, IV -1, IV +1}), not an
 *    exhaustive cross product of every sticky-rule / arrival-time /
 *    expiry combination.
 *  - Contact-time estimation uses the standard diffusion-scaling
 *    approximation (time-to-touch scales with (distance / expected move)^2
 *    of the remaining session), not a fitted arrival-time distribution.
 *  - Live Absorption reads the same intraday 5-minute candles already
 *    fetched for the exposure pages plus /dealer_anomalies - it is a
 *    same-session read, not a historical backtest, so state labels are
 *    confidence scores, not calibrated probabilities.
 */

import { bsPrice } from "@/lib/blackScholes";
import type { ChainStrikeInput, CrossExpiryRow, DealerFlowContext } from "@/lib/gex";
import { bsGammaAt, touchProbability } from "@/lib/gexAnalytics";
import type { GammaEngineResult } from "@/lib/gammaEngine";
import type { DeltaEngineResult } from "@/lib/deltaEngine";
import type { VannaEngineResult } from "@/lib/vannaEngine";
import type { CharmEngineResult } from "@/lib/charmEngine";

const MULTIPLIER = 100;
const YEAR_MINUTES = 60 * 24 * 365;

function toYears(minutes: number): number {
  return minutes / YEAR_MINUTES;
}

/** Quantizes a price to a scale-appropriate increment so sub-cent floating-point noise between requests doesn't visibly flicker a level that hasn't actually moved - increment scales with the instrument's own price level (indices like SPX/NDX vs. equities like QQQ/SPY). */
function stableRound(price: number, spot: number): number {
  const increment = spot >= 2000 ? 0.5 : 0.02;
  return Math.round(price / increment) * increment;
}

// ---------------------------------------------------------------------------
// Core primitive: unified hedge-field reprice (section 1)
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

/** Modeled hedge change (shares) vs. right now, at a hypothetical future (price, time-elapsed, IV shift) state - the single primitive that replaces adding GEX+DEX+Vanna+Charm together. */
function unifiedHedgeAt(chain: ChainStrikeInput[], baseSpot: number, T: number, r: number, q: number, evalSpot: number, hYears: number, ivShift: number, callWeight: number, putWeight: number): number {
  const hClamped = Math.min(Math.max(0, hYears), T - 1e-9);
  const tFuture = Math.max(1e-8, T - hClamped);
  let netDelta = 0;
  for (const row of chain) {
    if (row.oi <= 0 || row.iv <= 0) continue;
    const delta0 = bsDeltaAt(baseSpot, row.strike, T, row.iv, r, q, row.side === "call");
    const deltaFuture = bsDeltaAt(evalSpot, row.strike, tFuture, Math.max(1e-4, row.iv + ivShift), r, q, row.side === "call");
    const weight = row.side === "call" ? callWeight : putWeight;
    netDelta += weight * row.oi * MULTIPLIER * (deltaFuture - delta0);
  }
  return -netDelta;
}

// ---------------------------------------------------------------------------
// Dealer-sign scenarios (mirrors the other five engines)
// ---------------------------------------------------------------------------

interface DealerSignDef {
  name: string;
  label: string;
  callWeight: number;
  putWeight: number;
}

function dealerSignScenarios(flowImbalance: number | null, netGexSign: number): DealerSignDef[] {
  const imb = Number.isFinite(flowImbalance) ? Math.max(-1, Math.min(1, flowImbalance as number)) : 0;
  const gexBias = Math.max(-0.3, Math.min(0.3, netGexSign * 0.3));
  return [
    { name: "conventional", label: "Conventional customer-long/dealer-short", callWeight: 1, putWeight: 1 },
    { name: "reduced", label: "Reduced dealer participation", callWeight: 0.5, putWeight: 0.5 },
    { name: "call_heavy", label: "Call-heavy dealer exposure", callWeight: 1.5, putWeight: 0.5 },
    { name: "put_heavy", label: "Put-heavy dealer exposure", callWeight: 0.5, putWeight: 1.5 },
    { name: "dealer_flow_constrained", label: "Constrained by dealer-flow imbalance", callWeight: 1 + imb * 0.5, putWeight: 1 - imb * 0.5 },
    { name: "conservative_hedge_ratio", label: "Conservative hedge-ratio", callWeight: 1 + gexBias, putWeight: 1 - gexBias },
  ];
}

// ---------------------------------------------------------------------------
// Section 2: Dealer Reversal Wells
// ---------------------------------------------------------------------------

export type WellDirection = "lower" | "upper";

export interface WellCandidate {
  center: number;
  direction: WellDirection;
  distancePoints: number;
}

/** Local extrema of a (price, value) series with the requested sign - a peak of positive value (wantSign=1) or a trough of negative value (wantSign=-1) - sorted by magnitude descending. A full two-sided restoring crossing is the strongest form of this, but most sessions don't have one clean flip; they have several local buy-the-dip / sell-the-rip zones, which is what traders mean by "major potential highs and lows." */
function findLocalExtrema(rows: { price: number; value: number }[], wantSign: 1 | -1): { price: number; value: number }[] {
  const sorted = [...rows].sort((a, b) => a.price - b.price);
  const extrema: { price: number; value: number }[] = [];
  for (let i = 1; i < sorted.length - 1; i++) {
    const v = sorted[i].value;
    if (Math.sign(v) !== wantSign) continue;
    const isPeak = wantSign === 1 ? v >= sorted[i - 1].value && v >= sorted[i + 1].value : v <= sorted[i - 1].value && v <= sorted[i + 1].value;
    if (!isPeak) continue;
    // The candidate grid is rebuilt relative to spot on every request, so a
    // tiny spot tick shifts which grid index a real peak happens to land on -
    // reporting the raw grid point makes the output jump between calls even
    // when the underlying structure hasn't moved. A magnitude-weighted
    // centroid over the peak and its two neighbors is a continuous function
    // of the field instead of a brittle discrete argmax, so it moves
    // smoothly with the data rather than snapping between grid cells.
    const wLeft = Math.abs(sorted[i - 1].value);
    const wCenter = Math.abs(v);
    const wRight = Math.abs(sorted[i + 1].value);
    const totalW = wLeft + wCenter + wRight || 1;
    const refinedPrice = (sorted[i - 1].price * wLeft + sorted[i].price * wCenter + sorted[i + 1].price * wRight) / totalW;
    extrema.push({ price: refinedPrice, value: v });
  }
  return extrema.sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
}

/** Candidate reversal zones on each side of spot: potential lows are local peaks of modeled buying below spot, potential highs are local troughs of modeled selling above spot. Keeps up to 2 per side, each at least 15% of that side's strongest signal and separated from each other by at least dedupeDist. */
function findReversalCandidates(
  chain: ChainStrikeInput[],
  spot: number,
  T: number,
  r: number,
  q: number,
  priceGrid: number[],
  dedupeDist: number,
  callWeight: number,
  putWeight: number
): { lows: WellCandidate[]; highs: WellCandidate[] } {
  const rows = priceGrid.map((price) => ({ price, value: unifiedHedgeAt(chain, spot, T, r, q, price, 0, 0, callWeight, putWeight) }));
  const lowRows = rows.filter((r2) => r2.price < spot);
  const highRows = rows.filter((r2) => r2.price > spot);

  const lowPeaks = findLocalExtrema(lowRows, 1);
  const highPeaks = findLocalExtrema(highRows, -1);
  const maxAbsLow = Math.max(1e-6, ...lowPeaks.map((p) => Math.abs(p.value)));
  const maxAbsHigh = Math.max(1e-6, ...highPeaks.map((p) => Math.abs(p.value)));

  const dedupe = (peaks: { price: number; value: number }[], maxAbs: number): WellCandidate[] => {
    const kept: WellCandidate[] = [];
    for (const p of peaks) {
      if (Math.abs(p.value) < maxAbs * 0.15) continue;
      if (kept.some((k) => Math.abs(k.center - p.price) < dedupeDist)) continue;
      kept.push({ center: p.price, direction: p.price < spot ? "lower" : "upper", distancePoints: p.price - spot });
      if (kept.length >= 2) break;
    }
    return kept;
  };

  return { lows: dedupe(lowPeaks, maxAbsLow), highs: dedupe(highPeaks, maxAbsHigh) };
}

// ---------------------------------------------------------------------------
// Section 3: Well depth
// ---------------------------------------------------------------------------

export interface WellDepth {
  inwardShares: number;
  liquidityRatio: number | null;
  label: "weak" | "moderate" | "strong" | "unusually_strong";
}

function classifyDepth(ratio: number | null): WellDepth["label"] {
  if (ratio === null) return "weak";
  if (ratio > 1) return "unusually_strong";
  if (ratio >= 0.5) return "strong";
  if (ratio >= 0.25) return "moderate";
  return "weak";
}

function computeWellDepth(
  chain: ChainStrikeInput[],
  spot: number,
  T: number,
  r: number,
  q: number,
  center: number,
  windowPts: number,
  hYears: number,
  recentVolume5m: number | null,
  callWeight: number,
  putWeight: number
): WellDepth {
  const steps = 12;
  let inward = 0;
  for (let i = 0; i <= steps; i++) {
    const price = center - windowPts + (2 * windowPts * i) / steps;
    const R = unifiedHedgeAt(chain, spot, T, r, q, price, hYears, 0, callWeight, putWeight);
    // "Inward" means the sign that pulls price back toward center: positive R below center, negative R above center.
    const inwardComponent = price <= center ? Math.max(0, R) : Math.max(0, -R);
    inward += inwardComponent * ((2 * windowPts) / steps);
  }
  const liquidityRatio = recentVolume5m && recentVolume5m > 0 ? inward / recentVolume5m : null;
  return { inwardShares: inward, liquidityRatio, label: classifyDepth(liquidityRatio) };
}

/** Scores well depth 0-100. Liquidity-normalized when recent volume data is available (the intended reading); falls back to a raw-magnitude scale otherwise so a data outage (after-hours, upstream chart timeout) doesn't silently collapse the score to 0 - that's a missing-data case, not a weak-structure case. */
function depthScore(depth: WellDepth): number {
  if (depth.liquidityRatio !== null) return Math.min(100, depth.liquidityRatio * 80);
  return Math.min(100, (depth.inwardShares / 300_000) * 60);
}

// ---------------------------------------------------------------------------
// Section 4: Brake-and-Release
// ---------------------------------------------------------------------------

export interface BrakeAndRelease {
  brakeScore: number;
  releaseScore: number;
  combinedScore: number;
}

function computeBrakeAndRelease(chain: ChainStrikeInput[], spot: number, T: number, r: number, q: number, center: number, direction: WellDirection, windowPts: number, callWeight: number, putWeight: number): BrakeAndRelease {
  const sign = direction === "lower" ? -1 : 1; // sign(price - center) on the "approach" side vs "release" side
  const approachNear = unifiedHedgeAt(chain, spot, T, r, q, center + sign * windowPts * 0.5, 0, 0, callWeight, putWeight);
  const approachFar = unifiedHedgeAt(chain, spot, T, r, q, center + sign * windowPts * 1.5, 0, 0, callWeight, putWeight);
  const brakeMagnitude = (Math.abs(approachNear) + Math.abs(approachFar)) / 2;

  const releaseNear = unifiedHedgeAt(chain, spot, T, r, q, center - sign * windowPts * 0.5, 0, 0, callWeight, putWeight);
  const releaseFar = unifiedHedgeAt(chain, spot, T, r, q, center - sign * windowPts * 2, 0, 0, callWeight, putWeight);
  // releaseNear near zero is inconclusive (too little signal there to judge decay), not evidence of a bad
  // release - score it neutral rather than worst-case. The threshold is relative to this candidate's own
  // brake magnitude, not a fixed epsilon (raw hedge-share magnitudes vary by orders of magnitude book to book).
  const inconclusive = Math.abs(releaseNear) < Math.max(1, brakeMagnitude * 0.02);
  const decayRatio = inconclusive ? null : Math.min(1, Math.abs(releaseFar) / Math.abs(releaseNear));

  const brakeScore = Math.min(100, (brakeMagnitude / (Math.abs(releaseNear) + brakeMagnitude + 1e-9)) * 100);
  const releaseScore = decayRatio === null ? 50 : Math.max(0, (1 - decayRatio) * 100);
  // Weighted average, not sqrt(brake*release): the outer structural-quality geometric mean already
  // punishes weak components hard - stacking a second multiplicative penalty here double-counts it.
  const combinedScore = brakeScore * 0.6 + releaseScore * 0.4;
  return { brakeScore, releaseScore, combinedScore };
}

// ---------------------------------------------------------------------------
// Section 6: Arrival-adjusted reversal strength + Theta Survival
// ---------------------------------------------------------------------------

export interface ArrivalEstimate {
  contactMinutes: number;
  windowStartMinutes: number;
  windowEndMinutes: number;
}

function estimateArrival(distancePoints: number, expectedMove1s: number | null, totalMinutesToExpiry: number): ArrivalEstimate {
  const em = expectedMove1s && expectedMove1s > 0 ? expectedMove1s : Math.abs(distancePoints) || 1;
  const frac = Math.min(1, Math.pow(Math.abs(distancePoints) / em, 2));
  const contactMinutes = Math.max(2, Math.min(totalMinutesToExpiry, frac * totalMinutesToExpiry));
  return { contactMinutes, windowStartMinutes: Math.max(0, contactMinutes * 0.7), windowEndMinutes: Math.min(totalMinutesToExpiry, contactMinutes * 1.3) };
}

export interface ArrivalAdjustedForce {
  currentStrength: number;
  contactStrength: number;
  ratio: number;
}

function computeArrivalAdjustedForce(
  chain: ChainStrikeInput[],
  spot: number,
  T: number,
  r: number,
  q: number,
  center: number,
  windowPts: number,
  contactMinutes: number,
  recentVolume5m: number | null,
  callWeight: number,
  putWeight: number
): ArrivalAdjustedForce {
  const now = computeWellDepth(chain, spot, T, r, q, center, windowPts, 0, recentVolume5m, callWeight, putWeight);
  const atContact = computeWellDepth(chain, spot, T, r, q, center, windowPts, toYears(contactMinutes), recentVolume5m, callWeight, putWeight);
  const currentStrength = depthScore(now);
  const contactStrength = depthScore(atContact);
  return { currentStrength, contactStrength, ratio: currentStrength > 1e-6 ? contactStrength / currentStrength : 0 };
}

/** Pure time-decay survival of the reversal-relevant structure (gross gamma exposure), price and IV held at today's values - isolates "will the structure still exist" from "will price get there." */
function computeThetaSurvival(chain: ChainStrikeInput[], spot: number, T: number, r: number, q: number, contactMinutes: number): number {
  const grossGammaAt = (tYears: number) => {
    let g = 0;
    for (const row of chain) {
      if (row.oi <= 0 || row.iv <= 0) continue;
      g += Math.abs(bsGammaAt(spot, row.strike, tYears, row.iv, r, q, row.side === "call")) * row.oi * MULTIPLIER;
    }
    return g;
  };
  const now = grossGammaAt(T);
  if (now <= 0) return 0;
  const atContact = grossGammaAt(Math.max(1e-8, T - toYears(contactMinutes)));
  return Math.max(0, Math.min(1, atContact / now));
}

// ---------------------------------------------------------------------------
// Section 7: Cross-expiry reversal resonance
// ---------------------------------------------------------------------------

export interface CrossExpiryResonance {
  nextExpiry: { expiration: string; dte: number } | null;
  classification: "deep_cross_expiry_well" | "zero_dte_led" | "weekly_led" | "cross_expiry_cancellation" | "expiry_fragile" | "unavailable";
  score: number;
}

function computeCrossExpiryResonance(crossExpiry: CrossExpiryRow[]): CrossExpiryResonance {
  const candidates = crossExpiry.filter((row) => row.dte > 0);
  // /option-matrix is best-effort and frequently times out (documented across every other engine in this app) -
  // that's a missing-data case, not evidence the structure is fragile, so it gets a neutral score, not a punitive one.
  if (!candidates.length) return { nextExpiry: null, classification: "unavailable", score: 50 };
  const next = [...candidates].sort((a, b) => Math.abs(b.netGex) - Math.abs(a.netGex))[0];

  // A stabilizing 0DTE well (this engine only builds restoring wells) is reinforced by a next-expiry book that is ALSO net-positive-gamma (stabilizing); a net-negative-gamma next expiry works against it.
  const nextStabilizing = next.netGex > 0;
  const zeroDte = crossExpiry.find((row) => row.dte === 0);
  const zeroDteDominant = zeroDte ? Math.abs(zeroDte.netGex) >= Math.abs(next.netGex) : true;

  let classification: CrossExpiryResonance["classification"];
  let score: number;
  if (nextStabilizing) {
    classification = zeroDteDominant ? "zero_dte_led" : "weekly_led";
    score = zeroDteDominant ? 75 : 90;
  } else {
    classification = zeroDteDominant ? "cross_expiry_cancellation" : "expiry_fragile";
    score = zeroDteDominant ? 35 : 15;
  }
  if (nextStabilizing && zeroDteDominant && Math.abs(next.netGex) > Math.abs(zeroDte?.netGex ?? 0) * 0.5) {
    classification = "deep_cross_expiry_well";
    score = 95;
  }
  return { nextExpiry: { expiration: next.expiration, dte: next.dte }, classification, score };
}

// ---------------------------------------------------------------------------
// Section 9: Counterfactual Convergence
// ---------------------------------------------------------------------------

export interface ConvergenceResult {
  solutions: number[];
  primaryZoneLow: number;
  primaryZoneHigh: number;
  convergencePct: number;
  outerLow: number;
  outerHigh: number;
}

function computeConvergence(chain: ChainStrikeInput[], spot: number, T: number, r: number, q: number, priceGrid: number[], flowImbalance: number | null, netGexSign: number, anchorDirection: WellDirection): { convergence: ConvergenceResult; dealerAgreementPct: number } {
  const signs = dealerSignScenarios(flowImbalance, netGexSign);
  const ivVariants = [0, -0.01, 0.01];

  const wantSign = anchorDirection === "lower" ? 1 : -1;
  const solutions: number[] = [];
  const baseSolutions: number[] = [];
  for (const s of signs) {
    for (const ivShift of ivVariants) {
      const rows = priceGrid
        .filter((price) => (anchorDirection === "lower" ? price < spot : price > spot))
        .map((price) => ({ price, value: unifiedHedgeAt(chain, spot, T, r, q, price, 0, ivShift, s.callWeight, s.putWeight) }));
      const peaks = findLocalExtrema(rows, wantSign);
      const nearest = peaks.length ? peaks[0].price : null;
      if (nearest !== null) {
        solutions.push(nearest);
        if (ivShift === 0) baseSolutions.push(nearest);
      }
    }
  }

  if (!solutions.length) {
    return { convergence: { solutions: [], primaryZoneLow: spot, primaryZoneHigh: spot, convergencePct: 0, outerLow: spot, outerHigh: spot }, dealerAgreementPct: 50 };
  }

  const sorted = [...solutions].sort((a, b) => a - b);
  const tolerance = Math.max(0.05, spot * 0.0015);
  let bestCluster: number[] = [];
  let current: number[] = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] - sorted[i - 1] <= tolerance) current.push(sorted[i]);
    else {
      if (current.length > bestCluster.length) bestCluster = current;
      current = [sorted[i]];
    }
  }
  if (current.length > bestCluster.length) bestCluster = current;

  const convergencePct = (bestCluster.length / solutions.length) * 100;
  const clusterLow = Math.min(...bestCluster);
  const clusterHigh = Math.max(...bestCluster);

  const dealerAgreementCount = baseSolutions.filter((s) => s >= clusterLow - tolerance && s <= clusterHigh + tolerance).length;
  const dealerAgreementPct = baseSolutions.length ? (dealerAgreementCount / baseSolutions.length) * 100 : 50;

  return {
    convergence: { solutions: sorted, primaryZoneLow: clusterLow, primaryZoneHigh: clusterHigh, convergencePct, outerLow: sorted[0], outerHigh: sorted[sorted.length - 1] },
    dealerAgreementPct,
  };
}

// ---------------------------------------------------------------------------
// Section 10: Reachability
// ---------------------------------------------------------------------------

export interface Reachability {
  encounterProbabilityPct: number;
  conditionalConfidence: number;
  combinedEventScore: number;
}

function computeReachability(center: number, spot: number, atmIv: number, dteHours: number, structuralQuality: number, thetaSurvival: number): Reachability {
  const touch = touchProbability(center, spot, atmIv, dteHours);
  const encounterProbabilityPct = touch * 100;
  const conditionalConfidence = structuralQuality;
  const combinedEventScore = touch * thetaSurvival * (conditionalConfidence / 100) * 100;
  return { encounterProbabilityPct, conditionalConfidence, combinedEventScore };
}

// ---------------------------------------------------------------------------
// Section 16: Failure boundary
// ---------------------------------------------------------------------------

function computeFailureBoundary(chain: ChainStrikeInput[], spot: number, T: number, r: number, q: number, center: number, direction: WellDirection, windowPts: number, callWeight: number, putWeight: number): number {
  const sign = direction === "lower" ? -1 : 1;
  const peak = Math.abs(unifiedHedgeAt(chain, spot, T, r, q, center + sign * windowPts * 0.5, 0, 0, callWeight, putWeight));
  let boundary = center + sign * windowPts * 2.5;
  const steps = 20;
  for (let i = 1; i <= steps; i++) {
    const price = center + (sign * windowPts * 2.5 * i) / steps;
    const R = unifiedHedgeAt(chain, spot, T, r, q, price, 0, 0, callWeight, putWeight);
    const restoring = direction === "lower" ? R >= 0 : R <= 0;
    if (!restoring || Math.abs(R) < peak * 0.1) {
      boundary = price;
      break;
    }
  }
  return boundary;
}

// ---------------------------------------------------------------------------
// Section 13: Structural Reversal Quality (geometric mean of 7 components)
// ---------------------------------------------------------------------------

export interface StructuralComponents {
  wellDepthScore: number;
  brakeAndReleaseScore: number;
  arrivalForceScore: number;
  crossExpiryScore: number;
  thetaSurvivalScore: number;
  convergenceScore: number;
  dealerAgreementScore: number;
}

function geometricMean(values: number[]): number {
  // Floored at 15, not 1: the spec wants a genuinely weak component to drag
  // the score down hard (that's the whole point of using a geometric mean
  // instead of an average), but flooring at 1 let a single near-zero
  // component - which, after the fixes above, is now rare and usually a
  // real signal rather than a missing-data artifact - single-handedly crater
  // an otherwise-strong level to single digits.
  const clamped = values.map((v) => Math.max(15, Math.min(100, v)));
  const product = clamped.reduce((p, v) => p * v, 1);
  return Math.pow(product, 1 / clamped.length);
}

function computeStructuralQuality(components: StructuralComponents): number {
  return geometricMean([
    components.wellDepthScore,
    components.brakeAndReleaseScore,
    components.arrivalForceScore,
    components.crossExpiryScore,
    components.thetaSurvivalScore,
    components.convergenceScore,
    components.dealerAgreementScore,
  ]);
}

// ---------------------------------------------------------------------------
// Section 11: Live Absorption Monitor
// ---------------------------------------------------------------------------

export interface Candle {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface LiveAbsorption {
  tested: boolean;
  approachVelocity: number | null;
  approachDeceleratingPct: number | null;
  effortVsResultFlag: boolean;
  rejectionDetected: boolean;
  centerReclaimed: boolean;
  newExtremeMade: boolean;
  anomalyExhaustion: "invalidation_risk" | "absorption" | "neutral";
  liveConfirmationScore: number;
}

function computeLiveAbsorption(candles: Candle[], center: number, zoneLow: number, zoneHigh: number, direction: WellDirection, dealerFlow: DealerFlowContext | null): LiveAbsorption {
  if (candles.length < 6) {
    return { tested: false, approachVelocity: null, approachDeceleratingPct: null, effortVsResultFlag: false, rejectionDetected: false, centerReclaimed: false, newExtremeMade: false, anomalyExhaustion: "neutral", liveConfirmationScore: 0 };
  }

  const recent = candles.slice(-12);
  const avgRange = recent.reduce((s, c) => s + (c.high - c.low), 0) / recent.length || 1;

  const last3 = recent.slice(-3);
  const prior3 = recent.slice(-6, -3);
  const netMove3 = last3.length ? last3[last3.length - 1].close - last3[0].open : 0;
  const netMovePrior3 = prior3.length ? prior3[prior3.length - 1].close - prior3[0].open : 0;
  const towardZoneNow = direction === "lower" ? -netMove3 : netMove3;
  const towardZonePrior = direction === "lower" ? -netMovePrior3 : netMovePrior3;

  const approachVelocity = Math.abs(towardZoneNow) / avgRange;
  const approachDeceleratingPct = Math.abs(towardZonePrior) > 1e-6 ? Math.max(-100, Math.min(100, (1 - Math.abs(towardZoneNow) / Math.abs(towardZonePrior)) * 100)) : null;

  const volLast3 = last3.reduce((s, c) => s + c.volume, 0);
  const volPrior3 = prior3.reduce((s, c) => s + c.volume, 0);
  const effortVsResultFlag = volLast3 > volPrior3 * 1.1 && Math.abs(towardZoneNow) < Math.abs(towardZonePrior) * 0.8;

  const tested = recent.some((c) => (direction === "lower" ? c.low <= zoneHigh : c.high >= zoneLow));
  let rejectionDetected = false;
  let centerReclaimed = false;
  let newExtremeMade = false;
  if (tested) {
    const testCandles = recent.filter((c) => (direction === "lower" ? c.low <= zoneHigh : c.high >= zoneLow));
    const lastTest = testCandles[testCandles.length - 1];
    if (direction === "lower") {
      rejectionDetected = lastTest.low <= zoneHigh && lastTest.close > zoneLow;
      centerReclaimed = lastTest.close > center;
      newExtremeMade = testCandles.some((c) => c.low < Math.min(...testCandles.map((x) => x.low)) + 1e-9) && testCandles.length > 1 ? testCandles[testCandles.length - 1].low >= Math.min(...testCandles.slice(0, -1).map((c) => c.low)) : true;
    } else {
      rejectionDetected = lastTest.high >= zoneLow && lastTest.close < zoneHigh;
      centerReclaimed = lastTest.close < center;
      newExtremeMade = testCandles.length > 1 ? testCandles[testCandles.length - 1].high <= Math.max(...testCandles.slice(0, -1).map((c) => c.high)) : true;
    }
  }

  let anomalyExhaustion: LiveAbsorption["anomalyExhaustion"] = "neutral";
  if (dealerFlow) {
    const strongFlow = Math.abs(dealerFlow.currentZ) >= dealerFlow.zThreshold;
    const progressToward = Math.abs(towardZoneNow) > avgRange * 0.3;
    if (strongFlow && progressToward) anomalyExhaustion = "invalidation_risk";
    else if (strongFlow && !progressToward) anomalyExhaustion = "absorption";
  }

  let liveConfirmationScore = 0;
  if (tested) liveConfirmationScore += 25;
  if (approachDeceleratingPct !== null && approachDeceleratingPct > 20) liveConfirmationScore += 20;
  if (effortVsResultFlag) liveConfirmationScore += 15;
  if (rejectionDetected) liveConfirmationScore += 20;
  if (centerReclaimed) liveConfirmationScore += 10;
  if (newExtremeMade) liveConfirmationScore += 5;
  if (anomalyExhaustion === "absorption") liveConfirmationScore += 15;
  if (anomalyExhaustion === "invalidation_risk") liveConfirmationScore -= 25;
  liveConfirmationScore = Math.max(0, Math.min(100, liveConfirmationScore));

  return { tested, approachVelocity, approachDeceleratingPct, effortVsResultFlag, rejectionDetected, centerReclaimed, newExtremeMade, anomalyExhaustion, liveConfirmationScore };
}

// ---------------------------------------------------------------------------
// Section 12/14: Level state + live score
// ---------------------------------------------------------------------------

export type LevelState = "projected" | "armed" | "trade_ready" | "elite";

function classifyState(structuralQuality: number, convergencePct: number, thetaSurvival: number, encounterPct: number, dealerAgreementPct: number, live: LiveAbsorption, failureIntact: boolean): { state: LevelState; liveScore: number } {
  const liveScore = live.tested ? structuralQuality * 0.4 + live.liveConfirmationScore * 0.6 : structuralQuality * 0.6;

  const armedEligible = structuralQuality >= 80 && convergencePct >= 75 && thetaSurvival * 100 >= 60 && encounterPct >= 20 && dealerAgreementPct >= 70;
  const tradeReadyEligible =
    structuralQuality >= 85 &&
    liveScore >= 85 &&
    live.tested &&
    (live.approachDeceleratingPct ?? 0) > 0 &&
    live.liveConfirmationScore >= 40 &&
    (live.centerReclaimed || live.rejectionDetected) &&
    failureIntact &&
    live.anomalyExhaustion !== "invalidation_risk";

  let state: LevelState = "projected";
  if (tradeReadyEligible) state = liveScore >= 90 ? "elite" : "trade_ready";
  else if (armedEligible) state = "armed";

  return { state, liveScore };
}

// ---------------------------------------------------------------------------
// Fallback hierarchy (compressed 3-tier)
// ---------------------------------------------------------------------------

export type FallbackTier = "full_greek_well" | "gex_dex_alignment" | "expected_move_charm_aligned" | "none";

function fallbackWell(spot: number, gammaEngine: GammaEngineResult | undefined, deltaEngine: DeltaEngineResult | undefined, charmEngine: CharmEngineResult | undefined, expectedMove1s: number | null): { center: number; direction: WellDirection; tier: FallbackTier } | null {
  const pinBasin = gammaEngine?.typedLevels.find((l) => l.type === "pin_basin");
  const inventoryPivot = deltaEngine?.inventoryPivot ?? null;
  if (pinBasin && inventoryPivot !== null && Math.abs(pinBasin.center - inventoryPivot) < spot * 0.01) {
    const center = (pinBasin.center + inventoryPivot) / 2;
    return { center, direction: center < spot ? "lower" : "upper", tier: "gex_dex_alignment" };
  }

  const charmPivot = charmEngine?.pivots.find((p) => p.horizonLabel === "Next 30 minutes")?.price ?? null;
  if (expectedMove1s && expectedMove1s > 0 && charmPivot !== null) {
    const emBoundaryLow = spot - expectedMove1s;
    const emBoundaryHigh = spot + expectedMove1s;
    if (Math.abs(charmPivot - emBoundaryLow) < expectedMove1s * 0.25) return { center: (charmPivot + emBoundaryLow) / 2, direction: "lower", tier: "expected_move_charm_aligned" };
    if (Math.abs(charmPivot - emBoundaryHigh) < expectedMove1s * 0.25) return { center: (charmPivot + emBoundaryHigh) / 2, direction: "upper", tier: "expected_move_charm_aligned" };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Assembly - flat, scored list of levels. No zones, no gravity map: every
// score component above still runs internally (that's what the score IS),
// but the only things exposed are a price, a direction, a score, a state,
// and the failure boundary that invalidates the level.
// ---------------------------------------------------------------------------

export interface ReversalLevel {
  price: number;
  direction: WellDirection;
  tier: FallbackTier;
  state: LevelState;
  score: number;
  failureBoundary: number;
}

export interface ReversalEngineResult {
  levels: ReversalLevel[];
  diagnostics: {
    pricingModel: string;
    levelsFound: number;
    fallbackUsed: boolean;
    crossProductWarning: string;
    lastCalculatedAt: number;
  };
}

function buildLevel(
  chain: ChainStrikeInput[],
  spot: number,
  T: number,
  r: number,
  q: number,
  atmIv: number,
  dteHours: number,
  totalMinutesToExpiry: number,
  center: number,
  direction: WellDirection,
  tier: FallbackTier,
  windowPts: number,
  candidateGrid: number[],
  crossExpiry: CrossExpiryRow[],
  expectedMove1s: number | null,
  recentVolume5m: number | null,
  flowImbalance: number | null,
  netGexSign: number,
  candles: Candle[],
  dealerFlow: DealerFlowContext | null
): ReversalLevel {
  const wellDepth = computeWellDepth(chain, spot, T, r, q, center, windowPts, 0, recentVolume5m, 1, 1);
  const brakeAndRelease = computeBrakeAndRelease(chain, spot, T, r, q, center, direction, windowPts, 1, 1);
  const arrival = estimateArrival(center - spot, expectedMove1s, totalMinutesToExpiry);
  const arrivalForce = computeArrivalAdjustedForce(chain, spot, T, r, q, center, windowPts, arrival.contactMinutes, recentVolume5m, 1, 1);
  const thetaSurvival = computeThetaSurvival(chain, spot, T, r, q, arrival.contactMinutes);
  const crossExpiryResonance = computeCrossExpiryResonance(crossExpiry);
  const { convergence, dealerAgreementPct } = computeConvergence(chain, spot, T, r, q, candidateGrid, flowImbalance, netGexSign, direction);
  const failureBoundary = computeFailureBoundary(chain, spot, T, r, q, center, direction, windowPts, 1, 1);

  const zoneLow = Math.min(center - windowPts * 0.6, convergence.primaryZoneLow);
  const zoneHigh = Math.max(center + windowPts * 0.6, convergence.primaryZoneHigh);
  const liveAbsorption = computeLiveAbsorption(candles, center, zoneLow, zoneHigh, direction, dealerFlow);

  const components: StructuralComponents = {
    wellDepthScore: depthScore(wellDepth),
    brakeAndReleaseScore: brakeAndRelease.combinedScore,
    arrivalForceScore: arrivalForce.contactStrength,
    crossExpiryScore: crossExpiryResonance.score,
    thetaSurvivalScore: thetaSurvival * 100,
    convergenceScore: convergence.convergencePct,
    dealerAgreementScore: dealerAgreementPct,
  };
  const structuralQuality = computeStructuralQuality(components);
  const reachability = computeReachability(center, spot, atmIv, dteHours, structuralQuality, thetaSurvival);
  const failureIntact = direction === "lower" ? spot > failureBoundary : spot < failureBoundary;
  const { state } = classifyState(structuralQuality, convergence.convergencePct, thetaSurvival, reachability.encounterProbabilityPct, dealerAgreementPct, liveAbsorption, failureIntact);

  return { price: stableRound(center, spot), direction, tier, state, score: structuralQuality, failureBoundary: stableRound(failureBoundary, spot) };
}

export function computeReversalEngine(params: {
  chain: ChainStrikeInput[];
  spot: number;
  r: number;
  q: number;
  dteHours: number;
  atmIv: number;
  expectedMove1s: number | null;
  crossExpiry: CrossExpiryRow[];
  recentVolume5m: number | null;
  flowImbalance: number | null;
  netGexSign: number;
  dealerFlow: DealerFlowContext | null;
  candles: Candle[];
  gammaEngine?: GammaEngineResult;
  deltaEngine?: DeltaEngineResult;
  vannaEngine?: VannaEngineResult;
  charmEngine?: CharmEngineResult;
}): ReversalEngineResult {
  const { chain, spot, r, q, dteHours, atmIv, expectedMove1s, crossExpiry, recentVolume5m, flowImbalance, netGexSign, dealerFlow, candles, gammaEngine, deltaEngine, charmEngine } = params;

  const T = Math.max(dteHours, 0.05) / 24 / 365;
  const totalMinutesToExpiry = Math.max(dteHours * 60, 3);
  const windowPts = Math.max(1, spot * 0.004);

  // Deep OTM strikes carry ~0 delta everywhere, so a wide grid is mostly flat
  // out there - a "local peak" detected in that flat/noisy tail is numerical
  // noise, not a real reversal candidate. Candidate search (and the
  // convergence scenarios, which reuse this grid) is restricted to a
  // realistic band scaled off the session's own expected move.
  const candidateRangePct = expectedMove1s && expectedMove1s > 0 ? Math.max(0.012, Math.min(0.03, (expectedMove1s * 3) / spot)) : 0.02;
  const candidateGrid: number[] = [];
  for (let i = 0; i <= 40; i++) candidateGrid.push(spot * (1 - candidateRangePct + (2 * candidateRangePct * i) / 40));

  const dedupeDist = Math.max(1, spot * 0.003);
  const candidates = findReversalCandidates(chain, spot, T, r, q, candidateGrid, dedupeDist, 1, 1);

  const buildForCandidate = (w: WellCandidate) =>
    buildLevel(chain, spot, T, r, q, atmIv, dteHours, totalMinutesToExpiry, w.center, w.direction, "full_greek_well", windowPts, candidateGrid, crossExpiry, expectedMove1s, recentVolume5m, flowImbalance, netGexSign, candles, dealerFlow);

  let levels: ReversalLevel[] = [...candidates.lows, ...candidates.highs].map(buildForCandidate);
  let fallbackUsed = false;

  if (!levels.length) {
    fallbackUsed = true;
    const fb = fallbackWell(spot, gammaEngine, deltaEngine, charmEngine, expectedMove1s);
    if (fb) levels = [buildLevel(chain, spot, T, r, q, atmIv, dteHours, totalMinutesToExpiry, fb.center, fb.direction, fb.tier, windowPts, candidateGrid, crossExpiry, expectedMove1s, recentVolume5m, flowImbalance, netGexSign, candles, dealerFlow)];
  }

  levels.sort((a, b) => b.score - a.score);

  return {
    levels,
    diagnostics: {
      pricingModel: "Black-Scholes bump-and-reprice delta, unified full-chain repricing across (price, time-elapsed, IV shift) - never a sum of separately-computed GEX/DEX/Vanna/Charm numbers",
      levelsFound: levels.length,
      fallbackUsed,
      crossProductWarning: "Product-local exposure only (this symbol's own listed options) - cross-product offsets in futures, index options, ETF baskets, or other expirations are unobserved.",
      lastCalculatedAt: Date.now(),
    },
  };
}
