export type GexSymbol = "QQQ" | "SPX";

export interface GexStrikeRow {
  strike: number;
  gex: number;
  callGex: number;
  putGex: number;
  dex: number;
  vex: number;
  chex: number;
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

export interface HedgePressureComponent {
  key: "gamma" | "convexity" | "charm" | "vanna" | "oi" | "flow" | "proximity";
  label: string;
  weight: number;
  normalized: number; // 0..1
}

export interface HedgePressureRow {
  strike: number;
  score: number;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  components: HedgePressureComponent[];
  gex: number;
  chex: number;
  vex: number;
  totalOi: number;
  distPct: number;
  flags: string[];
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

/**
 * Local slope of the dealer gamma-vs-hypothetical-spot curve (flip.ladder) at
 * a given price - a second, independent way to size gamma's hedging impact.
 * Per-strike GEX measures "how much gamma sits here"; this measures "how
 * fast total book gamma is changing as price crosses here" - the convexity
 * of the hedge requirement, which is what makes a level an accelerant rather
 * than just large.
 */
function ladderSlopeAt(ladder: { s: number; g: number }[], price: number): number {
  if (ladder.length < 2) return 0;
  const sorted = [...ladder].sort((a, b) => a.s - b.s);
  let lo = sorted[0];
  let hi = sorted[sorted.length - 1];
  for (let i = 0; i < sorted.length - 1; i++) {
    if (sorted[i].s <= price && sorted[i + 1].s >= price) {
      lo = sorted[i];
      hi = sorted[i + 1];
      break;
    }
  }
  const ds = hi.s - lo.s;
  if (ds === 0) return 0;
  return Math.abs((hi.g - lo.g) / ds);
}

/**
 * Ranks strikes by how much dealer hedging flow they mechanically force,
 * fusing several independent, weighted signals rather than one number in
 * disguise - each strike's row exposes its component breakdown so you can
 * see WHY it ranked where it did:
 *
 *  - gamma (30%): |GEX| at the strike - forced trade per $1 spot move.
 *  - convexity (15%): local slope of the book-wide gamma-flip curve at that
 *    price - a structural measure independent of this strike's own OI, using
 *    the same curve that defines the short/long-gamma regime boundary.
 *  - charm (20%): |charm| - forced rebalancing from time decay alone, even
 *    at a frozen price. Heaviest into the close.
 *  - vanna (10%): |vanna| - forced rebalancing from IV changes alone, even
 *    at a frozen price and frozen clock. The third real trigger.
 *  - OI concentration (10%): a strike only matters if size sits there.
 *  - OI flow / dDOI (10%): building open interest means the exposure is
 *    live and growing; dissolving means it is going stale. Falls back to
 *    neutral when the feed has not accumulated enough sessions yet.
 *  - proximity (5%): closer strikes get triggered by smaller moves.
 *
 * Confidence is separate from the score: it counts how many *independent*
 * signals (gamma, charm, vanna, cross-expiry wall alignment, live OI flow)
 * agree this strike matters, rather than trusting one blended number.
 *
 * This is a composite ranking built from public options-chain exposure, not
 * a literal dealer book - the sign convention (dealers long calls, short
 * puts) is the standard assumption, not observed fact.
 */
export function computeHedgePressure(data: GexResponse, count = 15): HedgePressureRow[] {
  const spot = data.rnd.forward || data.aggregate.flip.nearestFlip;
  const rows = data.exposure.perStrike;
  const ladder = data.aggregate.flip.ladder ?? [];

  const maxAbsGex = Math.max(1, ...rows.map((r) => Math.abs(r.gex)));
  const maxAbsChex = Math.max(1, ...rows.map((r) => Math.abs(r.chex)));
  const maxAbsVex = Math.max(1, ...rows.map((r) => Math.abs(r.vex)));
  const maxOi = Math.max(1, ...rows.map((r) => r.callOi + r.putOi));
  const slopes = rows.map((r) => ladderSlopeAt(ladder, r.strike));
  const maxSlope = Math.max(1, ...slopes);
  const proximityBandPct = 8;

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

  const scored: HedgePressureRow[] = rows.map((r, i) => {
    const totalOi = r.callOi + r.putOi;
    const distPct = spot ? ((r.strike - spot) / spot) * 100 : 0;
    const proximity = Math.max(0, 1 - Math.abs(distPct) / proximityBandPct);

    const normGamma = Math.abs(r.gex) / maxAbsGex;
    const normConvexity = slopes[i] / maxSlope;
    const normCharm = Math.abs(r.chex) / maxAbsChex;
    const normVanna = Math.abs(r.vex) / maxAbsVex;
    const normOi = totalOi / maxOi;

    const isBuilding = building.has(r.strike);
    const isDissolving = dissolving.has(r.strike);
    const oiFlow = isBuilding ? 1 : isDissolving ? 0 : 0.5;

    const components: HedgePressureComponent[] = [
      { key: "gamma", label: "Gamma", weight: 0.3, normalized: normGamma },
      { key: "convexity", label: "Convexity", weight: 0.15, normalized: normConvexity },
      { key: "charm", label: "Charm", weight: 0.2, normalized: normCharm },
      { key: "vanna", label: "Vanna", weight: 0.1, normalized: normVanna },
      { key: "oi", label: "OI conc.", weight: 0.1, normalized: normOi },
      { key: "flow", label: "OI flow (dDOI)", weight: 0.1, normalized: oiFlow },
      { key: "proximity", label: "Proximity", weight: 0.05, normalized: proximity },
    ];

    const score = 100 * components.reduce((sum, c) => sum + c.weight * c.normalized, 0);

    const agreements = [normGamma > 0.3, normCharm > 0.3, normVanna > 0.3, isBuilding, otherExpiryWalls.has(r.strike)].filter(Boolean).length;
    const confidence: HedgePressureRow["confidence"] = agreements >= 3 ? "HIGH" : agreements >= 2 ? "MEDIUM" : "LOW";

    const flags: string[] = [];
    if (r.strike === data.aggregate.callWall) flags.push("CALL WALL");
    if (r.strike === data.aggregate.putWall) flags.push("PUT WALL");
    if (r.strike === data.structure.kingNode.strike) flags.push(data.structure.kingNode.type.toUpperCase());
    if (otherExpiryWalls.has(r.strike)) flags.push("CROSS-EXP WALL");
    if (isBuilding) flags.push("OI BUILDING");
    if (isDissolving) flags.push("OI DISSOLVING");
    if (putSkewRich && r.putOi > r.callOi) flags.push("SKEW-RICH");
    if (callSkewRich && r.callOi > r.putOi) flags.push("SKEW-RICH");

    return { strike: r.strike, score, confidence, components, gex: r.gex, chex: r.chex, vex: r.vex, totalOi, distPct, flags };
  });

  return scored.sort((a, b) => b.score - a.score).slice(0, count);
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
