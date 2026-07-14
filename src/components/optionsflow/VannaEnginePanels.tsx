"use client";

import { fmtNum } from "@/lib/gex";
import type {
  AsymmetryStats,
  ConcentrationStats,
  DealerSignUncertainty,
  ForwardVannaClockPoint,
  HedgeFieldPoint,
  IvShockScenario,
  LinearizationRisk,
  OiFreshnessRisk,
  SpotVolInteraction,
  SurfaceShapeRisk,
  VannaBalanceSheet,
  VannaCenter,
  VannaConfluence,
  VannaConsensus,
  VannaFlipBand,
  VannaHeatmap,
  VannaPhaseClassification,
  VannaShelf,
  VolatilityGate,
  VannaVacuum,
  ZeroDteVannaControl,
} from "@/lib/vannaEngine";

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

const PHASE_COLOR: Record<VannaPhaseClassification["phase"], string> = {
  compression_support: "var(--up)",
  compression_drag: "var(--down)",
  expansion_support: "var(--up)",
  expansion_pressure: "var(--down)",
  fragile_neutral: "#d9a441",
  vanna_light: "var(--text-faint)",
};

export function VannaHeroBanner({ heroStatement, phase }: { heroStatement: string; phase: VannaPhaseClassification }) {
  const color = PHASE_COLOR[phase.phase];
  return (
    <div className="flex flex-col gap-2 border p-5" style={{ borderColor: color, background: `color-mix(in srgb, ${color} 6%, var(--panel) 94%)` }}>
      <div className="font-mono text-[0.6rem] uppercase tracking-[0.08em] text-[var(--text-faint)]">Vanna decision engine · plain-English summary</div>
      <p className="m-0 font-sans text-[0.95rem] font-medium leading-relaxed text-[var(--text)]">{heroStatement}</p>
    </div>
  );
}

export type VannaPillarId = "regime" | "levels" | "risks" | "structure";

const PILLAR_LABEL: Record<VannaPillarId, string> = {
  regime: "VANNA REGIME",
  levels: "KEY LEVELS",
  risks: "KEY RISKS",
  structure: "KEY STRUCTURE",
};

export function VannaPillarNav({ active, onChange }: { active: VannaPillarId; onChange: (p: VannaPillarId) => void }) {
  const order: VannaPillarId[] = ["regime", "levels", "risks", "structure"];
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

export function VannaPillarSummaryCards({
  active,
  onChange,
  phase,
  consensus,
  flipBand,
  nearestShelf,
  confluence,
  linearizationRisk,
  vannaHalfLifeMinutes,
  oiFreshness,
  balanceSheet,
  concentrationEffectiveStrikes,
}: {
  active: VannaPillarId;
  onChange: (p: VannaPillarId) => void;
  phase: VannaPhaseClassification;
  consensus: VannaConsensus;
  flipBand: VannaFlipBand;
  nearestShelf: VannaShelf | null;
  confluence: VannaConfluence;
  linearizationRisk: LinearizationRisk;
  vannaHalfLifeMinutes: number | null;
  oiFreshness: OiFreshnessRisk;
  balanceSheet: VannaBalanceSheet;
  concentrationEffectiveStrikes: number;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <SummaryCard
        title="VANNA REGIME"
        active={active === "regime"}
        onClick={() => onChange("regime")}
        rows={[
          { label: "Phase", value: phase.label, tone: phase.phase.includes("support") ? "up" : phase.phase.includes("pressure") || phase.phase.includes("drag") ? "down" : "neutral" },
          { label: "Net VEX (per +1 vol pt)", value: fmtShares(balanceSheet.netVex), tone: balanceSheet.netVex >= 0 ? "up" : "down" },
          { label: "Consensus VEX", value: fmtShares(consensus.consensusVex) },
          { label: "Sign agreement", value: `${consensus.signAgreementPct.toFixed(0)}%` },
        ]}
      />
      <SummaryCard
        title="KEY LEVEL"
        active={active === "levels"}
        onClick={() => onChange("levels")}
        rows={[
          { label: "Vanna flip", value: flipBand.center !== null ? fmtNum(flipBand.center, 1) : "—" },
          { label: "Nearest shelf", value: nearestShelf ? `${fmtNum(nearestShelf.low, 0)}–${fmtNum(nearestShelf.high, 0)}` : "—" },
          { label: "Cross-expiry alignment", value: confluence.nextExpiry ? `${confluence.alignmentPct.toFixed(0)}%` : "—" },
          { label: "Flip agreement", value: `${flipBand.signAgreementPct.toFixed(0)}%` },
        ]}
      />
      <SummaryCard
        title="KEY RISK"
        active={active === "risks"}
        onClick={() => onChange("risks")}
        rows={[
          { label: "Linearization error", value: `${linearizationRisk.worstErrorPct.toFixed(0)}%`, tone: linearizationRisk.level === "high" ? "down" : "neutral" },
          { label: "Vanna half-life", value: vannaHalfLifeMinutes !== null ? `${vannaHalfLifeMinutes.toFixed(0)}m` : "—" },
          { label: "OI freshness risk", value: oiFreshness.level },
          { label: "Cancellation", value: `${(balanceSheet.cancellationRatio * 100).toFixed(0)}%` },
        ]}
      />
      <SummaryCard
        title="KEY STRUCTURE"
        active={active === "structure"}
        onClick={() => onChange("structure")}
        rows={[
          { label: "Gross VEX", value: fmtShares(balanceSheet.grossVex) },
          { label: "Call VEX", value: fmtShares(balanceSheet.callVex) },
          { label: "Put VEX", value: fmtShares(balanceSheet.putVex) },
          { label: "Concentration", value: `${concentrationEffectiveStrikes.toFixed(1)} strikes` },
        ]}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pillar 1: Vanna Regime
// ---------------------------------------------------------------------------

export function VannaConsensusTable({ consensus }: { consensus: VannaConsensus }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 font-mono text-[0.78rem]">
        <div>
          Consensus VEX: <span className="font-semibold" style={{ color: consensus.consensusVex >= 0 ? "var(--up)" : "var(--down)" }}>{fmtShares(consensus.consensusVex)}</span>
        </div>
        <div>
          Dispersion: <span className="font-semibold">{fmtShares(consensus.dispersion)}</span>
        </div>
        <div>
          Sign agreement: <span className="font-semibold">{consensus.signAgreementPct.toFixed(0)}%</span>
        </div>
      </div>
      <div>
        <div className="mb-1.5 font-mono text-[0.62rem] uppercase tracking-[0.06em] text-[var(--text-faint)]">Vanna views</div>
        <Table head={["Model", "Net VEX"]}>
          {consensus.models.map((m) => (
            <tr key={m.name} className="border-b border-[var(--border)] last:border-0">
              <td className="py-1.5 text-left text-[var(--text-dim)]">{m.label}</td>
              <td className={`py-1.5 pl-3 text-right font-semibold ${m.netVex >= 0 ? "text-[var(--up)]" : "text-[var(--down)]"}`}>{fmtShares(m.netVex)}</td>
            </tr>
          ))}
        </Table>
      </div>
      <div>
        <div className="mb-1.5 font-mono text-[0.62rem] uppercase tracking-[0.06em] text-[var(--text-faint)]">Dealer-sign scenarios</div>
        <Table head={["Scenario", "Net VEX"]}>
          {consensus.dealerSignScenarios.map((s) => (
            <tr key={s.name} className="border-b border-[var(--border)] last:border-0">
              <td className="py-1.5 text-left text-[var(--text-dim)]">{s.label}</td>
              <td className={`py-1.5 pl-3 text-right font-semibold ${s.netVex >= 0 ? "text-[var(--up)]" : "text-[var(--down)]"}`}>{fmtShares(s.netVex)}</td>
            </tr>
          ))}
        </Table>
      </div>
    </div>
  );
}

export function IvShockScenarioTable({ scenarios }: { scenarios: IvShockScenario[] }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="m-0 font-sans text-[0.68rem] leading-relaxed text-[var(--text-faint)]">
        Each row is conditional on the stated IV move happening - vanna does not predict which way volatility goes. &quot;Full reprice&quot; repriced every contract&apos;s delta at the shocked vol; &quot;linear&quot; scales net VEX by the shock size.
      </p>
      <Table head={["IV shock", "Hedge change (full reprice)", "Hedge change (linear)", "Impact ratio", "Risk"]}>
        {scenarios.map((s) => (
          <tr key={s.shockPoints} className="border-b border-[var(--border)] last:border-0">
            <td className="py-1.5 text-left font-semibold" style={{ color: s.shockPoints >= 0 ? "var(--up)" : "var(--down)" }}>
              {s.label}
            </td>
            <td className="py-1.5 pl-3 text-right font-semibold">{fmtShares(s.hedgeChangeSharesFull)}</td>
            <td className="py-1.5 pl-3 text-right text-[var(--text-dim)]">{fmtShares(s.hedgeChangeSharesLinear)}</td>
            <td className="py-1.5 pl-3 text-right">{s.impactRatio !== null ? `${(s.impactRatio * 100).toFixed(0)}%` : "—"}</td>
            <td className="py-1.5 pl-3 text-right">
              <RiskPill level={s.riskLevel} />
            </td>
          </tr>
        ))}
      </Table>
    </div>
  );
}

export function SpotVolInteractionCard({ interaction }: { interaction: SpotVolInteraction }) {
  return (
    <div className="flex flex-col gap-1.5 font-mono text-[0.78rem]">
      <div>
        Spot-vol interaction ({interaction.dSpotPct.toFixed(2)}% spot x {interaction.dVolPoints.toFixed(0)}pt IV):{" "}
        <span className="font-semibold" style={{ color: interaction.interactionShares >= 0 ? "var(--up)" : "var(--down)" }}>
          {fmtShares(interaction.interactionShares)}
        </span>
      </div>
      <p className="m-0 font-sans text-[0.66rem] leading-relaxed text-[var(--text-faint)]">{interaction.note}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Signature viz: Spot x IV Hedge Field
// ---------------------------------------------------------------------------

function divergingColor(value: number, maxAbs: number): string {
  if (maxAbs <= 0) return "var(--panel-2)";
  const t = Math.max(-1, Math.min(1, value / maxAbs));
  const pct = Math.round(Math.pow(Math.abs(t), 0.55) * 90);
  const base = t >= 0 ? "var(--down)" : "var(--up)"; // positive hedge change = must BUY, negative = must SELL
  return `color-mix(in srgb, ${base} ${pct}%, var(--panel-2) ${100 - pct}%)`;
}

export function HedgeFieldChart({
  grid,
  spotValues,
  ivShockValues,
  spot,
}: {
  grid: HedgeFieldPoint[];
  spotValues: number[];
  ivShockValues: number[];
  spot: number;
}) {
  const maxAbs = Math.max(1e-6, ...grid.map((p) => Math.abs(p.hedgeChangeShares)));
  const byKey = new Map(grid.map((p) => [`${p.ivShockPoints}:${p.spot}`, p]));
  const spotIdx = spotValues.reduce((best, s, i) => (Math.abs(s - spot) < Math.abs(spotValues[best] - spot) ? i : best), 0);

  return (
    <div className="overflow-x-auto">
      <div className="flex flex-col gap-px" style={{ minWidth: 640 }}>
        {[...ivShockValues].reverse().map((ivShockPoints) => (
          <div key={ivShockPoints} className="flex items-stretch gap-px">
            <div className="flex w-16 shrink-0 items-center justify-end pr-2 font-mono text-[0.6rem] text-[var(--text-faint)]">
              {ivShockPoints > 0 ? "+" : ""}
              {ivShockPoints}pt{ivShockPoints === 0 ? " (now)" : ""}
            </div>
            <div className="flex flex-1 gap-px">
              {spotValues.map((s, i) => {
                const point = byKey.get(`${ivShockPoints}:${s}`);
                return (
                  <div
                    key={s}
                    title={`${fmtNum(s, 2)} @ ${ivShockPoints > 0 ? "+" : ""}${ivShockPoints}pt IV: ${point ? fmtShares(point.hedgeChangeShares) : "—"} vs. now`}
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
        <div className="flex gap-px pl-16">
          {spotValues.map((s, i) => (
            <div key={s} className="flex-1 text-center font-mono text-[0.56rem] text-[var(--text-faint)]" style={{ visibility: i % 3 === 0 ? "visible" : "hidden" }}>
              {fmtNum(s, 0)}
            </div>
          ))}
        </div>
        <div className="mt-1 font-mono text-[0.6rem] text-[var(--text-faint)]">
          Columns: hypothetical spot · Rows: hypothetical IV shock, top (+) to bottom (-) · outlined column = spot · red = dealers must buy, green = dealers must sell, vs. current hedge at current IV
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pillar 2: Key Levels
// ---------------------------------------------------------------------------

export function VannaFlipBandCard({ band }: { band: VannaFlipBand }) {
  if (band.center === null) return <p className="m-0 font-mono text-[0.75rem] text-[var(--text-faint)]">No zero-crossing found this request.</p>;
  return (
    <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 font-mono text-[0.78rem]">
      <div>
        Vanna flip center: <span className="font-semibold text-[var(--accent)]">{fmtNum(band.center, 2)}</span>
      </div>
      <div>
        Scenario band: <span className="font-semibold">{fmtNum(band.low, 2)}–{fmtNum(band.high, 2)}</span>
      </div>
      <div>
        Model agreement: <span className="font-semibold">{band.signAgreementPct.toFixed(0)}%</span>
      </div>
    </div>
  );
}

export function VannaPivotsCard({ compressionPivot, expansionPivot }: { compressionPivot: number | null; expansionPivot: number | null }) {
  return (
    <div className="grid grid-cols-2 gap-4 font-mono text-[0.85rem]">
      <div>
        <div className="text-[0.62rem] uppercase tracking-[0.06em] text-[var(--text-faint)]">Compression pivot (IV -1pt)</div>
        <div className="mt-1 font-semibold text-[var(--text)]">{compressionPivot !== null ? fmtNum(compressionPivot, 2) : "—"}</div>
      </div>
      <div>
        <div className="text-[0.62rem] uppercase tracking-[0.06em] text-[var(--text-faint)]">Expansion pivot (IV +1pt)</div>
        <div className="mt-1 font-semibold text-[var(--text)]">{expansionPivot !== null ? fmtNum(expansionPivot, 2) : "—"}</div>
      </div>
    </div>
  );
}

const SHELF_LABEL: Record<VannaShelf["type"], string> = {
  compression_buy_expansion_sell: "Compression-buy / expansion-sell",
  compression_sell_expansion_buy: "Compression-sell / expansion-buy",
};
const SHELF_COLOR: Record<VannaShelf["type"], string> = {
  compression_buy_expansion_sell: "var(--up)",
  compression_sell_expansion_buy: "var(--down)",
};

export function VannaShelfTable({ shelves }: { shelves: VannaShelf[] }) {
  if (!shelves.length) return <p className="m-0 font-mono text-[0.75rem] text-[var(--text-faint)]">No shelf cleared the 3% share threshold this request.</p>;
  return (
    <Table head={["Region", "Hedge-flow type", "Share of gross VEX", "Width"]}>
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

export function VolatilityGateCard({ gate }: { gate: VolatilityGate }) {
  if (gate.price === null) return <p className="m-0 font-mono text-[0.75rem] text-[var(--text-faint)]">No gate found this request.</p>;
  return (
    <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 font-mono text-[0.78rem]">
      <div>
        Volatility gate: <span className="font-semibold text-[var(--accent)]">{fmtNum(gate.price, 2)}</span>
      </div>
      <div>
        Hedge impact at +1pt: <span className="font-semibold">{gate.hedgeImpactShares !== null ? fmtShares(gate.hedgeImpactShares) : "—"}</span>
      </div>
      <div>
        Impact ratio: <span className="font-semibold">{gate.impactRatio !== null ? `${(gate.impactRatio * 100).toFixed(0)}%` : "—"}</span>
      </div>
    </div>
  );
}

export function VannaVacuumCard({ vacuum }: { vacuum: VannaVacuum }) {
  if (vacuum.price === null) return <p className="m-0 font-mono text-[0.75rem] text-[var(--text-faint)]">No low-density zone found near spot this request.</p>;
  return (
    <div className="flex items-baseline gap-x-6 font-mono text-[0.78rem]">
      <div>
        Vanna vacuum: <span className="font-semibold text-[var(--accent)]">{fmtNum(vacuum.price, 2)}</span>
      </div>
      <div>
        Vacuum score: <span className="font-semibold">{vacuum.vacuumScore !== null ? vacuum.vacuumScore.toFixed(2) : "—"}</span>
      </div>
    </div>
  );
}

const CONFLUENCE_LABEL: Record<VannaConfluence["classification"], string> = {
  reinforcing: "Reinforcing vanna shelf",
  cancelling: "Cancelling vanna shelf",
  zero_dte_only: "0DTE-only vanna",
  next_expiry_only: "Next-expiry vanna",
  unavailable: "Unavailable",
};
const CONFLUENCE_COLOR: Record<VannaConfluence["classification"], string> = {
  reinforcing: "var(--up)",
  cancelling: "var(--down)",
  zero_dte_only: "var(--text-dim)",
  next_expiry_only: "#d9a441",
  unavailable: "var(--text-faint)",
};

export function VannaConfluenceCard({ confluence }: { confluence: VannaConfluence }) {
  if (!confluence.nextExpiry) return <p className="m-0 font-mono text-[0.75rem] text-[var(--text-faint)]">No dte&gt;0 vanna surface data available this request.</p>;
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
      <p className="m-0 font-sans text-[0.64rem] leading-relaxed text-[var(--text-faint)]">
        Based on the source&apos;s own /vanna_surface points, which carry no open interest - gross-magnitude proxy, not OI-weighted exposure.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pillar 3: Key Risks
// ---------------------------------------------------------------------------

export function SurfaceShapeRiskCard({ risk }: { risk: SurfaceShapeRisk }) {
  return (
    <div className="grid grid-cols-3 gap-3 font-mono text-[0.78rem]">
      <div>
        Level shock (+1pt) <div className="font-semibold text-[var(--text)]">{fmtShares(risk.levelShockShares)}</div>
      </div>
      <div>
        Skew shock <div className="font-semibold text-[var(--text)]">{fmtShares(risk.skewShockShares)}</div>
      </div>
      <div>
        Curvature shock <div className="font-semibold text-[var(--text)]">{fmtShares(risk.curvatureShockShares)}</div>
      </div>
      <div className="col-span-3">
        Skew amplification: <span className="font-semibold text-[var(--text)]">{risk.skewAmplificationPct.toFixed(0)}%</span> of the level shock
      </div>
    </div>
  );
}

export function LinearizationRiskCard({ risk }: { risk: LinearizationRisk }) {
  return (
    <div className="flex items-center gap-3 font-mono text-[0.78rem]">
      <span>Worst linearization error (linear VEX vs. full reprice):</span>
      <span className="font-semibold">{risk.worstErrorPct.toFixed(0)}%</span>
      <RiskPill level={risk.level === "high" ? "high" : risk.level === "moderate" ? "moderate" : "low"} />
    </div>
  );
}

export function VannaHalfLifeCard({ minutes }: { minutes: number | null }) {
  return (
    <div className="font-mono text-[0.78rem]">
      Vanna half-life: <span className="font-semibold text-[var(--text)]">{minutes !== null ? `${minutes.toFixed(0)} minutes` : "Does not halve within the session"}</span>
    </div>
  );
}

export function DealerSignUncertaintyCard({ uncertainty }: { uncertainty: DealerSignUncertainty }) {
  return (
    <div className="flex flex-col gap-1.5 font-mono text-[0.78rem]">
      <div>
        Sign agreement: <span className="font-semibold">{(100 - uncertainty.uncertainty * 100).toFixed(0)}%</span>
      </div>
      <div className="text-[var(--text-dim)]">
        {uncertainty.positiveScenarios} of {uncertainty.totalScenarios} dealer-sign scenarios positive, {uncertainty.negativeScenarios} negative.
      </div>
      <div className="font-semibold" style={{ color: uncertainty.uncertainty > 0.5 ? "var(--down)" : "var(--up)" }}>
        Current interpretation: {uncertainty.uncertainty > 0.5 ? "Low confidence" : "Higher confidence"}
      </div>
    </div>
  );
}

export function VannaOiFreshnessCard({ freshness }: { freshness: OiFreshnessRisk }) {
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

export function VannaCrossProductWarningCard({ warning }: { warning: string }) {
  return <p className="m-0 font-mono text-[0.72rem] leading-relaxed text-[var(--text-faint)]">{warning}</p>;
}

// ---------------------------------------------------------------------------
// Pillar 4: Key Structure
// ---------------------------------------------------------------------------

export function VannaBalanceSheetCard({ sheet }: { sheet: VannaBalanceSheet }) {
  return (
    <div className="grid grid-cols-2 gap-3 font-mono text-[0.78rem] sm:grid-cols-4">
      <div>
        Call VEX <div className="font-semibold" style={{ color: sheet.callVex >= 0 ? "var(--up)" : "var(--down)" }}>{fmtShares(sheet.callVex)}</div>
      </div>
      <div>
        Put VEX <div className="font-semibold" style={{ color: sheet.putVex >= 0 ? "var(--up)" : "var(--down)" }}>{fmtShares(sheet.putVex)}</div>
      </div>
      <div>
        Net VEX <div className="font-semibold" style={{ color: sheet.netVex >= 0 ? "var(--up)" : "var(--down)" }}>{fmtShares(sheet.netVex)}</div>
      </div>
      <div>
        Gross VEX <div className="font-semibold text-[var(--text)]">{fmtShares(sheet.grossVex)}</div>
      </div>
      <div className="col-span-2 sm:col-span-4">
        Cancellation: <span className="font-semibold text-[var(--text)]">{(sheet.cancellationRatio * 100).toFixed(0)}%</span>
      </div>
    </div>
  );
}

export function VannaHeatmapGrid({ heatmap }: { heatmap: VannaHeatmap | null }) {
  if (!heatmap || !heatmap.rows.length) return <p className="m-0 font-mono text-[0.75rem] text-[var(--text-faint)]">Unavailable this request (upstream /vanna_surface is best-effort and can time out).</p>;
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
                <div
                  key={i}
                  title={c !== null ? `${fmtNum(row.strike, 0)} @ ${heatmap.expiriesDte[i]}d: ${c.toFixed(4)}` : "—"}
                  className="h-6 flex-1"
                  style={{ background: c !== null ? divergingColor(c, maxAbs) : "var(--panel-2)" }}
                />
              ))}
            </div>
          </div>
        ))}
        <div className="mt-1 font-mono text-[0.6rem] text-[var(--text-faint)]">
          Raw per-contract vanna from the source&apos;s /vanna_surface, summed by strike x expiry - no open interest, gross-magnitude proxy only.
        </div>
      </div>
    </div>
  );
}

export function VannaConcentrationRow({ stats }: { stats: ConcentrationStats }) {
  return (
    <div className="grid grid-cols-3 gap-3 font-mono text-[0.78rem]">
      <div>
        Vanna HHI <div className="font-semibold text-[var(--text)]">{stats.hhi.toFixed(3)}</div>
      </div>
      <div>
        Vanna entropy <div className="font-semibold text-[var(--text)]">{stats.entropy.toFixed(2)}</div>
      </div>
      <div>
        Effective strikes <div className="font-semibold text-[var(--text)]">{stats.effectiveStrikes.toFixed(1)}</div>
      </div>
    </div>
  );
}

export function VannaCenterCard({ center, spot }: { center: VannaCenter; spot: number }) {
  const Row = ({ label, value }: { label: string; value: number | null }) => (
    <div>
      {label}{" "}
      <div className="font-semibold text-[var(--text)]">
        {value !== null ? `${fmtNum(value, 1)} (${value >= spot ? "+" : ""}${(value - spot).toFixed(1)})` : "—"}
      </div>
    </div>
  );
  return (
    <div className="grid grid-cols-2 gap-3 font-mono text-[0.78rem] sm:grid-cols-5">
      <Row label="Call-vanna center" value={center.callCenter} />
      <Row label="Put-vanna center" value={center.putCenter} />
      <Row label="Gross-vanna center" value={center.grossCenter} />
      <Row label="Net-signed center" value={center.netSignedCenter} />
      <Row label="Reachability-weighted" value={center.reachabilityWeightedCenter} />
    </div>
  );
}

export function VannaAsymmetryRow({ stats }: { stats: AsymmetryStats }) {
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

export function ZeroDteVannaControlCard({ control }: { control: ZeroDteVannaControl | null }) {
  if (!control) return <p className="m-0 font-mono text-[0.75rem] text-[var(--text-faint)]">Unavailable this request (upstream /vanna_surface is best-effort and can time out).</p>;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="font-mono text-[0.78rem]">
        0DTE vanna control: <span className="font-semibold text-[var(--accent)]">{control.controlPct.toFixed(1)}%</span> of gross raw vanna magnitude across expiries
      </div>
      <p className="m-0 font-sans text-[0.64rem] leading-relaxed text-[var(--text-faint)]">Raw-Greek-magnitude share, not OI-weighted - /vanna_surface carries no open interest.</p>
    </div>
  );
}

export function ForwardVannaClockTable({ clock }: { clock: ForwardVannaClockPoint[] }) {
  return (
    <Table head={["Horizon", "Net VEX", "Gross VEX", "Flip", "Hedge change at +1pt"]}>
      {clock.map((p) => (
        <tr key={p.label} className="border-b border-[var(--border)] last:border-0">
          <td className="py-1.5 text-left font-semibold">{p.label}</td>
          <td className={`py-1.5 pl-3 text-right font-semibold ${p.netVex >= 0 ? "text-[var(--up)]" : "text-[var(--down)]"}`}>{fmtShares(p.netVex)}</td>
          <td className="py-1.5 pl-3 text-right text-[var(--text-dim)]">{fmtShares(p.grossVex)}</td>
          <td className="py-1.5 pl-3 text-right text-[var(--text-dim)]">{p.flip !== null ? fmtNum(p.flip, 1) : "—"}</td>
          <td className="py-1.5 pl-3 text-right font-semibold">{fmtShares(p.hedgeChangeAt1pt)}</td>
        </tr>
      ))}
    </Table>
  );
}

// ---------------------------------------------------------------------------
// Diagnostic strip
// ---------------------------------------------------------------------------

export function VannaDiagnosticStrip({
  pricingModel,
  surfaceModel,
  contractsIncluded,
  invalidContracts,
  dealerSignConvention,
  oiFreshnessLabel,
  crossProductWarning,
  vannaSurfaceDataNote,
  signConventionWarning,
  lastCalculatedAt,
}: {
  pricingModel: string;
  surfaceModel: string;
  contractsIncluded: number;
  invalidContracts: number;
  dealerSignConvention: string;
  oiFreshnessLabel: string;
  crossProductWarning: string;
  vannaSurfaceDataNote: string;
  signConventionWarning: string;
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
      <div className="font-semibold text-[var(--text-dim)]">{signConventionWarning}</div>
      <div>{crossProductWarning}</div>
      <div>{vannaSurfaceDataNote}</div>
    </div>
  );
}
