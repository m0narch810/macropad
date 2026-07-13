export type GexSymbol = "QQQ" | "SPX";

export interface GexStrikeRow {
  strike: number;
  gex: number;
  callGex: number;
  putGex: number;
  dex: number;
  vex: number;
  chex: number;
  /** Second-order greeks: dGamma/dSpot, dCharm/dSpot, dGamma/dVol, dVanna/dVol - the terms a first-order gamma+charm model drops. */
  speedEx: number;
  colorEx: number;
  zommaEx: number;
  vommaEx: number;
  iv: number;
  callOi: number;
  putOi: number;
}

export interface GexLevel {
  price: number;
  type: string;
  distPct: number;
  gex: number;
}

export interface GexResponse {
  ok: boolean;
  symbol: GexSymbol;
  asOf: number;
  exposure: {
    perStrike: GexStrikeRow[];
    totalGex: number;
  };
  aggregate: {
    callWall: number;
    callWallGex: number;
    putWall: number;
    putWallGex: number;
    maxPain: number;
    totalGex: number;
    flip: { nearestFlip: number; gammaAtSpot: number; ladder: { s: number; g: number }[] };
    volTrigger: { price: number; distPct: number; belowTrigger: boolean; method: string };
  };
  structure: {
    regime: string;
    regimeNote: string;
    totalGex: number;
    kingNode: { strike: number; gex: number; type: string };
    levels: GexLevel[];
  };
  rnd: {
    ok: boolean;
    forward: number;
    mean: number;
    /** Breeden-Litzenberger risk-neutral density extracted from the chain - strikes[i] has probability density density[i], dK apart. */
    strikes: number[];
    density: number[];
    dK: number;
    quality: { p25: number; p50: number; p75: number; mass: number; usable: boolean };
  };
  shadow: {
    ok: boolean;
    regime: string;
    volMap: { hPct: number; sigUpPts: number; sigDnPts: number };
    skew: { putIvPct: number; callIvPct: number; gapPts: number; read: string };
  };
  quality: {
    atmIv: number;
    expiries: number;
    strikes: number;
  };
  development: {
    oi: {
      pcr: number;
      pcrPrior: number;
      pcrTrend: string;
      /** Strikes where OI has been building/dissolving across recent sessions - shape varies, treated defensively. */
      wallBuild: unknown[];
      wallDissolve: unknown[];
    };
    volTrig: { current: number; movePct: number; stability: string };
    iv: { atmNow: number; atmPrior: number; deltaOverDays: number; direction: string };
  };
  dealer: {
    drift: {
      netPerHourUsd: number;
      direction: string;
      bias: string;
      call: { perHourUsd: number; direction: string };
      put: { perHourUsd: number; direction: string };
      note: string;
    };
    alignment: {
      aligned: boolean;
      callAligned: boolean;
      putAligned: boolean;
      front: { callWall: number; putWall: number };
      allBook: { callWall: number; putWall: number };
    };
  };
  termContext: { exp: string; dte: number; netGex: number; regime: string; flip: number; callWall: number; putWall: number; nStrikes: number; oi: number }[];
  selection: { book: string; exp: string };
}

/** Picks the N strikes with the largest |value| under `pick`, then re-sorts them ascending by strike for a coherent x-axis. */
export function topStrikesByMagnitude<T extends { strike: number }>(rows: T[], pick: (row: T) => number, count = 22): T[] {
  return [...rows]
    .sort((a, b) => Math.abs(pick(b)) - Math.abs(pick(a)))
    .slice(0, count)
    .sort((a, b) => a.strike - b.strike);
}

export interface HedgeTaylorTerm {
  key: "gamma" | "charm" | "vanna" | "speed" | "color" | "zomma" | "vomma";
  label: string;
  dollars: number; // signed contribution to the Taylor-expansion hedge estimate
}

export interface HedgePressureRow {
  strike: number;
  /** |taylorFlow| x density weight - the ranking metric. */
  expectedFlow: number;
  /** Signed second-order Taylor-expansion estimate, before density weighting. */
  taylorFlow: number;
  /** Risk-neutral probability mass in a dK-wide bucket around this strike, from the feed's own Breeden-Litzenberger density. */
  densityWeight: number;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  terms: HedgeTaylorTerm[];
  gex: number;
  chex: number;
  vex: number;
  totalOi: number;
  distPct: number;
  flags: string[];
}

export interface HedgePressureContext {
  dSPct: number;
  dtDays: number;
  dSigmaPts: number;
}

/** Extracts strike numbers from a dev-diagnostic array of unknown shape (bare numbers, or objects carrying a `strike` field). */
function extractStrikes(arr: unknown[]): Set<number> {
  const out = new Set<number>();
  for (const item of arr) {
    if (typeof item === "number") out.add(item);
    else if (item && typeof item === "object" && "strike" in item && typeof (item as { strike: unknown }).strike === "number") {
      out.add((item as { strike: number }).strike);
    }
  }
  return out;
}

/** Nearest-point lookup into the risk-neutral density curve - 799 points is cheap to scan per render. */
function densityAt(rnd: GexResponse["rnd"], price: number): number {
  if (!rnd.strikes?.length || !rnd.density?.length) return 0;
  let bestIdx = 0;
  let bestDist = Infinity;
  for (let i = 0; i < rnd.strikes.length; i++) {
    const dist = Math.abs(rnd.strikes[i] - price);
    if (dist < bestDist) {
      bestDist = dist;
      bestIdx = i;
    }
  }
  return rnd.density[bestIdx] ?? 0;
}

/**
 * Ranks strikes by *expected* forced dealer-hedge dollars, using a real
 * second-order Taylor expansion of the change in dealer delta - the same
 * math professional risk desks use for P&L-attribution - instead of a
 * weighted composite of arbitrarily-normalized signals:
 *
 *   ΔHedge(K) = Gamma(K)·dS + Charm(K)·dt + Vanna(K)·dσ
 *             + ½Speed(K)·dS² + Color(K)·dt·dS + Zomma(K)·dS·dσ + ½Vomma(K)·dσ²
 *
 * Every term is a dollar quantity the feed already computes per strike -
 * nothing here is a picked percentage. The scenario inputs aren't guessed
 * either: dS is the feed's own last-observed move size, dt is one trading
 * day, and dσ is the feed's own realized ATM-IV drift. This is the discrete,
 * exact-at-a-point analogue of what a full stochastic-vol model (Heston)
 * would need Monte Carlo to approximate - skipped here because it would
 * require calibrating a fresh vol surface the feed doesn't expose, on top of
 * greeks that already price in the smile.
 *
 * The result is then weighted by the feed's own Breeden-Litzenberger
 * risk-neutral density (rnd.strikes/rnd.density) - an actual market-implied
 * probability of landing near that strike - turning "hedge dollars if
 * triggered" into "expected hedge dollars." OI concentration, OI flow/dDOI
 * (is the exposure live or going stale), and cross-expiry wall alignment are
 * kept OUT of the dollar estimate entirely and used only for a separate
 * confidence tag - they speak to durability of a number, not its size.
 *
 * This is a composite estimate built from public options-chain exposure,
 * not a literal dealer book - the sign convention (dealers long calls, short
 * puts) is the standard assumption, not observed fact.
 */
export function computeHedgePressure(data: GexResponse, count = 15): { rows: HedgePressureRow[]; context: HedgePressureContext } {
  const rows = data.exposure.perStrike;

  const dSPct = Math.max(0.05, data.development?.volTrig?.movePct ?? 0.5);
  const dtDays = 1;
  const dSigmaPts = (data.development?.iv?.deltaOverDays ?? 0) * 100;

  const building = extractStrikes(data.development?.oi?.wallBuild ?? []);
  const dissolving = extractStrikes(data.development?.oi?.wallDissolve ?? []);

  const otherExpiryWalls = new Set<number>();
  for (const term of data.termContext ?? []) {
    if (term.exp === data.selection.exp) continue;
    otherExpiryWalls.add(term.callWall);
    otherExpiryWalls.add(term.putWall);
  }

  const putSkewRich = data.shadow?.skew?.gapPts > 3;
  const callSkewRich = data.shadow?.skew?.gapPts < -3;

  const withFlow = rows.map((r) => {
    const gammaTerm = r.gex * dSPct;
    const charmTerm = r.chex * dtDays;
    const vannaTerm = r.vex * dSigmaPts;
    const speedTerm = 0.5 * r.speedEx * dSPct * dSPct;
    const colorTerm = r.colorEx * dtDays * dSPct;
    const zommaTerm = r.zommaEx * dSPct * dSigmaPts;
    const vommaTerm = 0.5 * r.vommaEx * dSigmaPts * dSigmaPts;

    const terms: HedgeTaylorTerm[] = [
      { key: "gamma", label: "Gamma·dS", dollars: gammaTerm },
      { key: "charm", label: "Charm·dt", dollars: charmTerm },
      { key: "vanna", label: "Vanna·dσ", dollars: vannaTerm },
      { key: "speed", label: "½Speed·dS²", dollars: speedTerm },
      { key: "color", label: "Color·dt·dS", dollars: colorTerm },
      { key: "zomma", label: "Zomma·dS·dσ", dollars: zommaTerm },
      { key: "vomma", label: "½Vomma·dσ²", dollars: vommaTerm },
    ];

    const taylorFlow = terms.reduce((sum, t) => sum + t.dollars, 0);
    return { r, terms, taylorFlow };
  });

  const maxDensity = Math.max(1e-9, ...data.rnd.strikes.map((_, i) => data.rnd.density[i] ?? 0));

  const scored: HedgePressureRow[] = withFlow.map(({ r, terms, taylorFlow }) => {
    const totalOi = r.callOi + r.putOi;
    const spot = data.rnd.forward || data.aggregate.flip.nearestFlip;
    const distPct = spot ? ((r.strike - spot) / spot) * 100 : 0;

    const rawDensity = densityAt(data.rnd, r.strike);
    const densityWeight = maxDensity > 0 ? rawDensity / maxDensity : 0;
    const expectedFlow = Math.abs(taylorFlow) * Math.max(0.05, densityWeight);

    const isBuilding = building.has(r.strike);
    const isDissolving = dissolving.has(r.strike);
    const isCrossExpiryWall = otherExpiryWalls.has(r.strike);
    const isFrontWall = r.strike === data.aggregate.callWall || r.strike === data.aggregate.putWall;

    const gammaDominant = Math.abs(terms[0].dollars) > 0.4 * Math.abs(taylorFlow || 1);
    const charmDominant = Math.abs(terms[1].dollars) > 0.4 * Math.abs(taylorFlow || 1);
    const vannaDominant = Math.abs(terms[2].dollars) > 0.2 * Math.abs(taylorFlow || 1);

    const agreements = [gammaDominant, charmDominant, vannaDominant, isBuilding, isCrossExpiryWall, isFrontWall].filter(Boolean).length;
    const confidence: HedgePressureRow["confidence"] = agreements >= 3 ? "HIGH" : agreements >= 2 ? "MEDIUM" : "LOW";

    const flags: string[] = [];
    if (r.strike === data.aggregate.callWall) flags.push("CALL WALL");
    if (r.strike === data.aggregate.putWall) flags.push("PUT WALL");
    if (r.strike === data.structure.kingNode.strike) flags.push(data.structure.kingNode.type.toUpperCase());
    if (isCrossExpiryWall) flags.push("CROSS-EXP WALL");
    if (isBuilding) flags.push("OI BUILDING");
    if (isDissolving) flags.push("OI DISSOLVING");
    if (putSkewRich && r.putOi > r.callOi) flags.push("SKEW-RICH");
    if (callSkewRich && r.callOi > r.putOi) flags.push("SKEW-RICH");

    return {
      strike: r.strike,
      expectedFlow,
      taylorFlow,
      densityWeight,
      confidence,
      terms,
      gex: r.gex,
      chex: r.chex,
      vex: r.vex,
      totalOi,
      distPct,
      flags,
    };
  });

  return { rows: scored.sort((a, b) => b.expectedFlow - a.expectedFlow).slice(0, count), context: { dSPct, dtDays, dSigmaPts } };
}

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
  const maxGex = Math.max(1, ...data.exposure.perStrike.map((r) => Math.abs(r.gex)));
  const secondary = topStrikesByMagnitude(data.exposure.perStrike, (r) => r.gex, 3);

  const levels = [
    { asset: data.symbol, label: "Call Resistance", price: data.aggregate.callWall, weight: Math.abs(data.aggregate.callWallGex) / maxGex },
    { asset: data.symbol, label: "Put Support", price: data.aggregate.putWall, weight: Math.abs(data.aggregate.putWallGex) / maxGex },
    { asset: data.symbol, label: "King Node", price: data.structure.kingNode.strike, weight: Math.abs(data.structure.kingNode.gex) / maxGex },
    { asset: data.symbol, label: "HVL (gamma flip)", price: data.aggregate.flip.nearestFlip, weight: 0.5 },
    { asset: data.symbol, label: "Max Pain", price: data.aggregate.maxPain, weight: 0.35 },
    ...secondary.map((r, i) => ({ asset: data.symbol, label: `GEX ${i + 1}`, price: r.strike, weight: Math.abs(r.gex) / maxGex })),
  ];

  return levels.filter((l) => Number.isFinite(l.price) && l.price > 0);
}

/**
 * A reduced, two-asset reconstruction of the published MenthorQ Blind Spots
 * idea: option-derived levels from more than one instrument, converted onto
 * a shared price scale, cluster where several land near each other. The real
 * product uses NQ futures options + NDX + QQQ + individual MAG7 chains; this
 * feed only carries QQQ and SPX, so this is a 2-asset version of the same
 * mechanic, not a reproduction of their model - MenthorQ doesn't publish
 * their weighting formula, clustering tolerance, or dealer-side classifier,
 * so those are stated assumptions here, not recovered constants.
 *
 * Method: convert every SPX level to a QQQ-equivalent price using the ratio
 * method (level x QQQspot/SPXspot - appropriate here since the two trade at
 * very different numeric levels, unlike e.g. ES/SPX where a spread method
 * fits better). Score every candidate QQQ price with a Gaussian-kernel
 * overlap density C(x) = sum(weight_i * exp(-(x-L_i)^2 / 2h^2)), h a
 * clustering tolerance in QQQ points. Local maxima, ranked by cluster
 * strength, are the Blind Spots.
 */
export function computeBlindSpots(qqq: GexResponse, spx: GexResponse, count = 8): { clusters: BlindSpotCluster[]; ratio: number; bandwidth: number } {
  const qqqSpot = qqq.rnd.forward || qqq.aggregate.flip.nearestFlip;
  const spxSpot = spx.rnd.forward || spx.aggregate.flip.nearestFlip;
  const ratio = qqqSpot / spxSpot;

  const qqqLevels = extractLevels(qqq).map((l) => ({ ...l, convertedPrice: l.price }));
  const spxLevels = extractLevels(spx).map((l) => ({ ...l, convertedPrice: l.price * ratio, weight: l.weight * 0.85 }));
  const allLevels: BlindSpotSourceLevel[] = [...qqqLevels, ...spxLevels].map((l) => ({
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

  // Evaluate the overlap curve at every candidate level plus a fine grid between the extremes, then find local maxima.
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

  // Collapse peaks within one bandwidth of each other (a flat top produces several adjacent "local maxima").
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
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

export function fmtPct(n: number | null | undefined, digits = 2): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return `${n >= 0 ? "+" : ""}${n.toFixed(digits)}%`;
}
