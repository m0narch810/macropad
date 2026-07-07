"use client";

import { AreaChart, Area, ReferenceLine, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts";
import type { ExtraStat } from "@/lib/macroData";
import { computeDistStats } from "@/lib/stats";

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

export default function SpecializedStatChart({ stat }: { stat: ExtraStat }) {
  const history = stat.history;
  const dist = history && history.length >= 5 ? computeDistStats(history.map((h) => h.value)) : null;
  const color = stat.flag ? "var(--down)" : "var(--accent)";

  return (
    <div
      className="rounded-md border p-3.5"
      style={
        stat.flag
          ? { borderColor: "color-mix(in srgb, var(--down) 45%, var(--border))", background: "color-mix(in srgb, var(--down) 8%, transparent)" }
          : { borderColor: "var(--border)", background: "var(--panel-2)" }
      }
    >
      <div className="flex items-baseline justify-between gap-2">
        <div className="font-sans text-[0.72rem] uppercase tracking-wide text-[var(--text-faint)]">{stat.label}</div>
        {dist && (
          <span className="font-mono text-[0.7rem]" style={{ color }}>
            {dist.zscore > 0 ? "+" : ""}
            {dist.zscore.toFixed(2)}σ
          </span>
        )}
      </div>
      <div className="mt-0.5 font-mono text-[1.15rem] font-semibold" style={stat.flag ? { color: "var(--down)" } : undefined}>
        {stat.value}
      </div>
      {stat.caption && <p className="m-0 mt-1 font-sans text-[0.72rem] leading-snug text-[var(--text-faint)]">{stat.caption}</p>}

      {history && history.length >= 10 && (
        <div className="mt-2.5 h-[90px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={history} margin={{ top: 4, right: 4, bottom: 0, left: -28 }}>
              <defs>
                <linearGradient id={`spec-${stat.label.replace(/\s+/g, "-")}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" hide />
              <YAxis tick={{ fill: "var(--text-faint)", fontSize: 9 }} tickLine={false} axisLine={false} width={34} domain={["auto", "auto"]} />
              {stat.threshold !== undefined && (
                <ReferenceLine y={stat.threshold} stroke="var(--down)" strokeDasharray="3 3" strokeOpacity={0.6} />
              )}
              <ReferenceLine y={0} stroke="var(--border)" />
              <Tooltip
                contentStyle={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 6, fontSize: 11 }}
                labelFormatter={(d) => fmtDate(String(d))}
                formatter={(v) => [Number(v).toFixed(3), stat.label]}
              />
              <Area type="monotone" dataKey="value" stroke={color} strokeWidth={1.5} fill={`url(#spec-${stat.label.replace(/\s+/g, "-")})`} dot={false} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
      {stat.windowLabel && (
        <div className="mt-1 font-mono text-[0.62rem] text-[var(--text-faint)]">{stat.windowLabel}</div>
      )}
    </div>
  );
}
