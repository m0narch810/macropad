/**
 * Strike x tenor "term profile" for the Terminal's 3D topography surface -
 * the same data shape the altaris-levels TOPO view renders: per strike, each
 * major Greek's exposure split into four expiry tenors
 * [0DTE, this-week (1-7 DTE), next-week (8-14 DTE), monthly+ (15+ DTE)].
 *
 * Cross-expiry fields come from the source's own surfaces (/gex_surface,
 * /vanna_surface, /charm_surface, /theta) rather than mixing in the
 * self-computed 0DTE chain: a terrain compares tenors AGAINST EACH OTHER,
 * so unit coherence across columns matters more than absolute 0DTE
 * precision (the bar chart remains the precise self-computed 0DTE view).
 * DEX and VEGA have no cross-expiry source at all (documented in
 * strikeExpiryHeatmaps.ts) - they carry the self-computed 0DTE chain in the
 * d0 bucket only, and the topo captions say so. Values are shipped RAW, not
 * scaled to $M - the surface endpoints are raw-greek-magnitude proxies whose
 * values can sit well below 1e6, and the renderer normalizes per surface.
 */

import type { StrikeRow0DTE } from "@/lib/gex";
import type { GexSurfacePoint } from "@/lib/strikeExpiryHeatmaps";
import type { CharmHeatmap } from "@/lib/charmEngine";
import type { VannaHeatmap } from "@/lib/vannaEngine";
import type { ThetaHeatmap } from "@/lib/thetaEngine";

export type TenorArr = [number, number, number, number];

export interface TopoRow {
  strike: number;
  gex: TenorArr;
  dex: TenorArr;
  vanna: TenorArr;
  charm: TenorArr;
  theta: TenorArr;
  vega: TenorArr;
}

export const TENOR_LABELS = ["0DTE", "1W", "2W", "M+"] as const;

const bucketIdx = (dte: number) => (dte <= 0 ? 0 : dte <= 7 ? 1 : dte <= 14 ? 2 : 3);

/** Shared shape of the charm/vanna engine heatmaps: strike rows x expiriesDte columns. */
function bucketDteHeatmap(hm: { expiriesDte: number[]; rows: { strike: number; cells: (number | null)[] }[] } | null): Map<number, TenorArr> {
  const out = new Map<number, TenorArr>();
  if (!hm) return out;
  for (const r of hm.rows) {
    const arr: TenorArr = [0, 0, 0, 0];
    r.cells.forEach((c, i) => {
      if (c !== null) arr[bucketIdx(hm.expiriesDte[i])] += c;
    });
    out.set(r.strike, arr);
  }
  return out;
}

function bucketThetaHeatmap(th: ThetaHeatmap | null): Map<number, TenorArr> {
  const out = new Map<number, TenorArr>();
  if (!th || !th.expiryDtes.some((d) => d !== null)) return out;
  const bucketByExp = new Map<string, number>();
  th.expirations.forEach((exp, i) => {
    const dte = th.expiryDtes[i];
    if (dte !== null) bucketByExp.set(exp, bucketIdx(dte));
  });
  for (const cell of th.cells) {
    const b = bucketByExp.get(cell.expiration);
    if (b === undefined) continue;
    const arr = out.get(cell.strike) ?? ([0, 0, 0, 0] as TenorArr);
    arr[b] += cell.netTheta;
    out.set(cell.strike, arr);
  }
  return out;
}

/** 0DTE-only Greeks (no cross-expiry source): the self-computed chain in the d0 bucket. */
function bucketZeroDteOnly(perStrike: StrikeRow0DTE[], pick: (r: StrikeRow0DTE) => number): Map<number, TenorArr> {
  const out = new Map<number, TenorArr>();
  for (const r of perStrike) out.set(r.strike, [pick(r), 0, 0, 0]);
  return out;
}

export interface TopoProfileInputs {
  gexPoints: GexSurfacePoint[];
  charmHm: CharmHeatmap | null;
  vannaHm: VannaHeatmap | null;
  thetaHm: ThetaHeatmap | null;
  perStrike: StrikeRow0DTE[];
  spot: number;
}

/** Nearest `count` strikes to spot with any surface data, ascending. */
export function buildTopoProfile({ gexPoints, charmHm, vannaHm, thetaHm, perStrike, spot }: TopoProfileInputs, count = 60): TopoRow[] {
  const gexBy = new Map<number, TenorArr>();
  for (const p of gexPoints) {
    const arr = gexBy.get(p.strike) ?? ([0, 0, 0, 0] as TenorArr);
    // Same dealer-sign convention as buildGexHeatmap: call-side positive, put-side negative.
    arr[bucketIdx(p.dte)] += p.isPut ? -Math.abs(p.gex) : Math.abs(p.gex);
    gexBy.set(p.strike, arr);
  }

  const charmBy = bucketDteHeatmap(charmHm);
  const vannaBy = bucketDteHeatmap(vannaHm);
  const thetaBy = bucketThetaHeatmap(thetaHm);
  const dexBy = bucketZeroDteOnly(perStrike, (r) => r.dex);
  const vegaBy = bucketZeroDteOnly(perStrike, (r) => r.vegaex);

  const strikes = [...new Set([...gexBy.keys(), ...charmBy.keys(), ...vannaBy.keys(), ...thetaBy.keys(), ...dexBy.keys()])]
    .sort((a, b) => Math.abs(a - spot) - Math.abs(b - spot))
    .slice(0, count)
    .sort((a, b) => a - b);

  const get = (m: Map<number, TenorArr>, k: number): TenorArr => m.get(k) ?? ([0, 0, 0, 0] as TenorArr);
  return strikes.map((strike) => ({
    strike,
    gex: get(gexBy, strike),
    dex: get(dexBy, strike),
    vanna: get(vannaBy, strike),
    charm: get(charmBy, strike),
    theta: get(thetaBy, strike),
    vega: get(vegaBy, strike),
  }));
}
