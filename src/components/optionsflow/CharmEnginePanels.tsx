"use client";

import { fmtNum } from "@/lib/gex";
import type {
  CharmAcceleration,
  CharmBalanceSheet,
  CharmCenters,
  CharmConfluence,
  CharmConsensus,
  CharmDeadZone,
  CharmEngineDiagnostics,
  CharmFieldPoint,
  CharmGate,
  CharmHeatmap,
  CharmPhaseClassification,
  CharmPivot,
  CharmRotationZone,
  CharmShelf,
  ConcentrationStats,
  DealerSignUncertainty,
  DeltaDestinationMap,
  FlowScheduleInterval,
  ForwardCharmClockPoint,
  GammaConflict,
  HorizonFlow,
  LateDaySurgeRisk,
  LinearizationRisk,
  OiFreshnessRisk,
  ReversalRisk,
  VannaContaminationRisk,
  ZeroDteCharmControl,
} from "@/lib/charmEngine";

function fmtShares(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(2)}M sh`;
  if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(0)}K sh`;
  return `${sign}${Math.round(abs)} sh`;
}

function fmtFlow(n: number): string {
  return `${n >= 0 ? "Buy " : "Sell "}${fmtShares(n)}`;
}

// ---------------------------------------------------------------------------
// Shared bits
// ---------------------------------------------------------------------------

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

function RiskPill({ level }: { level: "low" | "moderate" | "high" | "extreme" }) {
  const color = { low: "var(--up)", moderate: "#d9a441", high: "var(--down)", extreme: "var(--down)" }[level];
  return (
    <span className="rounded-[2px] px-1.5 py-0.5 font-mono text-[0.62rem] font-semibold uppercase" style={{ color, background: `color-mix(in srgb, ${color} 15%, transparent)` }}>
      {level}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Hero + nav
// ---------------------------------------------------------------------------

const PHASE_COLOR: Record<CharmPhaseClassification["phase"], string> = {
  passive_buy_drift: "var(--up)",
  passive_sell_drift: "var(--down)",
  balanced_decay: "var(--text-faint)",
  fragile_cancellation: "#d9a441",
  late_day_surge: "#d9a441",
  charm_light: "var(--text-faint)",
};

export function CharmHeroBanner({ heroStatement, phase }: { heroStatement: string; phase: CharmPhaseClassification }) {
  const color = PHASE_COLOR[phase.phase];
  return (
    <div className="flex flex-col gap-2 border p-5" style={{ borderColor: color, background: `color-mix(in srgb, ${color} 6%, var(--panel) 94%)` }}>
      <div className="font-mono text-[0.6rem] uppercase tracking-[0.08em] text-[var(--text-faint)]">Charm decision engine · plain-English summary</div>
      <p className="m-0 font-sans text-[0.95rem] font-medium leading-relaxed text-[var(--text)]">{heroStatement}</p>
    </div>
  );
}

export type CharmPillarId = "regime" | "levels" | "risks" | "structure";

const PILLAR_LABEL: Record<CharmPillarId, string> = {
  regime: "CHARM REGIME",
  levels: "KEY LEVELS",
  risks: "KEY RISKS",
  structure: "KEY STRUCTURE",
};

export function CharmPillarNav({ active, onChange }: { active: CharmPillarId; onChange: (p: CharmPillarId) => void }) {
  const order: CharmPillarId[] = ["regime", "levels", "risks", "structure"];
  return (
    <div className="inline-flex flex-wrap border border-[var(--border)]">
      {order.map((p) => (
        <button
          key={p}
          onClick={() => onChange(p)}
          className={`px-4 py-2 font-mono text-[0.72rem] font-semibold tracking-[0.06em] transition-colors duration-150 ${
            p === active ? "bg-[var(--accent)] text-[var(--bg)]" : "text-[var(--text-dim)] hover:text-[var(--text)]"
          }`}
        >
          {PILLAR_LABEL[p]}
        </button>
      ))}
    </div>
  );
}

function SummaryCard({ title, active, onClick, rows }: { title: string; active: boolean; onClick: () => void; rows: { label: string; value: string; tone?: "up" | "down" | "neutral" }[] }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col gap-2 border p-4 text-left transition-colors"
      style={{ borderColor: active ? "var(--accent)" : "var(--border)", background: active ? "color-mix(in srgb, var(--accent) 6%, var(--panel) 94%)" : "var(--panel)" }}
    >
      <div className="partno" style={{ color: active ? "var(--accent)" : "var(--text-faint)" }}>
        {title}
      </div>
      <div className="flex flex-col gap-1">
        {rows.map((r) => (
          <div key={r.label} className="flex items-baseline justify-between gap-2 font-mono text-[0.68rem]">
            <span className="text-[var(--text-faint)]">{r.label}</span>
            <span className="font-semibold" style={{ color: r.tone === "up" ? "var(--up)" : r.tone === "down" ? "var(--down)" : "var(--text)" }}>
              {r.value}
            </span>
          </div>
        ))}
      </div>
    </button>
  );
}

export function CharmPillarSummaryCards({
  active,
  onChange,
  phase,
  consensus,
  horizonFlows,
  pivots,
  rotationZone,
  gate,
  lateDaySurge,
  reversalRisk,
  gammaConflict,
  vannaContamination,
  balanceSheet,
  zeroDteControl,
  deltaDestination,
}: {
  active: CharmPillarId;
  onChange: (p: CharmPillarId) => void;
  phase: CharmPhaseClassification;
  consensus: CharmConsensus;
  horizonFlows: HorizonFlow[];
  pivots: CharmPivot[];
  rotationZone: CharmRotationZone;
  gate: CharmGate;
  lateDaySurge: LateDaySurgeRisk;
  reversalRisk: ReversalRisk;
  gammaConflict: GammaConflict;
  vannaContamination: VannaContaminationRisk;
  balanceSheet: CharmBalanceSheet;
  zeroDteControl: ZeroDteCharmControl | null;
  deltaDestination: DeltaDestinationMap;
}) {
  const flow30 = horizonFlows.find((h) => h.label === "Next 30 minutes");
  const flowClose = horizonFlows.find((h) => h.label === "Until close");
  const pivot30 = pivots.find((p) => p.horizonLabel === "Next 30 minutes");

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <SummaryCard
        title="CHARM REGIME"
        active={active === "regime"}
        onClick={() => onChange("regime")}
        rows={[
          { label: "Phase", value: phase.label, tone: phase.phase === "passive_buy_drift" ? "up" : phase.phase === "passive_sell_drift" ? "down" : "neutral" },
          { label: "30-minute flow", value: flow30 ? fmtFlow(flow30.hedgeChangeShares) : "—", tone: flow30 && flow30.hedgeChangeShares >= 0 ? "up" : "down" },
          { label: "Until-close flow", value: flowClose ? fmtFlow(flowClose.hedgeChangeShares) : "—" },
          { label: "Direction agreement", value: `${consensus.signAgreementPct.toFixed(0)}%` },
        ]}
      />
      <SummaryCard
        title="KEY LEVEL"
        active={active === "levels"}
        onClick={() => onChange("levels")}
        rows={[
          { label: "30-minute pivot", value: pivot30?.price !== null && pivot30?.price !== undefined ? fmtNum(pivot30.price, 1) : "—" },
          { label: "Rotation zone", value: rotationZone.low !== null ? `${fmtNum(rotationZone.low, 1)}–${fmtNum(rotationZone.high, 1)}` : "—" },
          { label: "Nearest gate", value: gate.price !== null ? `${fmtNum(gate.price, 1)} (${gate.direction})` : "—" },
        ]}
      />
      <SummaryCard
        title="KEY RISK"
        active={active === "risks"}
        onClick={() => onChange("risks")}
        rows={[
          { label: "Late-day surge", value: lateDaySurge.surgeStartMinutes !== null ? `${lateDaySurge.surgeStartMinutes.toFixed(0)}m` : "None detected" },
          { label: "Pivot reversal risk", value: reversalRisk.distanceEm !== null ? `${reversalRisk.distanceEm.toFixed(2)} EM` : "—" },
          { label: "Gamma conflict", value: gammaConflict.classification.replace(/_/g, " ") },
          { label: "Vanna contamination", value: vannaContamination.fragile ? "Fragile" : "Stable" },
        ]}
      />
      <SummaryCard
        title="KEY STRUCTURE"
        active={active === "structure"}
        onClick={() => onChange("structure")}
        rows={[
          { label: "Gross CHEX (30m)", value: fmtShares(balanceSheet.grossChex) },
          { label: "Cancellation", value: `${(balanceSheet.cancellationRatio * 100).toFixed(0)}%` },
          { label: "0DTE charm control", value: zeroDteControl ? `${zeroDteControl.controlPct.toFixed(0)}%` : "—" },
          { label: "Delta destination", value: fmtShares(deltaDestination.totalRemainingMigrationShares) },
        ]}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pillar 1: Charm Regime
// ---------------------------------------------------------------------------

export function CharmConsensusTable({ consensus }: { consensus: CharmConsensus }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 font-mono text-[0.78rem]">
        <div>
          Consensus 30-minute flow: <span className="font-semibold" style={{ color: consensus.consensusFlow >= 0 ? "var(--up)" : "var(--down)" }}>{fmtFlow(consensus.consensusFlow)}</span>
        </div>
        <div>
          Dispersion: <span className="font-semibold">{fmtShares(consensus.dispersion)}</span>
        </div>
        <div>
          Direction agreement: <span className="font-semibold">{consensus.signAgreementPct.toFixed(0)}%</span>
        </div>
      </div>
      <div>
        <div className="mb-1.5 font-mono text-[0.62rem] uppercase tracking-[0.06em] text-[var(--text-faint)]">Charm views</div>
        <Table head={["Model", "30-minute flow"]}>
          {consensus.models.map((m) => (
            <tr key={m.name} className="border-b border-[var(--border)] last:border-0">
              <td className="py-1.5 text-left text-[var(--text-dim)]">{m.label}</td>
              <td className={`py-1.5 pl-3 text-right font-semibold ${m.netFlow >= 0 ? "text-[var(--up)]" : "text-[var(--down)]"}`}>{fmtFlow(m.netFlow)}</td>
            </tr>
          ))}
        </Table>
      </div>
      <div>
        <div className="mb-1.5 font-mono text-[0.62rem] uppercase tracking-[0.06em] text-[var(--text-faint)]">Dealer-sign scenarios</div>
        <Table head={["Scenario", "30-minute flow"]}>
          {consensus.dealerSignScenarios.map((s) => (
            <tr key={s.name} className="border-b border-[var(--border)] last:border-0">
              <td className="py-1.5 text-left text-[var(--text-dim)]">{s.label}</td>
              <td className={`py-1.5 pl-3 text-right font-semibold ${s.netFlow >= 0 ? "text-[var(--up)]" : "text-[var(--down)]"}`}>{fmtFlow(s.netFlow)}</td>
            </tr>
          ))}
        </Table>
      </div>
    </div>
  );
}

export function HorizonFlowTable({ flows }: { flows: HorizonFlow[] }) {
  return (
    <Table head={["Horizon", "Modeled hedge adjustment", "Vs. 5m volume", "Vs. 15m volume"]}>
      {flows.map((f) => (
        <tr key={f.label} className="border-b border-[var(--border)] last:border-0">
          <td className="py-1.5 text-left font-semibold">{f.label}</td>
          <td className="py-1.5 pl-3 text-right font-semibold" style={{ color: f.hedgeChangeShares >= 0 ? "var(--up)" : "var(--down)" }}>
            {fmtFlow(f.hedgeChangeShares)}
          </td>
          <td className="py-1.5 pl-3 text-right text-[var(--text-dim)]">{f.impactRatio5m !== null ? `${(f.impactRatio5m * 100).toFixed(0)}%` : "—"}</td>
          <td className="py-1.5 pl-3 text-right text-[var(--text-dim)]">{f.impactRatio15m !== null ? `${(f.impactRatio15m * 100).toFixed(0)}%` : "—"}</td>
        </tr>
      ))}
    </Table>
  );
}

export function CharmAccelerationCard({ acceleration }: { acceleration: CharmAcceleration }) {
  return (
    <div className="grid grid-cols-2 gap-3 font-mono text-[0.78rem] sm:grid-cols-4">
      <div>
        Flow per minute now <div className="font-semibold text-[var(--text)]">{fmtShares(acceleration.flowPerMinuteNow)}/min</div>
      </div>
      <div>
        Projected at +15m <div className="font-semibold text-[var(--text)]">{fmtShares(acceleration.flowPerMinuteAt15)}/min</div>
      </div>
      <div>
        Peak flow rate <div className="font-semibold text-[var(--text)]">{fmtShares(acceleration.peakFlowRate)}/min</div>
      </div>
      <div>
        Time of peak <div className="font-semibold text-[var(--text)]">{acceleration.peakFlowMinutes !== null ? `${acceleration.peakFlowMinutes.toFixed(0)}m` : "—"}</div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Signature 1: Charm Flow Schedule
// ---------------------------------------------------------------------------

export function FlowScheduleChart({ intervals, largest }: { intervals: FlowScheduleInterval[]; largest: FlowScheduleInterval | null }) {
  const maxAbs = Math.max(1e-6, ...intervals.map((i) => Math.abs(i.hedgeChangeShares)));
  const maxCumAbs = Math.max(1e-6, ...intervals.map((i) => Math.abs(i.cumulativeShares)));
  return (
    <div className="flex flex-col gap-2">
      <div className="flex h-40 items-end gap-1 overflow-x-auto">
        {intervals.map((i) => {
          const heightPct = (Math.abs(i.hedgeChangeShares) / maxAbs) * 100;
          const isLargest = largest && i.startMinutes === largest.startMinutes;
          return (
            <div key={i.label} title={`${i.label}: ${fmtFlow(i.hedgeChangeShares)}`} className="flex min-w-[24px] flex-1 flex-col items-center justify-end gap-1">
              <div className="w-full" style={{ height: `${heightPct}%`, background: i.hedgeChangeShares >= 0 ? "var(--up)" : "var(--down)", outline: isLargest ? "2px solid var(--accent)" : undefined }} />
              <div className="whitespace-nowrap font-mono text-[0.52rem] text-[var(--text-faint)]" style={{ writingMode: "vertical-rl" }}>
                {i.label}
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex h-10 items-end gap-1 overflow-x-auto border-t border-[var(--border)] pt-1">
        {intervals.map((i) => (
          <div key={i.label} title={`Cumulative through ${i.label}: ${fmtFlow(i.cumulativeShares)}`} className="flex min-w-[24px] flex-1 items-end">
            <div className="w-full" style={{ height: `${(Math.abs(i.cumulativeShares) / maxCumAbs) * 100}%`, background: i.cumulativeShares >= 0 ? "color-mix(in srgb, var(--up) 50%, transparent)" : "color-mix(in srgb, var(--down) 50%, transparent)" }} />
          </div>
        ))}
      </div>
      <div className="font-mono text-[0.6rem] text-[var(--text-faint)]">Top: per-interval modeled hedge flow (outlined bar = largest interval) · Bottom: cumulative remaining flow · market close is the last bar</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Signature 2: Price x Time Charm Field
// ---------------------------------------------------------------------------

function divergingColor(value: number, maxAbs: number): string {
  if (maxAbs <= 0) return "var(--panel-2)";
  const t = Math.max(-1, Math.min(1, value / maxAbs));
  const pct = Math.round(Math.pow(Math.abs(t), 0.55) * 90);
  const base = t >= 0 ? "var(--down)" : "var(--up)"; // positive hedge change = must BUY, negative = must SELL
  return `color-mix(in srgb, ${base} ${pct}%, var(--panel-2) ${100 - pct}%)`;
}

export function CharmFieldChart({ grid, spotValues, minutesValues, spot }: { grid: CharmFieldPoint[]; spotValues: number[]; minutesValues: number[]; spot: number }) {
  const maxAbs = Math.max(1e-6, ...grid.map((p) => Math.abs(p.hedgeChangeShares)));
  const byKey = new Map(grid.map((p) => [`${p.minutesAhead}:${p.spot}`, p]));
  const spotIdx = spotValues.reduce((best, s, i) => (Math.abs(s - spot) < Math.abs(spotValues[best] - spot) ? i : best), 0);

  return (
    <div className="overflow-x-auto">
      <div className="flex flex-col gap-px" style={{ minWidth: 640 }}>
        {minutesValues.map((minutesAhead, rowIdx) => (
          <div key={minutesAhead} className="flex items-stretch gap-px">
            <div className="flex w-20 shrink-0 items-center justify-end pr-2 font-mono text-[0.6rem] text-[var(--text-faint)]">
              {minutesAhead.toFixed(0)}m{rowIdx === 0 ? " (now)" : rowIdx === minutesValues.length - 1 ? " (close)" : ""}
            </div>
            <div className="flex flex-1 gap-px">
              {spotValues.map((s, i) => {
                const point = byKey.get(`${minutesAhead}:${s}`);
                return (
                  <div
                    key={s}
                    title={`${fmtNum(s, 2)} @ ${minutesAhead.toFixed(0)}m: ${point ? fmtFlow(point.hedgeChangeShares) : "—"}`}
                    className="h-7 flex-1"
                    style={{ background: divergingColor(point?.hedgeChangeShares ?? 0, maxAbs), outline: i === spotIdx ? "1px solid var(--text)" : undefined, outlineOffset: -1 }}
                  />
                );
              })}
            </div>
          </div>
        ))}
        <div className="flex gap-px pl-20">
          {spotValues.map((s, i) => (
            <div key={s} className="flex-1 text-center font-mono text-[0.56rem] text-[var(--text-faint)]" style={{ visibility: i % 3 === 0 ? "visible" : "hidden" }}>
              {fmtNum(s, 0)}
            </div>
          ))}
        </div>
        <div className="mt-1 font-mono text-[0.6rem] text-[var(--text-faint)]">
          Columns: hypothetical stationary price · Rows: minutes ahead, top (now) to bottom (close) · outlined column = spot · red = dealers must buy, green = dealers must sell, from time passage alone
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pillar 2: Key Levels
// ---------------------------------------------------------------------------

export function CharmPivotTable({ pivots }: { pivots: CharmPivot[] }) {
  return (
    <Table head={["Horizon", "Charm pivot"]}>
      {pivots.map((p) => (
        <tr key={p.horizonLabel} className="border-b border-[var(--border)] last:border-0">
          <td className="py-1.5 text-left font-semibold">{p.horizonLabel}</td>
          <td className="py-1.5 pl-3 text-right font-semibold">{p.price !== null ? fmtNum(p.price, 2) : "—"}</td>
        </tr>
      ))}
    </Table>
  );
}

export function CharmRotationZoneCard({ zone }: { zone: CharmRotationZone }) {
  if (zone.low === null) return <p className="m-0 font-mono text-[0.75rem] text-[var(--text-faint)]">No rotation zone found at this grid resolution this request.</p>;
  return (
    <div className="font-mono text-[0.78rem]">
      Charm rotation zone: <span className="font-semibold text-[var(--accent)]">{fmtNum(zone.low, 2)}–{fmtNum(zone.high, 2)}</span>
      <p className="m-0 mt-1 font-sans text-[0.66rem] leading-relaxed text-[var(--text-faint)]">Outside this zone, the modeled 30-minute time flow becomes directionally meaningful.</p>
    </div>
  );
}

const SHELF_LABEL: Record<CharmShelf["type"], string> = { time_buy: "Time-buy shelf", time_sell: "Time-sell shelf", cancelling: "Cancelling shelf", expiry_sensitive: "Expiry-sensitive shelf" };
const SHELF_COLOR: Record<CharmShelf["type"], string> = { time_buy: "var(--up)", time_sell: "var(--down)", cancelling: "var(--text-faint)", expiry_sensitive: "#d9a441" };

export function CharmShelfTable({ shelves }: { shelves: CharmShelf[] }) {
  if (!shelves.length) return <p className="m-0 font-mono text-[0.75rem] text-[var(--text-faint)]">No shelf cleared the 3% share threshold this request.</p>;
  return (
    <Table head={["Region", "Type", "Share of gross 30m CHEX", "Width"]}>
      {shelves.map((s, i) => (
        <tr key={i} className="border-b border-[var(--border)] last:border-0" style={{ borderLeft: `3px solid ${SHELF_COLOR[s.type]}` }}>
          <td className="py-1.5 pl-2 text-left font-semibold">
            {fmtNum(s.low, 0)}–{fmtNum(s.high, 0)}
          </td>
          <td className="py-1.5 pl-3 text-right" style={{ color: SHELF_COLOR[s.type] }}>
            {SHELF_LABEL[s.type]}
          </td>
          <td className="py-1.5 pl-3 text-right font-semibold">{s.sharePct.toFixed(0)}%</td>
          <td className="py-1.5 pl-3 text-right text-[var(--text-dim)]">{s.widthPoints} pts</td>
        </tr>
      ))}
    </Table>
  );
}

export function CharmGateCard({ gate }: { gate: CharmGate }) {
  if (gate.price === null) return <p className="m-0 font-mono text-[0.75rem] text-[var(--text-faint)]">No gate found this request.</p>;
  return (
    <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 font-mono text-[0.78rem]">
      <div>
        {gate.direction === "upside" ? "Upside" : "Downside"} charm gate: <span className="font-semibold text-[var(--accent)]">{fmtNum(gate.price, 2)}</span>
      </div>
      <div>
        Impact ratio (30m vs. 15m volume): <span className="font-semibold">{gate.impactRatio !== null ? `${(gate.impactRatio * 100).toFixed(0)}%` : "—"}</span>
      </div>
    </div>
  );
}

export function CharmDeadZoneCard({ deadZone }: { deadZone: CharmDeadZone }) {
  if (!deadZone.ranges.length) return <p className="m-0 font-mono text-[0.75rem] text-[var(--text-faint)]">No dead zone found across the scanned range this request.</p>;
  return (
    <div className="flex flex-col gap-1.5 font-mono text-[0.78rem]">
      {deadZone.ranges.map((r, i) => (
        <div key={i}>
          {fmtNum(r.low, 2)}–{fmtNum(r.high, 2)}
        </div>
      ))}
      <p className="m-0 font-sans text-[0.64rem] leading-relaxed text-[var(--text-faint)]">Time passage produces little modeled hedge adjustment in these regions - this does not mean price will be quiet there.</p>
    </div>
  );
}

const CONFLUENCE_LABEL: Record<CharmConfluence["classification"], string> = {
  reinforcing: "Reinforcing time flow",
  cancelling: "Cross-expiry cancellation",
  zero_dte_only: "0DTE-only charm",
  next_expiry_only: "Weekly-dominant charm",
  unavailable: "Unavailable",
};
const CONFLUENCE_COLOR: Record<CharmConfluence["classification"], string> = {
  reinforcing: "var(--up)",
  cancelling: "var(--down)",
  zero_dte_only: "var(--text-dim)",
  next_expiry_only: "#d9a441",
  unavailable: "var(--text-faint)",
};

export function CharmConfluenceCard({ confluence }: { confluence: CharmConfluence }) {
  if (!confluence.nextExpiry) return <p className="m-0 font-mono text-[0.75rem] text-[var(--text-faint)]">No dte&gt;0 charm surface data available this request.</p>;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 font-mono text-[0.78rem]">
        <div>
          Next dominant expiry: <span className="font-semibold">{confluence.nextExpiry.dte} DTE</span>
        </div>
        <div className="font-semibold uppercase tracking-[0.04em]" style={{ color: CONFLUENCE_COLOR[confluence.classification] }}>
          {CONFLUENCE_LABEL[confluence.classification]}
        </div>
      </div>
      <div className="font-mono text-[0.72rem] text-[var(--text-dim)]">
        Alignment: <span className="font-semibold text-[var(--text)]">{confluence.alignmentPct.toFixed(0)}%</span>
      </div>
      <p className="m-0 font-sans text-[0.64rem] leading-relaxed text-[var(--text-faint)]">Based on the source&apos;s own /charm_surface points, which carry no open interest - gross-magnitude proxy, not OI-weighted exposure.</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pillar 3: Key Risks
// ---------------------------------------------------------------------------

export function LateDaySurgeCard({ surge }: { surge: LateDaySurgeRisk }) {
  return (
    <div className="flex flex-col gap-1.5 font-mono text-[0.78rem]">
      <div>
        Surge window begins: <span className="font-semibold text-[var(--text)]">{surge.surgeStartMinutes !== null ? `~${surge.surgeStartMinutes.toFixed(0)} minutes from now` : "Not detected this session"}</span>
      </div>
      <div>
        Peak modeled flow: <span className="font-semibold text-[var(--text)]">{surge.peakFlowMinutes !== null ? `~${surge.peakFlowMinutes.toFixed(0)} minutes from now` : "—"}</span> ({fmtShares(surge.peakFlowRate)}/min)
      </div>
      <p className="m-0 font-sans text-[0.64rem] leading-relaxed text-[var(--text-faint)]">This is scenario output, not evidence that actual flow will occur exactly then.</p>
    </div>
  );
}

export function ReversalRiskCard({ risk }: { risk: ReversalRisk }) {
  if (risk.pivotPrice === null) return <p className="m-0 font-mono text-[0.75rem] text-[var(--text-faint)]">No pivot found this request.</p>;
  return (
    <div className="flex flex-col gap-1.5 font-mono text-[0.78rem]">
      <div>
        Distance to 30-minute pivot: <span className="font-semibold">{risk.distancePoints !== null ? `${risk.distancePoints >= 0 ? "+" : ""}${risk.distancePoints.toFixed(2)} pts` : "—"}</span>
        {risk.distanceEm !== null && <span className="text-[var(--text-dim)]"> ({risk.distanceEm.toFixed(2)} expected moves)</span>}
      </div>
      <div>
        Below pivot: <span className="font-semibold" style={{ color: risk.belowDirection === "buy" ? "var(--up)" : "var(--down)" }}>{risk.belowDirection === "buy" ? "modeled buying" : "modeled selling"}</span> · Above pivot:{" "}
        <span className="font-semibold" style={{ color: risk.aboveDirection === "buy" ? "var(--up)" : "var(--down)" }}>{risk.aboveDirection === "buy" ? "modeled buying" : "modeled selling"}</span>
      </div>
    </div>
  );
}

const CONFLICT_LABEL: Record<GammaConflict["classification"], string> = { reinforcing: "Reinforcing", partially_offsetting: "Partially offsetting", strongly_conflicting: "Strongly conflicting" };

export function GammaConflictCard({ conflict }: { conflict: GammaConflict }) {
  return (
    <div className="flex flex-col gap-1.5 font-mono text-[0.78rem]">
      <div className="grid grid-cols-2 gap-3">
        <div>
          Charm flow (30m) <div className="font-semibold" style={{ color: conflict.charmFlow >= 0 ? "var(--up)" : "var(--down)" }}>{fmtFlow(conflict.charmFlow)}</div>
        </div>
        <div>
          Gamma-implied flow (1 EM down) <div className="font-semibold" style={{ color: conflict.gammaImpliedFlow >= 0 ? "var(--up)" : "var(--down)" }}>{fmtFlow(conflict.gammaImpliedFlow)}</div>
        </div>
      </div>
      <div>
        Classification: <span className="font-semibold">{CONFLICT_LABEL[conflict.classification]}</span> (conflict score {conflict.conflict.toFixed(2)})
      </div>
      <p className="m-0 font-sans text-[0.64rem] leading-relaxed text-[var(--text-faint)]">Risk diagnostic only - not the primary charm metric.</p>
    </div>
  );
}

export function VannaContaminationCard({ risk }: { risk: VannaContaminationRisk }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-3 gap-3 font-mono text-[0.78rem]">
        <div>
          IV -1 <div className="font-semibold" style={{ color: risk.ivDown1 >= 0 ? "var(--up)" : "var(--down)" }}>{fmtFlow(risk.ivDown1)}</div>
        </div>
        <div>
          IV unchanged <div className="font-semibold" style={{ color: risk.ivUnchanged >= 0 ? "var(--up)" : "var(--down)" }}>{fmtFlow(risk.ivUnchanged)}</div>
        </div>
        <div>
          IV +1 <div className="font-semibold" style={{ color: risk.ivUp1 >= 0 ? "var(--up)" : "var(--down)" }}>{fmtFlow(risk.ivUp1)}</div>
        </div>
      </div>
      {risk.fragile && <p className="m-0 font-sans text-[0.7rem] font-semibold text-[var(--down)]">Flow direction changes across these IV scenarios - the charm regime is flagged fragile.</p>}
    </div>
  );
}

export function CharmLinearizationRiskCard({ risk }: { risk: LinearizationRisk }) {
  return (
    <div className="flex items-center gap-3 font-mono text-[0.78rem]">
      <span>Linearization error (charm×h vs. full reprice):</span>
      <span className="font-semibold">{risk.errorPct.toFixed(0)}%</span>
      <RiskPill level={risk.level} />
    </div>
  );
}

export function ExpiryDiscontinuityCard({ risk }: { risk: { atmGamma: number; level: "low" | "moderate" | "high" } }) {
  return (
    <div className="flex items-center gap-3 font-mono text-[0.78rem]">
      <span>Expiry boundary sensitivity:</span>
      <RiskPill level={risk.level} />
      <span className="text-[var(--text-dim)]">ATM gamma {risk.atmGamma.toFixed(4)}</span>
    </div>
  );
}

export function CharmDealerSignUncertaintyCard({ uncertainty }: { uncertainty: DealerSignUncertainty }) {
  return (
    <div className="flex flex-col gap-1.5 font-mono text-[0.78rem]">
      <div>
        Direction agreement: <span className="font-semibold">{(100 - uncertainty.uncertainty * 100).toFixed(0)}%</span>
      </div>
      <div className="text-[var(--text-dim)]">
        {uncertainty.positiveScenarios} of {uncertainty.totalScenarios} dealer-sign scenarios modeling buying, {uncertainty.negativeScenarios} modeling selling.
      </div>
    </div>
  );
}

export function CharmOiFreshnessCard({ freshness }: { freshness: OiFreshnessRisk }) {
  return (
    <div className="flex flex-col gap-1.5 font-mono text-[0.78rem]">
      <div className="flex items-center gap-2">
        <span>OI freshness risk:</span>
        <RiskPill level={freshness.level} />
      </div>
      <div className="text-[var(--text-dim)]">
        Refresh ratio (recent volume / 0DTE OI): <span className="font-semibold text-[var(--text)]">{freshness.refreshRatio.toFixed(2)}×</span>
      </div>
    </div>
  );
}

export function HedgeTimingNoteCard({ note }: { note: string }) {
  return <p className="m-0 font-mono text-[0.72rem] leading-relaxed text-[var(--text-faint)]">{note}</p>;
}

// ---------------------------------------------------------------------------
// Pillar 4: Key Structure
// ---------------------------------------------------------------------------

export function CharmBalanceSheetCard({ sheet }: { sheet: CharmBalanceSheet }) {
  return (
    <div className="grid grid-cols-2 gap-3 font-mono text-[0.78rem] sm:grid-cols-4">
      <div>
        Positive migration <div className="font-semibold text-[var(--up)]">{fmtShares(sheet.chexPositive)}</div>
      </div>
      <div>
        Negative migration <div className="font-semibold text-[var(--down)]">{fmtShares(sheet.chexNegative)}</div>
      </div>
      <div>
        Net migration <div className="font-semibold" style={{ color: sheet.netChex >= 0 ? "var(--up)" : "var(--down)" }}>{fmtShares(sheet.netChex)}</div>
      </div>
      <div>
        Modeled hedge (30m) <div className="font-semibold" style={{ color: sheet.theoreticalHedge >= 0 ? "var(--up)" : "var(--down)" }}>{fmtFlow(sheet.theoreticalHedge)}</div>
      </div>
      <div className="col-span-2 sm:col-span-4">
        Cancellation: <span className="font-semibold text-[var(--text)]">{(sheet.cancellationRatio * 100).toFixed(0)}%</span>
      </div>
    </div>
  );
}

export function DeltaDestinationChart({ destination, spot }: { destination: DeltaDestinationMap; spot: number }) {
  const maxAbs = Math.max(1e-6, ...destination.rows.map((r) => Math.abs(r.remainingMigrationShares)));
  return (
    <div className="flex flex-col gap-2">
      <div className="font-mono text-[0.78rem]">
        Total remaining delta migration: <span className="font-semibold text-[var(--accent)]">{fmtShares(destination.totalRemainingMigrationShares)}</span> · Modeled hedge adjustment:{" "}
        <span className="font-semibold" style={{ color: destination.theoreticalHedgeAdjustment >= 0 ? "var(--up)" : "var(--down)" }}>{fmtFlow(destination.theoreticalHedgeAdjustment)}</span>
      </div>
      <p className="m-0 font-sans text-[0.66rem] leading-relaxed text-[var(--text-faint)]">
        Compares current delta inventory to projected delta {destination.nearCloseMinutes.toFixed(1)} minutes before expiration, at unchanged spot and IV - avoids the discontinuity exactly at expiry.
      </p>
      <div className="flex h-40 items-end gap-px overflow-x-auto">
        {destination.rows.map((row) => {
          const heightPct = (Math.abs(row.remainingMigrationShares) / maxAbs) * 100;
          const isSpotStrike = Math.abs(row.strike - spot) < 1;
          return (
            <div key={row.strike} title={`${fmtNum(row.strike, 0)}: ${fmtShares(row.remainingMigrationShares)} remaining migration`} className="flex min-w-[3px] flex-1 flex-col justify-end" style={{ outline: isSpotStrike ? "1px solid var(--text)" : undefined }}>
              <div className="w-full" style={{ height: `${heightPct}%`, background: row.remainingMigrationShares >= 0 ? "var(--up)" : "var(--down)" }} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function CharmHeatmapGrid({ heatmap }: { heatmap: CharmHeatmap | null }) {
  if (!heatmap || !heatmap.rows.length) return <p className="m-0 font-mono text-[0.75rem] text-[var(--text-faint)]">Unavailable this request (upstream /charm_surface is best-effort and can time out).</p>;
  const allValues = heatmap.rows.flatMap((r) => r.cells.filter((c): c is number => c !== null));
  const maxAbs = Math.max(1e-6, ...allValues.map((v) => Math.abs(v)));
  return (
    <div className="overflow-x-auto">
      <div className="flex flex-col gap-px" style={{ minWidth: 480 }}>
        <div className="flex gap-px pl-16">
          {heatmap.expiriesDte.map((dte) => (
            <div key={dte} className="flex-1 text-center font-mono text-[0.56rem] text-[var(--text-faint)]">
              {dte}d
            </div>
          ))}
        </div>
        {heatmap.rows.map((row) => (
          <div key={row.strike} className="flex items-stretch gap-px">
            <div className="flex w-16 shrink-0 items-center justify-end pr-2 font-mono text-[0.6rem] text-[var(--text-faint)]">{fmtNum(row.strike, 0)}</div>
            <div className="flex flex-1 gap-px">
              {row.cells.map((c, i) => (
                <div key={i} title={c !== null ? `${fmtNum(row.strike, 0)} @ ${heatmap.expiriesDte[i]}d: ${c.toFixed(4)}` : "—"} className="h-6 flex-1" style={{ background: c !== null ? divergingColor(c, maxAbs) : "var(--panel-2)" }} />
              ))}
            </div>
          </div>
        ))}
        <div className="mt-1 font-mono text-[0.6rem] text-[var(--text-faint)]">Raw per-contract charm from the source&apos;s /charm_surface, summed by strike x expiry - no open interest, gross-magnitude proxy only.</div>
      </div>
    </div>
  );
}

export function CharmConcentrationRow({ stats }: { stats: ConcentrationStats }) {
  return (
    <div className="grid grid-cols-3 gap-3 font-mono text-[0.78rem]">
      <div>
        Charm HHI <div className="font-semibold text-[var(--text)]">{stats.hhi.toFixed(3)}</div>
      </div>
      <div>
        Charm entropy <div className="font-semibold text-[var(--text)]">{stats.entropy.toFixed(2)}</div>
      </div>
      <div>
        Effective clusters <div className="font-semibold text-[var(--text)]">{stats.effectiveStrikes.toFixed(1)}</div>
      </div>
    </div>
  );
}

export function ZeroDteCharmControlCard({ control }: { control: ZeroDteCharmControl | null }) {
  if (!control) return <p className="m-0 font-mono text-[0.75rem] text-[var(--text-faint)]">Unavailable this request (upstream /charm_surface is best-effort and can time out).</p>;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="font-mono text-[0.78rem]">
        0DTE charm control: <span className="font-semibold text-[var(--accent)]">{control.controlPct.toFixed(1)}%</span> of gross raw charm magnitude across expiries
      </div>
      <p className="m-0 font-sans text-[0.64rem] leading-relaxed text-[var(--text-faint)]">Raw-Greek-magnitude share, not OI-weighted or horizon-specific - /charm_surface carries no open interest and no other expiry's full chain is available to recompute finite-horizon flow.</p>
    </div>
  );
}

export function CharmCentersCard({ centers, spot }: { centers: CharmCenters; spot: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 font-mono text-[0.78rem] sm:grid-cols-4">
      <div>
        Call charm center{" "}
        <div className="font-semibold" style={{ color: centers.callDirection === "buy" ? "var(--up)" : centers.callDirection === "sell" ? "var(--down)" : "var(--text)" }}>
          {centers.callCenter !== null ? fmtNum(centers.callCenter, 1) : "—"}
        </div>
      </div>
      <div>
        Put charm center{" "}
        <div className="font-semibold" style={{ color: centers.putDirection === "buy" ? "var(--up)" : centers.putDirection === "sell" ? "var(--down)" : "var(--text)" }}>
          {centers.putCenter !== null ? fmtNum(centers.putCenter, 1) : "—"}
        </div>
      </div>
      <div>
        Separation <div className="font-semibold text-[var(--text)]">{centers.separation !== null ? centers.separation.toFixed(1) : "—"}</div>
      </div>
      <div>
        Distance from spot (call/put) <div className="font-semibold text-[var(--text)]">
          {centers.callDistanceFromSpot !== null ? centers.callDistanceFromSpot.toFixed(1) : "—"} / {centers.putDistanceFromSpot !== null ? centers.putDistanceFromSpot.toFixed(1) : "—"}
        </div>
      </div>
      <div className="col-span-2 text-[var(--text-faint)] sm:col-span-4">Spot: {fmtNum(spot, 2)}</div>
    </div>
  );
}

export function ForwardCharmClockTable({ clock }: { clock: ForwardCharmClockPoint[] }) {
  return (
    <Table head={["Snapshot", "Net 30m flow", "Gross 30m flow", "30m pivot", "Cancellation"]}>
      {clock.map((p) => (
        <tr key={p.label} className="border-b border-[var(--border)] last:border-0">
          <td className="py-1.5 text-left font-semibold">{p.label}</td>
          <td className={`py-1.5 pl-3 text-right font-semibold ${p.net30mFlow >= 0 ? "text-[var(--up)]" : "text-[var(--down)]"}`}>{fmtFlow(p.net30mFlow)}</td>
          <td className="py-1.5 pl-3 text-right text-[var(--text-dim)]">{fmtShares(p.gross30mFlow)}</td>
          <td className="py-1.5 pl-3 text-right text-[var(--text-dim)]">{p.pivot30m !== null ? fmtNum(p.pivot30m, 1) : "—"}</td>
          <td className="py-1.5 pl-3 text-right font-semibold">{(p.cancellationRatio * 100).toFixed(0)}%</td>
        </tr>
      ))}
    </Table>
  );
}

// ---------------------------------------------------------------------------
// Diagnostic strip
// ---------------------------------------------------------------------------

export function CharmDiagnosticStrip({ diagnostics }: { diagnostics: CharmEngineDiagnostics }) {
  return (
    <div className="flex flex-col gap-1.5 border-t border-[var(--border)] pt-3 font-mono text-[0.62rem] text-[var(--text-faint)]">
      <div>Pricing model: {diagnostics.pricingModel}</div>
      <div>Surface model: {diagnostics.surfaceModel}</div>
      <div className="flex flex-wrap gap-x-6">
        <span>Contracts included: {diagnostics.contractsIncluded}</span>
        <span>Invalid/missing: {diagnostics.invalidContracts}</span>
        <span>Dealer-sign convention: {diagnostics.dealerSignConvention}</span>
        <span>OI freshness: {diagnostics.oiFreshnessLabel}</span>
        <span>Last calculated: {new Date(diagnostics.lastCalculatedAt).toLocaleTimeString()}</span>
      </div>
      <div>{diagnostics.hedgeTimingNote}</div>
      <div>{diagnostics.crossProductWarning}</div>
      <div>{diagnostics.charmSurfaceDataNote}</div>
    </div>
  );
}
