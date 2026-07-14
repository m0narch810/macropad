"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, ReferenceLine, Tooltip, XAxis, YAxis } from "recharts";
import { fmtUsd } from "@/lib/gex";

export interface ExposureBarDatum {
  strike: number;
  call?: number;
  put?: number;
  net?: number;
}

export interface ExposureMarker {
  value: number;
  label: string;
  color: string;
}

export default function ExposureBarChart({
  data,
  mode,
  unitLabel,
  markers,
}: {
  data: ExposureBarDatum[];
  mode: "split" | "net";
  unitLabel: string;
  markers?: ExposureMarker[];
}) {
  return (
    <div className="h-[280px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }} barGap={0} barCategoryGap="18%">
          <CartesianGrid strokeDasharray="2 4" stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="strike"
            tick={{ fill: "var(--text-faint)", fontSize: 10 }}
            tickLine={false}
            axisLine={{ stroke: "var(--border)" }}
            interval="preserveStartEnd"
            type="number"
            domain={["dataMin", "dataMax"]}
          />
          <YAxis
            tick={{ fill: "var(--text-faint)", fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            width={54}
            tickFormatter={(v) => fmtUsd(Number(v))}
          />
          <ReferenceLine y={0} stroke="var(--border-strong)" />
          {/* Text labels on these lines used to collide when levels sit close together (e.g. spot right next to a wall) - the legend below the chart carries the labels instead. */}
          {markers?.map((m) => (
            <ReferenceLine key={m.label} x={m.value} stroke={m.color} strokeWidth={1.5} strokeDasharray="4 3" />
          ))}
          <Tooltip
            cursor={{ fill: "var(--panel-2)", opacity: 0.5 }}
            contentStyle={{ background: "var(--panel)", border: "1px solid var(--border-strong)", borderRadius: 3, fontSize: 11 }}
            labelFormatter={(s) => `Strike ${s}`}
            formatter={(v, name) => [`${fmtUsd(Number(v))} ${unitLabel}`, String(name)]}
          />
          {mode === "split" ? (
            <>
              <Bar dataKey="call" name="Call" stackId="exp" fill="var(--up)" radius={[2, 2, 0, 0]} isAnimationActive={false} />
              <Bar dataKey="put" name="Put" stackId="exp" fill="var(--down)" radius={[0, 0, 2, 2]} isAnimationActive={false} />
            </>
          ) : (
            <Bar dataKey="net" name="Net" isAnimationActive={false} radius={[2, 2, 2, 2]}>
              {data.map((d, i) => (
                <Cell key={i} fill={(d.net ?? 0) >= 0 ? "var(--up)" : "var(--down)"} />
              ))}
            </Bar>
          )}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
