"use client";

import { fmtUsd } from "@/lib/gex";
import type { ExposureBarDatum } from "@/components/optionsflow/ExposureBarChart";

function divergingColor(value: number, maxAbs: number): string {
  if (maxAbs === 0) return "var(--panel-2)";
  const t = Math.max(-1, Math.min(1, value / maxAbs));
  const pct = Math.round(Math.abs(t) * 85);
  const base = t >= 0 ? "var(--up)" : "var(--down)";
  return `color-mix(in srgb, ${base} ${pct}%, var(--panel-2) ${100 - pct}%)`;
}

function HeatRow({ label, values, maxAbs }: { label: string; values: { strike: number; value: number }[]; maxAbs: number }) {
  return (
    <div className="flex items-stretch gap-px">
      <div className="flex w-14 shrink-0 items-center justify-end pr-2 font-mono text-[0.62rem] font-semibold uppercase tracking-[0.06em] text-[var(--text-faint)]">
        {label}
      </div>
      <div className="flex flex-1 gap-px overflow-hidden">
        {values.map((v) => (
          <div
            key={v.strike}
            title={`Strike ${v.strike}: ${fmtUsd(v.value)}`}
            className="group relative h-9 flex-1 cursor-default transition-transform duration-100 hover:z-10 hover:scale-y-110"
            style={{ background: divergingColor(v.value, maxAbs) }}
          >
            <div className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1.5 hidden -translate-x-1/2 whitespace-nowrap rounded-[2px] border border-[var(--border-strong)] bg-[var(--panel)] px-2 py-1 font-mono text-[0.62rem] text-[var(--text)] group-hover:block">
              {v.strike} · {fmtUsd(v.value)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ExposureHeatmap({ data, mode }: { data: ExposureBarDatum[]; mode: "split" | "net" }) {
  const maxAbs =
    mode === "split"
      ? Math.max(1, ...data.flatMap((d) => [Math.abs(d.call ?? 0), Math.abs(d.put ?? 0)]))
      : Math.max(1, ...data.map((d) => Math.abs(d.net ?? 0)));

  return (
    <div className="flex flex-col gap-1.5">
      {mode === "split" ? (
        <>
          <HeatRow label="Call" values={data.map((d) => ({ strike: d.strike, value: d.call ?? 0 }))} maxAbs={maxAbs} />
          <HeatRow label="Put" values={data.map((d) => ({ strike: d.strike, value: d.put ?? 0 }))} maxAbs={maxAbs} />
        </>
      ) : (
        <HeatRow label="Net" values={data.map((d) => ({ strike: d.strike, value: d.net ?? 0 }))} maxAbs={maxAbs} />
      )}
      <div className="flex gap-px pl-14">
        {data.map((d, i) => (
          <div
            key={d.strike}
            className="flex-1 text-center font-mono text-[0.56rem] text-[var(--text-faint)]"
            style={{ visibility: i % 2 === 0 ? "visible" : "hidden" }}
          >
            {d.strike}
          </div>
        ))}
      </div>
    </div>
  );
}
