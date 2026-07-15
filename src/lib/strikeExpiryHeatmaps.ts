/**
 * Strike x expiry heatmap grids for the Terminal page - one shared shape so
 * the same component can render whichever Greek is selected.
 *
 * Only GEX, VANNA, CHARM, and THETA have a real cross-expiry source
 * upstream (/gex_surface, /vanna_surface, /charm_surface, /theta - the
 * same endpoints the vanna/charm/theta engines already fetch for their own
 * pages). DEX and VEGA have no cross-expiry endpoint at all (/dex_ladder
 * is single-expiry only, and there's no vega surface route) - those two
 * fall back to a single 0DTE-only column built from the chain we already
 * hold, clearly labeled rather than silently showing fake columns.
 *
 * The surface endpoints' raw values are used as-is (a documented magnitude/
 * sign proxy, same posture as vannaEngine.ts's and charmEngine.ts's own
 * cross-expiry confluence sections) since we don't have per-contract OI/IV
 * for other expirations to recompute them ourselves.
 */

import type { StrikeRow0DTE } from "@/lib/gex";
import type { VannaHeatmap } from "@/lib/vannaEngine";
import type { CharmHeatmap } from "@/lib/charmEngine";
import type { ThetaHeatmap } from "@/lib/thetaEngine";

export interface StrikeExpiryHeatmap {
  columns: { label: string; dte: number | null }[];
  strikes: number[];
  values: (number | null)[][];
}

export interface GexSurfacePoint {
  strike: number;
  dte: number;
  gex: number;
  isPut: boolean;
}

/** Sums call+put per strike/dte with the app's own dealer-sign convention (call positive, put negative) applied to the raw surface value, since the source's own sign convention for this field isn't confirmed trustworthy (same caveat as the raw 0DTE fields this app already overrides everywhere else). */
export function buildGexHeatmap(points: GexSurfacePoint[]): StrikeExpiryHeatmap | null {
  if (!points.length) return null;
  const dteSet = [...new Set(points.map((p) => p.dte))].sort((a, b) => a - b);
  const byStrike = new Map<number, Map<number, number>>();
  for (const p of points) {
    const signed = p.isPut ? -Math.abs(p.gex) : Math.abs(p.gex);
    const byDte = byStrike.get(p.strike) ?? new Map<number, number>();
    byDte.set(p.dte, (byDte.get(p.dte) ?? 0) + signed);
    byStrike.set(p.strike, byDte);
  }
  const strikes = [...byStrike.keys()].sort((a, b) => a - b);
  const values = strikes.map((strike) => {
    const byDte = byStrike.get(strike)!;
    return dteSet.map((dte) => (byDte.has(dte) ? byDte.get(dte)! : null));
  });
  return { columns: dteSet.map((dte) => ({ label: `${dte}d`, dte })), strikes, values };
}

export function fromVannaHeatmap(vh: VannaHeatmap | null): StrikeExpiryHeatmap | null {
  if (!vh) return null;
  return {
    columns: vh.expiriesDte.map((dte) => ({ label: `${dte}d`, dte })),
    strikes: vh.rows.map((r) => r.strike),
    values: vh.rows.map((r) => r.cells),
  };
}

export function fromCharmHeatmap(ch: CharmHeatmap | null): StrikeExpiryHeatmap | null {
  if (!ch) return null;
  return {
    columns: ch.expiriesDte.map((dte) => ({ label: `${dte}d`, dte })),
    strikes: ch.rows.map((r) => r.strike),
    values: ch.rows.map((r) => r.cells),
  };
}

export function fromThetaHeatmap(th: ThetaHeatmap | null): StrikeExpiryHeatmap | null {
  if (!th) return null;
  const strikes = [...new Set(th.cells.map((c) => c.strike))].sort((a, b) => a - b);
  const values = strikes.map((strike) => th.expirations.map((exp) => th.cells.find((c) => c.strike === strike && c.expiration === exp)?.netTheta ?? null));
  return { columns: th.expirations.map((label) => ({ label, dte: null })), strikes, values };
}

/** Single-column fallback for Greeks with no cross-expiry source - 0DTE only, from the chain this app already holds. */
export function fromZeroDteOnly(perStrike: StrikeRow0DTE[], metric: keyof Pick<StrikeRow0DTE, "dex" | "vegaex">, columnLabel: string): StrikeExpiryHeatmap {
  const sorted = [...perStrike].sort((a, b) => a.strike - b.strike);
  return { columns: [{ label: columnLabel, dte: 0 }], strikes: sorted.map((r) => r.strike), values: sorted.map((r) => [r[metric]]) };
}
