"use client";

import { fmtNum, fmtUsd } from "@/lib/gex";
import type {
  BurnSurfacePoint,
  CarryWipeoutScenario,
  ConcentrationStats,
  ConvexityDeficit,
  DecayCenters,
  EscapeAsymmetry,
  EscapeBand,
  ExpiryThetaStack,
  ForwardClockSnapshot,
  IvStabilityResult,
  MoneynessRow,
  OiFreshnessRisk,
  PhaseClassification,
  SurvivalPoint,
  ThetaBalanceSheet,
  ThetaConfluence,
  ThetaConsensusScenario,
  ThetaDecisionLadderRow,
  ThetaHeatmap,
  ThetaMirageRisk,
  ThetaRegime,
  ThetaShelf,
} from "@/lib/thetaEngine";
import type { BurnBasin } from "@/lib/thetaEngine";

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

function pct(n: number, digits = 0): string {
  return `${(n * 100).toFixed(digits)}%`;
}

// ---------------------------------------------------------------------------
// Hero + nav
// ---------------------------------------------------------------------------

const PHASE_COLOR: Record<PhaseClassification["phase"], string> = {
  slow_carry: "var(--up)",
  steady_burn: "var(--text-faint)",
  accelerating_burn: "#d9a441",
  decay_trap: "var(--down)",
  motion_dominant: "var(--up)",
  fragile_carry: "#d9a441",
};

export function ThetaHeroBanner({ heroStatement, phase }: { heroStatement: string; phase: PhaseClassification }) {
  const color = PHASE_COLOR[phase.phase];
  return (
    <div className="flex flex-col gap-2 border p-5" style={{ borderColor: color, background: `color-mix(in srgb, ${color} 6%, var(--panel) 94%)` }}>
      <div className="font-mono text-[0.6rem] uppercase tracking-[0.08em] text-[var(--text-faint)]">Theta decision engine · plain-English summary</div>
      <p className="m-0 font-sans text-[0.95rem] font-medium leading-relaxed text-[var(--text)]">{heroStatement}</p>
    </div>
  );
}

export type ThetaPillarId = "regime" | "levels" | "risks" | "structure";
const PILLAR_LABEL: Record<ThetaPillarId, string> = { regime: "THETA REGIME", levels: "KEY LEVELS", risks: "KEY RISKS", structure: "KEY STRUCTURE" };

export function ThetaPillarNav({ active, onChange }: { active: ThetaPillarId; onChange: (p: ThetaPillarId) => void }) {
  const order: ThetaPillarId[] = ["regime", "levels", "risks", "structure"];
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

export function ThetaPillarSummaryCards({
  active,
  onChange,
  phase,
  regime,
  decayCenters,
  burnBasin,
  escapeBands,
  escapeAsymmetry30m,
  worstCarry,
  ivStability,
  oiFreshness,
  balanceSheet,
  concentrationEffectiveStrikes,
}: {
  active: ThetaPillarId;
  onChange: (p: ThetaPillarId) => void;
  phase: PhaseClassification;
  regime: ThetaRegime;
  decayCenters: DecayCenters;
  burnBasin: BurnBasin | null;
  escapeBands: EscapeBand[];
  escapeAsymmetry30m: EscapeAsymmetry;
  worstCarry: CarryWipeoutScenario | null;
  ivStability: { robustnessPct: number };
  oiFreshness: OiFreshnessRisk;
  balanceSheet: ThetaBalanceSheet;
  concentrationEffectiveStrikes: number;
}) {
  const band30m = escapeBands.find((b) => b.horizonMinutes === 30) ?? escapeBands[escapeBands.length - 1];
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <SummaryCard
        title="THETA REGIME"
        active={active === "regime"}
        onClick={() => onChange("regime")}
        rows={[
          { label: "Phase", value: phase.label, tone: phase.phase === "decay_trap" ? "down" : phase.phase === "motion_dominant" || phase.phase === "slow_carry" ? "up" : "neutral" },
          { label: "Burn/min now", value: fmtUsd(regime.burnRateNow) },
          { label: "30-min burn fraction", value: pct(regime.burnFraction30m) },
          { label: "Burn acceleration", value: fmtUsd(regime.burnAcceleration) },
        ]}
      />
      <SummaryCard
        title="KEY LEVELS"
        active={active === "levels"}
        onClick={() => onChange("levels")}
        rows={[
          { label: "Decay center", value: decayCenters.grossCenter !== null ? fmtNum(decayCenters.grossCenter, 1) : "—" },
          { label: "Burn basin", value: burnBasin ? `${fmtNum(burnBasin.low, 0)}–${fmtNum(burnBasin.high, 0)}` : "—" },
          { label: "30-min escape band", value: band30m?.down !== null && band30m?.up !== undefined ? `${fmtNum(band30m.down, 1)}–${fmtNum(band30m.up, 1)}` : "—" },
          { label: "Escape asymmetry", value: escapeAsymmetry30m.asymmetry !== null ? escapeAsymmetry30m.asymmetry.toFixed(2) : "—" },
        ]}
      />
      <SummaryCard
        title="KEY RISKS"
        active={active === "risks"}
        onClick={() => onChange("risks")}
        rows={[
          { label: "Largest carry wipeout", value: worstCarry ? worstCarry.label : "—", tone: worstCarry?.riskLevel === "extreme" || worstCarry?.riskLevel === "high" ? "down" : "neutral" },
          { label: "IV robustness", value: `${ivStability.robustnessPct.toFixed(0)}%` },
          { label: "OI freshness risk", value: oiFreshness.level },
          { label: "Carry ratio", value: worstCarry?.carryRiskRatio !== null && worstCarry?.carryRiskRatio !== undefined ? `${worstCarry.carryRiskRatio.toFixed(1)}×` : "—" },
        ]}
      />
      <SummaryCard
        title="KEY STRUCTURE"
        active={active === "structure"}
        onClick={() => onChange("structure")}
        rows={[
          { label: "Gross theta", value: fmtUsd(balanceSheet.grossTex) },
          { label: "Net dealer carry", value: fmtUsd(balanceSheet.dealerCarryNow), tone: balanceSheet.dealerCarryNow >= 0 ? "up" : "down" },
          { label: "Concentration", value: `${concentrationEffectiveStrikes.toFixed(1)} strikes` },
          { label: "0DTE control", value: "see tab" },
        ]}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pillar 1: Theta Regime
// ---------------------------------------------------------------------------

export function BurnHorizonTable({ regime }: { regime: ThetaRegime }) {
  return (
    <Table head={["Horizon", "Gross burn", "Burn fraction"]}>
      {[
        { label: "5 min", value: regime.burn5m },
        { label: "15 min", value: regime.burn15m },
        { label: "30 min", value: regime.burn30m },
        { label: "60 min", value: regime.burn60m },
        { label: "Until expiration", value: regime.burnUntilExpiry },
      ].map((row) => (
        <tr key={row.label} className="border-b border-[var(--border)] last:border-0">
          <td className="py-1.5 text-left font-semibold">{row.label}</td>
          <td className="py-1.5 pl-3 text-right text-[var(--text-dim)]">{fmtUsd(row.value)}</td>
          <td className="py-1.5 pl-3 text-right font-semibold">{regime.grossExtrinsicValue > 0 ? pct(row.value / regime.grossExtrinsicValue) : "—"}</td>
        </tr>
      ))}
    </Table>
  );
}

export function HalfLifeCard({ regime }: { regime: ThetaRegime }) {
  const Row = ({ label, value }: { label: string; value: number | null }) => (
    <div>
      {label} <div className="font-semibold text-[var(--text)]">{value !== null ? `${value.toFixed(0)} min` : "Doesn't reach within session"}</div>
    </div>
  );
  return (
    <div className="grid grid-cols-2 gap-3 font-mono text-[0.78rem] sm:grid-cols-4">
      <Row label="Full chain (OI-weighted)" value={regime.halfLifeAll} />
      <Row label="ATM options" value={regime.halfLifeAtm} />
      <Row label="Calls" value={regime.halfLifeCalls} />
      <Row label="Puts" value={regime.halfLifePuts} />
    </div>
  );
}

export function DecayDominanceCard({ regime }: { regime: ThetaRegime }) {
  const ratio = regime.decayDominanceRatio30m;
  const label = ratio === null ? "—" : ratio < 0.9 ? "Decay dominant" : ratio > 1.1 ? "Movement dominant" : "Balanced";
  return (
    <div className="flex items-center gap-3 font-mono text-[0.78rem]">
      <span>30-min decay dominance ratio:</span>
      <span className="font-semibold">{ratio !== null ? ratio.toFixed(2) : "—"}</span>
      <span className="text-[var(--text-dim)]">({label})</span>
    </div>
  );
}

export function ThetaConsensusTable({ scenarios }: { scenarios: ThetaConsensusScenario[] }) {
  return (
    <Table head={["Dealer-sign scenario", "Estimated carry now"]}>
      {scenarios.map((s) => (
        <tr key={s.name} className="border-b border-[var(--border)] last:border-0">
          <td className="py-1.5 text-left text-[var(--text-dim)]">{s.label}</td>
          <td className={`py-1.5 pl-3 text-right font-semibold ${s.carryNow >= 0 ? "text-[var(--up)]" : "text-[var(--down)]"}`}>{fmtUsd(s.carryNow)}</td>
        </tr>
      ))}
    </Table>
  );
}

// ---------------------------------------------------------------------------
// Pillar 2: Key Levels
// ---------------------------------------------------------------------------

export function DecayCentersCard({ centers }: { centers: DecayCenters }) {
  return (
    <div className="grid grid-cols-3 gap-3 font-mono text-[0.78rem]">
      <div>
        Call theta center <div className="font-semibold text-[var(--up)]">{centers.callCenter !== null ? fmtNum(centers.callCenter, 1) : "—"}</div>
      </div>
      <div>
        Put theta center <div className="font-semibold text-[var(--down)]">{centers.putCenter !== null ? fmtNum(centers.putCenter, 1) : "—"}</div>
      </div>
      <div>
        Gross theta center <div className="font-semibold text-[var(--text)]">{centers.grossCenter !== null ? fmtNum(centers.grossCenter, 1) : "—"}</div>
      </div>
    </div>
  );
}

export function BurnBasinCard({ basin }: { basin: BurnBasin | null }) {
  if (!basin) return <p className="m-0 font-mono text-[0.75rem] text-[var(--text-faint)]">No basin cleared the 60%-of-peak threshold this request.</p>;
  return (
    <div className="flex flex-col gap-1.5 font-mono text-[0.78rem]">
      <div>
        Primary burn basin: <span className="font-semibold text-[var(--accent)]">{fmtNum(basin.low, 1)}–{fmtNum(basin.high, 1)}</span>
      </div>
      <div className="text-[var(--text-dim)]">
        Burn center: <span className="font-semibold text-[var(--text)]">{fmtNum(basin.center, 1)}</span> · Share of 0DTE decay: <span className="font-semibold text-[var(--text)]">{basin.sharePct.toFixed(0)}%</span>
      </div>
    </div>
  );
}

export function EscapeBandTable({ bands }: { bands: EscapeBand[] }) {
  if (!bands.length) return <p className="m-0 font-mono text-[0.75rem] text-[var(--text-faint)]">No escape band resolved within the search range this request.</p>;
  return (
    <Table head={["Horizon", "Downside escape", "Upside escape"]}>
      {bands.map((b) => (
        <tr key={b.horizonMinutes} className="border-b border-[var(--border)] last:border-0">
          <td className="py-1.5 text-left font-semibold">{b.horizonMinutes} min</td>
          <td className="py-1.5 pl-3 text-right text-[var(--down)]">{b.down !== null ? fmtNum(b.down, 2) : "—"}</td>
          <td className="py-1.5 pl-3 text-right text-[var(--up)]">{b.up !== null ? fmtNum(b.up, 2) : "—"}</td>
        </tr>
      ))}
    </Table>
  );
}

export function EscapeAsymmetryCard({ asymmetry }: { asymmetry: EscapeAsymmetry }) {
  if (asymmetry.upDistance === null || asymmetry.downDistance === null) return <p className="m-0 font-mono text-[0.75rem] text-[var(--text-faint)]">Unavailable this request.</p>;
  return (
    <p className="m-0 font-sans text-[0.82rem] leading-relaxed text-[var(--text-dim)]">
      Downside options require a <span className="font-semibold text-[var(--text)]">{((asymmetry.downDistance / (asymmetry.downDistance + asymmetry.upDistance)) * 100).toFixed(0)}%</span>-of-range move
      (<span className="font-semibold text-[var(--text)]">{asymmetry.downDistance.toFixed(2)} pts</span>) to escape {asymmetry.horizonMinutes}-minute decay, while upside options require{" "}
      <span className="font-semibold text-[var(--text)]">{asymmetry.upDistance.toFixed(2)} pts</span>. Escape is {Math.abs(asymmetry.asymmetry ?? 0) < 0.05 ? "roughly symmetric" : (asymmetry.asymmetry ?? 0) < 0 ? "easier to the downside" : "easier to the upside"} under the current skew.
    </p>
  );
}

const SHELF_MIX_LABEL: Record<ThetaShelf["mix"], string> = { call_heavy: "Call-heavy", put_heavy: "Put-heavy", balanced: "Balanced" };
const SHELF_MIX_COLOR: Record<ThetaShelf["mix"], string> = { call_heavy: "var(--up)", put_heavy: "var(--down)", balanced: "var(--text-dim)" };

export function ThetaShelfTable({ shelves }: { shelves: ThetaShelf[] }) {
  if (!shelves.length) return <p className="m-0 font-mono text-[0.75rem] text-[var(--text-faint)]">No shelf cleared the 3% share threshold this request.</p>;
  return (
    <Table head={["Region", "Gross burn share", "Call/put mix", "30-min burn"]}>
      {shelves.map((s, i) => (
        <tr key={i} className="border-b border-[var(--border)] last:border-0">
          <td className="py-1.5 text-left font-semibold">{fmtNum(s.low, 0)}–{fmtNum(s.high, 0)}</td>
          <td className="py-1.5 pl-3 text-right font-semibold">{s.sharePct.toFixed(0)}%</td>
          <td className="py-1.5 pl-3 text-right" style={{ color: SHELF_MIX_COLOR[s.mix] }}>{SHELF_MIX_LABEL[s.mix]}</td>
          <td className="py-1.5 pl-3 text-right text-[var(--text-dim)]">{fmtUsd(s.burn30m)}</td>
        </tr>
      ))}
    </Table>
  );
}

const CONFLUENCE_LABEL: Record<ThetaConfluence["classification"], string> = {
  reinforcing: "Reinforcing decay concentration",
  zero_dte_only: "0DTE-only decay",
  weekly_only: "Weekly-only decay",
  mixed_call_put: "Mixed call/put carry concentration",
};
const CONFLUENCE_COLOR: Record<ThetaConfluence["classification"], string> = {
  reinforcing: "var(--up)",
  zero_dte_only: "var(--text-dim)",
  weekly_only: "#d9a441",
  mixed_call_put: "var(--text-faint)",
};

export function ThetaConfluenceCard({ confluence }: { confluence: ThetaConfluence }) {
  if (!confluence.nextExpiry) return <p className="m-0 font-mono text-[0.75rem] text-[var(--text-faint)]">No other expiry available in the /theta grid this request.</p>;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 font-mono text-[0.78rem]">
        <div>
          Next dominant expiry: <span className="font-semibold">{confluence.nextExpiry.expiration}</span>
        </div>
        <div className="font-semibold uppercase tracking-[0.04em]" style={{ color: CONFLUENCE_COLOR[confluence.classification] }}>
          {CONFLUENCE_LABEL[confluence.classification]}
        </div>
      </div>
      <div className="font-mono text-[0.72rem] text-[var(--text-dim)]">
        Alignment: <span className="font-semibold text-[var(--text)]">{confluence.alignmentPct.toFixed(0)}%</span>
      </div>
      <p className="m-0 font-sans text-[0.66rem] text-[var(--text-faint)]">Unlike gamma confluence, this does not imply stronger hedging pressure - it means the strike is a major premium-decay center across expirations.</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pillar 3: Key Risks
// ---------------------------------------------------------------------------

export function ThetaDecisionLadderTable({ rows }: { rows: ThetaDecisionLadderRow[] }) {
  if (!rows.length) return <p className="m-0 font-mono text-[0.75rem] text-[var(--text-faint)]">No escape band resolved this request.</p>;
  return (
    <Table head={["Horizon", "Compression zone", "Premium burned", "Movement required"]}>
      {rows.map((r) => (
        <tr key={r.horizonMinutes} className="border-b border-[var(--border)] last:border-0">
          <td className="py-1.5 text-left font-semibold">{r.horizonMinutes}m</td>
          <td className="py-1.5 pl-3 text-right text-[var(--text-dim)]">
            {r.compressionLow !== null && r.compressionHigh !== null ? `${fmtNum(r.compressionLow, 1)}–${fmtNum(r.compressionHigh, 1)}` : "—"}
          </td>
          <td className="py-1.5 pl-3 text-right font-semibold">{pct(r.burnFractionPct / 100)}</td>
          <td className="py-1.5 pl-3 text-right font-semibold">{r.movementRequiredPct !== null ? `${r.movementRequiredPct.toFixed(2)}%` : "—"}</td>
        </tr>
      ))}
    </Table>
  );
}

export function ConvexityDeficitCard({ deficit }: { deficit: ConvexityDeficit }) {
  if (deficit.moveRequiredPct === null) {
    return <p className="m-0 font-mono text-[0.75rem] text-[var(--text-faint)]">No aggregate gamma available to solve this request.</p>;
  }
  return (
    <p className="m-0 font-sans text-[0.82rem] leading-relaxed text-[var(--text-dim)]">
      Theta sellers earn <span className="font-semibold text-[var(--text)]">{fmtUsd(deficit.thetaCarry30m)}</span> over the next 30 minutes but become exposed once the underlying moves more than
      approximately <span className="font-semibold text-[var(--text)]">{deficit.moveRequiredPct.toFixed(2)}%</span> ({deficit.moveRequiredPoints?.toFixed(2)} points) - a{" "}
      <span className="font-semibold">sqrt(2·|Θ|·Δt / Γ)</span> approximation, not full repricing (see the Escape Bands above for the full-reprice version of the same question).
    </p>
  );
}

export function ExpiryThetaStackTable({ stack }: { stack: ExpiryThetaStack | null }) {
  if (!stack) return <p className="m-0 font-mono text-[0.75rem] text-[var(--text-faint)]">Unavailable this request (upstream /theta grid didn't land in time).</p>;
  return (
    <div className="flex flex-col gap-3">
      <div className="font-mono text-[0.78rem]">
        0DTE theta control (gross): <span className="font-semibold text-[var(--accent)]">{stack.zeroDteControlPct.toFixed(1)}%</span>
      </div>
      <Table head={["Expiration", "Gross burn (source units)", "Share"]}>
        {stack.rows.slice(0, 10).map((r) => (
          <tr key={r.expiration} className="border-b border-[var(--border)] last:border-0">
            <td className="py-1.5 text-left text-[var(--text-dim)]">{r.expiration}</td>
            <td className="py-1.5 pl-3 text-right text-[var(--text-dim)]">{r.grossBurn.toFixed(0)}</td>
            <td className="py-1.5 pl-3 text-right font-semibold">{r.sharePct.toFixed(0)}%</td>
          </tr>
        ))}
      </Table>
    </div>
  );
}

export function CarryWipeoutTable({ scenarios }: { scenarios: CarryWipeoutScenario[] }) {
  return (
    <Table head={["Scenario", "Price", "Position P&L", "Carry risk ratio", "Risk"]}>
      {scenarios.map((s) => (
        <tr key={s.label} className="border-b border-[var(--border)] last:border-0">
          <td className="py-1.5 text-left font-semibold">{s.label}</td>
          <td className="py-1.5 pl-3 text-right text-[var(--text-dim)]">{fmtNum(s.price, 2)}</td>
          <td className={`py-1.5 pl-3 text-right ${s.positionPnl >= 0 ? "text-[var(--up)]" : "text-[var(--down)]"}`}>{fmtUsd(s.positionPnl)}</td>
          <td className="py-1.5 pl-3 text-right font-semibold">{s.carryRiskRatio !== null ? `${s.carryRiskRatio.toFixed(2)}×` : "—"}</td>
          <td className="py-1.5 pl-3 text-right">
            <RiskPill level={s.riskLevel} />
          </td>
        </tr>
      ))}
    </Table>
  );
}

export function IvStabilityCard({ stability }: { stability: { scenarios: IvStabilityResult[]; robustnessPct: number } }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="font-mono text-[0.78rem]">
        Theta robustness across IV scenarios: <span className="font-semibold">{stability.robustnessPct.toFixed(0)}%</span>
      </div>
      <Table head={["IV shift", "30-min burn", "Decay still dominant"]}>
        {stability.scenarios.map((s) => (
          <tr key={s.ivShiftPoints} className="border-b border-[var(--border)] last:border-0">
            <td className="py-1.5 text-left font-semibold">
              {s.ivShiftPoints >= 0 ? "+" : ""}
              {s.ivShiftPoints}pt
            </td>
            <td className="py-1.5 pl-3 text-right text-[var(--text-dim)]">{fmtUsd(s.burn30m)}</td>
            <td className="py-1.5 pl-3 text-right font-semibold" style={{ color: s.decayStillDominant ? "var(--up)" : "var(--down)" }}>
              {s.decayStillDominant ? "Yes" : "No"}
            </td>
          </tr>
        ))}
      </Table>
    </div>
  );
}

export function ThetaMirageCard({ mirage }: { mirage: ThetaMirageRisk }) {
  return (
    <div className="flex flex-col gap-1.5 font-mono text-[0.78rem]">
      <div>
        Gross decay exposure: <span className="font-semibold text-[var(--text)]">{fmtUsd(mirage.gross)}</span>
      </div>
      <div>
        Estimated net dealer carry: <span className="font-semibold" style={{ color: mirage.net >= 0 ? "var(--up)" : "var(--down)" }}>{fmtUsd(mirage.net)}</span>
      </div>
      <div>
        Cancellation: <span className="font-semibold text-[var(--text)]">{mirage.cancellationPct.toFixed(0)}%</span>
      </div>
      {mirage.cancellationPct > 70 && <p className="m-0 font-sans text-[0.68rem] text-[var(--text-faint)]">The market has a large decay structure but weak estimated net carry.</p>}
    </div>
  );
}

export function ThetaOiFreshnessCard({ freshness }: { freshness: OiFreshnessRisk }) {
  return (
    <div className="flex flex-col gap-1.5 font-mono text-[0.78rem]">
      <div className="flex items-center gap-2">
        <span>OI freshness risk:</span>
        <RiskPill level={freshness.level} />
      </div>
      <div className="text-[var(--text-dim)]">
        Refresh ratio (0DTE volume / 0DTE OI): <span className="font-semibold text-[var(--text)]">{freshness.refreshRatio.toFixed(2)}×</span>
      </div>
    </div>
  );
}

export function AssignmentRiskNote({ note }: { note: string }) {
  return <p className="m-0 font-mono text-[0.72rem] leading-relaxed text-[var(--text-faint)]">{note}</p>;
}

// ---------------------------------------------------------------------------
// Pillar 4: Key Structure
// ---------------------------------------------------------------------------

export function ThetaBalanceSheetCard({ sheet }: { sheet: ThetaBalanceSheet }) {
  return (
    <div className="grid grid-cols-2 gap-3 font-mono text-[0.78rem] sm:grid-cols-4">
      <div>
        Call theta <div className="font-semibold text-[var(--down)]">{fmtUsd(sheet.callTex)}</div>
      </div>
      <div>
        Put theta <div className="font-semibold text-[var(--down)]">{fmtUsd(sheet.putTex)}</div>
      </div>
      <div>
        Gross theta <div className="font-semibold text-[var(--text)]">{fmtUsd(sheet.grossTex)}</div>
      </div>
      <div>
        Net theta <div className="font-semibold text-[var(--down)]">{fmtUsd(sheet.netTex)}</div>
      </div>
      <div>
        Long-holder decay burden <div className="font-semibold text-[var(--down)]">{fmtUsd(sheet.longHolderBurdenNow)}</div>
      </div>
      <div>
        Estimated dealer carry <div className="font-semibold" style={{ color: sheet.dealerCarryNow >= 0 ? "var(--up)" : "var(--down)" }}>{fmtUsd(sheet.dealerCarryNow)}</div>
      </div>
      <div>
        Next 30-min burn <div className="font-semibold text-[var(--text)]">{fmtUsd(sheet.burn30m)}</div>
      </div>
      <div>
        Until-expiry burn <div className="font-semibold text-[var(--text)]">{fmtUsd(sheet.burnUntilExpiry)}</div>
      </div>
    </div>
  );
}

export function ThetaConcentrationRow({ stats }: { stats: ConcentrationStats }) {
  return (
    <div className="grid grid-cols-3 gap-3 font-mono text-[0.78rem]">
      <div>
        Theta HHI <div className="font-semibold text-[var(--text)]">{stats.hhi.toFixed(3)}</div>
      </div>
      <div>
        Theta entropy <div className="font-semibold text-[var(--text)]">{stats.entropy.toFixed(2)}</div>
      </div>
      <div>
        Effective strikes <div className="font-semibold text-[var(--text)]">{stats.effectiveStrikes.toFixed(1)}</div>
      </div>
    </div>
  );
}

export function MoneynessStructureChart({ rows }: { rows: MoneynessRow[] }) {
  const total = rows.reduce((s, r) => s + Math.abs(r.burn30m), 0) || 1;
  return (
    <div className="flex flex-col gap-2">
      {rows.map((r) => (
        <div key={r.bucket} className="flex items-center gap-3">
          <div className="w-24 shrink-0 font-mono text-[0.68rem] text-[var(--text-dim)]">{r.label}</div>
          <div className="h-3 flex-1 overflow-hidden rounded-[2px]" style={{ background: "var(--panel-2)" }}>
            <div className="h-full" style={{ width: `${(Math.abs(r.burn30m) / total) * 100}%`, background: "var(--down)" }} />
          </div>
          <div className="w-28 shrink-0 text-right font-mono text-[0.68rem] font-semibold text-[var(--text)]">
            {fmtUsd(r.burn30m)} ({((Math.abs(r.burn30m) / total) * 100).toFixed(0)}%)
          </div>
        </div>
      ))}
    </div>
  );
}

export function ThetaForwardClockTable({ snapshots }: { snapshots: ForwardClockSnapshot[] }) {
  return (
    <Table head={["When", "Burn rate/min", "Burn center", "Effective strikes"]}>
      {snapshots.map((s) => (
        <tr key={s.label} className="border-b border-[var(--border)] last:border-0">
          <td className="py-1.5 text-left font-semibold">{s.label}</td>
          <td className="py-1.5 pl-3 text-right text-[var(--text-dim)]">{fmtUsd(s.burnRatePerMin)}</td>
          <td className="py-1.5 pl-3 text-right text-[var(--text-dim)]">{s.burnCenter !== null ? fmtNum(s.burnCenter, 1) : "—"}</td>
          <td className="py-1.5 pl-3 text-right text-[var(--text-dim)]">{s.concentrationEffectiveStrikes.toFixed(1)}</td>
        </tr>
      ))}
    </Table>
  );
}

// ---------------------------------------------------------------------------
// Strike x expiry theta heatmap (from the source's own /theta grid)
// ---------------------------------------------------------------------------

function divergingColor(value: number, maxAbs: number): string {
  if (maxAbs <= 0) return "var(--panel-2)";
  const t = Math.max(-1, Math.min(1, value / maxAbs));
  const pct2 = Math.round(Math.pow(Math.abs(t), 0.55) * 90);
  const base = t >= 0 ? "var(--up)" : "var(--down)";
  return `color-mix(in srgb, ${base} ${pct2}%, var(--panel-2) ${100 - pct2}%)`;
}

export function ThetaStrikeExpiryHeatmap({ heatmap, spot }: { heatmap: ThetaHeatmap; spot: number }) {
  const strikes = [...new Set(heatmap.cells.map((c) => c.strike))].sort((a, b) => b - a);
  const maxAbs = Math.max(1e-6, ...heatmap.cells.map((c) => Math.abs(c.netTheta)));
  const byKey = new Map(heatmap.cells.map((c) => [`${c.strike}:${c.expiration}`, c]));
  const spotStrike = strikes.reduce((best, s) => (Math.abs(s - spot) < Math.abs(best - spot) ? s : best), strikes[0] ?? spot);

  return (
    <div className="overflow-x-auto">
      <div className="flex flex-col gap-px" style={{ minWidth: 640 }}>
        <div className="flex gap-px pl-16">
          {heatmap.expirations.map((exp) => (
            <div key={exp} className="flex-1 text-center font-mono text-[0.56rem] text-[var(--text-faint)]">
              {exp}
            </div>
          ))}
        </div>
        {strikes.map((strike) => (
          <div key={strike} className="flex items-stretch gap-px">
            <div
              className="flex w-16 shrink-0 items-center justify-end pr-2 font-mono text-[0.6rem]"
              style={{ color: strike === spotStrike ? "var(--text)" : "var(--text-faint)", fontWeight: strike === spotStrike ? 700 : 400 }}
            >
              {fmtNum(strike, 0)}
            </div>
            <div className="flex flex-1 gap-px">
              {heatmap.expirations.map((exp) => {
                const cell = byKey.get(`${strike}:${exp}`);
                return (
                  <div
                    key={exp}
                    title={`${fmtNum(strike, 0)} @ ${exp}: ${fmtUsd(cell?.netTheta ?? 0)}`}
                    className="h-5 flex-1"
                    style={{
                      background: divergingColor(cell?.netTheta ?? 0, maxAbs),
                      outline: strike === spotStrike ? "1px solid var(--text)" : undefined,
                      outlineOffset: -1,
                    }}
                  />
                );
              })}
            </div>
          </div>
        ))}
        <div className="mt-1 font-mono text-[0.6rem] text-[var(--text-faint)]">
          Source's own per-expiry theta grid (not this app's own repriced chain for other expiries) - outlined row = strike nearest spot
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Signature visualizations
// ---------------------------------------------------------------------------

function burnColor(value: number, maxAbs: number): string {
  if (maxAbs <= 0) return "var(--panel-2)";
  const t = Math.max(0, Math.min(1, value / maxAbs));
  const p = Math.round(Math.pow(t, 0.55) * 90);
  return `color-mix(in srgb, var(--down) ${p}%, var(--panel-2) ${100 - p}%)`;
}

export function BurnSurfaceChart({ grid, priceValues, minutesValues, spot }: { grid: BurnSurfacePoint[]; priceValues: number[]; minutesValues: number[]; spot: number }) {
  const maxAbs = Math.max(1e-6, ...grid.map((p) => Math.abs(p.grossBurn)));
  const byKey = new Map(grid.map((p) => [`${p.minutesAhead}:${p.price}`, p]));
  const spotIdx = priceValues.reduce((best, p, i) => (Math.abs(p - spot) < Math.abs(priceValues[best] - spot) ? i : best), 0);

  return (
    <div className="overflow-x-auto">
      <div className="flex flex-col gap-px" style={{ minWidth: 640 }}>
        {minutesValues.map((minutes, rowIdx) => (
          <div key={minutes} className="flex items-stretch gap-px">
            <div className="flex w-20 shrink-0 items-center justify-end pr-2 font-mono text-[0.6rem] text-[var(--text-faint)]">
              +{minutes.toFixed(0)}m{rowIdx === minutesValues.length - 1 ? " (close)" : ""}
            </div>
            <div className="flex flex-1 gap-px">
              {priceValues.map((price, i) => {
                const point = byKey.get(`${minutes}:${price}`);
                return (
                  <div
                    key={price}
                    title={`${fmtNum(price, 2)} @ +${minutes.toFixed(0)}m: ${fmtUsd(point?.grossBurn ?? 0)} burned`}
                    className="h-7 flex-1"
                    style={{ background: burnColor(point?.grossBurn ?? 0, maxAbs), outline: i === spotIdx ? "1px solid var(--text)" : undefined, outlineOffset: -1 }}
                  />
                );
              })}
            </div>
          </div>
        ))}
        <div className="flex gap-px pl-20">
          {priceValues.map((p, i) => (
            <div key={p} className="flex-1 text-center font-mono text-[0.56rem] text-[var(--text-faint)]" style={{ visibility: i % 3 === 0 ? "visible" : "hidden" }}>
              {fmtNum(p, 0)}
            </div>
          ))}
        </div>
        <div className="mt-1 font-mono text-[0.6rem] text-[var(--text-faint)]">
          Columns: hypothetical price · Rows: minutes forward from now · darker = more premium burned by that point · outlined column = spot
        </div>
      </div>
    </div>
  );
}

function survivalColor(value: number, maxAbs: number): string {
  if (maxAbs <= 0) return "var(--panel-2)";
  const t = Math.max(-1, Math.min(1, value / maxAbs));
  const p = Math.round(Math.pow(Math.abs(t), 0.55) * 90);
  const base = t >= 0 ? "var(--up)" : "var(--down)";
  return `color-mix(in srgb, ${base} ${p}%, var(--panel-2) ${100 - p}%)`;
}

export function SurvivalMapChart({ grid, priceValues, minutesValues, spot }: { grid: SurvivalPoint[]; priceValues: number[]; minutesValues: number[]; spot: number }) {
  const maxAbs = Math.max(1e-6, ...grid.map((p) => Math.abs(p.pnl)));
  const byKey = new Map(grid.map((p) => [`${p.minutesAhead}:${p.price}`, p]));
  const spotIdx = priceValues.reduce((best, p, i) => (Math.abs(p - spot) < Math.abs(priceValues[best] - spot) ? i : best), 0);

  return (
    <div className="overflow-x-auto">
      <div className="flex flex-col gap-px" style={{ minWidth: 640 }}>
        {minutesValues.map((minutes, rowIdx) => (
          <div key={minutes} className="flex items-stretch gap-px">
            <div className="flex w-20 shrink-0 items-center justify-end pr-2 font-mono text-[0.6rem] text-[var(--text-faint)]">
              +{minutes.toFixed(0)}m{rowIdx === minutesValues.length - 1 ? " (close)" : ""}
            </div>
            <div className="flex flex-1 gap-px">
              {priceValues.map((price, i) => {
                const point = byKey.get(`${minutes}:${price}`);
                return (
                  <div
                    key={price}
                    title={`${fmtNum(price, 2)} @ +${minutes.toFixed(0)}m: ${fmtUsd(point?.pnl ?? 0)} modeled long-premium P&L`}
                    className="h-7 flex-1"
                    style={{ background: survivalColor(point?.pnl ?? 0, maxAbs), outline: i === spotIdx ? "1px solid var(--text)" : undefined, outlineOffset: -1 }}
                  />
                );
              })}
            </div>
          </div>
        ))}
        <div className="flex gap-px pl-20">
          {priceValues.map((p, i) => (
            <div key={p} className="flex-1 text-center font-mono text-[0.56rem] text-[var(--text-faint)]" style={{ visibility: i % 3 === 0 ? "visible" : "hidden" }}>
              {fmtNum(p, 0)}
            </div>
          ))}
        </div>
        <div className="mt-1 font-mono text-[0.6rem] text-[var(--text-faint)]">
          Columns: hypothetical future price · Rows: minutes forward · green = modeled long-premium book gains (movement overcame decay), red = loses (decay dominates) · outlined column = spot
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Diagnostic strip
// ---------------------------------------------------------------------------

export function ThetaDiagnosticStrip({
  pricingModel,
  exactExpirationLabel,
  thetaUnit,
  staticIvAssumption,
  validContracts,
  dealerSignAssumption,
  oiFreshnessLabel,
  assignmentSettlementNote,
  lastCalculatedAt,
}: {
  pricingModel: string;
  exactExpirationLabel: string;
  thetaUnit: string;
  staticIvAssumption: string;
  validContracts: number;
  dealerSignAssumption: string;
  oiFreshnessLabel: string;
  assignmentSettlementNote: string;
  lastCalculatedAt: number;
}) {
  return (
    <div className="flex flex-col gap-1.5 border-t border-[var(--border)] pt-3 font-mono text-[0.62rem] text-[var(--text-faint)]">
      <div>Pricing model: {pricingModel}</div>
      <div>Exact time to expiration: {exactExpirationLabel}</div>
      <div>Theta unit: {thetaUnit}</div>
      <div>{staticIvAssumption}</div>
      <div className="flex flex-wrap gap-x-6">
        <span>Valid contracts: {validContracts}</span>
        <span>Dealer-sign assumption: {dealerSignAssumption}</span>
        <span>OI freshness: {oiFreshnessLabel}</span>
        <span>Last calculated: {new Date(lastCalculatedAt).toLocaleTimeString()}</span>
      </div>
      <div>{assignmentSettlementNote}</div>
    </div>
  );
}
