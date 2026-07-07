"use client";

import { AreaChart, Area, ResponsiveContainer, YAxis } from "recharts";

export default function Sparkline({
  data,
  tone,
  heightClass = "h-14",
}: {
  data: number[];
  tone: "up" | "down" | "flat" | "pending";
  heightClass?: string;
}) {
  const color =
    tone === "up" ? "var(--up)" : tone === "down" ? "var(--down)" : tone === "flat" ? "var(--flat)" : "var(--accent)";
  const points = data.map((v, i) => ({ i, v }));
  const min = Math.min(...data);
  const max = Math.max(...data);
  const pad = (max - min) * 0.12 || 1;

  return (
    <div className={`${heightClass} w-full`}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 4, right: 2, bottom: 0, left: 2 }}>
          <defs>
            <linearGradient id={`spark-${color}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <YAxis domain={[min - pad, max + pad]} hide />
          <Area
            type="monotone"
            dataKey="v"
            stroke={color}
            strokeWidth={1.75}
            fill={`url(#spark-${color})`}
            dot={false}
            activeDot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
