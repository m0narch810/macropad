"use client";

import { fmtNum, fmtUsd } from "@/lib/gex";
import type {
  AsymmetryStats,
  CenterOfInventory,
  ConcentrationStats,
  DealerInventoryUncertainty,
  DeltaBalanceSheet,
  DeltaConfluence,
  DeltaConsensus,
  DeltaNeutralBand,
  DeltaShelf,
  ExpiryDexStack,
  GapRiskRow,
  HedgeCrowdingRisk,
  HedgeRotationZone,
  MoneynessRow,
  OiFreshnessRisk,
  PhaseClassification,
  RehedgeSurfacePoint,
  RehedgeTrigger,
  UnwindScenario,
} from "@/lib/deltaEngine";

function fmtShares(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(2)}M sh`;
  if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(0)}K sh`;
  return `${sign}${Math.round(abs)} sh`;
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

const PHASE_COLOR: Record<PhaseClassification["phase"], string> = {
  hedge_long: "var(--up)",
  hedge_short: "var(--down)",
  balanced: "var(--text-faint)",
  fragile_neutral: "#d9a441",
  crowded_hedge_long: "var(--up)",
  crowded_hedge_short: "var(--down)",
};

export function DeltaHeroBanner({ heroStatement, phase }: { heroStatement: string; phase: PhaseClassification }) {
  const color = PHASE_COLOR[phase.phase];
  return (
    <div className="flex flex-col gap-2 border p-5" style={{ borderColor: color, background: `color-mix(in srgb, ${color} 6%, var(--panel) 94%)` }}>
      <div className="font-mono text-[0.6rem] uppercase tracking-[0.08em] text-[var(--text-faint)]">Delta decision engine · plain-English summary</div>
      <p className="m-0 font-sans text-[0.95rem] font-medium leading-relaxed text-[var(--text)]">{heroStatement}</p>
    </div>
  );
}

export type DeltaPillarId = "regime" | "levels" | "risks" | "structure";

const PILLAR_LABEL: Record<DeltaPillarId, string> = {
  regime: "DELTA REGIME",
  levels: "KEY LEVELS",
  risks: "KEY RISKS",
  structure: "KEY STRUCTURE",
};

export function DeltaPillarNav({ active, onChange }: { active: DeltaPillarId; onChange: (p: DeltaPillarId) => void }) {
  const order: DeltaPillarId[] = ["regime", "levels", "risks", "structure"];
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

export function DeltaPillarSummaryCards({
  active,
  onChange,
  phase,
  consensus,
  balanceSheet,
  inventoryPivot,
  nearestShelf,
  nearestTrigger,
  confluence,
  worstUnwind,
  gapRisk,
  oiFreshness,
  hedgeCrowding,
  concentrationEffectiveStrikes,
}: {
  active: DeltaPillarId;
  onChange: (p: DeltaPillarId) => void;
  phase: PhaseClassification;
  consensus: DeltaConsensus;
  balanceSheet: DeltaBalanceSheet;
  inventoryPivot: number | null;
  nearestShelf: DeltaShelf | null;
  nearestTrigger: RehedgeTrigger | null;
  confluence: DeltaConfluence;
  worstUnwind: UnwindScenario | null;
  gapRisk: GapRiskRow[];
  oiFreshness: OiFreshnessRisk;
  hedgeCrowding: HedgeCrowdingRisk;
  concentrationEffectiveStrikes: number;
}) {
  const worstGap = [...gapRisk].sort((a, b) => (b.impactRatio ?? 0) - (a.impactRatio ?? 0))[0] ?? null;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <SummaryCard
        title="DELTA REGIME"
        active={active === "regime"}
        onClick={() => onChange("regime")}
        rows={[
          { label: "Phase", value: phase.label, tone: phase.phase.includes("long") ? "up" : phase.phase.includes("short") ? "down" : "neutral" },
          { label: "Net DEX", value: fmtShares(balanceSheet.netDex), tone: balanceSheet.netDex >= 0 ? "up" : "down" },
          { label: "Theoretical hedge", value: fmtShares(balanceSheet.theoreticalHedge), tone: balanceSheet.theoreticalHedge >= 0 ? "up" : "down" },
          { label: "Sign agreement", value: `${consensus.signAgreementPct.toFixed(0)}%` },
        ]}
      />
      <SummaryCard
        title="KEY LEVEL"
        active={active === "levels"}
        onClick={() => onChange("levels")}
        rows={[
          { label: "Inventory pivot", value: inventoryPivot !== null ? fmtNum(inventoryPivot, 1) : "—" },
          { label: "Nearest shelf", value: nearestShelf ? `${fmtNum(nearestShelf.low, 0)}–${fmtNum(nearestShelf.high, 0)}` : "—" },
          { label: "Nearest rehedge trigger", value: nearestTrigger ? fmtNum(nearestTrigger.price, 1) : "—" },
          { label: "Cross-expiry alignment", value: confluence.nextExpiry ? `${confluence.alignmentPct.toFixed(0)}%` : "—" },
        ]}
      />
      <SummaryCard
        title="KEY RISK"
        active={active === "risks"}
        onClick={() => onChange("risks")}
        rows={[
          { label: "Largest unwind", value: worstUnwind ? worstUnwind.label : "—", tone: worstUnwind?.riskLevel === "extreme" || worstUnwind?.riskLevel === "high" ? "down" : "neutral" },
          { label: "Gap rehedge risk", value: worstGap ? `${worstGap.gapPct.toFixed(2)}% ${worstGap.direction}` : "—" },
          { label: "OI freshness risk", value: oiFreshness.level },
          { label: "Hedge crowding", value: hedgeCrowding.label },
        ]}
      />
      <SummaryCard
        title="KEY STRUCTURE"
        active={active === "structure"}
        onClick={() => onChange("structure")}
        rows={[
          { label: "Gross DEX", value: fmtShares(balanceSheet.grossDex) },
          { label: "Cancellation", value: `${(balanceSheet.cancellationRatio * 100).toFixed(0)}%` },
          { label: "Concentration", value: `${concentrationEffectiveStrikes.toFixed(1)} strikes` },
          { label: "0DTE control", value: "see tab" },
        ]}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pillar 1: Delta Regime
// ---------------------------------------------------------------------------

export function DeltaConsensusTable({ consensus }: { consensus: DeltaConsensus }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 font-mono text-[0.78rem]">
        <div>
          Consensus DEX: <span className="font-semibold" style={{ color: consensus.consensusDex >= 0 ? "var(--up)" : "var(--down)" }}>{fmtShares(consensus.consensusDex)}</span>
        </div>
        <div>
          Dispersion: <span className="font-semibold">{fmtShares(consensus.dispersion)}</span>
        </div>
        <div>
          Sign agreement: <span className="font-semibold">{consensus.signAgreementPct.toFixed(0)}%</span>
        </div>
      </div>
      <div>
        <div className="mb-1.5 font-mono text-[0.62rem] uppercase tracking-[0.06em] text-[var(--text-faint)]">Delta views</div>
        <Table head={["Model", "Net DEX"]}>
          {consensus.models.map((m) => (
            <tr key={m.name} className="border-b border-[var(--border)] last:border-0">
              <td className="py-1.5 text-left text-[var(--text-dim)]">{m.label}</td>
              <td className={`py-1.5 pl-3 text-right font-semibold ${m.netDex >= 0 ? "text-[var(--up)]" : "text-[var(--down)]"}`}>{fmtShares(m.netDex)}</td>
            </tr>
          ))}
        </Table>
      </div>
      <div>
        <div className="mb-1.5 font-mono text-[0.62rem] uppercase tracking-[0.06em] text-[var(--text-faint)]">Dealer-sign scenarios</div>
        <Table head={["Scenario", "Net DEX"]}>
          {consensus.dealerSignScenarios.map((s) => (
            <tr key={s.name} className="border-b border-[var(--border)] last:border-0">
              <td className="py-1.5 text-left text-[var(--text-dim)]">{s.label}</td>
              <td className={`py-1.5 pl-3 text-right font-semibold ${s.netDex >= 0 ? "text-[var(--up)]" : "text-[var(--down)]"}`}>{fmtShares(s.netDex)}</td>
            </tr>
          ))}
        </Table>
      </div>
    </div>
  );
}

export function OptionBookVsHedgeCard({ balanceSheet }: { balanceSheet: DeltaBalanceSheet }) {
  return (
    <div className="grid grid-cols-2 gap-4 font-mono text-[0.85rem]">
      <div>
        <div className="text-[0.62rem] uppercase tracking-[0.06em] text-[var(--text-faint)]">Option-book delta</div>
        <div className="mt-1 font-semibold" style={{ color: balanceSheet.netDex >= 0 ? "var(--up)" : "var(--down)" }}>
          {balanceSheet.netDex >= 0 ? "+" : ""}
          {fmtShares(balanceSheet.netDex)}
        </div>
      </div>
      <div>
        <div className="text-[0.62rem] uppercase tracking-[0.06em] text-[var(--text-faint)]">Theoretical hedge position</div>
        <div className="mt-1 font-semibold" style={{ color: balanceSheet.theoreticalHedge >= 0 ? "var(--up)" : "var(--down)" }}>
          {balanceSheet.theoreticalHedge >= 0 ? "+" : ""}
          {fmtShares(balanceSheet.theoreticalHedge)}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pillar 2: Key Levels
// ---------------------------------------------------------------------------

export function DeltaNeutralBandCard({ band }: { band: DeltaNeutralBand }) {
  if (band.center === null) return <p className="m-0 font-mono text-[0.75rem] text-[var(--text-faint)]">No zero-crossing found this request.</p>;
  return (
    <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 font-mono text-[0.78rem]">
      <div>
        Delta neutral center: <span className="font-semibold text-[var(--accent)]">{fmtNum(band.center, 2)}</span>
      </div>
      <div>
        Scenario range: <span className="font-semibold">{fmtNum(band.low, 2)}–{fmtNum(band.high, 2)}</span>
      </div>
      <div>
        Model agreement: <span className="font-semibold">{band.signAgreementPct.toFixed(0)}%</span>
      </div>
    </div>
  );
}

const SHELF_COLOR: Record<DeltaShelf["side"], string> = { positive: "var(--up)", negative: "var(--down)" };

export function DeltaShelfTable({ shelves }: { shelves: DeltaShelf[] }) {
  if (!shelves.length) return <p className="m-0 font-mono text-[0.75rem] text-[var(--text-faint)]">No shelf cleared the 3% share threshold this request.</p>;
  return (
    <Table head={["Region", "Inventory type", "Share of gross DEX", "Width"]}>
      {shelves.map((s, i) => (
        <tr key={i} className="border-b border-[var(--border)] last:border-0" style={{ borderLeft: `3px solid ${SHELF_COLOR[s.side]}` }}>
          <td className="py-1.5 pl-2 text-left font-semibold">
            {fmtNum(s.low, 0)}–{fmtNum(s.high, 0)}
          </td>
          <td className="py-1.5 pl-3 text-right" style={{ color: SHELF_COLOR[s.side] }}>
            {s.side === "positive" ? "Positive option delta" : "Negative option delta"}
          </td>
          <td className="py-1.5 pl-3 text-right font-semibold">{s.sharePct.toFixed(0)}%</td>
          <td className="py-1.5 pl-3 text-right text-[var(--text-dim)]">{s.widthPoints} pts</td>
        </tr>
      ))}
    </Table>
  );
}

export function RehedgeTriggerTable({ triggers }: { triggers: RehedgeTrigger[] }) {
  if (!triggers.length) return <p className="m-0 font-mono text-[0.75rem] text-[var(--text-faint)]">No price in the scan grid crosses the 25% liquidity threshold this request.</p>;
  return (
    <Table head={["Direction", "Price", "Additional hedge", "Impact ratio"]}>
      {triggers.map((t) => (
        <tr key={t.direction} className="border-b border-[var(--border)] last:border-0">
          <td className="py-1.5 text-left font-semibold uppercase" style={{ color: t.direction === "upside" ? "var(--up)" : "var(--down)" }}>
            {t.direction}
          </td>
          <td className="py-1.5 pl-3 text-right font-semibold">{fmtNum(t.price, 2)}</td>
          <td className="py-1.5 pl-3 text-right text-[var(--text-dim)]">{fmtShares(t.hedgeChangeShares)}</td>
          <td className="py-1.5 pl-3 text-right font-semibold">{t.impactRatio !== null ? `${(t.impactRatio * 100).toFixed(0)}%` : "—"}</td>
        </tr>
      ))}
    </Table>
  );
}

export function HedgeRotationZoneCard({ zone }: { zone: HedgeRotationZone }) {
  if (zone.low === null) return <p className="m-0 font-mono text-[0.75rem] text-[var(--text-faint)]">No rotation zone found at this grid resolution this request.</p>;
  return (
    <div className="flex flex-col gap-1.5 font-mono text-[0.78rem]">
      <div>
        Hedge rotation zone: <span className="font-semibold text-[var(--accent)]">{fmtNum(zone.low, 2)}–{fmtNum(zone.high, 2)}</span>
      </div>
      <div className="text-[var(--text-dim)]">
        Below zone: <span className="font-semibold text-[var(--text)]">{zone.belowPosture}</span> posture · Above zone: <span className="font-semibold text-[var(--text)]">{zone.abovePosture}</span> posture
      </div>
    </div>
  );
}

const CONFLUENCE_LABEL: Record<DeltaConfluence["classification"], string> = {
  reinforcing: "Reinforcing delta shelf",
  cancelling: "Cancelling delta shelf",
  zero_dte_only: "0DTE-only inventory",
  next_expiry_only: "Next-expiry inventory",
  unavailable: "Unavailable",
};
const CONFLUENCE_COLOR: Record<DeltaConfluence["classification"], string> = {
  reinforcing: "var(--up)",
  cancelling: "var(--down)",
  zero_dte_only: "var(--text-dim)",
  next_expiry_only: "#d9a441",
  unavailable: "var(--text-faint)",
};

export function DeltaConfluenceCard({ confluence }: { confluence: DeltaConfluence }) {
  if (!confluence.nextExpiry) return <p className="m-0 font-mono text-[0.75rem] text-[var(--text-faint)]">No dte&gt;0 row available this request.</p>;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 font-mono text-[0.78rem]">
        <div>
          Next dominant expiry: <span className="font-semibold">{confluence.nextExpiry.expiration}</span>{" "}
          <span className="text-[var(--text-dim)]">({confluence.nextExpiry.dte} DTE)</span>
        </div>
        <div className="font-semibold uppercase tracking-[0.04em]" style={{ color: CONFLUENCE_COLOR[confluence.classification] }}>
          {CONFLUENCE_LABEL[confluence.classification]}
        </div>
      </div>
      <div className="font-mono text-[0.72rem] text-[var(--text-dim)]">
        Alignment: <span className="font-semibold text-[var(--text)]">{confluence.alignmentPct.toFixed(0)}%</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pillar 3: Key Risks
// ---------------------------------------------------------------------------

export function UnwindScenarioTable({ scenarios }: { scenarios: UnwindScenario[] }) {
  return (
    <Table head={["Scenario", "Price", "Hedge change", "Impact ratio", "Risk"]}>
      {scenarios.map((s) => (
        <tr key={s.label} className="border-b border-[var(--border)] last:border-0">
          <td className="py-1.5 text-left font-semibold">{s.label}</td>
          <td className="py-1.5 pl-3 text-right text-[var(--text-dim)]">{fmtNum(s.price, 2)}</td>
          <td className="py-1.5 pl-3 text-right text-[var(--text-dim)]">{fmtShares(s.hedgeChangeShares)}</td>
          <td className="py-1.5 pl-3 text-right font-semibold">{s.impactRatio !== null ? `${(s.impactRatio * 100).toFixed(0)}%` : "—"}</td>
          <td className="py-1.5 pl-3 text-right">
            <RiskPill level={s.riskLevel} />
          </td>
        </tr>
      ))}
    </Table>
  );
}

export function GapRiskTable({ rows }: { rows: GapRiskRow[] }) {
  return (
    <Table head={["Gap size", "Direction", "Hedge change", "Impact ratio"]}>
      {rows.map((r, i) => (
        <tr key={i} className="border-b border-[var(--border)] last:border-0">
          <td className="py-1.5 text-left font-semibold">{r.gapPct.toFixed(2)}%</td>
          <td className="py-1.5 pl-3 text-right uppercase" style={{ color: r.direction === "upside" ? "var(--up)" : "var(--down)" }}>
            {r.direction}
          </td>
          <td className="py-1.5 pl-3 text-right text-[var(--text-dim)]">{fmtShares(r.hedgeChangeShares)}</td>
          <td className="py-1.5 pl-3 text-right font-semibold">{r.impactRatio !== null ? `${(r.impactRatio * 100).toFixed(0)}%` : "—"}</td>
        </tr>
      ))}
    </Table>
  );
}

export function HedgeCrowdingCard({ crowding }: { crowding: HedgeCrowdingRisk }) {
  return (
    <div className="flex items-center gap-3 font-mono text-[0.78rem]">
      <span>Hedge crowding score:</span>
      <span className="font-semibold">{crowding.score.toFixed(0)}</span>
      <RiskPill level={crowding.label} />
    </div>
  );
}

export function DeltaOiFreshnessCard({ freshness }: { freshness: OiFreshnessRisk }) {
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

export function DeltaInventoryUncertaintyCard({ uncertainty }: { uncertainty: DealerInventoryUncertainty }) {
  return (
    <div className="flex flex-col gap-1.5 font-mono text-[0.78rem]">
      <div>
        Hedge-direction agreement: <span className="font-semibold">{(100 - uncertainty.uncertainty * 100).toFixed(0)}%</span>
      </div>
      <div className="text-[var(--text-dim)]">
        {uncertainty.positiveScenarios} of {uncertainty.totalScenarios} dealer-sign scenarios positive, {uncertainty.negativeScenarios} negative.
      </div>
      <div className="font-semibold" style={{ color: uncertainty.uncertainty > 0.5 ? "var(--down)" : "var(--up)" }}>
        Current inventory interpretation: {uncertainty.uncertainty > 0.5 ? "Low confidence" : "Higher confidence"}
      </div>
    </div>
  );
}

export function CrossProductWarningCard({ warning }: { warning: string }) {
  return <p className="m-0 font-mono text-[0.72rem] leading-relaxed text-[var(--text-faint)]">{warning}</p>;
}

// ---------------------------------------------------------------------------
// Pillar 4: Key Structure
// ---------------------------------------------------------------------------

export function DeltaBalanceSheetCard({ sheet }: { sheet: DeltaBalanceSheet }) {
  return (
    <div className="grid grid-cols-2 gap-3 font-mono text-[0.78rem] sm:grid-cols-4">
      <div>
        Call DEX <div className="font-semibold text-[var(--up)]">{fmtShares(sheet.callDex)}</div>
      </div>
      <div>
        Put DEX <div className="font-semibold text-[var(--down)]">{fmtShares(sheet.putDex)}</div>
      </div>
      <div>
        Net option DEX <div className="font-semibold" style={{ color: sheet.netDex >= 0 ? "var(--up)" : "var(--down)" }}>{fmtShares(sheet.netDex)}</div>
      </div>
      <div>
        Theoretical hedge <div className="font-semibold" style={{ color: sheet.theoreticalHedge >= 0 ? "var(--up)" : "var(--down)" }}>{fmtShares(sheet.theoreticalHedge)}</div>
      </div>
      <div className="col-span-2 sm:col-span-4">
        Cancellation: <span className="font-semibold text-[var(--text)]">{(sheet.cancellationRatio * 100).toFixed(0)}%</span>
      </div>
    </div>
  );
}

export function CumulativeDexLadderChart({ points, spot }: { points: { strike: number; cumulativeNet: number }[]; spot: number }) {
  const maxAbs = Math.max(1e-6, ...points.map((p) => Math.abs(p.cumulativeNet)));
  return (
    <div className="flex h-40 items-end gap-px overflow-x-auto">
      {points.map((p) => {
        const heightPct = (Math.abs(p.cumulativeNet) / maxAbs) * 100;
        const isSpotStrike = Math.abs(p.strike - spot) < 1;
        return (
          <div
            key={p.strike}
            title={`${fmtNum(p.strike, 0)}: cumulative ${fmtShares(p.cumulativeNet)}`}
            className="flex min-w-[3px] flex-1 flex-col justify-end"
            style={{ outline: isSpotStrike ? "1px solid var(--text)" : undefined }}
          >
            <div className="w-full" style={{ height: `${heightPct}%`, background: p.cumulativeNet >= 0 ? "var(--up)" : "var(--down)" }} />
          </div>
        );
      })}
    </div>
  );
}

export function ExpiryDexStackTable({ stack }: { stack: ExpiryDexStack }) {
  if (!stack.rows.length) return <p className="m-0 font-mono text-[0.75rem] text-[var(--text-faint)]">Unavailable this request (upstream option-matrix is best-effort and can time out).</p>;
  return (
    <div className="flex flex-col gap-3">
      <div className="font-mono text-[0.78rem]">
        0DTE delta control (gross): <span className="font-semibold text-[var(--accent)]">{stack.zeroDteControlGrossPct.toFixed(1)}%</span>
      </div>
      <p className="m-0 font-sans text-[0.66rem] text-[var(--text-faint)]">
        Net share can swing outside a plain 0-100% range when expirations partly cancel - use the gross figure above as the reliable read; net is shown for context only.
      </p>
      <Table head={["Expiration", "DTE", "Gross DEX (source units)", "Net share", "Gross share"]}>
        {stack.rows.slice(0, 10).map((r) => (
          <tr key={r.expiration} className="border-b border-[var(--border)] last:border-0">
            <td className="py-1.5 text-left text-[var(--text-dim)]">{r.expiration}</td>
            <td className="py-1.5 pl-3 text-right text-[var(--text-dim)]">{r.dte}</td>
            <td className="py-1.5 pl-3 text-right text-[var(--text-dim)]">{r.grossDex.toFixed(3)}</td>
            <td className="py-1.5 pl-3 text-right font-semibold">{r.sharePctNet.toFixed(0)}%</td>
            <td className="py-1.5 pl-3 text-right font-semibold">{r.sharePctGross.toFixed(0)}%</td>
          </tr>
        ))}
      </Table>
    </div>
  );
}

export function DeltaConcentrationRow({ stats }: { stats: ConcentrationStats }) {
  return (
    <div className="grid grid-cols-3 gap-3 font-mono text-[0.78rem]">
      <div>
        Delta HHI <div className="font-semibold text-[var(--text)]">{stats.hhi.toFixed(3)}</div>
      </div>
      <div>
        Delta entropy <div className="font-semibold text-[var(--text)]">{stats.entropy.toFixed(2)}</div>
      </div>
      <div>
        Effective strikes <div className="font-semibold text-[var(--text)]">{stats.effectiveStrikes.toFixed(1)}</div>
      </div>
    </div>
  );
}

export function CenterOfInventoryCard({ cog, spot }: { cog: CenterOfInventory; spot: number }) {
  const Row = ({ label, value }: { label: string; value: number | null }) => (
    <div>
      {label}{" "}
      <div className="font-semibold text-[var(--text)]">
        {value !== null ? `${fmtNum(value, 1)} (${value >= spot ? "+" : ""}${(value - spot).toFixed(1)})` : "—"}
      </div>
    </div>
  );
  return (
    <div className="grid grid-cols-2 gap-3 font-mono text-[0.78rem] sm:grid-cols-4">
      <Row label="Call-delta center" value={cog.callCenter} />
      <Row label="Put-delta center" value={cog.putCenter} />
      <Row label="Gross-delta center" value={cog.grossCenter} />
      <Row label="Reachability-weighted" value={cog.reachabilityWeightedCenter} />
    </div>
  );
}

export function DeltaAsymmetryRow({ stats }: { stats: AsymmetryStats }) {
  const abovePct = (stats.aboveAbs / (stats.aboveAbs + stats.belowAbs || 1)) * 100;
  return (
    <div className="flex flex-col gap-2 font-mono text-[0.78rem]">
      <div>
        Above spot: <span className="font-semibold">{abovePct.toFixed(0)}%</span> · Below spot: <span className="font-semibold">{(100 - abovePct).toFixed(0)}%</span>
      </div>
      <div>
        Asymmetry: <span className="font-semibold">{stats.asymmetry >= 0 ? "+" : ""}{stats.asymmetry.toFixed(2)}</span>
      </div>
    </div>
  );
}

export function MoneynessStructureChart({ rows }: { rows: MoneynessRow[] }) {
  const maxAbs = Math.max(1e-6, ...rows.map((r) => Math.abs(r.dex)));
  return (
    <div className="flex flex-col gap-2">
      {rows.map((r) => (
        <div key={r.bucket} className="flex items-center gap-3">
          <div className="w-24 shrink-0 font-mono text-[0.68rem] text-[var(--text-dim)]">{r.label}</div>
          <div className="h-3 flex-1 overflow-hidden rounded-[2px]" style={{ background: "var(--panel-2)" }}>
            <div
              className="h-full"
              style={{
                width: `${(Math.abs(r.dex) / maxAbs) * 100}%`,
                background: r.dex >= 0 ? "var(--up)" : "var(--down)",
                marginLeft: r.dex < 0 ? "auto" : undefined,
              }}
            />
          </div>
          <div className="w-24 shrink-0 text-right font-mono text-[0.68rem] font-semibold" style={{ color: r.dex >= 0 ? "var(--up)" : "var(--down)" }}>
            {fmtShares(r.dex)}
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Rehedge surface (price x time)
// ---------------------------------------------------------------------------

function divergingColor(value: number, maxAbs: number): string {
  if (maxAbs <= 0) return "var(--panel-2)";
  const t = Math.max(-1, Math.min(1, value / maxAbs));
  const pct = Math.round(Math.pow(Math.abs(t), 0.55) * 90);
  const base = t >= 0 ? "var(--down)" : "var(--up)"; // positive hedge change = must BUY (amplifying upside pressure, shown red like a warning); negative = must SELL
  return `color-mix(in srgb, ${base} ${pct}%, var(--panel-2) ${100 - pct}%)`;
}

export function RehedgeSurfaceChart({
  grid,
  priceValues,
  minutesValues,
  spot,
}: {
  grid: RehedgeSurfacePoint[];
  priceValues: number[];
  minutesValues: number[];
  spot: number;
}) {
  const maxAbs = Math.max(1e-6, ...grid.map((p) => Math.abs(p.hedgeChangeShares)));
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
                    title={`${fmtNum(price, 2)} @ ${minutes.toFixed(0)}m: ${point ? fmtShares(point.hedgeChangeShares) : "—"} vs. now`}
                    className="h-7 flex-1"
                    style={{
                      background: divergingColor(point?.hedgeChangeShares ?? 0, maxAbs),
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
          Columns: hypothetical price · Rows: minutes to expiry, top (now) to bottom (close) · outlined column = spot · red = dealers must buy, green = dealers must sell, vs. current hedge
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Diagnostic strip
// ---------------------------------------------------------------------------

export function DeltaDiagnosticStrip({
  pricingModel,
  surfaceModel,
  contractsIncluded,
  invalidContracts,
  dealerSignConvention,
  oiFreshnessLabel,
  crossProductWarning,
  lastCalculatedAt,
}: {
  pricingModel: string;
  surfaceModel: string;
  contractsIncluded: number;
  invalidContracts: number;
  dealerSignConvention: string;
  oiFreshnessLabel: string;
  crossProductWarning: string;
  lastCalculatedAt: number;
}) {
  return (
    <div className="flex flex-col gap-1.5 border-t border-[var(--border)] pt-3 font-mono text-[0.62rem] text-[var(--text-faint)]">
      <div>Pricing model: {pricingModel}</div>
      <div>Surface model: {surfaceModel}</div>
      <div className="flex flex-wrap gap-x-6">
        <span>Contracts included: {contractsIncluded}</span>
        <span>Invalid/missing: {invalidContracts}</span>
        <span>Dealer-sign convention: {dealerSignConvention}</span>
        <span>OI freshness: {oiFreshnessLabel}</span>
        <span>Last calculated: {new Date(lastCalculatedAt).toLocaleTimeString()}</span>
      </div>
      <div>{crossProductWarning}</div>
    </div>
  );
}
