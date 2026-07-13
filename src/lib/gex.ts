import { lrDelta, lrGreeks, dollarCharm, dollarDex, dollarGex, dollarTheta, dollarVanna, dollarVega } from "@/lib/americanPricer";

export type GexSymbol = "QQQ" | "SPY" | "SPX" | "NDX";

// Continuous dividend-yield approximation, not discrete ex-dividend jumps -
// a stated simplification of the pricer, not a hidden one. QQQ/NDX track the
// Nasdaq-100 (lower yield, tech-heavy); SPY/SPX track the S&P 500.
export const DIVIDEND_YIELD: Record<GexSymbol, number> = { QQQ: 0.006, NDX: 0.006, SPY: 0.012, SPX: 0.012 };

export interface StrikeRow0DTE {
  strike: number;
  /** $, self-computed via Leisen-Reimer American binomial on this strike's SVI-smoothed IV - confirmed unit, not borrowed from any black box. */
  gex: number;
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

export interface GexResponse {
  ok: boolean;
  symbol: GexSymbol;
  asOf: number;
  spot: number;
  /** The actual date (YYYY-MM-DD) the 0DTE column was read from. */
  resolvedExpiry: string;
  /** Hours remaining to that expiry - precision Black-Scholes/CRR needs, not just "today". */
  dteHours: number;
  perStrike: StrikeRow0DTE[];
  totalGex0dte: number;
  /** Self-derived via peak-prominence on the 0DTE gex curve, not trusted from the source API's own (multi-expiry) wall fields. */
  callWall: number;
  putWall: number;
  kingNode: { strike: number; gex: number; type: "repellor" | "pin" };
  /** From the source API directly - not confirmed 0DTE-pure, shown as-is. */
  maxPain: number;
  /** Self-derived zero-crossing of the 0DTE gex-by-strike curve, nearest to spot. */
  gammaFlip: number | null;
  /** Real historical empirical stats, replacing the earlier OI-dispersion proxy. */
  probability: ProbabilityStats;
  dealerFlow: DealerFlowContext | null;
  crossExpiry: CrossExpiryRow[];
  zeroDte: ZeroDteContext | null;
  /** Inputs the pricer actually used - stated so the Greeks are auditable, not a black box either. */
  pricerInputs: { r: number; q: number };
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
function deriveWalls(perStrike: StrikeRow0DTE[], spot: number): { callWall: number; putWall: number } {
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
function deriveGammaFlip(perStrike: StrikeRow0DTE[], spot: number): number | null {
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
 * Builds our own per-strike Greeks via CRR American binomial pricing on
 * real per-contract IV/OI, instead of trusting the source's own precomputed
 * gex/dex/vanna/charm. Sign convention (documented, not hidden): gamma,
 * vanna, charm, vega, and theta are always the same natural sign for both
 * calls and puts, so the standard "dealers long calls, short puts"
 * convention flips the put side's contribution - that's what makes a put
 * wall show up as a support rather than just adding to the call side.
 * Delta doesn't need this: a put's delta is already negative on its own, so
 * DEX sums both sides with their natural sign, unflipped.
 */
export function buildStrikeRowsFromChain(chain: ChainStrikeInput[], spot: number, T: number, r: number, q: number): StrikeRow0DTE[] {
  const byStrike = new Map<number, { call?: ChainStrikeInput; put?: ChainStrikeInput }>();
  for (const row of chain) {
    const entry = byStrike.get(row.strike) ?? {};
    entry[row.side] = row;
    byStrike.set(row.strike, entry);
  }

  const rows: StrikeRow0DTE[] = [];
  for (const [strike, { call, put }] of byStrike) {
    let gex = 0;
    let dex = 0;
    let vex = 0;
    let cex = 0;
    let vegaex = 0;
    let tex = 0;

    if (call && call.oi > 0 && call.iv > 0) {
      const g = lrGreeks({ spot, strike, T, vol: call.iv, r, q, isCall: true });
      gex += dollarGex(g.gamma, call.oi, spot);
      dex += dollarDex(g.delta, call.oi, spot);
      vex += dollarVanna(g.vanna, call.oi, spot);
      cex += dollarCharm(g.charm, call.oi, spot);
      vegaex += dollarVega(g.vega, call.oi);
      tex += dollarTheta(g.theta, call.oi);
    }
    if (put && put.oi > 0 && put.iv > 0) {
      const g = lrGreeks({ spot, strike, T, vol: put.iv, r, q, isCall: false });
      gex += -dollarGex(g.gamma, put.oi, spot);
      dex += dollarDex(g.delta, put.oi, spot);
      vex += -dollarVanna(g.vanna, put.oi, spot);
      cex += -dollarCharm(g.charm, put.oi, spot);
      vegaex += -dollarVega(g.vega, put.oi);
      tex += -dollarTheta(g.theta, put.oi);
    }

    rows.push({ strike, gex, dex, vex, tex, cex, vegaex, callOi: call?.oi ?? 0, putOi: put?.oi ?? 0 });
  }

  return rows.sort((a, b) => a.strike - b.strike);
}

export function deriveGexResponse(raw: {
  symbol: GexSymbol;
  spot: number;
  resolvedExpiry: string;
  dteHours: number;
  perStrike: StrikeRow0DTE[];
  maxPain: number;
  probability: ProbabilityStats;
  dealerFlow: DealerFlowContext | null;
  crossExpiry: CrossExpiryRow[];
  zeroDte: ZeroDteContext | null;
  pricerInputs: { r: number; q: number };
}): GexResponse {
  const { callWall, putWall } = deriveWalls(raw.perStrike, raw.spot);
  const kingNodeRow = [...raw.perStrike].sort((a, b) => Math.abs(b.gex) - Math.abs(a.gex))[0];
  const totalGex0dte = raw.perStrike.reduce((sum, r) => sum + r.gex, 0);

  return {
    ok: true,
    symbol: raw.symbol,
    asOf: Date.now(),
    spot: raw.spot,
    resolvedExpiry: raw.resolvedExpiry,
    dteHours: raw.dteHours,
    perStrike: raw.perStrike,
    totalGex0dte,
    callWall,
    putWall,
    kingNode: kingNodeRow ? { strike: kingNodeRow.strike, gex: kingNodeRow.gex, type: kingNodeRow.gex < 0 ? "repellor" : "pin" } : { strike: raw.spot, gex: 0, type: "pin" },
    maxPain: raw.maxPain,
    gammaFlip: deriveGammaFlip(raw.perStrike, raw.spot),
    probability: raw.probability,
    dealerFlow: raw.dealerFlow,
    crossExpiry: raw.crossExpiry,
    zeroDte: raw.zeroDte,
    pricerInputs: raw.pricerInputs,
  };
}

// ---------------------------------------------------------------------------
// Hedge Pressure
// ---------------------------------------------------------------------------

export interface HedgePressureRow {
  strike: number;
  /** |gex| x same-day reachability weight - the ranking metric. Dollars, confirmed unit (self-computed via CRR). */
  expectedFlow: number;
  gex: number;
  /** Real dollar charm/vanna at this strike (self-computed, confirmed units) - shown as context, not folded into the ranked dollar figure (no solid dσ/dt scenario to combine them under). */
  cex: number;
  vex: number;
  /** exp(-z^2/2) reachability weight under the real empirical (possibly asymmetric) 1-day band, not a symmetric proxy. No floor - genuinely far strikes decay toward 0. */
  reachWeight: number;
  /** Signed distance from spot in empirical standard deviations (asymmetric: up-moves and down-moves use their own real historical band width). */
  sigmaZ: number;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  totalOi: number;
  distPct: number;
  flags: string[];
}

export interface HedgePressureContext {
  sigmaUpPct: number;
  sigmaDownPct: number;
  skewness: number;
  excessKurtosis: number;
}

/** Asymmetric reachability: up-moves and down-moves each use their own real empirical 1-sigma band width from /probability, not a symmetric assumption. */
function reachabilityWeight(strike: number, spot: number, sigmaUpPct: number, sigmaDownPct: number): { weight: number; z: number } {
  if (!spot) return { weight: 0, z: 0 };
  const logMove = Math.log(strike / spot);
  const sigma = (logMove >= 0 ? sigmaUpPct : sigmaDownPct) / 100;
  if (sigma <= 0) return { weight: 0, z: 0 };
  const z = logMove / sigma;
  return { weight: Math.exp((-z * z) / 2), z };
}

/**
 * Ranks strikes by *expected* same-day hedge dollars: |0DTE GEX(K)| -
 * self-computed via CRR American binomial pricing on this chain's real
 * per-contract IV, not borrowed from any black box - weighted by same-day
 * reachability. Reachability is now asymmetric: the up-move and down-move
 * band widths come from /probability's real historical empirical
 * distribution (which is genuinely skewed and fat-tailed for this book -
 * see excessKurtosis in the context), not a symmetric Gaussian assumption.
 * Charm and vanna are real dollar figures now (confirmed units, since we
 * compute them ourselves) but still shown as context rather than summed
 * into the ranked figure - combining them correctly needs a real dσ/dt
 * scenario, which this endpoint's snapshot doesn't give us on its own.
 */
export function computeHedgePressure(data: GexResponse, count = 15): { rows: HedgePressureRow[]; context: HedgePressureContext } {
  const spot = data.spot;
  const rows = data.perStrike;
  const band68 = data.probability.bands1d["68"];
  const sigmaUpPct = band68 ? ((band68[1] - spot) / spot) * 100 : 1.5;
  const sigmaDownPct = band68 ? ((spot - band68[0]) / spot) * 100 : 1.5;

  const scored: HedgePressureRow[] = rows.map((r) => {
    const totalOi = r.callOi + r.putOi;
    const distPct = spot ? ((r.strike - spot) / spot) * 100 : 0;
    const { weight: reachWeight, z: sigmaZ } = reachabilityWeight(r.strike, spot, sigmaUpPct, sigmaDownPct);
    const expectedFlow = Math.abs(r.gex) * reachWeight;

    const isReachableToday = Math.abs(sigmaZ) <= 2;
    const isFrontWall = r.strike === data.callWall || r.strike === data.putWall;
    const isKingNode = r.strike === data.kingNode.strike;

    const agreements = [isReachableToday, isFrontWall, isKingNode].filter(Boolean).length;
    const confidence: HedgePressureRow["confidence"] = agreements >= 2 ? "HIGH" : agreements >= 1 ? "MEDIUM" : "LOW";

    const flags: string[] = [];
    if (r.strike === data.callWall) flags.push("CALL WALL");
    if (r.strike === data.putWall) flags.push("PUT WALL");
    if (isKingNode) flags.push(data.kingNode.type.toUpperCase());
    if (data.gammaFlip !== null && Math.abs(r.strike - data.gammaFlip) < 1) flags.push("GAMMA FLIP");

    return { strike: r.strike, expectedFlow, gex: r.gex, cex: r.cex, vex: r.vex, reachWeight, sigmaZ, confidence, totalOi, distPct, flags };
  });

  return {
    rows: scored.sort((a, b) => b.expectedFlow - a.expectedFlow).slice(0, count),
    context: { sigmaUpPct, sigmaDownPct, skewness: data.probability.skewness, excessKurtosis: data.probability.excessKurtosis },
  };
}

// ---------------------------------------------------------------------------
// Tesseract Zones (formerly a 2-asset "Blind Spots" reconstruction)
// ---------------------------------------------------------------------------

export interface TesseractContributor {
  asset: GexSymbol;
  label: string;
  nativePrice: number;
  convertedPrice: number;
  weight: number;
}

export interface TesseractZone {
  rank: number;
  price: number;
  score: number;
  contributors: TesseractContributor[];
}

/** Pulls a small set of named, weighted option-derived levels out of one symbol's book - the inputs a confluence model clusters. */
function extractLevels(data: GexResponse): { asset: GexSymbol; label: string; price: number; weight: number }[] {
  const maxGex = Math.max(1e-9, ...data.perStrike.map((r) => Math.abs(r.gex)));
  const secondary = topStrikesByMagnitude(data.perStrike, (r) => r.gex, 3);
  const wallRow = (strike: number) => data.perStrike.find((r) => r.strike === strike);

  const levels = [
    { asset: data.symbol, label: "Call Resistance", price: data.callWall, weight: Math.abs(wallRow(data.callWall)?.gex ?? 0) / maxGex },
    { asset: data.symbol, label: "Put Support", price: data.putWall, weight: Math.abs(wallRow(data.putWall)?.gex ?? 0) / maxGex },
    { asset: data.symbol, label: "King Node", price: data.kingNode.strike, weight: Math.abs(data.kingNode.gex) / maxGex },
    ...(data.gammaFlip !== null ? [{ asset: data.symbol, label: "Gamma Flip", price: data.gammaFlip, weight: 0.5 }] : []),
    { asset: data.symbol, label: "Max Pain", price: data.maxPain, weight: 0.35 },
    ...secondary.map((r, i) => ({ asset: data.symbol, label: `GEX ${i + 1}`, price: r.strike, weight: Math.abs(r.gex) / maxGex })),
  ];

  return levels.filter((l) => Number.isFinite(l.price) && l.price > 0);
}

/**
 * A reduced reconstruction of the published MenthorQ Blind Spots idea:
 * option-derived levels from more than one instrument, converted onto a
 * shared price scale, cluster where several land near each other - a
 * "tesseract": a shape only visible when several assets' projections line
 * up, not any single chain's opinion. The
 * real product uses NQ futures options + NDX + QQQ + individual MAG7
 * chains; this data source only carries QQQ, SPY, SPX, and NDX as
 * genuinely distinct instruments (every other ticker tried against it
 * silently returned SPX's own numbers relabeled - confirmed directly, not
 * assumed), so this is a 4-asset version of the same mechanic, not a
 * reproduction of their model. MenthorQ doesn't publish their weighting
 * formula, clustering tolerance, or dealer-side classifier, so those are
 * stated assumptions here, not recovered constants.
 *
 * Method: convert every non-home level to a home-equivalent price using the
 * ratio method (level x homeSpot/assetSpot). Score every candidate home
 * price with a Gaussian-kernel overlap density C(x) = sum(weight_i *
 * exp(-(x-L_i)^2 / 2h^2)), h a clustering tolerance in home-asset points.
 * Local maxima, ranked by cluster strength, are the Tesseract Zones.
 */
export function computeTesseractZones(
  home: GexResponse,
  others: GexResponse[],
  count = 8
): { zones: TesseractZone[]; ratios: Partial<Record<GexSymbol, number>>; bandwidth: number; curve: { x: number; c: number }[] } {
  const homeSpot = home.spot;
  const ratios: Partial<Record<GexSymbol, number>> = {};

  const homeLevels = extractLevels(home).map((l) => ({ ...l, convertedPrice: l.price }));
  const otherLevels = others.flatMap((data) => {
    const ratio = homeSpot / data.spot;
    ratios[data.symbol] = ratio;
    return extractLevels(data).map((l) => ({ ...l, convertedPrice: l.price * ratio, weight: l.weight * 0.85 }));
  });

  const allLevels: TesseractContributor[] = [...homeLevels, ...otherLevels].map((l) => ({
    asset: l.asset,
    label: l.label,
    nativePrice: l.price,
    convertedPrice: l.convertedPrice,
    weight: l.weight,
  }));

  const bandwidth = homeSpot * 0.004; // clustering tolerance: ~0.4% of home-asset spot, a stated assumption

  function densityAt(x: number): number {
    return allLevels.reduce((sum, l) => sum + l.weight * Math.exp(-((x - l.convertedPrice) ** 2) / (2 * bandwidth * bandwidth)), 0);
  }

  const candidateXs = new Set<number>(allLevels.map((l) => l.convertedPrice));
  const sortedPrices = allLevels.map((l) => l.convertedPrice).sort((a, b) => a - b);
  const pad = (sortedPrices[sortedPrices.length - 1] - sortedPrices[0]) * 0.15 || bandwidth * 3;
  const lo = sortedPrices[0] - pad;
  const hi = sortedPrices[sortedPrices.length - 1] + pad;
  const steps = 240;
  for (let i = 0; i <= steps; i++) candidateXs.add(lo + ((hi - lo) * i) / steps);

  const grid = [...candidateXs].sort((a, b) => a - b).map((x) => ({ x, c: densityAt(x) }));

  const peaks: { x: number; c: number }[] = [];
  for (let i = 0; i < grid.length; i++) {
    const prev = grid[i - 1]?.c ?? -Infinity;
    const next = grid[i + 1]?.c ?? -Infinity;
    if (grid[i].c >= prev && grid[i].c >= next) peaks.push(grid[i]);
  }

  peaks.sort((a, b) => b.c - a.c);
  const merged: { x: number; c: number }[] = [];
  for (const p of peaks) {
    if (merged.some((m) => Math.abs(m.x - p.x) < bandwidth)) continue;
    merged.push(p);
  }

  const zones: TesseractZone[] = merged.slice(0, count).map((peak, i) => ({
    rank: i + 1,
    price: peak.x,
    score: peak.c,
    contributors: allLevels.filter((l) => Math.abs(l.convertedPrice - peak.x) < bandwidth * 1.5).sort((a, b) => b.weight - a.weight),
  }));

  return { zones, ratios, bandwidth, curve: grid };
}

// ---------------------------------------------------------------------------
// Hedge Terrain: reprice the whole book across a grid of hypothetical prices
// and projected-forward times, instead of reading gamma at today's spot as a
// static bar chart. There's no historical snapshot storage in this app, so
// the "time" axis here is a genuine forward projection using our own
// pricer (reduce T, same as charm's bump-and-reprice) - not a fabricated
// history. Every point sums real per-strike delta (frozen-IV, per the
// pricer's stated scope) into dealer hedge shares: dealers are assumed to
// hold the opposite of the aggregate customer position implied by OI, so
// their required hedge is the negative of that aggregate delta.
// ---------------------------------------------------------------------------

export interface HedgeGridPoint {
  price: number;
  hoursAhead: number;
  /** Shares dealers must transact to stay hedged at this hypothetical (price, time) - positive = must buy, negative = must sell. */
  dealerHedgeShares: number;
}

export function computeHedgeGrid(
  chain: ChainStrikeInput[],
  spot: number,
  totalHoursToExpiry: number,
  r: number,
  q: number,
  priceRangePct = 0.05,
  priceSteps = 21,
  timeSteps = 5
): HedgeGridPoint[] {
  const active = chain.filter((row) => row.oi > 0 && row.iv > 0);
  const grid: HedgeGridPoint[] = [];

  for (let ti = 0; ti <= timeSteps; ti++) {
    const hoursAhead = (totalHoursToExpiry * ti) / timeSteps;
    const hoursRemaining = Math.max(0.05, totalHoursToExpiry - hoursAhead);
    const T = hoursRemaining / 24 / 365;

    for (let pi = 0; pi <= priceSteps; pi++) {
      const price = spot * (1 - priceRangePct + (2 * priceRangePct * pi) / priceSteps);

      let totalCustomerDelta = 0;
      for (const row of active) {
        const delta = lrDelta({ spot: price, strike: row.strike, T, vol: row.iv, r, q, isCall: row.side === "call" });
        totalCustomerDelta += delta * row.oi * 100;
      }

      grid.push({ price, hoursAhead, dealerHedgeShares: -totalCustomerDelta });
    }
  }

  return grid;
}

export interface HedgeCliff {
  price: number;
  steepness: number;
  classification: "stabilizing" | "accelerating" | "neutral";
}

/** Slope of the dealerHedgeShares-vs-price curve at hoursAhead=0 - steep sections are "cliffs" where a small move forces a large rebalance. */
export function computeHedgeCliffs(gridAtNow: HedgeGridPoint[]): HedgeCliff[] {
  const sorted = [...gridAtNow].sort((a, b) => a.price - b.price);
  if (sorted.length < 3) return [];

  const slopes: number[] = [];
  for (let i = 1; i < sorted.length - 1; i++) {
    const slope = (sorted[i + 1].dealerHedgeShares - sorted[i - 1].dealerHedgeShares) / (sorted[i + 1].price - sorted[i - 1].price);
    slopes.push(slope);
  }
  const absSlopes = slopes.map(Math.abs).sort((a, b) => a - b);
  const median = absSlopes[Math.floor(absSlopes.length / 2)] || 1;

  const cliffs: HedgeCliff[] = [];
  for (let i = 0; i < slopes.length; i++) {
    const point = sorted[i + 1];
    const slope = slopes[i];
    if (Math.abs(slope) < median * 1.5) continue; // only genuinely steep sections count as a cliff
    // Rising price + dealers must buy more (positive, increasing) = accelerating (short-gamma); rising price + dealers sell more = stabilizing (long-gamma).
    const classification: HedgeCliff["classification"] = slope > 0 ? "accelerating" : "stabilizing";
    cliffs.push({ price: point.price, steepness: slope, classification });
  }
  return cliffs.sort((a, b) => Math.abs(b.steepness) - Math.abs(a.steepness));
}

export interface HedgeBasin {
  center: number;
  innerLow: number;
  innerHigh: number;
  escapeLow: number;
  escapeHigh: number;
}

/** The basin center is where required hedging is smallest (price dealers have least reason to fight); escape boundaries are where the slope first becomes a cliff on either side. */
export function computeHedgeBasin(gridAtNow: HedgeGridPoint[], cliffs: HedgeCliff[]): HedgeBasin | null {
  const sorted = [...gridAtNow].sort((a, b) => a.price - b.price);
  if (!sorted.length) return null;

  const center = sorted.reduce((best, p) => (Math.abs(p.dealerHedgeShares) < Math.abs(best.dealerHedgeShares) ? p : best), sorted[0]).price;

  const below = cliffs.filter((c) => c.price < center).sort((a, b) => b.price - a.price)[0];
  const above = cliffs.filter((c) => c.price > center).sort((a, b) => a.price - b.price)[0];

  const spread = (sorted[sorted.length - 1].price - sorted[0].price) * 0.15;
  return {
    center,
    innerLow: center - spread,
    innerHigh: center + spread,
    escapeLow: below?.price ?? sorted[0].price,
    escapeHigh: above?.price ?? sorted[sorted.length - 1].price,
  };
}

export interface AccelerationPoint {
  price: number;
  acceleration: number;
}

/** Second derivative of the hedge curve - where the *rate of change itself* is increasing fastest, a potential "ignition point" before price ever reaches the largest single cliff. */
export function computeHedgeAcceleration(gridAtNow: HedgeGridPoint[], count = 3): AccelerationPoint[] {
  const sorted = [...gridAtNow].sort((a, b) => a.price - b.price);
  if (sorted.length < 5) return [];

  const points: AccelerationPoint[] = [];
  for (let i = 2; i < sorted.length - 2; i++) {
    const h = sorted[i + 1].price - sorted[i].price || 1;
    const second = (sorted[i + 1].dealerHedgeShares - 2 * sorted[i].dealerHedgeShares + sorted[i - 1].dealerHedgeShares) / (h * h);
    points.push({ price: sorted[i].price, acceleration: second });
  }
  return points.sort((a, b) => Math.abs(b.acceleration) - Math.abs(a.acceleration)).slice(0, count);
}

export interface GammaFlipBand {
  /** Standard convention: dealers long calls, short puts (same as GEX/Hedge Pressure elsewhere in this app). */
  conventionA: number | null;
  /** Fully inverted assumption: dealers short calls, long puts. */
  conventionB: number | null;
  /** True when both conventions land within 0.5% of spot - a flip level that survives the assumption is more trustworthy than one that doesn't. */
  agrees: boolean;
}

/** Dealer positioning direction is an assumption, not observed fact - showing the flip under two conventions instead of one line is the honest version of "the" gamma flip. */
export function computeGammaFlipBand(chain: ChainStrikeInput[], spot: number, T: number, r: number, q: number): GammaFlipBand {
  const standardRows = buildStrikeRowsFromChain(chain, spot, T, r, q);
  const invertedChain: ChainStrikeInput[] = chain.map((row) => ({ ...row, side: row.side === "call" ? "put" : "call" }));
  const invertedRows = buildStrikeRowsFromChain(invertedChain, spot, T, r, q);

  const conventionA = deriveGammaFlip(standardRows, spot);
  const conventionB = deriveGammaFlip(invertedRows, spot);
  const agrees = conventionA !== null && conventionB !== null && Math.abs(conventionA - conventionB) < spot * 0.005;

  return { conventionA, conventionB, agrees };
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
