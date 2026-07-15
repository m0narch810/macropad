"use client";

import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fmtUsd } from "@/lib/gex";
import type { TerminalMetricPoint } from "@/components/optionsflow/TerminalChart";

/** Running cumulative sum ascending by strike - the "staircase" view of a book: where it crosses zero is the true structural flip, not just the single largest strike. A different read than the per-strike bar chart, derived client-side from the same data, no extra fetch. */
export function CumulativeExposureChart({
  data,
  unitLabel,
  spot,
  valueFormatter = fmtUsd,
}: {
  data: TerminalMetricPoint[];
  unitLabel: string;
  spot: number;
  /** Defaults to $-formatted; pass fmtRaw when the underlying data comes from /heatmap - see TerminalExposureChart. */
  valueFormatter?: (n: number | null | undefined) => string;
}) {
  const sorted = [...data].sort((a, b) => a.strike - b.strike);
  let running = 0;
  const cumulative = sorted.map((d) => {
    running += d.value;
    return { strike: d.strike, cumulative: running };
  });

  let flipStrike: number | null = null;
  for (let i = 1; i < cumulative.length; i++) {
    if (Math.sign(cumulative[i - 1].cumulative) !== Math.sign(cumulative[i].cumulative) && cumulative[i - 1].cumulative !== 0) {
      flipStrike = cumulative[i - 1].strike;
      break;
    }
  }

  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={cumulative} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="cumUp" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--up)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--up)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="2 4" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="strike" type="number" domain={["dataMin", "dataMax"]} tick={{ fill: "var(--text-faint)", fontSize: 10 }} tickLine={false} axisLine={{ stroke: "var(--border)" }} />
          <YAxis tick={{ fill: "var(--text-faint)", fontSize: 10 }} tickLine={false} axisLine={false} width={54} tickFormatter={(v) => valueFormatter(Number(v))} />
          <ReferenceLine y={0} stroke="var(--border-strong)" />
          {spot > 0 && <ReferenceLine x={spot} stroke="var(--text-faint)" strokeDasharray="3 3" label={{ value: "Spot", fill: "var(--text-faint)", fontSize: 10, position: "top" }} />}
          {flipStrike !== null && <ReferenceLine x={flipStrike} stroke="var(--accent)" strokeDasharray="4 3" label={{ value: `Flip ${flipStrike}`, fill: "var(--accent)", fontSize: 10, position: "insideTopRight" }} />}
          <Tooltip
            cursor={{ stroke: "var(--border-strong)" }}
            contentStyle={{ background: "var(--panel)", border: "1px solid var(--border-strong)", borderRadius: 3, fontSize: 11 }}
            labelFormatter={(s) => `Strike ${s}`}
            formatter={(v) => [`${valueFormatter(Number(v))} ${unitLabel}`, "Cumulative"]}
          />
          <Area type="monotone" dataKey="cumulative" stroke="var(--text)" strokeWidth={1.5} fill="url(#cumUp)" isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
