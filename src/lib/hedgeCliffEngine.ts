/**
 * Hedge Acceleration and Cliff Map.
 *
 * Different question from the GEX bar chart. GEX asks "how much gamma
 * exposure exists at each strike right now?" This asks "as spot moves
 * through a hypothetical price grid, how rapidly does the estimated
 * dealer-hedging response change?"
 *
 * Not based on historical data. A hypothetical price grid is built around
 * the current live 0DTE chain; every contract is repriced (delta only -
 * time and IV held fixed, isolating the pure spot-driven / gamma effect)
 * at each hypothetical spot, and the theoretical hedge adjustment is
 * summed. Three curves come out of that:
 *
 *   H(S)   total hedge pressure   - estimated shares vs. right now
 *   H'(S)  marginal hedge pressure - shares per further $1 of spot move
 *   H''(S) hedge acceleration      - how fast H'(S) itself is changing
 *
 * Sign convention: H'(S) < 0 is stabilizing (sell rallies, buy declines -
 * countertrend, associated with net-long dealer gamma). H'(S) > 0 is
 * destabilizing (buy rallies, sell declines - procyclical, associated with
 * net-short dealer gamma). A "cliff" is a location where |H''(S)| is
 * unusually large and persists across more than one grid point - not
 * necessarily where H(S) or gross GEX is largest. A major GEX strike can
 * be a smooth wall (large H, modest H'') rather than a cliff; a cliff can
 * occur between strikes, where several contracts' delta curves overlap
 * and their combined curvature peaks somewhere no strike sits.
 *
 * This is a model of hedge-demand curvature, not a price forecast. It does
 * not show that dealers hold the assumed position, that any estimated
 * hedge is actually executed, or that price must reverse at a stabilizing
 * cliff or accelerate through a destabilizing one - see diagnostics.disclosures.
 *
 * Stated simplifications (documented, matching every other engine in this
 * app): dealer sign is modeled across scenarios, never asserted as known;
 * only delta is repriced (no time/IV movement - that's charmEngine.ts's
 * and vannaEngine.ts's job respectively); light 5-point moving-average
 * smoothing removes single-point quote noise before differentiating,
 * deliberately not enough to erase genuine sharp 0DTE transitions; cliff
 * selection requires persistence, a minimum spacing between selected
 * cliffs, and rough agreement across two alternate dealer-sign weightings
 * (a "surface" proxy - not full sticky-strike/sticky-delta repricing,
 * which would require rebuilding the whole curve under a fitted smile
 * shift, out of scope for what is already an O(grid x chain) computation).
 */

import { bsPrice } from "@/lib/blackScholes";
import type { ChainStrikeInput } from "@/lib/gex";
import { median } from "@/lib/gexAnalytics";

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

/** H(S): total estimated hedge adjustment (shares) vs. right now, delta-only reprice (time/IV held fixed at today's quote). */
function hedgeAt(chain: ChainStrikeInput[], spot0: number, T: number, r: number, q: number, evalSpot: number, callWeight: number, putWeight: number): number {
  let netDelta = 0;
  for (const row of chain) {
    if (row.oi <= 0 || row.iv <= 0) continue;
    const d0 = bsDeltaAt(spot0, row.strike, T, row.iv, r, q, row.side === "call");
    const d1 = bsDeltaAt(evalSpot, row.strike, T, row.iv, r, q, row.side === "call");
    const weight = row.side === "call" ? callWeight : putWeight;
    netDelta += weight * row.oi * 100 * (d1 - d0);
  }
  return -netDelta;
}

function smooth(values: number[], window = 5): number[] {
  const half = Math.floor(window / 2);
  return values.map((_, i) => {
    const lo = Math.max(0, i - half);
    const hi = Math.min(values.length - 1, i + half);
    const slice = values.slice(lo, hi + 1);
    return slice.reduce((s, v) => s + v, 0) / slice.length;
  });
}

function firstDeriv(y: number[], h: number): number[] {
  const n = y.length;
  return y.map((_, i) => {
    if (i === 0) return (y[1] - y[0]) / h;
    if (i === n - 1) return (y[n - 1] - y[n - 2]) / h;
    return (y[i + 1] - y[i - 1]) / (2 * h);
  });
}

function secondDeriv(y: number[], h: number): number[] {
  const n = y.length;
  return y.map((_, i) => {
    if (i === 0 || i === n - 1) return 0;
    return (y[i + 1] - 2 * y[i] + y[i - 1]) / (h * h);
  });
}

function dealerSignVariants(flowImbalance: number | null): { name: string; callWeight: number; putWeight: number }[] {
  const imb = Number.isFinite(flowImbalance) ? Math.max(-1, Math.min(1, flowImbalance as number)) : 0;
  return [
    { name: "conventional", callWeight: 1, putWeight: 1 },
    { name: "call_heavy", callWeight: 1.5, putWeight: 0.5 },
    { name: "put_heavy", callWeight: 0.5, putWeight: 1.5 },
    { name: "dealer_flow_constrained", callWeight: 1 + imb * 0.5, putWeight: 1 - imb * 0.5 },
  ];
}

export interface HedgeCurvePoint {
  price: number;
  H: number;
  Hprime: number;
  Hdoubleprime: number;
  accelZ: number;
}

export type CliffType = "stabilizing" | "destabilizing";

export interface HedgeCliff {
  price: number;
  direction: "upside" | "downside";
  type: CliffType;
  pressureAfter: number;
  score: number;
}

export interface FeedbackFlip {
  price: number;
  belowType: CliffType;
  aboveType: CliffType;
}

export interface MaxPinning {
  price: number | null;
  pressure: number | null;
}

export interface HedgeBalanceZero {
  price: number | null;
}

export interface HedgeCliffResult {
  curve: HedgeCurvePoint[];
  upsideCliff: HedgeCliff | null;
  downsideCliff: HedgeCliff | null;
  maxPinning: MaxPinning;
  feedbackFlip: FeedbackFlip | null;
  hedgeBalanceZero: HedgeBalanceZero;
  diagnostics: {
    pricingModel: string;
    gridStep: number;
    gridRangePct: number;
    disclosures: string[];
    lastCalculatedAt: number;
  };
}

function findZeroCrossings(prices: number[], values: number[]): number[] {
  const crossings: number[] = [];
  for (let i = 1; i < values.length; i++) {
    if (values[i - 1] === 0) continue;
    if (Math.sign(values[i - 1]) !== Math.sign(values[i])) {
      const t = Math.abs(values[i - 1]) / (Math.abs(values[i - 1]) + Math.abs(values[i]) + 1e-9);
      crossings.push(prices[i - 1] + (prices[i] - prices[i - 1]) * t);
    }
  }
  return crossings;
}

export function computeHedgeCliffMap(params: {
  chain: ChainStrikeInput[];
  spot: number;
  r: number;
  q: number;
  dteHours: number;
  flowImbalance: number | null;
}): HedgeCliffResult {
  const { chain, spot, r, q, dteHours, flowImbalance } = params;
  const T = Math.max(dteHours, 0.05) / 24 / 365;

  const rangePct = 0.01;
  const steps = 120;
  const h = (2 * rangePct * spot) / steps;
  const prices: number[] = [];
  for (let i = 0; i <= steps; i++) prices.push(spot * (1 - rangePct) + h * i);

  const variants = dealerSignVariants(flowImbalance);
  const conventional = variants[0];
  const rawH = prices.map((p) => hedgeAt(chain, spot, T, r, q, p, conventional.callWeight, conventional.putWeight));
  const smoothedH = smooth(rawH, 5);
  const Hprime = firstDeriv(smoothedH, h);
  const Hdouble = secondDeriv(smoothedH, h);
  const medAbsHdd = median(Hdouble.map((v) => Math.abs(v))) || 1;
  const accelZ = Hdouble.map((v) => v / medAbsHdd);

  const curve: HedgeCurvePoint[] = prices.map((price, i) => ({ price, H: smoothedH[i], Hprime: Hprime[i], Hdoubleprime: Hdouble[i], accelZ: accelZ[i] }));

  // Alternate dealer-sign curves, used only as a rough "surface agreement" confidence check on candidate cliffs.
  const altHdouble = variants.slice(1).map((v) => {
    const raw = prices.map((p) => hedgeAt(chain, spot, T, r, q, p, v.callWeight, v.putWeight));
    return secondDeriv(smooth(raw, 5), h);
  });

  const spotIdx = prices.reduce((best, p, i) => (Math.abs(p - spot) < Math.abs(prices[best] - spot) ? i : best), 0);
  const minDistancePts = Math.max(3, Math.round(steps * 0.03));

  const candidates: { idx: number; score: number }[] = [];
  for (let i = 2; i < curve.length - 2; i++) {
    const absAcc = Math.abs(curve[i].accelZ);
    if (absAcc < Math.abs(curve[i - 1].accelZ) || absAcc < Math.abs(curve[i + 1].accelZ)) continue; // local max only
    if (absAcc < 1.5) continue; // must clear a minimum curvature threshold
    const persistent = Math.abs(curve[i - 1].accelZ) > 1 || Math.abs(curve[i + 1].accelZ) > 1;
    if (!persistent) continue;

    const agreementCount = altHdouble.filter((ac) => Math.sign(ac[i]) === Math.sign(curve[i].Hdoubleprime)).length;
    const surfaceScore = 0.5 + 0.5 * (agreementCount / Math.max(1, altHdouble.length));
    const marginalMag = Math.abs(curve[i].Hprime);
    const score = absAcc * Math.log(1 + marginalMag / 100_000) * surfaceScore;
    candidates.push({ idx: i, score });
  }

  candidates.sort((a, b) => b.score - a.score);
  const kept: typeof candidates = [];
  for (const c of candidates) {
    if (kept.some((k) => Math.abs(k.idx - c.idx) < minDistancePts)) continue;
    kept.push(c);
  }

  const upsideBest = kept.filter((c) => c.idx > spotIdx).sort((a, b) => b.score - a.score)[0];
  const downsideBest = kept.filter((c) => c.idx < spotIdx).sort((a, b) => b.score - a.score)[0];

  function buildCliff(c: { idx: number; score: number } | undefined, direction: "upside" | "downside"): HedgeCliff | null {
    if (!c) return null;
    const point = curve[c.idx];
    const afterIdx = direction === "upside" ? Math.min(curve.length - 1, c.idx + minDistancePts) : Math.max(0, c.idx - minDistancePts);
    const pressureAfter = curve[afterIdx].Hprime;
    const type: CliffType = pressureAfter < 0 ? "stabilizing" : "destabilizing";
    return { price: point.price, direction, type, pressureAfter, score: c.score };
  }

  const upsideCliff = buildCliff(upsideBest, "upside");
  const downsideCliff = buildCliff(downsideBest, "downside");

  let pinIdx = 0;
  for (let i = 1; i < curve.length; i++) if (curve[i].Hprime < curve[pinIdx].Hprime) pinIdx = i;
  const maxPinning: MaxPinning = { price: curve[pinIdx]?.price ?? null, pressure: curve[pinIdx]?.Hprime ?? null };

  const flipCrossings = findZeroCrossings(prices, Hprime).sort((a, b) => Math.abs(a - spot) - Math.abs(b - spot));
  let feedbackFlip: FeedbackFlip | null = null;
  if (flipCrossings.length) {
    const flipPrice = flipCrossings[0];
    const idx = prices.reduce((best, p, i) => (Math.abs(p - flipPrice) < Math.abs(prices[best] - flipPrice) ? i : best), 0);
    const belowIdx = Math.max(0, idx - 2);
    const aboveIdx = Math.min(curve.length - 1, idx + 2);
    feedbackFlip = {
      price: flipPrice,
      belowType: curve[belowIdx].Hprime < 0 ? "stabilizing" : "destabilizing",
      aboveType: curve[aboveIdx].Hprime < 0 ? "stabilizing" : "destabilizing",
    };
  }

  // H(S) is trivially zero at spot by construction - only a crossing at least a few grid points away from spot counts as a genuine second balance point.
  const balanceCrossings = findZeroCrossings(prices, smoothedH).filter((p) => Math.abs(p - spot) > h * 3);
  const hedgeBalanceZero: HedgeBalanceZero = { price: balanceCrossings.length ? balanceCrossings.sort((a, b) => Math.abs(a - spot) - Math.abs(b - spot))[0] : null };

  return {
    curve,
    upsideCliff,
    downsideCliff,
    maxPinning,
    feedbackFlip,
    hedgeBalanceZero,
    diagnostics: {
      pricingModel: "Black-Scholes bump-and-reprice delta, spot-only reprice (time/IV held fixed) across a fine hypothetical price grid, 5-point moving-average smoothed before differentiating",
      gridStep: h,
      gridRangePct: rangePct * 100,
      disclosures: [
        "This is a model of hedge-demand curvature built from the current live chain, not a price forecast and not based on historical data.",
        "It does not prove dealers actually hold the assumed position, that any estimated hedge is executed immediately, or that price must reverse at a stabilizing cliff or accelerate through a destabilizing one.",
        "A cliff marks where the options-driven feedback mechanism changes quickly - the sign of H'(S) after crossing it indicates whether that change would theoretically resist or reinforce a move, not a prediction that it will.",
      ],
      lastCalculatedAt: Date.now(),
    },
  };
}
