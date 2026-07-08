"use client";

import { useMemo, useState } from "react";
import type { MacroPanel, MacroSeries } from "@/lib/macroData";
import { useLocalStorage } from "@/lib/useLocalStorage";
import { computeIndicatorSignal } from "@/lib/indicatorSignal";
import { inferCadence } from "@/lib/stats";

interface CustomEntry {
  seriesId: string;
  sign: 1 | -1;
  weight: number; // 0-100
  threshold: number; // 0-100, minimum |score| to count at all
}

function toneColor(tone: "up" | "down" | "flat"): string {
  return tone === "up" ? "var(--up)" : tone === "down" ? "var(--down)" : "var(--flat)";
}

function computeScore(entry: CustomEntry, series: MacroSeries): number | null {
  if (!series.history || series.history.length < 5) return null;
  const cadence = inferCadence(series.history).cadence;
  const signal = computeIndicatorSignal(series.id, series.history.map((p) => p.value), cadence);
  if (!signal) return null;
  const mag = Math.abs(signal.score) < entry.threshold / 100 ? 0 : signal.score;
  return entry.sign * mag;
}

function Gauge({ score, tone }: { score: number; tone: "up" | "down" | "flat" }) {
  const clamped = Math.max(-1, Math.min(1, score));
  const pct = ((clamped + 1) / 2) * 100;
  return (
    <div className="relative h-2.5 rounded-full bg-[var(--border)]">
      <div className="absolute left-1/2 top-1/2 h-4 w-px -translate-x-1/2 -translate-y-1/2 bg-[var(--text-faint)]" />
      <div
        className="absolute top-1/2 h-4 w-4 -translate-y-1/2 -translate-x-1/2 rounded-full border-2 border-[var(--panel)]"
        style={{ left: `${pct}%`, background: toneColor(tone) }}
      />
    </div>
  );
}

function EntryRow({
  entry,
  series,
  panelTitle,
  onChange,
  onRemove,
}: {
  entry: CustomEntry;
  series: MacroSeries;
  panelTitle: string;
  onChange: (next: CustomEntry) => void;
  onRemove: () => void;
}) {
  const score = computeScore(entry, series);
  const tone = score === null || Math.abs(score) < 0.001 ? "flat" : score > 0 ? "up" : "down";

  return (
    <div className="rounded-md border border-[var(--border)] bg-[var(--panel)] px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="truncate font-sans text-[0.85rem] font-semibold">{series.name}</div>
          <div className="truncate font-mono text-[0.62rem] text-[var(--text-faint)]">{panelTitle}</div>
        </div>
        <div className="shrink-0 text-right font-mono text-[0.8rem]" style={{ color: toneColor(tone) }}>
          {score === null ? "—" : `${score > 0 ? "+" : ""}${Math.round(score * 100)}%`}
        </div>
        <button onClick={onRemove} className="shrink-0 font-mono text-[0.72rem] text-[var(--text-faint)] hover:text-[var(--down)]">
          remove
        </button>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-4">
        <div className="flex rounded-md border border-[var(--border)] bg-[var(--panel-2)] p-0.5">
          {([1, -1] as const).map((s) => (
            <button
              key={s}
              onClick={() => onChange({ ...entry, sign: s })}
              className="rounded px-2.5 py-1 font-sans text-[0.68rem] font-semibold transition-colors"
              style={
                entry.sign === s
                  ? { background: "color-mix(in srgb, var(--accent) 18%, transparent)", color: "var(--accent)" }
                  : { color: "var(--text-faint)" }
              }
            >
              {s === 1 ? "high = bullish" : "high = bearish"}
            </button>
          ))}
        </div>

        <label className="flex items-center gap-1.5 font-sans text-[0.68rem] text-[var(--text-faint)]">
          weight
          <input
            type="range"
            min={0}
            max={100}
            value={entry.weight}
            onChange={(e) => onChange({ ...entry, weight: Number(e.target.value) })}
            className="w-24 accent-[var(--accent)]"
          />
          <span className="w-9 font-mono text-[var(--text)]">{entry.weight}%</span>
        </label>

        <label className="flex items-center gap-1.5 font-sans text-[0.68rem] text-[var(--text-faint)]">
          threshold
          <input
            type="range"
            min={0}
            max={90}
            value={entry.threshold}
            onChange={(e) => onChange({ ...entry, threshold: Number(e.target.value) })}
            className="w-24 accent-[var(--accent)]"
          />
          <span className="w-9 font-mono text-[var(--text)]">{entry.threshold}%</span>
        </label>
      </div>
    </div>
  );
}

export default function CustomBiasPage({ panels }: { panels: MacroPanel[] }) {
  const [entries, setEntries] = useLocalStorage<CustomEntry[]>("macropad:customBias", []);
  const [query, setQuery] = useState("");
  const [pickerOpen, setPickerOpen] = useState(entries.length === 0);

  const allSeries = useMemo(
    () => panels.flatMap((p) => p.series.filter((s) => s.id !== "geo:news-feed").map((s) => ({ series: s, panelTitle: p.title }))),
    [panels]
  );
  const seriesById = new Map(allSeries.map((x) => [x.series.id, x]));

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const chosenIds = new Set(entries.map((e) => e.seriesId));
    const pool = allSeries.filter(({ series }) => !chosenIds.has(series.id));
    if (!q) return pool;
    return pool.filter(({ series }) => series.name.toLowerCase().includes(q) || series.note.toLowerCase().includes(q));
  }, [allSeries, entries, query]);

  const add = (seriesId: string) => {
    setEntries((prev) => [...prev, { seriesId, sign: 1, weight: 50, threshold: 15 }]);
  };
  const update = (seriesId: string, next: CustomEntry) => {
    setEntries((prev) => prev.map((e) => (e.seriesId === seriesId ? next : e)));
  };
  const remove = (seriesId: string) => {
    setEntries((prev) => prev.filter((e) => e.seriesId !== seriesId));
  };

  const scored = entries
    .map((entry) => {
      const found = seriesById.get(entry.seriesId);
      if (!found) return null;
      const score = computeScore(entry, found.series);
      return { entry, series: found.series, panelTitle: found.panelTitle, score };
    })
    .filter((x): x is { entry: CustomEntry; series: MacroSeries; panelTitle: string; score: number | null } => x !== null);

  const totalWeight = scored.reduce((a, s) => a + (s.score !== null ? s.entry.weight : 0), 0);
  const netScore =
    totalWeight === 0
      ? 0
      : scored.reduce((a, s) => a + (s.score !== null ? s.score * s.entry.weight : 0), 0) / totalWeight;
  const netTone = Math.abs(netScore) < 0.01 ? "flat" : netScore > 0 ? "up" : "down";

  return (
    <div>
      {scored.length > 0 && (
        <div className="mb-6 rounded-lg border border-[var(--border)] bg-[var(--panel)] p-6">
          <div className="flex items-center justify-between gap-4">
            <div className="font-sans text-[0.68rem] uppercase tracking-wide text-[var(--text-faint)]">Your custom bias</div>
            <span
              className="rounded-full border px-3 py-1 text-[0.72rem] font-bold uppercase tracking-wide"
              style={{
                color: toneColor(netTone),
                borderColor: `color-mix(in srgb, ${toneColor(netTone)} 40%, var(--border))`,
                background: `color-mix(in srgb, ${toneColor(netTone)} 12%, transparent)`,
              }}
            >
              {netScore > 0 ? "+" : ""}
              {Math.round(netScore * 100)}%
            </span>
          </div>
          <div className="mt-3">
            <Gauge score={netScore} tone={netTone} />
          </div>
        </div>
      )}

      <div className="mb-5 rounded-lg border border-[var(--border)] bg-[var(--panel)]">
        <button onClick={() => setPickerOpen((v) => !v)} className="flex w-full items-center justify-between px-4 py-3 text-left">
          <span className="font-sans text-[0.82rem] font-semibold">Add indicator</span>
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
            <div className="grid max-h-[300px] grid-cols-1 gap-1 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map(({ series, panelTitle }) => (
                <button
                  key={series.id}
                  onClick={() => add(series.id)}
                  className="flex items-center justify-between rounded-md px-2 py-1.5 text-left hover:bg-[var(--panel-2)]"
                >
                  <div className="min-w-0">
                    <div className="truncate font-sans text-[0.78rem]">{series.name}</div>
                    <div className="truncate font-mono text-[0.62rem] text-[var(--text-faint)]">{panelTitle}</div>
                  </div>
                  <span className="shrink-0 font-mono text-[0.9rem] text-[var(--accent)]">+</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {scored.length === 0 ? (
        <p className="font-sans text-[0.85rem] text-[var(--text-faint)]">No indicators added yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {scored.map(({ entry, series, panelTitle }) => (
            <EntryRow
              key={entry.seriesId}
              entry={entry}
              series={series}
              panelTitle={panelTitle}
              onChange={(next) => update(entry.seriesId, next)}
              onRemove={() => remove(entry.seriesId)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
