"use client";

import { fmtNum, fmtUsd } from "@/lib/gex";
import type {
  CascadeRisk,
  DealerInventoryUncertainty,
  ForwardClockSnapshot,
  GammaConsensus,
  GammaCliffRisk,
  ConfluenceResult,
  OiFreshness,
  PhaseClassification,
  PhaseMap,
  PinFailureRisk,
  StructureBalanceSheet,
  CenterOfGravity,
  SurfaceModelRisk,
  TypedLevel,
} from "@/lib/gammaEngine";

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
// Hero statement + pillar nav
// ---------------------------------------------------------------------------

const PHASE_COLOR: Record<PhaseClassification["phase"], string> = {
  pinned: "var(--up)",
  damped: "var(--up)",
  fragile_balance: "#d9a441",
  transition: "#d9a441",
  reflexive: "var(--down)",
  open_field: "var(--text-faint)",
};

export function HeroBanner({ heroStatement, phase }: { heroStatement: string; phase: PhaseClassification }) {
  const color = PHASE_COLOR[phase.phase];
  return (
    <div className="flex flex-col gap-2 border p-5" style={{ borderColor: color, background: `color-mix(in srgb, ${color} 6%, var(--panel) 94%)` }}>
      <div className="font-mono text-[0.6rem] uppercase tracking-[0.08em] text-[var(--text-faint)]">Gamma decision engine · plain-English summary</div>
      <p className="m-0 font-sans text-[0.95rem] font-medium leading-relaxed text-[var(--text)]">{heroStatement}</p>
    </div>
  );
}

export type PillarId = "regime" | "levels" | "risks" | "structure";

const PILLAR_LABEL: Record<PillarId, string> = {
  regime: "GAMMA REGIME",
  levels: "KEY LEVELS",
  risks: "KEY RISKS",
  structure: "KEY STRUCTURE",
};

export function PillarNav({ active, onChange }: { active: PillarId; onChange: (p: PillarId) => void }) {
  const order: PillarId[] = ["regime", "levels", "risks", "structure"];
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

export function PillarSummaryCards({
  active,
  onChange,
  phase,
  consensus,
  nearestLevel,
  confluence,
  cliffRisk,
  cascadeRisks,
  oiFreshness,
  inventoryUncertainty,
  zeroDteControlPct,
  concentrationEffectiveStrikes,
  cancellationRatio,
}: {
  active: PillarId;
  onChange: (p: PillarId) => void;
  phase: PhaseClassification;
  consensus: GammaConsensus;
  nearestLevel: TypedLevel | null;
  confluence: ConfluenceResult;
  cliffRisk: GammaCliffRisk;
  cascadeRisks: CascadeRisk[];
  oiFreshness: OiFreshness;
  inventoryUncertainty: DealerInventoryUncertainty;
  zeroDteControlPct: number | null;
  concentrationEffectiveStrikes: number;
  cancellationRatio: number;
}) {
  const worstCascade = [...cascadeRisks].sort((a, b) => (b.cascadeImpactRatio ?? 0) - (a.cascadeImpactRatio ?? 0))[0] ?? null;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <SummaryCard
        title="GAMMA REGIME"
        active={active === "regime"}
        onClick={() => onChange("regime")}
        rows={[
          { label: "Phase", value: phase.label, tone: phase.phase === "reflexive" ? "down" : phase.phase === "pinned" || phase.phase === "damped" ? "up" : "neutral" },
          { label: "Consensus GEX", value: fmtUsd(consensus.consensusGex), tone: consensus.consensusGex >= 0 ? "up" : "down" },
          { label: "Impact ratio", value: phase.impactRatio !== null ? `${(phase.impactRatio * 100).toFixed(0)}%` : "—" },
          { label: "Model agreement", value: `${consensus.signAgreementPct.toFixed(0)}%` },
        ]}
      />
      <SummaryCard
        title="KEY LEVEL"
        active={active === "levels"}
        onClick={() => onChange("levels")}
        rows={[
          { label: "Nearest range", value: nearestLevel ? `${fmtNum(nearestLevel.low, 1)}–${fmtNum(nearestLevel.high, 1)}` : "—" },
          { label: "Type", value: nearestLevel ? nearestLevel.label : "—" },
          { label: "Score", value: nearestLevel ? nearestLevel.score.toFixed(0) : "—" },
          { label: "Cross-expiry confluence", value: confluence.nextExpiry ? `${Math.max(confluence.callConfluence, confluence.putConfluence).toFixed(0)}%` : "—" },
        ]}
      />
      <SummaryCard
        title="KEY RISK"
        active={active === "risks"}
        onClick={() => onChange("risks")}
        rows={[
          { label: "Nearest cliff", value: cliffRisk.price !== null ? fmtNum(cliffRisk.price, 1) : "—" },
          { label: "Cascade direction", value: worstCascade ? worstCascade.direction : "—", tone: worstCascade?.direction === "downside" ? "down" : worstCascade?.direction === "upside" ? "up" : "neutral" },
          { label: "OI freshness risk", value: oiFreshness.level },
          { label: "Inventory uncertainty", value: `${(inventoryUncertainty.uncertainty * 100).toFixed(0)}%` },
        ]}
      />
      <SummaryCard
        title="KEY STRUCTURE"
        active={active === "structure"}
        onClick={() => onChange("structure")}
        rows={[
          { label: "0DTE control", value: zeroDteControlPct !== null ? `${zeroDteControlPct.toFixed(0)}%` : "—" },
          { label: "Concentration", value: `${concentrationEffectiveStrikes.toFixed(1)} strikes` },
          { label: "Cancellation", value: `${(cancellationRatio * 100).toFixed(0)}%` },
          { label: "Center of gravity", value: "see tab" },
        ]}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pillar 1: Gamma Regime
// ---------------------------------------------------------------------------

function phaseMapColor(netGex: number, maxAbs: number, agreementPct: number): string {
  if (maxAbs <= 0) return "var(--panel-2)";
  const t = Math.max(-1, Math.min(1, netGex / maxAbs));
  const pct = Math.round(Math.pow(Math.abs(t), 0.55) * 90 * (agreementPct / 100));
  const base = t >= 0 ? "var(--up)" : "var(--down)";
  return `color-mix(in srgb, ${base} ${pct}%, var(--panel-2) ${100 - pct}%)`;
}

export function PhaseMapChart({ phaseMap, spot }: { phaseMap: PhaseMap; spot: number }) {
  const { grid, priceValues, minutesValues } = phaseMap;
  const maxAbs = Math.max(1e-6, ...grid.map((p) => Math.abs(p.netGex)));
  const byKey = new Map(grid.map((p) => [`${p.minutesToExpiry}:${p.price}`, p]));
  const spotIdx = priceValues.reduce((best, p, i) => (Math.abs(p - spot) < Math.abs(priceValues[best] - spot) ? i : best), 0);

  return (
    <div className="overflow-x-auto">
      <div className="flex flex-col gap-px" style={{ minWidth: 640 }}>
        {minutesValues.map((minutes, rowIdx) => (
          <div key={minutes} className="flex items-stretch gap-px">
            <div className="flex w-20 shrink-0 items-center justify-end pr-2 font-mono text-[0.6rem] text-[var(--text-faint)]">
              {minutes.toFixed(0)}m{rowIdx === 0 ? " (now)" : rowIdx === minutesValues.length - 1 ? " (close)" : ""}
            </div>
            <div className="flex flex-1 gap-px">
              {priceValues.map((price, i) => {
                const point = byKey.get(`${minutes}:${price}`);
                return (
                  <div
                    key={price}
                    title={`${fmtNum(price, 2)} @ ${minutes.toFixed(0)}m to expiry: ${fmtUsd(point?.netGex ?? 0)} (agreement ${point?.agreementPct ?? 0}%)`}
                    className="h-7 flex-1"
                    style={{
                      background: phaseMapColor(point?.netGex ?? 0, maxAbs, point?.agreementPct ?? 100),
                      outline: i === spotIdx ? "1px solid var(--text)" : undefined,
                      outlineOffset: -1,
                    }}
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
          Columns: hypothetical price · Rows: minutes to expiry, top (now) to bottom (close) · outlined column = spot · opacity = 2-scenario dealer-sign agreement
        </div>
      </div>
    </div>
  );
}

export function ConsensusTable({ consensus }: { consensus: GammaConsensus }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 font-mono text-[0.78rem]">
        <div>
          Consensus GEX: <span className="font-semibold" style={{ color: consensus.consensusGex >= 0 ? "var(--up)" : "var(--down)" }}>{fmtUsd(consensus.consensusGex)}</span>
        </div>
        <div>
          Dispersion: <span className="font-semibold">{fmtUsd(consensus.dispersion)}</span>
        </div>
        <div>
          Sign agreement: <span className="font-semibold">{consensus.signAgreementPct.toFixed(0)}%</span>
        </div>
      </div>
      <div>
        <div className="mb-1.5 font-mono text-[0.62rem] uppercase tracking-[0.06em] text-[var(--text-faint)]">Pricing models</div>
        <Table head={["Model", "Net GEX"]}>
          {consensus.models.map((m) => (
            <tr key={m.name} className="border-b border-[var(--border)] last:border-0">
              <td className="py-1.5 text-left text-[var(--text-dim)]">{m.label}</td>
              <td className={`py-1.5 pl-3 text-right font-semibold ${m.netGex >= 0 ? "text-[var(--up)]" : "text-[var(--down)]"}`}>{fmtUsd(m.netGex)}</td>
            </tr>
          ))}
        </Table>
      </div>
      <div>
        <div className="mb-1.5 font-mono text-[0.62rem] uppercase tracking-[0.06em] text-[var(--text-faint)]">Dealer-sign scenarios</div>
        <Table head={["Scenario", "Net GEX"]}>
          {consensus.dealerSignScenarios.map((s) => (
            <tr key={s.name} className="border-b border-[var(--border)] last:border-0">
              <td className="py-1.5 text-left text-[var(--text-dim)]">{s.label}</td>
              <td className={`py-1.5 pl-3 text-right font-semibold ${s.netGex >= 0 ? "text-[var(--up)]" : "text-[var(--down)]"}`}>{fmtUsd(s.netGex)}</td>
            </tr>
          ))}
        </Table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pillar 2: Key Levels
// ---------------------------------------------------------------------------

const LEVEL_TYPE_COLOR: Record<TypedLevel["type"], string> = {
  pin_basin: "var(--accent)",
  friction_wall: "var(--up)",
  launch_edge: "#d9a441",
  vacuum_gate: "var(--text-faint)",
};

export function TypedLevelLadder({ levels }: { levels: TypedLevel[] }) {
  if (!levels.length) return <p className="m-0 font-mono text-[0.75rem] text-[var(--text-faint)]">No typed levels cleared the scoring threshold this request.</p>;
  return (
    <Table head={["Level", "Type", "Score", "If held", "If crossed"]}>
      {levels.map((l, i) => (
        <tr key={i} className="border-b border-[var(--border)] last:border-0" style={{ borderLeft: `3px solid ${LEVEL_TYPE_COLOR[l.type]}` }}>
          <td className="py-1.5 pl-2 text-left font-semibold">
            {fmtNum(l.low, 1)}–{fmtNum(l.high, 1)}
          </td>
          <td className="py-1.5 pl-3 text-right uppercase" style={{ color: LEVEL_TYPE_COLOR[l.type] }}>
            {l.label}
          </td>
          <td className="py-1.5 pl-3 text-right font-semibold">{l.score.toFixed(0)}</td>
          <td className="py-1.5 pl-3 text-right text-[var(--text-dim)]">{l.ifHeld}</td>
          <td className="py-1.5 pl-3 text-right text-[var(--text-dim)]">{l.ifCrossed}</td>
        </tr>
      ))}
    </Table>
  );
}

const CONFLUENCE_LABEL: Record<ConfluenceResult["classification"], string> = {
  reinforcing: "Reinforcing confluence",
  opposing: "Opposing/cancelling confluence",
  zero_dte_only: "0DTE-only concentration",
  weekly_only: "Weekly-only concentration",
  unavailable: "Unavailable",
};
const CONFLUENCE_COLOR: Record<ConfluenceResult["classification"], string> = {
  reinforcing: "var(--up)",
  opposing: "var(--down)",
  zero_dte_only: "var(--text-dim)",
  weekly_only: "#d9a441",
  unavailable: "var(--text-faint)",
};

export function ConfluenceCard({ confluence }: { confluence: ConfluenceResult }) {
  if (!confluence.nextExpiry) {
    return <p className="m-0 font-mono text-[0.75rem] text-[var(--text-faint)]">No dte&gt;0 row available this request (upstream option-matrix is best-effort and can time out).</p>;
  }
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 font-mono text-[0.78rem]">
        <div>
          Next dominant expiry: <span className="font-semibold">{confluence.nextExpiry.expiration}</span>{" "}
          <span className="text-[var(--text-dim)]">
            ({confluence.nextExpiry.dte} DTE, {fmtNum(confluence.nextExpiry.totalOi, 0)} OI)
          </span>
        </div>
        <div className="font-semibold uppercase tracking-[0.04em]" style={{ color: CONFLUENCE_COLOR[confluence.classification] }}>
          {CONFLUENCE_LABEL[confluence.classification]}
        </div>
      </div>
      <div className="flex gap-6 font-mono text-[0.72rem] text-[var(--text-dim)]">
        <div>
          Call-side confluence: <span className="font-semibold text-[var(--text)]">{confluence.callConfluence.toFixed(0)}%</span>
        </div>
        <div>
          Put-side confluence: <span className="font-semibold text-[var(--text)]">{confluence.putConfluence.toFixed(0)}%</span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pillar 3: Key Risks
// ---------------------------------------------------------------------------

export function CliffRiskCard({ cliffRisk }: { cliffRisk: GammaCliffRisk }) {
  if (cliffRisk.price === null) return <p className="m-0 font-mono text-[0.75rem] text-[var(--text-faint)]">No meaningful cliff detected this request.</p>;
  return (
    <div className="flex flex-col gap-1.5 font-mono text-[0.78rem]">
      <div>
        Nearest gamma cliff: <span className="font-semibold" style={{ color: "#d9a441" }}>{fmtNum(cliffRisk.price, 2)}</span>
      </div>
      <div>
        Distance: <span className="font-semibold">{cliffRisk.distancePct?.toFixed(2)}%</span>
      </div>
      <div className="text-[var(--text-dim)]">
        Regime density either side: {fmtUsd(cliffRisk.regimeChangeLow)} → {fmtUsd(cliffRisk.regimeChangeHigh)}
      </div>
    </div>
  );
}

export function CascadeRiskCards({ risks }: { risks: CascadeRisk[] }) {
  if (!risks.length) return <p className="m-0 font-mono text-[0.75rem] text-[var(--text-faint)]">No launch edge detected on either side this request.</p>;
  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      {risks.map((c) => (
        <div key={c.direction} className="flex-1 border p-4" style={{ borderColor: c.direction === "downside" ? "var(--down)" : "var(--up)" }}>
          <div className="flex items-center justify-between">
            <div className="font-mono text-[0.62rem] uppercase tracking-[0.06em] text-[var(--text-faint)]">{c.direction} cascade risk</div>
            <RiskPill level={c.riskLevel} />
          </div>
          <div className="mt-1 font-mono text-[0.9rem] font-semibold">
            Trigger: {fmtNum(c.triggerLow, 1)}–{fmtNum(c.triggerHigh, 1)}
          </div>
          <div className="mt-1 font-mono text-[0.72rem] text-[var(--text-dim)]">Next ridge: {fmtNum(c.nextRidge, 1)}</div>
          <div className="mt-1 font-mono text-[0.72rem] text-[var(--text-dim)]">
            Hedge requirement to next ridge: {c.cascadeImpactRatio !== null ? `${(c.cascadeImpactRatio * 100).toFixed(0)}% of recent 5-min volume` : "volume data unavailable"}
          </div>
        </div>
      ))}
    </div>
  );
}

export function OiFreshnessCard({ freshness }: { freshness: OiFreshness }) {
  return (
    <div className="flex flex-col gap-1.5 font-mono text-[0.78rem]">
      <div className="flex items-center gap-2">
        <span>OI freshness risk:</span>
        <RiskPill level={freshness.level === "high" ? "high" : freshness.level === "moderate" ? "moderate" : "low"} />
      </div>
      <div className="text-[var(--text-dim)]">
        Refresh ratio (0DTE volume / 0DTE OI): <span className="font-semibold text-[var(--text)]">{freshness.refreshRatio.toFixed(2)}×</span>
      </div>
      <p className="m-0 font-sans text-[0.68rem] text-[var(--text-faint)]">
        High turnover means today&apos;s open-interest map may poorly represent current intraday positioning - a confidence penalty, not a correction applied to the numbers.
      </p>
    </div>
  );
}

export function InventoryUncertaintyCard({ uncertainty }: { uncertainty: DealerInventoryUncertainty }) {
  return (
    <div className="flex flex-col gap-1.5 font-mono text-[0.78rem]">
      <div>
        Inventory uncertainty: <span className="font-semibold">{(uncertainty.uncertainty * 100).toFixed(0)}%</span>
      </div>
      <div className="text-[var(--text-dim)]">
        {uncertainty.positiveScenarios} of {uncertainty.totalScenarios} dealer-sign scenarios positive, {uncertainty.negativeScenarios} negative.
      </div>
    </div>
  );
}

export function SurfaceModelRiskCard({ risk }: { risk: SurfaceModelRisk }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 font-mono text-[0.78rem]">
        <span>Model dispersion:</span>
        <RiskPill level={risk.dispersionLabel} />
        <span className="text-[var(--text-faint)]">at {fmtNum(risk.evalPrice, 2)} (today&apos;s upside expected-move edge)</span>
      </div>
      <Table head={["Model", "Net GEX"]}>
        {risk.models.map((m) => (
          <tr key={m.name} className="border-b border-[var(--border)] last:border-0">
            <td className="py-1.5 text-left text-[var(--text-dim)]">{m.label}</td>
            <td className={`py-1.5 pl-3 text-right font-semibold ${m.netGex >= 0 ? "text-[var(--up)]" : "text-[var(--down)]"}`}>{fmtUsd(m.netGex)}</td>
          </tr>
        ))}
      </Table>
    </div>
  );
}

export function PinFailureRiskList({ risks }: { risks: PinFailureRisk[] }) {
  if (!risks.length) return <p className="m-0 font-mono text-[0.75rem] text-[var(--text-faint)]">No pin basin detected this request to test.</p>;
  return (
    <Table head={["Basin center", "Fragility"]}>
      {risks.map((p, i) => (
        <tr key={i} className="border-b border-[var(--border)] last:border-0">
          <td className="py-1.5 text-left font-semibold">{fmtNum(p.center, 1)}</td>
          <td className="py-1.5 pl-3 text-right font-semibold" style={{ color: p.fragility > 0.5 ? "var(--down)" : p.fragility > 0.25 ? "#d9a441" : "var(--up)" }}>
            {(p.fragility * 100).toFixed(0)}%
          </td>
        </tr>
      ))}
    </Table>
  );
}

// ---------------------------------------------------------------------------
// Pillar 4: Key Structure
// ---------------------------------------------------------------------------

export function BalanceSheetCard({ sheet }: { sheet: StructureBalanceSheet }) {
  return (
    <div className="grid grid-cols-2 gap-3 font-mono text-[0.78rem] sm:grid-cols-4">
      <div>
        Gross positive <div className="font-semibold text-[var(--up)]">{fmtUsd(sheet.grossPositive)}</div>
      </div>
      <div>
        Gross negative <div className="font-semibold text-[var(--down)]">{fmtUsd(sheet.grossNegative)}</div>
      </div>
      <div>
        Gamma gross <div className="font-semibold text-[var(--text)]">{fmtUsd(sheet.gammaGross)}</div>
      </div>
      <div>
        Gamma net <div className="font-semibold" style={{ color: sheet.gammaNet >= 0 ? "var(--up)" : "var(--down)" }}>{fmtUsd(sheet.gammaNet)}</div>
      </div>
      <div className="col-span-2 sm:col-span-4">
        Cancellation ratio <span className="font-semibold text-[var(--text)]">{(sheet.cancellationRatio * 100).toFixed(0)}%</span>
        <span className="ml-2 text-[var(--text-faint)]">
          {sheet.cancellationRatio > 0.7 ? "— high: large opposing exposures, structurally fragile even if net looks quiet" : ""}
        </span>
      </div>
    </div>
  );
}

export function CenterOfGravityCard({ cog }: { cog: CenterOfGravity }) {
  return (
    <div className="flex flex-col gap-1.5 font-mono text-[0.78rem]">
      <div>
        Gamma center of gravity: <span className="font-semibold">{fmtNum(cog.strike, 1)}</span>
      </div>
      <div className="text-[var(--text-dim)]">
        {cog.side === "at" ? "At spot" : `${fmtNum(Math.abs(cog.distanceFromSpot), 2)} points ${cog.side} spot`}
        {cog.distanceInEmUnits !== null ? ` (${cog.distanceInEmUnits.toFixed(2)}× today's expected move)` : ""}
      </div>
    </div>
  );
}

export function ForwardClockTable({ snapshots }: { snapshots: ForwardClockSnapshot[] }) {
  return (
    <Table head={["When", "Gamma flip", "Pin basin center", "Nearest cliff", "Effective strikes"]}>
      {snapshots.map((s) => (
        <tr key={s.label} className="border-b border-[var(--border)] last:border-0">
          <td className="py-1.5 text-left font-semibold">{s.label}</td>
          <td className="py-1.5 pl-3 text-right text-[var(--text-dim)]">{fmtNum(s.gammaFlip, 2)}</td>
          <td className="py-1.5 pl-3 text-right text-[var(--text-dim)]">{fmtNum(s.pinBasinCenter, 0)}</td>
          <td className="py-1.5 pl-3 text-right text-[var(--text-dim)]">{fmtNum(s.nearestCliff, 0)}</td>
          <td className="py-1.5 pl-3 text-right text-[var(--text-dim)]">{s.effectiveStrikes.toFixed(1)}</td>
        </tr>
      ))}
    </Table>
  );
}

// ---------------------------------------------------------------------------
// Diagnostic strip
// ---------------------------------------------------------------------------

export function DiagnosticStrip({
  pricingEngine,
  ivSurfaceFitError,
  validContracts,
  dealerSignAssumption,
  modelDispersionLabel,
  oiFreshnessLabel,
  lastCalculatedAt,
}: {
  pricingEngine: string;
  ivSurfaceFitError: number;
  validContracts: number;
  dealerSignAssumption: string;
  modelDispersionLabel: string;
  oiFreshnessLabel: string;
  lastCalculatedAt: number;
}) {
  return (
    <div className="flex flex-col gap-1.5 border-t border-[var(--border)] pt-3 font-mono text-[0.62rem] text-[var(--text-faint)]">
      <div>Pricing engine: {pricingEngine}</div>
      <div className="flex flex-wrap gap-x-6">
        <span>IV-surface fit error (RMS): {ivSurfaceFitError.toFixed(4)}</span>
        <span>Valid contracts: {validContracts}</span>
        <span>Dealer-sign assumption: {dealerSignAssumption}</span>
        <span>Model dispersion: {modelDispersionLabel}</span>
        <span>OI freshness: {oiFreshnessLabel}</span>
        <span>Last calculated: {new Date(lastCalculatedAt).toLocaleTimeString()}</span>
      </div>
    </div>
  );
}
