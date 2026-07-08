"use client";

import { useMemo, useState } from "react";
import type { MacroPanel } from "@/lib/macroData";
import type { MarketRow } from "@/lib/getMarkets";
import QuantCard from "@/components/QuantCard";
import { useLocalStorage } from "@/lib/useLocalStorage";

export default function CustomDashboardPage({ panels, markets }: { panels: MacroPanel[]; markets: MarketRow[] }) {
  const [selected, setSelected] = useLocalStorage<string[]>("macropad:customDashboard", []);
  const [query, setQuery] = useState("");
  const [pickerOpen, setPickerOpen] = useState(true);

  const allSeries = useMemo(
    () => panels.flatMap((p) => p.series.filter((s) => s.id !== "geo:news-feed").map((s) => ({ series: s, panelTitle: p.title }))),
    [panels]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allSeries;
    return allSeries.filter(({ series }) => series.name.toLowerCase().includes(q) || series.note.toLowerCase().includes(q));
  }, [allSeries, query]);

  const selectedSet = new Set(selected);
  const toggle = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const chosen = allSeries.filter(({ series }) => selectedSet.has(series.id));

  return (
    <div>
      <div className="mb-5 rounded-lg border border-[var(--border)] bg-[var(--panel)]">
        <button onClick={() => setPickerOpen((v) => !v)} className="flex w-full items-center justify-between px-4 py-3 text-left">
          <span className="font-sans text-[0.82rem] font-semibold">
            Pick indicators ({selected.length} selected)
          </span>
          <span className="font-mono text-[0.7rem] text-[var(--text-faint)]">{pickerOpen ? "hide" : "show"}</span>
        </button>
        {pickerOpen && (
          <div className="border-t border-[var(--border)] p-4">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter…"
              className="mb-3 w-full rounded-md border border-[var(--border)] bg-[var(--panel-2)] px-3 py-1.5 font-sans text-[0.8rem] outline-none focus-visible:border-[var(--accent)]"
            />
            <div className="grid max-h-[360px] grid-cols-1 gap-1 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map(({ series, panelTitle }) => (
                <label
                  key={series.id}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-[var(--panel-2)]"
                >
                  <input type="checkbox" checked={selectedSet.has(series.id)} onChange={() => toggle(series.id)} className="shrink-0" />
                  <div className="min-w-0">
                    <div className="truncate font-sans text-[0.78rem]">{series.name}</div>
                    <div className="truncate font-mono text-[0.62rem] text-[var(--text-faint)]">{panelTitle}</div>
                  </div>
                </label>
              ))}
            </div>
            {selected.length > 0 && (
              <button
                onClick={() => setSelected([])}
                className="mt-3 font-sans text-[0.72rem] font-semibold text-[var(--down)] hover:underline"
              >
                Clear all
              </button>
            )}
          </div>
        )}
      </div>

      {chosen.length === 0 ? (
        <p className="font-sans text-[0.85rem] text-[var(--text-faint)]">No indicators picked yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {chosen.map(({ series }) => (
            <QuantCard key={series.id} series={series} markets={markets} />
          ))}
        </div>
      )}
    </div>
  );
}
