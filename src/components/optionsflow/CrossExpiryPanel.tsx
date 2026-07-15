"use client";

import { useEffect, useMemo, useState } from "react";
import type { GexResponse, GexSymbol } from "@/lib/gex";
import { computeTopWalls, TerminalExposureChart, type WallMarker } from "@/components/optionsflow/TerminalChart";

const STRIKE_WINDOW = 26; // ~+-13 strikes around spot

type Metric = "gex" | "dex" | "vex" | "cex" | "tex" | "vegaex";
const METRIC_LABEL: Record<Metric, string> = { gex: "GEX", dex: "DEX", vex: "VEX", cex: "CHEX", tex: "THETA", vegaex: "VEGA" };
const METRIC_ORDER: Metric[] = ["gex", "dex", "vex", "cex", "tex", "vegaex"];
const TICKERS: GexSymbol[] = ["QQQ", "SPY", "SPX", "NDX"];

function Dropdown<T extends string>({ value, options, labels, onChange }: { value: T; options: T[]; labels?: Record<T, string>; onChange: (v: T) => void }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className="border border-[var(--border)] bg-[var(--panel)] px-2 py-1 font-mono text-[0.68rem] font-semibold text-[var(--text)] outline-none"
    >
      {options.map((o) => (
        <option key={o} value={o}>
          {labels ? labels[o] : o}
        </option>
      ))}
    </select>
  );
}

export function CrossExpiryPanel({ defaultSymbol }: { defaultSymbol: GexSymbol }) {
  const [ticker, setTicker] = useState<GexSymbol>(defaultSymbol);
  const [metric, setMetric] = useState<Metric>("gex");
  const [dteIndex, setDteIndex] = useState(0);
  const [data, setData] = useState<GexResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/gex?symbol=${ticker}`, { cache: "no-store" })
      .then((res) => {
        if (!res.ok) throw new Error(`request failed (${res.status})`);
        return res.json();
      })
      .then((json: GexResponse) => {
        if (cancelled) return;
        if (!json.ok) throw new Error("upstream returned an error");
        setData(json);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [ticker]);

  const grid = data?.strikeExpiryHeatmaps?.[metric] ?? null;
  const columns = grid?.columns ?? [];
  const clampedIndex = Math.min(dteIndex, Math.max(0, columns.length - 1));

  const chartData = useMemo(() => {
    if (!grid || !grid.strikes.length || !data) return [];
    const all = grid.strikes.map((strike, i) => ({ strike, value: grid.values[i][clampedIndex] ?? 0 }));
    return [...all].sort((a, b) => Math.abs(a.strike - data.spot) - Math.abs(b.strike - data.spot)).slice(0, STRIKE_WINDOW).sort((a, b) => a.strike - b.strike);
  }, [grid, clampedIndex, data]);

  const walls: WallMarker[] = data
    ? [...computeTopWalls(chartData, metric, 2), { label: "Max Pain", price: data.maxPain, color: "#d9a441" }, ...(data.gammaFlip !== null ? [{ label: "G-Flip", price: data.gammaFlip, color: "var(--text-faint)" }] : [])]
    : [];

  return (
    <div className="hud flex flex-col gap-3 border border-[var(--border)] bg-[var(--panel)] p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Dropdown value={ticker} options={TICKERS} onChange={setTicker} />
        <Dropdown value={String(clampedIndex)} options={columns.map((_, i) => String(i))} labels={Object.fromEntries(columns.map((c, i) => [String(i), c.label]))} onChange={(v) => setDteIndex(Number(v))} />
        <Dropdown value={metric} options={METRIC_ORDER} labels={METRIC_LABEL} onChange={(m) => { setMetric(m); setDteIndex(0); }} />
      </div>

      {loading && <div className="py-16 text-center font-mono text-[0.72rem] text-[var(--text-faint)]">Loading {ticker}…</div>}
      {!loading && error && (
        <div className="py-16 text-center font-mono text-[0.72rem]" style={{ color: "var(--down)" }}>
          ERR: {error}
        </div>
      )}
      {!loading && !error && data && (chartData.length ? <TerminalExposureChart data={chartData} unitLabel={METRIC_LABEL[metric]} spot={data.spot} walls={walls} showAllTicks /> : <div className="py-16 text-center font-mono text-[0.72rem] text-[var(--text-faint)]">No data for this selection.</div>)}
    </div>
  );
}
