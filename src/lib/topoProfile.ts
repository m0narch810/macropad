/**
 * Strike x tenor "term profile" for the Terminal's 3D topography surface -
 * the same data shape the altaris-levels TOPO view renders: per strike, the
 * dealer book's gamma and charm split into four expiry tenors
 * [0DTE, this-week (1-7 DTE), next-week (8-14 DTE), monthly+ (15+ DTE)].
 *
 * Both fields come from the source's own cross-expiry surfaces
 * (/gex_surface via GexSurfacePoint, /charm_surface via the charm engine's
 * parsed heatmap) rather than mixing in the self-computed 0DTE chain: a
 * terrain compares tenors AGAINST EACH OTHER, so unit coherence across
 * columns matters more than absolute 0DTE precision (the bar chart remains
 * the precise self-computed 0DTE view). Values are shipped RAW, not scaled
 * to $M - the charm surface is a raw-greek-magnitude proxy whose values can
 * sit well below 1e6, and the renderer normalizes to the surface max anyway.
 */

import type { GexSurfacePoint } from "@/lib/strikeExpiryHeatmaps";
import type { CharmHeatmap } from "@/lib/charmEngine";

export type TenorArr = [number, number, number, number];

export interface TopoRow {
  strike: number;
  gex: TenorArr;
  charm: TenorArr;
}

export const TENOR_LABELS = ["0DTE", "1W", "2W", "M+"] as const;

const bucketIdx = (dte: number) => (dte <= 0 ? 0 : dte <= 7 ? 1 : dte <= 14 ? 2 : 3);

/** Nearest `count` strikes to spot with any surface data, ascending. */
export function buildTopoProfile(gexPoints: GexSurfacePoint[], charmHm: CharmHeatmap | null, spot: number, count = 60): TopoRow[] {
  const gexBy = new Map<number, TenorArr>();
  for (const p of gexPoints) {
    const arr = gexBy.get(p.strike) ?? ([0, 0, 0, 0] as TenorArr);
    // Same dealer-sign convention as buildGexHeatmap: call-side positive, put-side negative.
    arr[bucketIdx(p.dte)] += p.isPut ? -Math.abs(p.gex) : Math.abs(p.gex);
    gexBy.set(p.strike, arr);
  }

  const charmBy = new Map<number, TenorArr>();
  if (charmHm) {
    for (const r of charmHm.rows) {
      const arr: TenorArr = [0, 0, 0, 0];
      r.cells.forEach((c, i) => {
        if (c !== null) arr[bucketIdx(charmHm.expiriesDte[i])] += c;
      });
      charmBy.set(r.strike, arr);
    }
  }

  const strikes = [...new Set([...gexBy.keys(), ...charmBy.keys()])]
    .sort((a, b) => Math.abs(a - spot) - Math.abs(b - spot))
    .slice(0, count)
    .sort((a, b) => a - b);

  return strikes.map((strike) => ({
    strike,
    gex: gexBy.get(strike) ?? ([0, 0, 0, 0] as TenorArr),
    charm: charmBy.get(strike) ?? ([0, 0, 0, 0] as TenorArr),
  }));
}
