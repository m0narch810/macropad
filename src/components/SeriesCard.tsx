import type { MacroSeries } from "@/lib/macroData";
import Sparkline from "@/components/Sparkline";
import ZScoreBar from "@/components/ZScoreBar";
import { MARKET_LINKS } from "@/lib/markets";

const chipClasses: Record<MacroSeries["status"], string> = {
  up: "text-[var(--up)] bg-[color-mix(in_srgb,var(--up)_14%,transparent)] border-[color-mix(in_srgb,var(--up)_35%,transparent)]",
  down: "text-[var(--down)] bg-[color-mix(in_srgb,var(--down)_14%,transparent)] border-[color-mix(in_srgb,var(--down)_35%,transparent)]",
  flat: "text-[var(--flat)] bg-[color-mix(in_srgb,var(--flat)_14%,transparent)] border-[color-mix(in_srgb,var(--flat)_35%,transparent)]",
  pending: "text-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] border-[color-mix(in_srgb,var(--accent)_30%,transparent)]",
};

const chipLabel: Record<MacroSeries["status"], string> = {
  up: "Up",
  down: "Down",
  flat: "Flat",
  pending: "Pending",
};

function readLabel(z: number): string {
  const abs = Math.abs(z);
  if (abs >= 2) return z > 0 ? "Extreme high" : "Extreme low";
  if (abs >= 1) return z > 0 ? "Elevated" : "Depressed";
  return "Normal range";
}

export default function SeriesCard({
  series,
  assetFilter = null,
  assetLabel = null,
}: {
  series: MacroSeries;
  assetFilter?: string | null;
  assetLabel?: string | null;
}) {
  const hasChart = series.sparkline !== null && series.sparkline.length >= 5;
  const hasZ = series.zscore !== null;
  const links = MARKET_LINKS[series.id];
  const isRelevant = !assetFilter || (links?.some((l) => l.symbol === assetFilter) ?? false);

  return (
    <div
      className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-5 transition-opacity duration-150"
      style={!isRelevant ? { opacity: 0.42 } : undefined}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="m-0 text-[0.95rem] font-semibold text-[var(--text)]">{series.name}</h3>
          <p className="m-0 mt-0.5 font-sans text-[0.76rem] text-[var(--text-faint)]">{series.note}</p>
        </div>
        <span
          className={`shrink-0 whitespace-nowrap rounded-full border px-2 py-[3px] text-[0.62rem] font-bold uppercase tracking-wide ${chipClasses[series.status]}`}
        >
          {chipLabel[series.status]}
        </span>
      </div>

      {!isRelevant && (
        <div className="mt-2 font-sans text-[0.68rem] font-semibold text-[var(--text-faint)]">
          Not linked to {assetLabel ?? assetFilter}
        </div>
      )}

      <div className="mt-3 font-mono text-[1.7rem] font-semibold leading-none text-[var(--text)]">
        {series.value}
      </div>

      {hasChart && (
        <div className="mt-3">
          <Sparkline data={series.sparkline as number[]} tone={series.status} />
        </div>
      )}

      {hasZ && (
        <div className="mt-3 border-t border-[var(--border)] pt-3">
          <div className="mb-1.5 flex items-center justify-between font-sans text-[0.68rem] uppercase tracking-wide text-[var(--text-faint)]">
            <span>Z-score</span>
            <span>{readLabel(series.zscore as number)}</span>
          </div>
          <ZScoreBar z={series.zscore as number} />
        </div>
      )}

      <div className="mt-3 flex items-center justify-between font-mono text-[0.66rem] text-[var(--text-faint)]">
        <span>{series.source}</span>
        {series.windowLabel && <span>{series.windowLabel}</span>}
      </div>
    </div>
  );
}
