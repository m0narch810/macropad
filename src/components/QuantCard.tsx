"use client";

import { useState } from "react";
import {
  ComposedChart,
  Area,
  Line,
  BarChart,
  Bar,
  ReferenceLine,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
} from "recharts";
import type { MacroSeries } from "@/lib/macroData";
import {
  computeDistStats,
  rollingZScore,
  movingAverage,
  rollingStd,
  momentumForCadence,
  histogram,
  inferCadence,
} from "@/lib/stats";
import SeriesCard from "@/components/SeriesCard";
import Sparkline from "@/components/Sparkline";
import ZScoreSurface3D from "@/components/ZScoreSurface3D";
import MarketLink from "@/components/MarketLink";
import SpecializedStatChart from "@/components/SpecializedStatChart";
import { getBias, getDirectionTone, getSignTone } from "@/lib/bias";
import { MARKET_LINKS } from "@/lib/markets";
import type { MarketRow } from "@/lib/getMarkets";

const chipClasses: Record<MacroSeries["status"], string> = {
  up: "text-[var(--up)] bg-[color-mix(in_srgb,var(--up)_14%,transparent)] border-[color-mix(in_srgb,var(--up)_35%,transparent)]",
  down: "text-[var(--down)] bg-[color-mix(in_srgb,var(--down)_14%,transparent)] border-[color-mix(in_srgb,var(--down)_35%,transparent)]",
  flat: "text-[var(--flat)] bg-[color-mix(in_srgb,var(--flat)_14%,transparent)] border-[color-mix(in_srgb,var(--flat)_35%,transparent)]",
  pending: "text-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] border-[color-mix(in_srgb,var(--accent)_30%,transparent)]",
};

/** Context-aware z-score color: only paints green/red once |z| clears 2σ, else neutral accent. */
function zTone(seriesId: string, z: number) {
  if (Math.abs(z) < 2) return "var(--accent)";
  const t = getSignTone(seriesId, z);
  return t === "up" ? "var(--up)" : t === "down" ? "var(--down)" : "var(--accent)";
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

function SectionHead({ title, caption }: { title: string; caption: string }) {
  return (
    <div className="mb-1.5">
      <div className="font-sans text-[0.7rem] font-semibold uppercase tracking-wide text-[var(--text-dim)]">{title}</div>
      <div className="font-sans text-[0.76rem] leading-snug text-[var(--text-faint)]">{caption}</div>
    </div>
  );
}

function MomentumBadge({
  seriesId,
  label,
  value,
  maxAbs,
}: {
  seriesId: string;
  label: string;
  value: number | null;
  maxAbs: number;
}) {
  const t = getSignTone(seriesId, value);
  const color = value === null ? "var(--text-faint)" : t === "up" ? "var(--up)" : t === "down" ? "var(--down)" : "var(--flat)";
  const barPct = value === null || maxAbs === 0 ? 0 : (Math.abs(value) / maxAbs) * 100;
  return (
    <div className="flex flex-col gap-1.5 rounded-md bg-[var(--panel-2)] px-2.5 py-2.5">
      <span className="font-sans text-[0.68rem] uppercase tracking-wide text-[var(--text-faint)]">{label}</span>
      <span className="font-mono text-[0.94rem] font-semibold" style={{ color }}>
        {value === null ? "—" : `${value > 0 ? "+" : ""}${value.toFixed(3)}`}
      </span>
      <div className="relative h-1 rounded-full bg-[var(--border)]">
        <div
          className="absolute top-0 h-1 rounded-full"
          style={{
            width: `${barPct}%`,
            background: color,
            [value !== null && value < 0 ? "right" : "left"]: 0,
          }}
        />
      </div>
    </div>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      className="shrink-0 text-[var(--text-faint)] transition-transform duration-200"
      style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
    >
      <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function QuantCard({
  series,
  markets,
  assetFilter = null,
  assetLabel = null,
}: {
  series: MacroSeries;
  markets: MarketRow[];
  assetFilter?: string | null;
  assetLabel?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const history = series.history;
  const link = MARKET_LINKS[series.id];
  const isRelevant = !assetFilter || link?.symbol === assetFilter;
  if (!history || history.length < 20) {
    return <SeriesCard series={series} assetFilter={assetFilter} assetLabel={assetLabel} />;
  }

  const linkedMarket = link ? markets.find((m) => m.id === `market:${link.symbol}`) : null;

  const values = history.map((h) => h.value);
  const dist = computeDistStats(values);
  const { cadence, periodsPerYear } = inferCadence(history);
  const zWindow = Math.min(60, Math.floor(values.length / 2));
  const zSeries = rollingZScore(values, zWindow);
  const maShortWindow = Math.min(20, Math.floor(values.length / 3));
  const maLongWindow = Math.min(50, Math.floor(values.length / 2));
  const ma20 = movingAverage(values, maShortWindow);
  const ma50 = movingAverage(values, maLongWindow);
  const volWindow = Math.min(20, Math.floor(values.length / 3));
  const vol = rollingStd(values, volWindow);
  const momentum = momentumForCadence(history, cadence);
  const lookbackPoints = cadence === "daily" ? 252 : cadence === "weekly" ? 52 : cadence === "monthly" ? 12 : 4;
  const dist52 = computeDistStats(values.slice(-Math.min(values.length, lookbackPoints)));
  const hist = histogram(values, 14);

  const chartData = history.map((h, i) => ({
    date: h.date,
    value: h.value,
    ma20: ma20[i],
    ma50: ma50[i],
    z: zSeries[i],
    vol: vol[i],
  }));

  const annVolMultiplier = Math.sqrt(periodsPerYear);
  const annVol = dist && vol[vol.length - 1] !== null ? (vol[vol.length - 1] as number) * annVolMultiplier : null;
  const bias = getBias(series.id, dist ? dist.zscore : null);
  const biasToneColor = bias ? (bias.tone === "up" ? "var(--up)" : bias.tone === "down" ? "var(--down)" : "var(--text-faint)") : "var(--text-faint)";
  const chipTone = getDirectionTone(series.id, series.status);

  return (
    <div
      className="rounded-lg border border-[var(--border)] bg-[var(--panel)] transition-opacity duration-150"
      style={!isRelevant ? { opacity: 0.42 } : undefined}
    >
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-4 p-7 text-left">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="m-0 truncate text-[1.2rem] font-semibold">{series.name}</h3>
            <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[0.7rem] font-bold uppercase tracking-wide ${chipClasses[chipTone]}`}>
              {series.status}
            </span>
            {!isRelevant && (
              <span className="shrink-0 whitespace-nowrap rounded-full border border-[var(--border)] px-2 py-[3px] font-sans text-[0.62rem] font-semibold text-[var(--text-faint)]">
                Not linked to {assetLabel ?? assetFilter}
              </span>
            )}
          </div>
          <p className="m-0 mt-1 truncate font-sans text-[0.86rem] text-[var(--text-faint)]">{series.note}</p>
          {bias && (
            <div className="mt-1 truncate font-sans text-[0.8rem]" style={{ color: biasToneColor }}>
              {bias.label}
            </div>
          )}
        </div>

        {series.sparkline && series.sparkline.length >= 5 && (
          <div className="hidden w-24 shrink-0 md:block">
            <Sparkline data={series.sparkline} tone={series.status} heightClass="h-10" />
          </div>
        )}

        <div className="shrink-0 text-right">
          <div className="font-mono text-[2.1rem] font-semibold leading-none">{series.value}</div>
          {dist && (
            <div className="mt-1 font-mono text-[0.8rem]" style={{ color: zTone(series.id, dist.zscore) }}>
              {dist.zscore > 0 ? "+" : ""}
              {dist.zscore.toFixed(2)}σ
            </div>
          )}
        </div>

        <Chevron open={open} />
      </button>

      {open && (
      <div className="border-t border-[var(--border)] p-7 pt-6">
      {bias && (
        <div className="mt-4 rounded-md border p-3.5" style={{ borderColor: `color-mix(in srgb, ${biasToneColor} 35%, var(--border))`, background: `color-mix(in srgb, ${biasToneColor} 7%, transparent)` }}>
          <div className="flex items-center gap-2">
            <span className="font-sans text-[0.68rem] font-bold uppercase tracking-wide" style={{ color: biasToneColor }}>
              {bias.strength === "strong" ? "Strong read" : bias.strength === "mild" ? "Mild read" : "Neutral"}
            </span>
          </div>
          <div className="mt-0.5 font-sans text-[0.92rem] font-semibold" style={{ color: biasToneColor }}>
            {bias.label}
          </div>
          <p className="m-0 mt-1.5 font-sans text-[0.78rem] leading-snug text-[var(--text-faint)]">{bias.context}</p>
        </div>
      )}

      {linkedMarket && link && (
        <div className="mt-3">
          <MarketLink market={linkedMarket} rationale={link.rationale} indicatorHistory={history} />
        </div>
      )}

      {/* specialized stats — the deepest section, each with its own history + z-score */}
      {series.extraStats && series.extraStats.length > 0 && (
        <div className="mt-6">
          <SectionHead
            title="Specialized for this indicator"
            caption="Metrics quants actually use for this specific series, not generic stats — each with its own history and z-score."
          />
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {series.extraStats.map((stat) => (
              <SpecializedStatChart key={stat.label} stat={stat} />
            ))}
          </div>
        </div>
      )}

      {/* history + moving averages */}
      <div className="mt-6">
        <SectionHead
          title="History"
          caption={`Raw series with ${maShortWindow}- and ${maLongWindow}-period moving averages overlaid — crossovers flag trend shifts.`}
        />
        <div className="h-[240px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 4, right: 8, bottom: 22, left: 4 }}>
              <defs>
                <linearGradient id={`q-hist-${series.id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="date"
                tickFormatter={fmtDate}
                tick={{ fill: "var(--text-faint)", fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: "var(--border)" }}
                minTickGap={70}
                label={{ value: "Date", position: "insideBottom", offset: -14, fill: "var(--text-faint)", fontSize: 11 }}
              />
              <YAxis
                tick={{ fill: "var(--text-faint)", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={58}
                domain={["auto", "auto"]}
                label={{ value: "Value", angle: -90, position: "insideLeft", offset: 10, fill: "var(--text-faint)", fontSize: 11 }}
              />
              <Tooltip
                contentStyle={{ background: "var(--panel-2)", border: "1px solid var(--border)", borderRadius: 6, fontSize: 12.5 }}
                labelFormatter={(d) => fmtDate(String(d))}
                formatter={(v, name) => [v === null || v === undefined ? "—" : Number(v).toFixed(3), name]}
              />
              <Area type="monotone" dataKey="value" stroke="var(--accent)" strokeWidth={2} fill={`url(#q-hist-${series.id})`} dot={false} isAnimationActive={false} />
              <Line type="monotone" dataKey="ma20" stroke="var(--up)" strokeWidth={1.5} dot={false} isAnimationActive={false} strokeOpacity={0.85} />
              <Line type="monotone" dataKey="ma50" stroke="var(--down)" strokeWidth={1.5} dot={false} isAnimationActive={false} strokeOpacity={0.85} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-1 flex gap-4 font-sans text-[0.72rem] text-[var(--text-faint)]">
          <span><span className="text-[var(--accent)]">■</span> value</span>
          <span><span className="text-[var(--up)]">■</span> MA{maShortWindow}</span>
          <span><span className="text-[var(--down)]">■</span> MA{maLongWindow}</span>
        </div>
      </div>

      {/* rolling z-score + volatility, side by side */}
      <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div>
          <SectionHead
            title={`Rolling z-score (window ${zWindow})`}
            caption="σ from the trailing mean at every point — dashed lines mark the ±2σ tail."
          />
          <div className="h-[130px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 2, right: 8, bottom: 0, left: 4 }}>
                <XAxis dataKey="date" hide />
                <YAxis
                  domain={[-3, 3]}
                  tick={{ fill: "var(--text-faint)", fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  width={26}
                  ticks={[-2, 0, 2]}
                />
                <ReferenceLine y={0} stroke="var(--border)" />
                <ReferenceLine y={2} stroke="var(--down)" strokeDasharray="3 3" strokeOpacity={0.5} />
                <ReferenceLine y={-2} stroke="var(--down)" strokeDasharray="3 3" strokeOpacity={0.5} />
                <Tooltip
                  contentStyle={{ background: "var(--panel-2)", border: "1px solid var(--border)", borderRadius: 6, fontSize: 12 }}
                  labelFormatter={(d) => fmtDate(String(d))}
                  formatter={(v) => [v === null || v === undefined ? "—" : Number(v).toFixed(2) + "σ", "z"]}
                />
                <Line type="monotone" dataKey="z" stroke={dist ? zTone(series.id, dist.zscore) : "var(--accent)"} strokeWidth={1.5} dot={false} isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div>
          <SectionHead
            title={`Rolling volatility (${volWindow}p std dev)`}
            caption="Realized dispersion — rising means choppier, not a direction."
          />
          <div className="h-[130px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 2, right: 8, bottom: 0, left: 4 }}>
                <XAxis dataKey="date" hide />
                <YAxis tick={{ fill: "var(--text-faint)", fontSize: 10 }} tickLine={false} axisLine={false} width={38} domain={[0, "auto"]} />
                <Tooltip
                  contentStyle={{ background: "var(--panel-2)", border: "1px solid var(--border)", borderRadius: 6, fontSize: 12 }}
                  labelFormatter={(d) => fmtDate(String(d))}
                  formatter={(v) => [v === null || v === undefined ? "—" : Number(v).toFixed(4), "σ"]}
                />
                <Area type="monotone" dataKey="vol" stroke="var(--flat)" strokeWidth={1.25} fill="var(--flat)" fillOpacity={0.18} dot={false} isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* z-score surface: window x time, 3D — always on */}
      <div className="mt-6">
        <ZScoreSurface3D history={history} seriesName={series.name} />
        <p className="mt-1.5 font-sans text-[0.74rem] leading-snug text-[var(--text-faint)] opacity-90">
          Same rolling z-score, swept across 8 lookback windows at once. A signal that stays tall across every
          row is robust to window choice; one tall in a single row is likely a lookback artifact.
        </p>
      </div>

      {/* distribution + range, side by side */}
      <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div>
          <SectionHead
            title={`Distribution (${series.windowLabel})`}
            caption="Historical values by bucket — accent bar is where today sits."
          />
          <div className="h-[90px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hist} margin={{ top: 2, right: 8, bottom: 0, left: 0 }}>
                <XAxis dataKey="bucket" hide />
                <YAxis hide />
                <Tooltip
                  contentStyle={{ background: "var(--panel-2)", border: "1px solid var(--border)", borderRadius: 6, fontSize: 12 }}
                  labelFormatter={(b) => `≈ ${Number(b).toFixed(3)}`}
                  formatter={(v) => [v, "count"]}
                />
                <Bar dataKey="count" radius={[2, 2, 0, 0]}>
                  {hist.map((h, i) => (
                    <Cell key={i} fill={dist && Math.abs(h.bucket - dist.latest) < (dist.max - dist.min) / 14 ? "var(--accent)" : "var(--border)"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {dist52 && (
          <div>
            <SectionHead
              title={cadence === "daily" || cadence === "weekly" ? "52w range" : cadence === "monthly" ? "12m range" : "4q range"}
              caption="Dot marks where today's value sits in the recent range."
            />
            <div className="mt-3">
              <div className="mb-1.5 flex justify-between font-mono text-[0.72rem] text-[var(--text-faint)]">
                <span>{dist52.min.toFixed(3)}</span>
                <span>{dist52.max.toFixed(3)}</span>
              </div>
              <div className="relative h-2 rounded-full bg-[var(--border)]">
                <div
                  className="absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 -translate-x-1/2 rounded-full border-2 border-[var(--panel)] bg-[var(--accent)]"
                  style={{
                    left: `${dist52.max === dist52.min ? 50 : ((dist52.latest - dist52.min) / (dist52.max - dist52.min)) * 100}%`,
                  }}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* momentum row */}
      <div className="mt-6">
        <div className="mb-1.5 font-sans text-[0.68rem] uppercase tracking-wide text-[var(--text-faint)]">
          Momentum — absolute change vs. N periods ago
        </div>
        <div className="grid grid-cols-4 gap-2">
          {(() => {
            const maxAbs = Math.max(1e-9, ...momentum.map((m) => (m.value === null ? 0 : Math.abs(m.value))));
            return momentum.map((m) => (
              <MomentumBadge key={m.label} seriesId={series.id} label={m.label} value={m.value} maxAbs={maxAbs} />
            ));
          })()}
        </div>
      </div>

      {/* stats grid, with a range-position visual */}
      {dist && (
        <div className="mt-6 border-t border-[var(--border)] pt-4">
          <div className="mb-1.5 flex justify-between font-sans text-[0.68rem] uppercase tracking-wide text-[var(--text-faint)]">
            <span>Full-history range</span>
            <span className="font-mono normal-case">{dist.percentile.toFixed(0)}th percentile</span>
          </div>
          <div className="relative h-2 rounded-full bg-[var(--border)]">
            <div
              className="absolute top-1/2 h-1 w-1 -translate-y-1/2 rounded-full bg-[var(--text-faint)]"
              style={{ left: `${((dist.mean - dist.min) / (dist.max - dist.min || 1)) * 100}%` }}
            />
            <div
              className="absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 -translate-x-1/2 rounded-full border-2 border-[var(--panel)]"
              style={{
                left: `${((dist.latest - dist.min) / (dist.max - dist.min || 1)) * 100}%`,
                background: zTone(series.id, dist.zscore),
              }}
            />
          </div>
          <div className="mt-1 flex justify-between font-mono text-[0.7rem] text-[var(--text-faint)]">
            <span>{dist.min.toFixed(3)}</span>
            <span>mean {dist.mean.toFixed(3)}</span>
            <span>{dist.max.toFixed(3)}</span>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-x-3 gap-y-3 font-mono text-[0.82rem] sm:grid-cols-5">
            <Stat label="Std Dev" value={dist.std.toFixed(3)} />
            <Stat label="Ann. Vol" value={annVol !== null ? annVol.toFixed(3) : "—"} />
            <Stat label="Z-score" value={`${dist.zscore > 0 ? "+" : ""}${dist.zscore.toFixed(2)}σ`} color={zTone(series.id, dist.zscore)} />
            <Stat label="N obs" value={String(values.length)} />
            <Stat label="Cadence" value={cadence} />
          </div>
        </div>
      )}

      <div className="mt-5 flex items-center justify-between font-mono text-[0.7rem] text-[var(--text-faint)]">
        <span>{series.source}</span>
        {series.windowLabel && <span>{series.windowLabel}</span>}
      </div>
      </div>
      )}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div className="font-sans text-[0.66rem] uppercase tracking-wide text-[var(--text-faint)]">{label}</div>
      <div style={color ? { color } : undefined}>{value}</div>
    </div>
  );
}
