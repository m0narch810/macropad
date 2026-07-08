import type { MacroPanel, MacroSeries } from "@/lib/macroData";
import { getBias, getSignTone } from "@/lib/bias";

function statusColor(status: MacroSeries["status"]): string {
  return status === "up" ? "var(--up)" : status === "down" ? "var(--down)" : "var(--text-faint)";
}

/** One-line-per-indicator overview, everything on screen at once - no charts, no depth. */
export default function BoardPage({ panels, newsSeries }: { panels: MacroPanel[]; newsSeries: MacroSeries[] }) {
  return (
    <div className="flex flex-col gap-5">
      {newsSeries.length > 0 && (
        <div>
          <div className="eyebrow mb-1.5">News Sentiment</div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {newsSeries.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-2 border-b border-[var(--border)] py-1.5" title={s.note}>
                <span className="min-w-0 truncate text-[0.74rem] text-[var(--text-dim)]">{s.name}</span>
                <span className="shrink-0 whitespace-nowrap font-mono text-[0.78rem] font-semibold" style={{ color: statusColor(s.status) }}>
                  {s.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {panels.map((panel) => {
        const series = panel.series.filter((s) => s.id !== "geo:news-feed");
        if (series.length === 0) return null;
        return (
          <div key={panel.id}>
            <div className="eyebrow mb-1.5">{panel.title}</div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {series.map((s) => {
                const bias = getBias(s.id, s.zscore);
                const tone = getSignTone(s.id, s.zscore);
                const color = tone === "up" ? "var(--up)" : tone === "down" ? "var(--down)" : "var(--text-faint)";
                return (
                  <div
                    key={s.id}
                    className="flex items-center justify-between gap-2 border-b border-[var(--border)] py-1.5"
                    title={bias?.label ?? s.note}
                  >
                    <span className="min-w-0 truncate text-[0.74rem] text-[var(--text-dim)]">{s.name}</span>
                    <span className="shrink-0 whitespace-nowrap font-mono text-[0.78rem]">
                      <span className="font-semibold" style={{ color }}>{s.value}</span>
                      {s.zscore !== null && (
                        <span className="ml-1.5 text-[0.66rem]" style={{ color }}>
                          {s.zscore > 0 ? "+" : ""}
                          {Math.round(s.zscore * 100)}%
                        </span>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
