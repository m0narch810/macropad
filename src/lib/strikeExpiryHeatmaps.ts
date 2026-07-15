/**
 * Strike x expiry heatmap grids for the Terminal page - one shared shape so
 * the same component can render whichever Greek is selected.
 *
 * Sourced entirely from the dedicated /heatmap endpoint, which returns real
 * per-expiry strike data (0DTE through ~8 DTE) for all six Greeks in one
 * call. Values are shipped RAW, exactly as the endpoint returns them - a
 * documented magnitude proxy, NOT dollarized. Verified directly against a
 * live vendor $-GEX table: this endpoint's raw numbers track the vendor's
 * real dollar figures via a consistent ratio at every strike/expiry checked,
 * but that ratio isn't a formula this app can derive (no OI field, no
 * disclosed multiplier) - so it's labeled and shown as-is rather than
 * multiplied by a guessed constant. This replaces the former per-endpoint
 * mix (/gex_surface, /vanna_surface heatmap, /charm_surface heatmap, /theta
 * grid) and the self-computed 0DTE chain, which don't agree with each other
 * or with this endpoint - see git history on this file for that dead end.
 */

export interface StrikeExpiryHeatmap {
  columns: { label: string; dte: number | null }[];
  strikes: number[];
  values: (number | null)[][];
}

export type HeatmapMetric = "gex" | "dex" | "vex" | "cex" | "tex" | "vegaex";

export interface HeatmapEndpointRaw {
  spot?: number;
  strikes?: number[];
  expiries?: { date: string; label: string; dte: number }[];
  grids?: Partial<Record<HeatmapMetric, { rows: { strike: number; cells: (number | null)[] }[]; max_abs?: number } | null>>;
  error?: string | null;
}

/** Builds one metric's grid from the /heatmap endpoint's response, strikes sorted ascending. */
export function fromHeatmapEndpoint(raw: HeatmapEndpointRaw | null, metric: HeatmapMetric): StrikeExpiryHeatmap | null {
  if (!raw || raw.error || !raw.expiries?.length) return null;
  const grid = raw.grids?.[metric];
  if (!grid || !grid.rows.length) return null;
  const sorted = [...grid.rows].sort((a, b) => a.strike - b.strike);
  return {
    columns: raw.expiries.map((e) => ({ label: e.label, dte: e.dte })),
    strikes: sorted.map((r) => r.strike),
    values: sorted.map((r) => r.cells),
  };
}
