export type GexSymbol = "QQQ" | "SPY";

export interface StrikeRow0DTE {
  strike: number;
  /** $M, 0DTE-only column of the chain's own gex grid - the one greek here with a confirmed, documented unit. */
  gex: number;
  /** 0DTE-only, unit not documented by the source API - used directionally, never summed with gex. */
  dex: number;
  /** Vanna, 0DTE-only, unit not documented. */
  vex: number;
  /** Theta, 0DTE-only, unit not documented. */
  tex: number;
  /** Charm, 0DTE-only, unit not documented. */
  cex: number;
  /** Vega, 0DTE-only, unit not documented. */
  vegaex: number;
  /** Aggregate across ALL expiries, not 0DTE-only - the source API doesn't expose OI broken out per expiry. */
  callOi: number;
  putOi: number;
}

export interface GexResponse {
  ok: boolean;
  symbol: GexSymbol;
  asOf: number;
  spot: number;
  /** The actual date (YYYY-MM-DD) the 0DTE column was read from. */
  resolvedExpiry: string;
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
  /** OI-weighted dispersion of strikes around spot, as a same-day move proxy - derived from this chain's own (aggregate) OI, not an external vol source. */
  sigma1dPct: number;
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

/** OI-weighted dispersion of strikes around spot, as a same-day move proxy derived from this chain's own OI rather than an external vol source. OI here is aggregate-across-expiries (an API limitation, not this function's choice). */
function deriveSigma1dPct(perStrike: StrikeRow0DTE[], spot: number): number {
  const withOi = perStrike.filter((r) => r.callOi + r.putOi > 0);
  const totalOi = withOi.reduce((sum, r) => sum + r.callOi + r.putOi, 0);
  if (!totalOi || !spot) return 1.5;
  const variance = withOi.reduce((sum, r) => {
    const w = r.callOi + r.putOi;
    const pct = ((r.strike - spot) / spot) * 100;
    return sum + w * pct * pct;
  }, 0);
  return Math.max(0.3, Math.sqrt(variance / totalOi));
}

export function deriveGexResponse(raw: {
  symbol: GexSymbol;
  spot: number;
  resolvedExpiry: string;
  perStrike: StrikeRow0DTE[];
  maxPain: number;
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
    perStrike: raw.perStrike,
    totalGex0dte,
    callWall,
    putWall,
    kingNode: kingNodeRow ? { strike: kingNodeRow.strike, gex: kingNodeRow.gex, type: kingNodeRow.gex < 0 ? "repellor" : "pin" } : { strike: raw.spot, gex: 0, type: "pin" },
    maxPain: raw.maxPain,
    gammaFlip: deriveGammaFlip(raw.perStrike, raw.spot),
    sigma1dPct: deriveSigma1dPct(raw.perStrike, raw.spot),
  };
}

// ---------------------------------------------------------------------------
// Hedge Pressure
// ---------------------------------------------------------------------------

export interface HedgePressureRow {
  strike: number;
  /** |gex 0DTE, $M| x same-day reachability weight - the ranking metric. Dollars, confirmed unit. */
  expectedFlow: number;
  gex: number;
  /** exp(-z^2/2) reachability weight, z = distance in 1-trading-day standard deviations. No floor - genuinely far strikes decay toward 0. */
  reachWeight: number;
  /** Signed distance from spot in 1-trading-day standard deviations. */
  sigmaZ: number;
  /** Charm/vanna shown as a normalized 0-1 share of their own grid's range, NOT dollars - their units aren't documented by the source API, so they're corroboration, never summed with gex. */
  charmShare: number;
  vannaShare: number;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  totalOi: number;
  distPct: number;
  flags: string[];
}

export interface HedgePressureContext {
  sigma1dPct: number;
}

function reachabilityWeight(strike: number, spot: number, sigma1dPct: number): { weight: number; z: number } {
  if (!spot || sigma1dPct <= 0) return { weight: 0, z: 0 };
  const z = Math.log(strike / spot) / (sigma1dPct / 100);
  return { weight: Math.exp((-z * z) / 2), z };
}

/**
 * Ranks strikes by *expected* same-day hedge dollars: |0DTE GEX(K)| - the
 * one greek here with a confirmed, documented unit ($M) - weighted by a
 * strict same-day reachability Gaussian (see reachabilityWeight). Charm and
 * vanna are surfaced per strike as a normalized 0-1 share of their own
 * grid's range, never summed into the dollar figure, because the source API
 * doesn't document their units and a wrong unit assumption is worse than no
 * number - see the methodology note in the UI for the full reasoning.
 * Cross-wall/king-node flags and OI concentration corroborate confidence but
 * stay out of the ranked dollar metric.
 */
export function computeHedgePressure(data: GexResponse, count = 15): { rows: HedgePressureRow[]; context: HedgePressureContext } {
  const spot = data.spot;
  const rows = data.perStrike;
  const maxAbsCex = Math.max(1e-9, ...rows.map((r) => Math.abs(r.cex)));
  const maxAbsVex = Math.max(1e-9, ...rows.map((r) => Math.abs(r.vex)));

  const scored: HedgePressureRow[] = rows.map((r) => {
    const totalOi = r.callOi + r.putOi;
    const distPct = spot ? ((r.strike - spot) / spot) * 100 : 0;
    const { weight: reachWeight, z: sigmaZ } = reachabilityWeight(r.strike, spot, data.sigma1dPct);
    const expectedFlow = Math.abs(r.gex) * reachWeight;

    const charmShare = Math.abs(r.cex) / maxAbsCex;
    const vannaShare = Math.abs(r.vex) / maxAbsVex;
    const isReachableToday = Math.abs(sigmaZ) <= 2;
    const isFrontWall = r.strike === data.callWall || r.strike === data.putWall;
    const isKingNode = r.strike === data.kingNode.strike;

    const agreements = [isReachableToday, charmShare > 0.3, vannaShare > 0.3, isFrontWall, isKingNode].filter(Boolean).length;
    const confidence: HedgePressureRow["confidence"] = agreements >= 3 ? "HIGH" : agreements >= 2 ? "MEDIUM" : "LOW";

    const flags: string[] = [];
    if (r.strike === data.callWall) flags.push("CALL WALL");
    if (r.strike === data.putWall) flags.push("PUT WALL");
    if (isKingNode) flags.push(data.kingNode.type.toUpperCase());
    if (data.gammaFlip !== null && Math.abs(r.strike - data.gammaFlip) < 1) flags.push("GAMMA FLIP");

    return { strike: r.strike, expectedFlow, gex: r.gex, reachWeight, sigmaZ, charmShare, vannaShare, confidence, totalOi, distPct, flags };
  });

  return { rows: scored.sort((a, b) => b.expectedFlow - a.expectedFlow).slice(0, count), context: { sigma1dPct: data.sigma1dPct } };
}

// ---------------------------------------------------------------------------
// Blind Spots
// ---------------------------------------------------------------------------

export interface BlindSpotSourceLevel {
  asset: GexSymbol;
  label: string;
  nativePrice: number;
  convertedPrice: number;
  weight: number;
}

export interface BlindSpotCluster {
  rank: number;
  price: number;
  score: number;
  contributors: BlindSpotSourceLevel[];
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
 * shared price scale, cluster where several land near each other. The real
 * product uses NQ futures options + NDX + QQQ + individual MAG7 chains;
 * this data source carries QQQ and SPY, so this is a 2-asset version of the
 * same mechanic, not a reproduction of their model - MenthorQ doesn't
 * publish their weighting formula, clustering tolerance, or dealer-side
 * classifier, so those are stated assumptions here, not recovered constants.
 *
 * Method: convert every SPY level to a QQQ-equivalent price using the ratio
 * method (level x QQQspot/SPYspot). Score every candidate QQQ price with a
 * Gaussian-kernel overlap density C(x) = sum(weight_i * exp(-(x-L_i)^2 /
 * 2h^2)), h a clustering tolerance in QQQ points. Local maxima, ranked by
 * cluster strength, are the Blind Spots.
 */
export function computeBlindSpots(qqq: GexResponse, spy: GexResponse, count = 8): { clusters: BlindSpotCluster[]; ratio: number; bandwidth: number } {
  const qqqSpot = qqq.spot;
  const spySpot = spy.spot;
  const ratio = qqqSpot / spySpot;

  const qqqLevels = extractLevels(qqq).map((l) => ({ ...l, convertedPrice: l.price }));
  const spyLevels = extractLevels(spy).map((l) => ({ ...l, convertedPrice: l.price * ratio, weight: l.weight * 0.85 }));
  const allLevels: BlindSpotSourceLevel[] = [...qqqLevels, ...spyLevels].map((l) => ({
    asset: l.asset,
    label: l.label,
    nativePrice: l.price,
    convertedPrice: l.convertedPrice,
    weight: l.weight,
  }));

  const bandwidth = qqqSpot * 0.004; // clustering tolerance: ~0.4% of QQQ spot, a stated assumption

  function densityAt(x: number): number {
    return allLevels.reduce((sum, l) => sum + l.weight * Math.exp(-((x - l.convertedPrice) ** 2) / (2 * bandwidth * bandwidth)), 0);
  }

  const candidateXs = new Set<number>(allLevels.map((l) => l.convertedPrice));
  const sortedPrices = allLevels.map((l) => l.convertedPrice).sort((a, b) => a - b);
  const lo = sortedPrices[0];
  const hi = sortedPrices[sortedPrices.length - 1];
  const steps = 200;
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

  const clusters: BlindSpotCluster[] = merged.slice(0, count).map((peak, i) => ({
    rank: i + 1,
    price: peak.x,
    score: peak.c,
    contributors: allLevels.filter((l) => Math.abs(l.convertedPrice - peak.x) < bandwidth * 1.5).sort((a, b) => b.weight - a.weight),
  }));

  return { clusters, ratio, bandwidth };
}

export function fmtNum(n: number | null | undefined, digits = 2): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return n.toLocaleString(undefined, { maximumFractionDigits: digits, minimumFractionDigits: 0 });
}

export function fmtUsd(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(2)}B`;
  return `${sign}$${abs.toFixed(2)}M`;
}

export function fmtPct(n: number | null | undefined, digits = 2): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return `${n >= 0 ? "+" : ""}${n.toFixed(digits)}%`;
}
