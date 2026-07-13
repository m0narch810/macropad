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
