"use client";

import { Area, AreaChart, CartesianGrid, Line, LineChart, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fmtNum, fmtUsd } from "@/lib/gex";
import type { HedgeCliff, HedgeCurvePoint } from "@/lib/hedgeCliffEngine";

function cliffBand(cliff: HedgeCliff | null, spacing: number) {
  if (!cliff) return null;
  return { x1: cliff.price - spacing, x2: cliff.price + spacing, color: cliff.type === "stabilizing" ? "var(--up)" : "var(--down)" };
}

/** Three vertically stacked charts sharing one price axis: H(S), H'(S), H''(S). Shared shape lets you read straight down a column - a shaded band means the same price is a cliff on all three. */
export function HedgeCliffCharts({
  curve,
  spot,
  upsideCliff,
  downsideCliff,
  maxPinning,
  feedbackFlip,
}: {
  curve: HedgeCurvePoint[];
  spot: number;
  upsideCliff: HedgeCliff | null;
  downsideCliff: HedgeCliff | null;
  maxPinning: { price: number | null; pressure: number | null };
  feedbackFlip: { price: number; belowType: string; aboveType: string } | null;
}) {
  const spacing = curve.length > 1 ? (curve[curve.length - 1].price - curve[0].price) * 0.02 : 0.2;
  const upBand = cliffBand(upsideCliff, spacing);
  const downBand = cliffBand(downsideCliff, spacing);

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <div className="eyebrow">Total hedge pressure — H(S)</div>
        <div className="font-mono text-[0.56rem] text-[var(--text-faint)]">shares vs. now</div>
      </div>
      <div className="h-[150px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={curve} margin={{ top: 4, right: 12, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="hFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--text)" stopOpacity={0.25} />
                <stop offset="100%" stopColor="var(--text)" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="2 4" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="price" type="number" domain={["dataMin", "dataMax"]} hide />
            <YAxis tick={{ fill: "var(--text-faint)", fontSize: 9 }} tickLine={false} axisLine={false} width={48} tickFormatter={(v) => fmtUsd(Number(v))} />
            <ReferenceLine y={0} stroke="var(--border-strong)" />
            <ReferenceLine x={spot} stroke="var(--text-faint)" strokeDasharray="3 3" />
            {upBand && <ReferenceArea x1={upBand.x1} x2={upBand.x2} fill={upBand.color} fillOpacity={0.1} />}
            {downBand && <ReferenceArea x1={downBand.x1} x2={downBand.x2} fill={downBand.color} fillOpacity={0.1} />}
            <Tooltip contentStyle={{ background: "var(--panel)", border: "1px solid var(--border-strong)", borderRadius: 3, fontSize: 11 }} labelFormatter={(s) => `${fmtNum(Number(s), 2)}`} formatter={(v) => [fmtUsd(Number(v)), "H(S)"]} />
            <Area type="monotone" dataKey="H" stroke="var(--text)" strokeWidth={1.3} fill="url(#hFill)" isAnimationActive={false} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-2 flex items-center justify-between">
        <div className="eyebrow">Marginal hedge pressure — H'(S)</div>
        <div className="font-mono text-[0.56rem] text-[var(--text-faint)]">shares per $1 move · green = stabilizing, red = destabilizing</div>
      </div>
      <div className="h-[170px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={curve} margin={{ top: 4, right: 12, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="hpNeg" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--up)" stopOpacity={0} />
                <stop offset="100%" stopColor="var(--up)" stopOpacity={0.3} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="2 4" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="price" type="number" domain={["dataMin", "dataMax"]} tick={{ fill: "var(--text-faint)", fontSize: 9 }} tickLine={false} axisLine={{ stroke: "var(--border)" }} />
            <YAxis tick={{ fill: "var(--text-faint)", fontSize: 9 }} tickLine={false} axisLine={false} width={48} tickFormatter={(v) => fmtUsd(Number(v))} />
            <ReferenceLine y={0} stroke="var(--border-strong)" />
            <ReferenceLine x={spot} stroke="var(--text-faint)" strokeDasharray="3 3" label={{ value: "Spot", fill: "var(--text-faint)", fontSize: 9, position: "insideTop" }} />
            {maxPinning.price !== null && (
              <ReferenceLine x={maxPinning.price} stroke="var(--accent)" strokeDasharray="4 3" label={{ value: `Max Pin ${fmtNum(maxPinning.price, 2)}`, fill: "var(--accent)", fontSize: 9, position: "insideBottom" }} />
            )}
            {feedbackFlip && <ReferenceLine x={feedbackFlip.price} stroke="#d9a441" strokeDasharray="4 3" label={{ value: `Flip ${fmtNum(feedbackFlip.price, 2)}`, fill: "#d9a441", fontSize: 9, position: "insideTop" }} />}
            {upBand && <ReferenceArea x1={upBand.x1} x2={upBand.x2} fill={upBand.color} fillOpacity={0.1} />}
            {downBand && <ReferenceArea x1={downBand.x1} x2={downBand.x2} fill={downBand.color} fillOpacity={0.1} />}
            <Tooltip
              contentStyle={{ background: "var(--panel)", border: "1px solid var(--border-strong)", borderRadius: 3, fontSize: 11 }}
              labelFormatter={(s) => `${fmtNum(Number(s), 2)}`}
              formatter={(v) => [`${fmtUsd(Number(v))}/$`, Number(v) < 0 ? "Stabilizing" : "Destabilizing"]}
            />
            <Area type="monotone" dataKey="Hprime" stroke="var(--text)" strokeWidth={1.3} fill="url(#hpNeg)" isAnimationActive={false} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-2 flex items-center justify-between">
        <div className="eyebrow">Hedge acceleration — H''(S)</div>
        <div className="font-mono text-[0.56rem] text-[var(--text-faint)]">normalized curvature · shaded = selected cliff</div>
      </div>
      <div className="h-[110px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={curve} margin={{ top: 4, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="2 4" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="price" type="number" domain={["dataMin", "dataMax"]} tick={{ fill: "var(--text-faint)", fontSize: 9 }} tickLine={false} axisLine={{ stroke: "var(--border)" }} />
            <YAxis tick={{ fill: "var(--text-faint)", fontSize: 9 }} tickLine={false} axisLine={false} width={48} />
            <ReferenceLine y={0} stroke="var(--border-strong)" />
            <ReferenceLine x={spot} stroke="var(--text-faint)" strokeDasharray="3 3" />
            {upBand && <ReferenceArea x1={upBand.x1} x2={upBand.x2} fill={upBand.color} fillOpacity={0.15} />}
            {downBand && <ReferenceArea x1={downBand.x1} x2={downBand.x2} fill={downBand.color} fillOpacity={0.15} />}
            <Tooltip contentStyle={{ background: "var(--panel)", border: "1px solid var(--border-strong)", borderRadius: 3, fontSize: 11 }} labelFormatter={(s) => `${fmtNum(Number(s), 2)}`} formatter={(v) => [Number(v).toFixed(2), "Accel Z"]} />
            <Line type="monotone" dataKey="accelZ" stroke="var(--accent)" strokeWidth={1.3} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
