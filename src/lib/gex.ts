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
    flip: { nearestFlip: number; gammaAtSpot: number };
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
    oi: { pcr: number; pcrPrior: number; pcrTrend: string };
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
  selection: { book: string; exp: string };
}

/** Picks the N strikes with the largest |value| under `pick`, then re-sorts them ascending by strike for a coherent x-axis. */
export function topStrikesByMagnitude<T extends { strike: number }>(rows: T[], pick: (row: T) => number, count = 22): T[] {
  return [...rows]
    .sort((a, b) => Math.abs(pick(b)) - Math.abs(pick(a)))
    .slice(0, count)
    .sort((a, b) => a.strike - b.strike);
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
