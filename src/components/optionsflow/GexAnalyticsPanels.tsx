"use client";

import { Area, AreaChart, CartesianGrid, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fmtNum, fmtUsd } from "@/lib/gex";
import type {
  ConcentrationStats,
  AsymmetryStats,
  ColorForwardRow,
  CrossExpiryStack,
  FrictionPoint,
  GammaConfluence,
  GammaFlipBand,
  GammaFlipGradient,
  GexCurvePoint,
  HedgeScenarioRow,
  ImpliedMoments,
  IvScenarioPoint,
  PinningBasin,
  ProximityStats,
  ReachabilityRow,
  SurfaceAdjustedRow,
  TransitionRow,
  VacuumPoint,
  WallQualityRow,
} from "@/lib/gexAnalytics";

// ---------------------------------------------------------------------------
// Small shared bits
// ---------------------------------------------------------------------------

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="partno" style={{ color: "var(--text-faint)" }}>
      {children}
    </div>
  );
}

/** Every chart on this page reprices the same live 0DTE chain snapshot - never past snapshots. This block says in one place, right on the chart, what a reader should DO with it and what feeds it, instead of leaving that to a page-wide footnote nobody reads before the chart. */
export function HowToUse({ use, source }: { use: string; source: string }) {
  return (
    <div className="mb-3 flex flex-col gap-1 border-l-2 border-[var(--border)] pl-3 font-sans text-[0.72rem] leading-relaxed text-[var(--text-dim)]">
      <div>
        <span className="font-semibold text-[var(--text)]">How to use: </span>
        {use}
      </div>
      <div>
        <span className="font-semibold text-[var(--text)]">Where this comes from: </span>
        {source}
      </div>
    </div>
  );
}

export interface LegendItem {
  label: string;
  value: string;
  color: string;
}

/** Key-level legend rendered BELOW a chart instead of as in-chart line labels - in-chart text collides whenever two levels sit close together (spot right next to a wall, etc), confirmed directly against a live screenshot. */
export function MarkerLegend({ items }: { items: LegendItem[] }) {
  return (
    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-1.5 font-mono text-[0.66rem] text-[var(--text-dim)]">
          <span className="inline-block h-2.5 w-2.5 rounded-[1px]" style={{ background: item.color }} />
          {item.label}: <span className="font-semibold text-[var(--text)]">{item.value}</span>
        </div>
      ))}
    </div>
  );
}

/** Red-to-green diverging color scale bar, shared caption for every diverging heatmap on the page. */
export function DivergingColorLegend({ negLabel, posLabel }: { negLabel: string; posLabel: string }) {
  return (
    <div className="mt-2 flex items-center gap-2 font-mono text-[0.62rem] text-[var(--text-faint)]">
      <span>{negLabel}</span>
      <span
        className="h-2.5 w-28 rounded-[1px]"
        style={{ background: "linear-gradient(to right, var(--down), var(--panel-2), var(--up))" }}
      />
      <span>{posLabel}</span>
    </div>
  );
}

function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[480px] border-collapse font-mono text-[0.72rem]">
        <thead>
          <tr className="border-b border-[var(--border)]">
            {head.map((h, i) => (
              <th
                key={h}
                className={`whitespace-nowrap py-1.5 font-semibold uppercase tracking-[0.04em] text-[var(--text-faint)] ${i === 0 ? "text-left" : "text-right pl-3"}`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Plain-English summary components - regime, key levels, key risks, structure.
// These are the FIRST things a reader sees; everything technical (curves,
// tables, per-strike Greeks) lives further down in a collapsed "advanced"
// section instead of competing with these for attention.
// ---------------------------------------------------------------------------

export function RegimeBanner({
  regime,
  netGex,
  gammaFlip,
  spot,
  nearestCliffPrice,
  nearestCliffClassification,
}: {
  regime: "POSITIVE" | "NEGATIVE";
  netGex: number;
  gammaFlip: number | null;
  spot: number;
  nearestCliffPrice: number | null;
  nearestCliffClassification: TransitionRow["classification"] | null;
}) {
  const isPositive = regime === "POSITIVE";
  const color = isPositive ? "var(--up)" : "var(--down)";
  const flipDistance = gammaFlip !== null ? Math.abs(spot - gammaFlip) : null;
  const flipDirection = gammaFlip !== null ? (spot > gammaFlip ? "above" : "below") : null;
  const cliffWarning = nearestCliffClassification === "cliff" || nearestCliffClassification === "high";

  return (
    <div className="flex flex-col gap-3 border p-5" style={{ borderColor: color, background: `color-mix(in srgb, ${color} 8%, var(--panel) 92%)` }}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="font-mono text-[0.62rem] uppercase tracking-[0.08em] text-[var(--text-faint)]">Current gamma regime</div>
          <div className="font-mono text-[1.6rem] font-bold" style={{ color }}>
            {isPositive ? "POSITIVE GAMMA" : "NEGATIVE GAMMA"}
          </div>
        </div>
        <div className="text-right">
          <div className="font-mono text-[0.62rem] uppercase tracking-[0.08em] text-[var(--text-faint)]">Net GEX</div>
          <div className="font-mono text-[1.3rem] font-semibold" style={{ color }}>
            {fmtUsd(netGex)}
          </div>
        </div>
      </div>
      <p className="m-0 font-sans text-[0.85rem] leading-relaxed text-[var(--text-dim)]">
        {isPositive
          ? "Dealers are estimated net long gamma right now. Their hedging tends to STABILIZE price - buying dips, selling rallies."
          : "Dealers are estimated net short gamma right now. Their hedging tends to AMPLIFY price moves - selling into weakness, buying into strength."}
        {gammaFlip !== null && flipDistance !== null && (
          <>
            {" "}
            Spot sits {flipDirection} the gamma flip ({fmtNum(gammaFlip, 2)}), {fmtNum(flipDistance, 2)} points away.
          </>
        )}
      </p>
      {cliffWarning && nearestCliffPrice !== null && (
        <div className="font-mono text-[0.72rem]" style={{ color: "#d9a441" }}>
          ⚠ A {nearestCliffClassification === "cliff" ? "gamma cliff" : "sharp gamma transition"} sits near {fmtNum(nearestCliffPrice, 1)} — the regime could change fast if price gets there.
        </div>
      )}
    </div>
  );
}

export interface KeyLevel {
  label: string;
  value: number;
  color: string;
  isSpot?: boolean;
}

/** A visual price ruler instead of a table of numbers - every key level plotted on one line, positioned by actual price so the reader can see at a glance how close spot is to each one. */
export function KeyLevelsStrip({ levels, pinningBasin }: { levels: KeyLevel[]; pinningBasin?: { low: number; high: number } | null }) {
  const values = levels.map((l) => l.value);
  if (pinningBasin) values.push(pinningBasin.low, pinningBasin.high);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(1e-6, max - min);
  const pad = range * 0.12 || 1;
  const lo = min - pad;
  const hi = max + pad;
  const pct = (v: number) => ((v - lo) / (hi - lo)) * 100;

  return (
    <div className="relative" style={{ minHeight: 92, paddingTop: 26, paddingBottom: 34 }}>
      {pinningBasin && (
        <div
          className="absolute top-1/2 h-2.5 -translate-y-1/2 rounded-full"
          style={{
            left: `${pct(pinningBasin.low)}%`,
            width: `${Math.max(0.5, pct(pinningBasin.high) - pct(pinningBasin.low))}%`,
            background: "color-mix(in srgb, var(--accent) 35%, transparent)",
          }}
          title={`Pinning basin ${fmtNum(pinningBasin.low, 0)}-${fmtNum(pinningBasin.high, 0)}`}
        />
      )}
      <div className="absolute top-1/2 right-0 left-0 h-px -translate-y-1/2" style={{ background: "var(--border-strong)" }} />
      {levels.map((l) => (
        <div key={l.label} className="absolute top-1/2 flex flex-col items-center" style={{ left: `${pct(l.value)}%`, transform: "translate(-50%, -50%)" }}>
          <div className="mb-1 whitespace-nowrap font-mono" style={{ color: l.color, fontSize: l.isSpot ? "0.72rem" : "0.62rem", fontWeight: l.isSpot ? 700 : 500 }}>
            {fmtNum(l.value, l.isSpot ? 2 : 0)}
          </div>
          <div
            className="rounded-full"
            style={{ width: l.isSpot ? 11 : 8, height: l.isSpot ? 11 : 8, background: l.color, border: "2px solid var(--panel)" }}
          />
          <div className="mt-1 whitespace-nowrap font-mono text-[0.58rem] text-[var(--text-faint)]">{l.label}</div>
        </div>
      ))}
    </div>
  );
}

/** Two big plain-English callouts instead of a 4-row table - the two moves most people actually want to know about (a modest up move, a modest down move). */
export function HedgeCallouts({ rows }: { rows: HedgeScenarioRow[] }) {
  const up = [...rows].filter((r) => r.movePct > 0).sort((a, b) => a.movePct - b.movePct)[0];
  const down = [...rows].filter((r) => r.movePct < 0).sort((a, b) => b.movePct - a.movePct)[0];

  const Callout = ({ row, label }: { row: HedgeScenarioRow | undefined; label: string }) => {
    if (!row) return null;
    const color = row.direction === "Buy" ? "var(--up)" : "var(--down)";
    return (
      <div className="flex-1 border p-4" style={{ borderColor: color }}>
        <div className="font-mono text-[0.62rem] uppercase tracking-[0.06em] text-[var(--text-faint)]">{label}</div>
        <div className="mt-1 font-mono text-[1.1rem] font-bold" style={{ color }}>
          Dealers {row.direction} ~{fmtNum(Math.abs(row.shares), 0)} sh
        </div>
        <div className="mt-1 font-mono text-[0.68rem] text-[var(--text-dim)]">
          {row.impactRatio !== null ? `~${(row.impactRatio * 100).toFixed(0)}% of recent 5-min volume` : "volume data unavailable this request"}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <Callout row={up} label={`IF PRICE RISES ${up ? up.movePct.toFixed(2) : ""}%`} />
      <Callout row={down} label={`IF PRICE FALLS ${down ? Math.abs(down.movePct).toFixed(2) : ""}%`} />
    </div>
  );
}

/** A single-value progress bar - concentration/breadth/control numbers read faster as a filled bar than as a bare percentage. */
export function SimpleBar({ label, pct, color, caption }: { label: string; pct: number; color: string; caption: string }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between font-mono text-[0.72rem]">
        <span className="text-[var(--text-dim)]">{label}</span>
        <span className="font-semibold text-[var(--text)]">{pct.toFixed(0)}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full" style={{ background: "var(--panel-2)" }}>
        <div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, pct))}%`, background: color }} />
      </div>
      <div className="font-sans text-[0.68rem] text-[var(--text-faint)]">{caption}</div>
    </div>
  );
}

/** Above-spot vs below-spot gamma share as one split bar, red (below) / green (above) - replaces reading two separate numbers and doing the subtraction yourself. */
export function AsymmetrySplitBar({ abovePct }: { abovePct: number }) {
  const clamped = Math.max(0, Math.min(100, abovePct));
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between font-mono text-[0.72rem]">
        <span>
          Below spot: <span className="font-semibold">{(100 - clamped).toFixed(0)}%</span>
        </span>
        <span>
          Above spot: <span className="font-semibold">{clamped.toFixed(0)}%</span>
        </span>
      </div>
      <div className="flex h-2.5 w-full overflow-hidden rounded-full">
        <div className="h-full" style={{ width: `${100 - clamped}%`, background: "var(--down)" }} />
        <div className="h-full flex-1" style={{ background: "var(--up)" }} />
      </div>
    </div>
  );
}

/** Collapsed by default - every deep-quant metric on this page lives here so the top of the page stays readable at a glance, without deleting any of the underlying analysis. */
export function AdvancedToggle({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className="flex w-full items-center justify-between border border-[var(--border)] bg-[var(--panel)] px-4 py-3 font-mono text-[0.72rem] font-semibold uppercase tracking-[0.06em] text-[var(--text-dim)] transition-colors hover:text-[var(--text)]"
    >
      <span>{open ? "Hide" : "Show"} advanced / technical analytics</span>
      <span className="text-[var(--text-faint)]">{open ? "▾" : "▸"}</span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Gamma feedback curve (with positive/negative fill split + key levels)
// ---------------------------------------------------------------------------

export function GammaFeedbackChart({
  curve,
  spot,
  callWall,
  putWall,
  gammaFlip,
  emLow,
  emHigh,
}: {
  curve: GexCurvePoint[];
  spot: number;
  callWall: number;
  putWall: number;
  gammaFlip: number | null;
  emLow: number;
  emHigh: number;
}) {
  const data = curve.map((p) => ({ price: p.price, pos: p.netGex > 0 ? p.netGex : 0, neg: p.netGex < 0 ? p.netGex : 0, netGex: p.netGex }));

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="gexPos" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--up)" stopOpacity={0.55} />
              <stop offset="100%" stopColor="var(--up)" stopOpacity={0.05} />
            </linearGradient>
            <linearGradient id="gexNeg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--down)" stopOpacity={0.05} />
              <stop offset="100%" stopColor="var(--down)" stopOpacity={0.55} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="2 4" stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="price"
            type="number"
            domain={["dataMin", "dataMax"]}
            tick={{ fill: "var(--text-faint)", fontSize: 10 }}
            tickLine={false}
            axisLine={{ stroke: "var(--border)" }}
            tickFormatter={(v) => fmtNum(Number(v), 0)}
          />
          <YAxis tick={{ fill: "var(--text-faint)", fontSize: 10 }} tickLine={false} axisLine={false} width={54} tickFormatter={(v) => fmtUsd(Number(v))} />
          <ReferenceLine y={0} stroke="var(--border-strong)" />
          {/* No in-chart text labels here on purpose - they collided whenever two levels sit close together. See the legend rendered below this chart instead. */}
          <ReferenceLine x={spot} stroke="var(--text)" strokeWidth={1.5} strokeDasharray="3 2" />
          <ReferenceLine x={callWall} stroke="var(--up)" strokeWidth={1.5} strokeDasharray="4 3" />
          <ReferenceLine x={putWall} stroke="var(--down)" strokeWidth={1.5} strokeDasharray="4 3" />
          <ReferenceLine x={emLow} stroke="var(--text-faint)" strokeDasharray="1 3" />
          <ReferenceLine x={emHigh} stroke="var(--text-faint)" strokeDasharray="1 3" />
          {gammaFlip !== null && (
            <ReferenceDot x={gammaFlip} y={0} r={4} fill="var(--accent)" stroke="var(--panel)" strokeWidth={1.5} />
          )}
          <Tooltip
            contentStyle={{ background: "var(--panel)", border: "1px solid var(--border-strong)", borderRadius: 3, fontSize: 11 }}
            labelFormatter={(p) => `Price ${fmtNum(Number(p), 2)}`}
            formatter={(v, name) => (name === "netGex" ? [fmtUsd(Number(v)), "Net GEX"] : [null, null])}
          />
          <Area type="monotone" dataKey="pos" stroke="var(--up)" strokeWidth={1.5} fill="url(#gexPos)" isAnimationActive={false} dot={false} />
          <Area type="monotone" dataKey="neg" stroke="var(--down)" strokeWidth={1.5} fill="url(#gexNeg)" isAnimationActive={false} dot={false} />
          <Area type="monotone" dataKey="netGex" stroke="transparent" fill="transparent" isAnimationActive={false} dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Price zone strip - shared by friction map + vacuum map
// ---------------------------------------------------------------------------

export function PriceZoneStrip<T extends { price: number }>({
  points,
  colorOf,
  labelOf,
}: {
  points: T[];
  colorOf: (p: T) => string;
  labelOf: (p: T) => string;
}) {
  return (
    <div className="flex h-10 w-full gap-px overflow-hidden rounded-[2px]">
      {points.map((p, i) => (
        <div
          key={i}
          title={`${fmtNum(p.price, 2)} — ${labelOf(p)}`}
          className="group relative h-full flex-1 cursor-default transition-transform duration-100 hover:z-10 hover:scale-y-110"
          style={{ background: colorOf(p) }}
        >
          <div className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1.5 hidden -translate-x-1/2 whitespace-nowrap rounded-[2px] border border-[var(--border-strong)] bg-[var(--panel)] px-2 py-1 font-mono text-[0.62rem] text-[var(--text)] group-hover:block">
            {fmtNum(p.price, 2)} · {labelOf(p)}
          </div>
        </div>
      ))}
    </div>
  );
}

export function frictionColor(p: FrictionPoint): string {
  const map: Record<FrictionPoint["zone"], string> = {
    strong_stabilizing: "var(--up)",
    moderate_stabilizing: "color-mix(in srgb, var(--up) 55%, var(--panel-2) 45%)",
    neutral: "var(--panel-2)",
    moderate_amplifying: "color-mix(in srgb, var(--down) 55%, var(--panel-2) 45%)",
    strong_amplifying: "var(--down)",
  };
  return map[p.zone];
}

export function frictionLabel(p: FrictionPoint): string {
  const map: Record<FrictionPoint["zone"], string> = {
    strong_stabilizing: "Strong stabilizing",
    moderate_stabilizing: "Moderate stabilizing",
    neutral: "Neutral",
    moderate_amplifying: "Moderate amplifying",
    strong_amplifying: "Strong amplifying",
  };
  return `${map[p.zone]} (${p.friction.toFixed(0)})`;
}

export function vacuumColor(p: VacuumPoint): string {
  if (p.zone === "wall") return "var(--accent)";
  if (p.zone === "vacuum") return "var(--panel-2)";
  return "color-mix(in srgb, var(--text-dim) 45%, var(--panel-2) 55%)";
}

export function vacuumLabel(p: VacuumPoint): string {
  const zoneLabel = p.zone === "wall" ? "Gamma wall" : p.zone === "vacuum" ? "Vacuum" : "Friction zone";
  return `${zoneLabel} — vacuum score ${(p.vacuumScore * 100).toFixed(0)}`;
}

// ---------------------------------------------------------------------------
// Transition / cliff ladder table
// ---------------------------------------------------------------------------

const CLASS_COLOR: Record<TransitionRow["classification"], string> = {
  low: "var(--text-faint)",
  moderate: "var(--text-dim)",
  high: "#d9a441",
  cliff: "var(--down)",
};

export function TransitionCliffTable({ rows, spot, count = 9 }: { rows: TransitionRow[]; spot: number; count?: number }) {
  const nearest = [...rows].sort((a, b) => Math.abs(a.price - spot) - Math.abs(b.price - spot)).slice(0, count).sort((a, b) => b.price - a.price);

  return (
    <Table head={["Price", "Net GEX", "Transition intensity", "Cliff score"]}>
      {nearest.map((r) => (
        <tr key={r.price} className="border-b border-[var(--border)] last:border-0">
          <td className="py-1.5 text-left font-semibold">{fmtNum(r.price, 2)}</td>
          <td className={`py-1.5 pl-3 text-right ${r.netGex >= 0 ? "text-[var(--up)]" : "text-[var(--down)]"}`}>{fmtUsd(r.netGex)}</td>
          <td className="py-1.5 pl-3 text-right uppercase" style={{ color: CLASS_COLOR[r.classification] }}>
            {r.classification}
          </td>
          <td className="py-1.5 pl-3 text-right text-[var(--text-dim)]">{r.cliffScore.toFixed(0)}</td>
        </tr>
      ))}
    </Table>
  );
}

// ---------------------------------------------------------------------------
// Gamma flip band card
// ---------------------------------------------------------------------------

export function GammaFlipBandCard({ band }: { band: GammaFlipBand }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2 font-mono text-[0.78rem]">
        <div>
          Central flip: <span className="font-semibold text-[var(--accent)]">{fmtNum(band.central, 2)}</span>
        </div>
        <div>
          Scenario band:{" "}
          <span className="font-semibold">
            {fmtNum(band.low, 2)}–{fmtNum(band.high, 2)}
          </span>
        </div>
        <div>
          Sign agreement at spot: <span className="font-semibold">{band.signAgreementPct.toFixed(0)}%</span>
        </div>
      </div>
      <Table head={["Scenario", "Flip"]}>
        {band.scenarios.map((s) => (
          <tr key={s.name} className="border-b border-[var(--border)] last:border-0">
            <td className="py-1.5 text-left text-[var(--text-dim)]">{s.label}</td>
            <td className="py-1.5 pl-3 text-right font-semibold">{fmtNum(s.flip, 2)}</td>
          </tr>
        ))}
      </Table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Wall quality table
// ---------------------------------------------------------------------------

const WALL_TYPE_LABEL: Record<WallQualityRow["type"], string> = { call_wall: "Call wall", put_wall: "Put wall", cluster: "Gamma cluster" };
const WALL_TYPE_COLOR: Record<WallQualityRow["type"], string> = { call_wall: "var(--up)", put_wall: "var(--down)", cluster: "var(--text-dim)" };

export function WallQualityTable({ rows }: { rows: WallQualityRow[] }) {
  return (
    <Table head={["Strike", "Type", "GEX share", "Breadth", "Stability", "Wall quality"]}>
      {rows.map((r) => (
        <tr key={r.strike} className="border-b border-[var(--border)] last:border-0">
          <td className="py-1.5 text-left font-semibold">{fmtNum(r.strike, 0)}</td>
          <td className="py-1.5 pl-3 text-right" style={{ color: WALL_TYPE_COLOR[r.type] }}>
            {WALL_TYPE_LABEL[r.type]}
          </td>
          <td className="py-1.5 pl-3 text-right text-[var(--text-dim)]">{r.gexShare.toFixed(0)}%</td>
          <td className="py-1.5 pl-3 text-right text-[var(--text-dim)]">{r.breadth.toFixed(0)}</td>
          <td className="py-1.5 pl-3 text-right text-[var(--text-dim)]">{r.stability.toFixed(0)}</td>
          <td className="py-1.5 pl-3 text-right font-semibold text-[var(--accent)]">{r.qualityScore.toFixed(0)}</td>
        </tr>
      ))}
    </Table>
  );
}

// ---------------------------------------------------------------------------
// Reachability ranking table
// ---------------------------------------------------------------------------

export function ReachabilityTable({ rows }: { rows: ReachabilityRow[] }) {
  return (
    <Table head={["Strike", "Raw GEX rank", "Touch probability", "Gamma interaction rank"]}>
      {rows.map((r) => (
        <tr key={r.strike} className="border-b border-[var(--border)] last:border-0">
          <td className="py-1.5 text-left font-semibold">{fmtNum(r.strike, 0)}</td>
          <td className="py-1.5 pl-3 text-right text-[var(--text-dim)]">#{r.rawRank}</td>
          <td className="py-1.5 pl-3 text-right text-[var(--text-dim)]">{(r.touchProbability * 100).toFixed(0)}%</td>
          <td className="py-1.5 pl-3 text-right font-semibold text-[var(--accent)]">#{r.adjustedRank}</td>
        </tr>
      ))}
    </Table>
  );
}

// ---------------------------------------------------------------------------
// Pinning basin card
// ---------------------------------------------------------------------------

export function PinningBasinCard({ basins }: { basins: PinningBasin[] }) {
  if (!basins.length) {
    return <p className="m-0 font-mono text-[0.75rem] text-[var(--text-faint)]">No basin clears the stability/symmetry threshold right now.</p>;
  }
  const top = basins[0];
  return (
    <div className="flex flex-col gap-3">
      <div className="font-mono text-[0.8rem]">
        Primary pinning basin:{" "}
        <span className="font-semibold text-[var(--accent)]">
          {fmtNum(top.low, 0)}–{fmtNum(top.high, 0)}
        </span>
        <span className="text-[var(--text-dim)]"> · center {fmtNum(top.center, 1)} · score {top.score.toFixed(0)}/100</span>
      </div>
      <p className="m-0 font-mono text-[0.68rem] text-[var(--text-faint)]">Breakdown below {fmtNum(top.invalidation, 0)} invalidates the basin.</p>
      {basins.length > 1 && (
        <Table head={["Range", "Center", "Score"]}>
          {basins.slice(1).map((b, i) => (
            <tr key={i} className="border-b border-[var(--border)] last:border-0">
              <td className="py-1.5 text-left text-[var(--text-dim)]">
                {fmtNum(b.low, 0)}–{fmtNum(b.high, 0)}
              </td>
              <td className="py-1.5 pl-3 text-right text-[var(--text-dim)]">{fmtNum(b.center, 1)}</td>
              <td className="py-1.5 pl-3 text-right font-semibold">{b.score.toFixed(0)}</td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Concentration / asymmetry / proximity stat rows
// ---------------------------------------------------------------------------

export function ConcentrationRow({ stats }: { stats: ConcentrationStats }) {
  return (
    <div className="grid grid-cols-2 gap-3 font-mono text-[0.78rem] sm:grid-cols-4">
      <div>
        Gamma HHI <div className="font-semibold text-[var(--text)]">{stats.hhi.toFixed(3)}</div>
      </div>
      <div>
        Gamma entropy <div className="font-semibold text-[var(--text)]">{stats.entropy.toFixed(2)}</div>
      </div>
      <div>
        Effective gamma strikes <div className="font-semibold text-[var(--text)]">{stats.effectiveStrikes.toFixed(1)}</div>
      </div>
      <div>
        Top-5 strike breadth <div className="font-semibold text-[var(--text)]">{stats.topFivePct.toFixed(0)}%</div>
      </div>
    </div>
  );
}

export function AsymmetryRow({ stats }: { stats: AsymmetryStats }) {
  const aboveSharePct = (stats.aboveAbs / (stats.aboveAbs + stats.belowAbs || 1)) * 100;
  return (
    <div className="flex flex-col gap-2 font-mono text-[0.78rem]">
      <div>
        Upper gamma share: <span className="font-semibold">{aboveSharePct.toFixed(0)}%</span> · Lower gamma share:{" "}
        <span className="font-semibold">{(100 - aboveSharePct).toFixed(0)}%</span>
      </div>
      <div>
        Gamma asymmetry (gross): <span className="font-semibold">{stats.asymmetryAbs >= 0 ? "+" : ""}{stats.asymmetryAbs.toFixed(2)}</span> · signed:{" "}
        <span className="font-semibold">{stats.asymmetrySigned >= 0 ? "+" : ""}{stats.asymmetrySigned.toFixed(2)}</span>
      </div>
    </div>
  );
}

export function ProximityRow({ stats }: { stats: ProximityStats }) {
  return (
    <div className="grid grid-cols-3 gap-3 font-mono text-[0.78rem]">
      <div>
        Full-book net GEX <div className="font-semibold text-[var(--text)]">{fmtUsd(stats.fullBookGex)}</div>
      </div>
      <div>
        Expected-move-adjusted GEX <div className="font-semibold text-[var(--text)]">{fmtUsd(stats.expectedMoveAdjustedGex)}</div>
      </div>
      <div>
        Near-spot GEX (λ={stats.lambda.toFixed(1)}) <div className="font-semibold text-[var(--text)]">{fmtUsd(stats.nearSpotGex)}</div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Hedge scenarios + cross-expiry stack
// ---------------------------------------------------------------------------

export function HedgeScenarioTable({ rows }: { rows: HedgeScenarioRow[] }) {
  return (
    <Table head={["Spot move", "Estimated hedge shares", "Direction", "Impact ratio (vs. 5m volume)"]}>
      {rows.map((r) => (
        <tr key={r.movePct} className="border-b border-[var(--border)] last:border-0">
          <td className="py-1.5 text-left font-semibold">
            {r.movePct >= 0 ? "+" : ""}
            {r.movePct.toFixed(2)}%
          </td>
          <td className="py-1.5 pl-3 text-right text-[var(--text-dim)]">{fmtNum(Math.abs(r.shares), 0)}</td>
          <td className={`py-1.5 pl-3 text-right font-semibold ${r.direction === "Buy" ? "text-[var(--up)]" : "text-[var(--down)]"}`}>{r.direction}</td>
          <td className="py-1.5 pl-3 text-right text-[var(--text-dim)]">{r.impactRatio !== null ? `${(r.impactRatio * 100).toFixed(1)}%` : "—"}</td>
        </tr>
      ))}
    </Table>
  );
}

// ---------------------------------------------------------------------------
// 0DTE - next-expiry gamma confluence
// ---------------------------------------------------------------------------

const CONFLUENCE_LABEL: Record<GammaConfluence["label"], string> = {
  strong: "Strong confluence",
  partial: "Partial confluence",
  none: "No confluence",
  unavailable: "Unavailable",
};
const CONFLUENCE_COLOR: Record<GammaConfluence["label"], string> = {
  strong: "var(--up)",
  partial: "#d9a441",
  none: "var(--down)",
  unavailable: "var(--text-faint)",
};

export function GammaConfluenceCard({ confluence }: { confluence: GammaConfluence }) {
  if (confluence.label === "unavailable" || !confluence.nextExpiry) {
    return (
      <p className="m-0 font-mono text-[0.75rem] text-[var(--text-faint)]">
        No dte&gt;0 row in the cross-expiry table this request (upstream option-matrix is best-effort and can time out).
      </p>
    );
  }
  const SIDE_LABEL: Record<"call" | "put", string> = { call: "Call wall / resistance", put: "Put wall / support" };
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2 font-mono text-[0.78rem]">
        <div>
          Next dominant expiry: <span className="font-semibold">{confluence.nextExpiry.expiration}</span>{" "}
          <span className="text-[var(--text-dim)]">({confluence.nextExpiry.dte} DTE, {fmtNum(confluence.nextExpiry.totalOi, 0)} OI)</span>
        </div>
        <div style={{ color: CONFLUENCE_COLOR[confluence.label] }} className="font-semibold uppercase tracking-[0.04em]">
          {CONFLUENCE_LABEL[confluence.label]}
        </div>
      </div>
      <Table head={["Level", "0DTE strike", "Next-expiry strike", "Distance", "Status"]}>
        {confluence.levels.map((l) => (
          <tr key={l.side} className="border-b border-[var(--border)] last:border-0">
            <td className="py-1.5 text-left text-[var(--text-dim)]">{SIDE_LABEL[l.side]}</td>
            <td className="py-1.5 pl-3 text-right font-semibold">{fmtNum(l.zeroDteStrike, 0)}</td>
            <td className="py-1.5 pl-3 text-right text-[var(--text-dim)]">{l.nextExpiryStrike !== null ? fmtNum(l.nextExpiryStrike, 0) : "—"}</td>
            <td className="py-1.5 pl-3 text-right text-[var(--text-dim)]">{l.distance !== null ? fmtNum(l.distance, 1) : "—"}</td>
            <td className="py-1.5 pl-3 text-right font-semibold" style={{ color: l.aligned ? "var(--up)" : "var(--text-faint)" }}>
              {l.aligned ? "Aligned" : "Not aligned"}
            </td>
          </tr>
        ))}
      </Table>
    </div>
  );
}

export function CrossExpiryStackTable({ stack }: { stack: CrossExpiryStack }) {
  if (!stack.rows.length) {
    return <p className="m-0 font-mono text-[0.75rem] text-[var(--text-faint)]">Cross-expiry table unavailable this request (upstream option-matrix is best-effort and can time out).</p>;
  }
  return (
    <div className="flex flex-col gap-3">
      <div className="font-mono text-[0.78rem]">
        0DTE gamma control: <span className="font-semibold text-[var(--accent)]">{stack.zeroDteControlPct.toFixed(1)}%</span> · Next expiry:{" "}
        <span className="font-semibold">{stack.nextExpiryPct.toFixed(1)}%</span> · Remaining: <span className="font-semibold">{stack.remainingPct.toFixed(1)}%</span>
      </div>
      <Table head={["Expiration", "DTE", "|GEX|", "Share"]}>
        {stack.rows.map((r) => (
          <tr key={r.expiration} className="border-b border-[var(--border)] last:border-0">
            <td className="py-1.5 text-left text-[var(--text-dim)]">{r.expiration}</td>
            <td className="py-1.5 pl-3 text-right text-[var(--text-dim)]">{r.dte}</td>
            <td className="py-1.5 pl-3 text-right text-[var(--text-dim)]">{fmtUsd(r.absGex)}</td>
            <td className="py-1.5 pl-3 text-right font-semibold">{r.sharePct.toFixed(0)}%</td>
          </tr>
        ))}
      </Table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 19. Color-adjusted forward GEX
// ---------------------------------------------------------------------------

export function ColorForwardTable({ rows }: { rows: ColorForwardRow[] }) {
  if (!rows.length) return <p className="m-0 font-mono text-[0.75rem] text-[var(--text-faint)]">Not enough time left today for a forward horizon.</p>;
  return (
    <Table head={["Minutes ahead", "Linear projection (color)", "Actual reprice", "Divergence"]}>
      {rows.map((r) => (
        <tr key={r.minutesAhead} className="border-b border-[var(--border)] last:border-0">
          <td className="py-1.5 text-left font-semibold">+{r.minutesAhead}m</td>
          <td className="py-1.5 pl-3 text-right text-[var(--text-dim)]">{fmtUsd(r.linearProjection)}</td>
          <td className="py-1.5 pl-3 text-right text-[var(--text-dim)]">{fmtUsd(r.actualReprice)}</td>
          <td className="py-1.5 pl-3 text-right font-semibold" style={{ color: Math.abs(r.divergence) > Math.abs(r.actualReprice) * 0.1 ? "var(--down)" : "var(--text-faint)" }}>
            {fmtUsd(r.divergence)}
          </td>
        </tr>
      ))}
    </Table>
  );
}

// ---------------------------------------------------------------------------
// 20. Zomma / IV-scenario GEX
// ---------------------------------------------------------------------------

export function IvScenarioTable({ points }: { points: IvScenarioPoint[] }) {
  return (
    <Table head={["IV shift", "Net GEX"]}>
      {points.map((p) => (
        <tr key={p.ivShiftPoints} className="border-b border-[var(--border)] last:border-0" style={p.ivShiftPoints === 0 ? { background: "var(--panel-2)" } : undefined}>
          <td className="py-1.5 text-left font-semibold">
            {p.ivShiftPoints >= 0 ? "+" : ""}
            {p.ivShiftPoints}pt
          </td>
          <td className={`py-1.5 pl-3 text-right ${p.netGex >= 0 ? "text-[var(--up)]" : "text-[var(--down)]"}`}>{fmtUsd(p.netGex)}</td>
        </tr>
      ))}
    </Table>
  );
}

// ---------------------------------------------------------------------------
// 21. Gamma flip gradient
// ---------------------------------------------------------------------------

export function GammaFlipGradientCard({ gradient }: { gradient: GammaFlipGradient }) {
  return (
    <div className="flex flex-col gap-2 font-mono text-[0.78rem]">
      <div>
        Flip sensitivity to IV: <span className="font-semibold">{gradient.perVolPoint !== null ? `${gradient.perVolPoint >= 0 ? "+" : ""}${gradient.perVolPoint.toFixed(2)} pts / vol point` : "—"}</span>
      </div>
      <div>
        Flip sensitivity to time: <span className="font-semibold">{gradient.perTenMinutes !== null ? `${gradient.perTenMinutes >= 0 ? "+" : ""}${gradient.perTenMinutes.toFixed(2)} pts / 10 min elapsed` : "—"}</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 22. Surface-adjusted GEX
// ---------------------------------------------------------------------------

export function SurfaceAdjustedTable({ rows }: { rows: SurfaceAdjustedRow[] }) {
  return (
    <Table head={["Price", "Frozen IV (sticky-strike)", "Sticky-moneyness", "Divergence"]}>
      {rows.map((r) => (
        <tr key={r.price} className="border-b border-[var(--border)] last:border-0">
          <td className="py-1.5 text-left font-semibold">{fmtNum(r.price, 2)}</td>
          <td className="py-1.5 pl-3 text-right text-[var(--text-dim)]">{fmtUsd(r.frozenIvGex)}</td>
          <td className="py-1.5 pl-3 text-right text-[var(--text-dim)]">{fmtUsd(r.stickyMoneynessGex)}</td>
          <td className="py-1.5 pl-3 text-right font-semibold">{fmtUsd(r.divergence)}</td>
        </tr>
      ))}
    </Table>
  );
}

// ---------------------------------------------------------------------------
// 23. Implied skewness and kurtosis
// ---------------------------------------------------------------------------

export function ImpliedMomentsRow({ moments }: { moments: ImpliedMoments }) {
  return (
    <div className="grid grid-cols-2 gap-3 font-mono text-[0.78rem]">
      <div>
        Implied skewness{" "}
        <div className="font-semibold text-[var(--text)]">
          {moments.skewness >= 0 ? "+" : ""}
          {moments.skewness.toFixed(3)}
        </div>
        <div className="mt-0.5 font-sans text-[0.66rem] text-[var(--text-faint)]">{moments.skewness < -0.1 ? "Left-skewed (downside tail priced fatter)" : moments.skewness > 0.1 ? "Right-skewed (upside tail priced fatter)" : "Roughly symmetric"}</div>
      </div>
      <div>
        Implied excess kurtosis{" "}
        <div className="font-semibold text-[var(--text)]">
          {moments.excessKurtosis >= 0 ? "+" : ""}
          {moments.excessKurtosis.toFixed(3)}
        </div>
        <div className="mt-0.5 font-sans text-[0.66rem] text-[var(--text-faint)]">{moments.excessKurtosis > 0.5 ? "Fatter tails than lognormal" : moments.excessKurtosis < -0.5 ? "Thinner tails than lognormal" : "Close to lognormal"}</div>
      </div>
    </div>
  );
}
