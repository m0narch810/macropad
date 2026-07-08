import type { MacroPanel } from "@/lib/macroData";
import { getBias, getSignTone } from "@/lib/bias";

/** One-line-per-indicator overview, everything on screen at once — no charts, no depth. */
export default function BoardPage({ panels }: { panels: MacroPanel[] }) {
  return (
    <div className="flex flex-col gap-5">
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
                    <span className="shrink-0 whitespace-nowrap font-mono text-[0.78rem] font-semibold" style={{ color }}>
                      {s.value}
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
