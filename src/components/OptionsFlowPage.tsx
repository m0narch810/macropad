"use client";

import { useEffect, useMemo, useState } from "react";
import type { GexResponse, GexSymbol, PricerEngine } from "@/lib/gex";
import { fmtNum, fmtUsd, nearStrikeWindow } from "@/lib/gex";
import ExposureBarChart, { type ExposureBarDatum, type ExposureMarker } from "@/components/optionsflow/ExposureBarChart";
import ExposureHeatmap from "@/components/optionsflow/ExposureHeatmap";
import {
  AsymmetryRow,
  ColorForwardTable,
  ConcentrationRow,
  CrossExpiryStackTable,
  GammaConfluenceCard,
  GammaFeedbackChart,
  GammaFlipBandCard,
  GammaFlipGradientCard,
  HedgeScenarioTable,
  HowToUse,
  ImpliedMomentsRow,
  IvScenarioTable,
  MarkerLegend,
  PinningBasinCard,
  ProximityRow,
  ReachabilityTable,
  SurfaceAdjustedTable,
  TransitionCliffTable,
  WallQualityTable,
  AdvancedToggle,
} from "@/components/optionsflow/GexAnalyticsPanels";
import {
  BalanceSheetCard,
  CascadeRiskCards,
  CenterOfGravityCard,
  CliffRiskCard,
  ConfluenceCard,
  ConsensusTable,
  DiagnosticStrip,
  ForwardClockTable,
  HeroBanner,
  InventoryUncertaintyCard,
  OiFreshnessCard,
  PhaseMapChart,
  PillarNav,
  PillarSummaryCards,
  PinFailureRiskList,
  SurfaceModelRiskCard,
  TypedLevelLadder,
  type PillarId,
} from "@/components/optionsflow/GammaEnginePanels";
import {
  CenterOfInventoryCard,
  CrossProductWarningCard,
  CumulativeDexLadderChart,
  DeltaAsymmetryRow,
  DeltaBalanceSheetCard,
  DeltaConcentrationRow,
  DeltaConfluenceCard,
  DeltaConsensusTable,
  DeltaDiagnosticStrip,
  DeltaHeroBanner,
  DeltaInventoryUncertaintyCard,
  DeltaNeutralBandCard,
  DeltaOiFreshnessCard,
  DeltaPillarNav,
  DeltaPillarSummaryCards,
  DeltaShelfTable,
  ExpiryDexStackTable,
  GapRiskTable,
  HedgeCrowdingCard,
  HedgeRotationZoneCard,
  MoneynessStructureChart,
  OptionBookVsHedgeCard,
  RehedgeSurfaceChart,
  RehedgeTriggerTable,
  UnwindScenarioTable,
  type DeltaPillarId,
} from "@/components/optionsflow/DeltaEnginePanels";
import {
  AssignmentRiskNote,
  BurnBasinCard,
  BurnHorizonTable,
  BurnSurfaceChart,
  CarryWipeoutTable,
  ConvexityDeficitCard,
  DecayCentersCard,
  DecayDominanceCard,
  EscapeAsymmetryCard,
  EscapeBandTable,
  ExpiryThetaStackTable,
  HalfLifeCard,
  IvStabilityCard,
  MoneynessStructureChart as ThetaMoneynessStructureChart,
  SurvivalMapChart,
  ThetaBalanceSheetCard,
  ThetaConcentrationRow,
  ThetaConfluenceCard,
  ThetaConsensusTable,
  ThetaDecisionLadderTable,
  ThetaDiagnosticStrip,
  ThetaForwardClockTable,
  ThetaHeroBanner,
  ThetaMirageCard,
  ThetaOiFreshnessCard,
  ThetaPillarNav,
  ThetaPillarSummaryCards,
  ThetaShelfTable,
  ThetaStrikeExpiryHeatmap,
  type ThetaPillarId,
} from "@/components/optionsflow/ThetaEnginePanels";
import {
  DealerSignUncertaintyCard,
  ForwardVannaClockTable,
  HedgeFieldChart,
  IvShockScenarioTable,
  LinearizationRiskCard,
  SpotVolInteractionCard,
  SurfaceShapeRiskCard,
  VannaAsymmetryRow,
  VannaBalanceSheetCard,
  VannaCenterCard,
  VannaConcentrationRow,
  VannaConfluenceCard,
  VannaConsensusTable,
  VannaCrossProductWarningCard,
  VannaDiagnosticStrip,
  VannaFlipBandCard,
  VannaHalfLifeCard,
  VannaHeatmapGrid,
  VannaHeroBanner,
  VannaOiFreshnessCard,
  VannaPillarNav,
  VannaPillarSummaryCards,
  VannaPivotsCard,
  VannaShelfTable,
  VannaVacuumCard,
  VolatilityGateCard,
  ZeroDteVannaControlCard,
  type VannaPillarId,
} from "@/components/optionsflow/VannaEnginePanels";
import {
  CharmAccelerationCard,
  CharmBalanceSheetCard,
  CharmCentersCard,
  CharmConcentrationRow,
  CharmConfluenceCard,
  CharmConsensusTable,
  CharmDealerSignUncertaintyCard,
  CharmDeadZoneCard,
  CharmDiagnosticStrip,
  CharmFieldChart,
  CharmGateCard,
  CharmHeatmapGrid,
  CharmHeroBanner,
  CharmLinearizationRiskCard,
  CharmOiFreshnessCard,
  CharmPillarNav,
  CharmPillarSummaryCards,
  CharmPivotTable,
  CharmRotationZoneCard,
  CharmShelfTable,
  DeltaDestinationChart,
  ExpiryDiscontinuityCard,
  FlowScheduleChart,
  ForwardCharmClockTable,
  GammaConflictCard,
  HedgeTimingNoteCard,
  HorizonFlowTable,
  LateDaySurgeCard,
  ReversalRiskCard,
  VannaContaminationCard,
  ZeroDteCharmControlCard,
  type CharmPillarId,
} from "@/components/optionsflow/CharmEnginePanels";
import { LevelListPanel, ReversalDiagnosticStrip } from "@/components/optionsflow/ReversalEnginePanels";
import { BlindSpotsLadder } from "@/components/optionsflow/BlindSpotsPanel";
import { OpFloCard } from "@/components/optionsflow/OpFloPanel";

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-2 border-b border-[var(--border)] pb-2 font-mono text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-[var(--text-dim)]">
      {children}
    </div>
  );
}

export type OptionsFlowView = "gex" | "dex" | "theta" | "vanna" | "charm" | "reversal" | "blindspots" | "opflo";

const SYMBOLS: GexSymbol[] = ["QQQ", "SPY"];

const ENGINE_LABEL: Record<PricerEngine, string> = {
  bs: "BLACK-SCHOLES",
  american: "AMERICAN TREE (LIVE SMILE)",
  crr: "CRR BINOMIAL + ARB-CONTROLLED SMILE",
};
const ENGINE_ORDER: PricerEngine[] = ["bs", "american", "crr"];

function SymbolToggle({ symbol, onChange }: { symbol: GexSymbol; onChange: (s: GexSymbol) => void }) {
  return (
    <div className="inline-flex border border-[var(--border)]">
      {SYMBOLS.map((s) => (
        <button
          key={s}
          onClick={() => onChange(s)}
          className={`px-4 py-1.5 font-mono text-[0.72rem] font-semibold tracking-[0.08em] transition-colors duration-150 ${
            s === symbol ? "bg-[var(--text)] text-[var(--bg)]" : "text-[var(--text-dim)] hover:text-[var(--text)]"
          }`}
        >
          {s}
        </button>
      ))}
    </div>
  );
}

/** bs = closed-form Black-Scholes on the SVI-smoothed smile. american = Leisen-Reimer binomial tree (prices early exercise) on each strike's own live, unsmoothed quoted IV. */
function EngineToggle({ engine, onChange }: { engine: PricerEngine; onChange: (e: PricerEngine) => void }) {
  return (
    <div className="inline-flex flex-wrap border border-[var(--border)]">
      {ENGINE_ORDER.map((e) => (
        <button
          key={e}
          onClick={() => onChange(e)}
          className={`px-4 py-1.5 font-mono text-[0.68rem] font-semibold tracking-[0.06em] transition-colors duration-150 ${
            e === engine ? "bg-[var(--accent)] text-[var(--bg)]" : "text-[var(--text-dim)] hover:text-[var(--text)]"
          }`}
        >
          {ENGINE_LABEL[e]}
        </button>
      ))}
    </div>
  );
}

/** Projects a GexResponse onto the chosen engine's per-strike rows/stats, so every view component can stay engine-agnostic. */
function withEngine(data: GexResponse, engine: PricerEngine): GexResponse {
  if (engine === "bs") return data;
  const source = engine === "american" ? data.american : data.crr;
  return {
    ...data,
    perStrike: source.perStrike,
    totalGex0dte: source.totalGex0dte,
    callWall: source.callWall,
    putWall: source.putWall,
    kingNode: source.kingNode,
    gammaFlip: source.gammaFlip,
  };
}

function StatTile({ label, value, tone }: { label: string; value: string; tone?: "up" | "down" | "neutral" }) {
  const color = tone === "up" ? "var(--up)" : tone === "down" ? "var(--down)" : "var(--text)";
  return (
    <div className="border border-[var(--border)] bg-[var(--panel)] p-4">
      <div className="partno mb-2" style={{ color: "var(--text-faint)" }}>
        {label}
      </div>
      <div className="font-mono text-[1.15rem] font-semibold" style={{ color }}>
        {value}
      </div>
    </div>
  );
}

function tone(n: number): "up" | "down" | "neutral" {
  if (n > 0) return "up";
  if (n < 0) return "down";
  return "neutral";
}

/** A titled card wrapping one visualization, consistent chrome across bar/heatmap views. */
function VisualCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="border border-[var(--border)] bg-[var(--panel)] p-5">
      <div className="mb-4 flex items-baseline justify-between gap-2">
        <div className="partno" style={{ color: "var(--text-faint)" }}>
          {title}
        </div>
        {subtitle && <div className="font-mono text-[0.64rem] text-[var(--text-faint)]">{subtitle}</div>}
      </div>
      {children}
    </div>
  );
}

type GexProfileMode = "net" | "gross" | "density";

function GexProfileModeToggle({ mode, onChange }: { mode: GexProfileMode; onChange: (m: GexProfileMode) => void }) {
  const options: { id: GexProfileMode; label: string }[] = [
    { id: "net", label: "NET GEX" },
    { id: "gross", label: "GROSS GEX" },
    { id: "density", label: "GAMMA DENSITY" },
  ];
  return (
    <div className="inline-flex border border-[var(--border)]">
      {options.map((o) => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          className={`px-3 py-1 font-mono text-[0.64rem] font-semibold tracking-[0.05em] transition-colors duration-150 ${
            o.id === mode ? "bg-[var(--text)] text-[var(--bg)]" : "text-[var(--text-dim)] hover:text-[var(--text)]"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function GexExposureView({ data }: { data: GexResponse }) {
  const [mode, setMode] = useState<GexProfileMode>("net");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [pillar, setPillar] = useState<PillarId>("regime");
  const top = useMemo(() => nearStrikeWindow(data.perStrike, data.spot, 22), [data]);
  const gp = data.gexPage;
  const ge = data.gammaEngine;

  const chartData: ExposureBarDatum[] = useMemo(() => {
    if (mode === "net") return top.map((r) => ({ strike: r.strike, net: r.gex }));
    if (mode === "gross") return top.map((r) => ({ strike: r.strike, call: Math.abs(r.callGex), put: Math.abs(r.putGex) }));
    const maxGross = Math.max(1e-9, ...top.map((r) => Math.abs(r.callGex) + Math.abs(r.putGex)));
    return top.map((r) => ({ strike: r.strike, net: ((Math.abs(r.callGex) + Math.abs(r.putGex)) / maxGross) * 100 }));
  }, [top, mode]);

  const emLow = data.zeroDte ? data.spot - data.zeroDte.expectedMove1s : data.spot * 0.98;
  const emHigh = data.zeroDte ? data.spot + data.zeroDte.expectedMove1s : data.spot * 1.02;

  const markers: ExposureMarker[] = [
    { value: data.spot, label: "Spot", color: "var(--text)" },
    { value: data.callWall, label: "Call wall", color: "var(--up)" },
    { value: data.putWall, label: "Put wall", color: "var(--down)" },
    ...(data.gammaFlip !== null ? [{ value: data.gammaFlip, label: "Flip", color: "var(--accent)" }] : []),
    { value: emLow, label: "EM low", color: "var(--text-faint)" },
    { value: emHigh, label: "EM high", color: "var(--text-faint)" },
  ];

  const nearestLevel = ge ? [...ge.typedLevels].sort((a, b) => Math.abs(a.center - data.spot) - Math.abs(b.center - data.spot))[0] ?? null : null;

  return (
    <div className="flex flex-col gap-6">
      <p className="m-0 font-sans text-[0.85rem] leading-relaxed text-[var(--text-dim)]">
        {data.symbol} 0DTE book ({data.resolvedExpiry}) — the Gamma Decision Engine below is built from this live
        chain snapshot plus scenario repricing across price, time, IV, smile-response, and dealer-sign assumptions,
        not historical data. Raw per-strike detail (feedback curve, wall quality, speed/color/zomma, etc.) lives
        under "advanced" at the bottom.
      </p>

      {ge && (
        <>
          <HeroBanner heroStatement={ge.heroStatement} phase={ge.phase} />

          <PillarSummaryCards
            active={pillar}
            onChange={setPillar}
            phase={ge.phase}
            consensus={ge.consensus}
            nearestLevel={nearestLevel}
            confluence={ge.confluence}
            cliffRisk={ge.cliffRisk}
            cascadeRisks={ge.cascadeRisks}
            oiFreshness={ge.oiFreshness}
            inventoryUncertainty={ge.inventoryUncertainty}
            zeroDteControlPct={ge.zeroDteControlPct}
            concentrationEffectiveStrikes={gp?.concentration.effectiveStrikes ?? 0}
            cancellationRatio={ge.balanceSheet.cancellationRatio}
          />

          <PillarNav active={pillar} onChange={setPillar} />

          {pillar === "regime" && (
            <>
              <VisualCard title="GAMMA PHASE MAP" subtitle="Price × time-to-expiry, colored by consensus-direction net GEX">
                <HowToUse
                  use="This is the main chart: it shows not just today's regime, but how it could evolve through the rest of the session. Green = positive/stabilizing gamma, red = negative/amplifying; darker = larger magnitude; faded = the two dealer-sign scenarios checked here disagree on direction at that cell, so trust it less. The outlined column is current spot."
                  source="Static-model conventional-sign net GEX at each (price, minutes-to-expiry) grid point, closed-form Black-Scholes; opacity from a 2-scenario (conventional vs. dealers-short-all) agreement check."
                />
                <PhaseMapChart phaseMap={ge.phaseMap} spot={data.spot} />
              </VisualCard>
              <VisualCard title="GAMMA CONSENSUS" subtitle="Median across 4 pricing models × 6 dealer-sign scenarios, not one fragile estimate">
                <HowToUse
                  use="The models mostly agree exactly at today's actual spot (they only diverge once you reprice at a hypothetical price/vol - see Surface Model Risk under Key Risks); the dealer-sign scenarios are where the real uncertainty at the current snapshot lives, since a public chain can't reveal which side of each trade the dealer actually took."
                  source="4 gamma models (static, smile-aware, sticky-delta approximation, tail-aware Corrado-Su) × 6 dealer-sign weightings, evaluated at current spot."
                />
                <ConsensusTable consensus={ge.consensus} />
              </VisualCard>
            </>
          )}

          {pillar === "levels" && (
            <>
              <VisualCard title="TYPED GAMMA LEVELS" subtitle="Pin basin · friction wall · launch edge · vacuum gate — not just the strikes with the largest bars">
                <HowToUse
                  use="Pin basins (narrow, symmetric, positive) are where mean-reversion pressure is structurally supported. Friction walls are broader or one-sided high-gamma ridges. Launch edges are where the regime flips from stabilizing to amplifying - useful for breakouts, not reversals. Vacuum gates are low-density corridors with little modeled resistance if price gets there."
                  source="A continuous gamma density built from the current chain (Gaussian-smoothed |GEX|-weighted sum around each hypothetical price), then classified by peak width, local symmetry, and zero-crossing steepness."
                />
                <TypedLevelLadder levels={ge.typedLevels} />
              </VisualCard>
              <VisualCard title="0DTE–NEXT EXPIRY GAMMA CONFLUENCE" subtitle="Compared against whichever dte>0 expiry currently carries the most gross gamma, not a fixed 4DTE">
                <HowToUse
                  use="Reinforcing confluence means today's wall and the next dominant expiry's wall line up and agree in direction - a more durable level. Opposing means they disagree. 0DTE-only or weekly-only means one side dominates and there's nothing to compare against yet."
                  source="/option-matrix per-expiration net GEX and call-resistance/put-support; the next-expiry per-strike breakdown isn't available from this source, so the overlap uses a coarser proxy than a true per-strike comparison - stated plainly."
                />
                <ConfluenceCard confluence={ge.confluence} />
              </VisualCard>
              <VisualCard title="GEX BY STRIKE" subtitle="Net GEX, 22 strikes nearest spot">
                <HowToUse
                  use="Green bars above zero = dealers estimated net long gamma at that strike (stabilizing); red bars below zero = net short gamma (amplifying). Cross-reference against the typed levels above."
                  source="Same 0DTE chain, repriced through the selected pricer engine above."
                />
                <ExposureBarChart data={top.map((r) => ({ strike: r.strike, net: r.gex }))} mode="net" unitLabel="GEX" markers={markers} />
              </VisualCard>
            </>
          )}

          {pillar === "risks" && (
            <>
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <VisualCard title="GAMMA CLIFF RISK" subtitle="Where a small move produces a large regime change">
                  <CliffRiskCard cliffRisk={ge.cliffRisk} />
                </VisualCard>
                <VisualCard title="OI FRESHNESS RISK" subtitle="Open interest is a daily snapshot, not live positioning">
                  <OiFreshnessCard freshness={ge.oiFreshness} />
                </VisualCard>
              </div>
              <VisualCard title="CASCADE RISK" subtitle="Simulated hedge requirement from spot through the nearest launch edge into the next ridge">
                <HowToUse
                  use="Not a generic negative-GEX warning - this is the estimated dealer hedging flow specifically required to travel from spot through the nearest launch edge to the next real gamma ridge, sized against recent trading volume."
                  source="Riemann-sum extension of the same gamma-only hedge-share formula used elsewhere on this page, integrated across the price path instead of a single small bump."
                />
                <CascadeRiskCards risks={ge.cascadeRisks} />
              </VisualCard>
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <VisualCard title="DEALER INVENTORY RISK" subtitle="Disagreement across the 6 dealer-sign scenarios">
                  <InventoryUncertaintyCard uncertainty={ge.inventoryUncertainty} />
                </VisualCard>
                <VisualCard title="SURFACE MODEL RISK" subtitle="How much the 4 gamma models disagree once repriced">
                  <SurfaceModelRiskCard risk={ge.surfaceModelRisk} />
                </VisualCard>
              </div>
              <VisualCard title="PIN FAILURE RISK" subtitle="Scenario fragility, not a historical probability">
                <HowToUse
                  use="For every detected pin basin, this tests whether it stays a genuine positive-gamma convergence point across a grid of price/time/IV perturbations. High fragility means the basin is a fair-weather read, not a durable structural feature."
                  source="Price ±0.10/0.25/0.50%, time decay in steps, IV ±1/2 vol points - a reduced scenario set for compute budget, not the full combinatorial cross product."
                />
                <PinFailureRiskList risks={ge.pinFailureRisks} />
              </VisualCard>
            </>
          )}

          {pillar === "structure" && (
            <>
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <VisualCard title="GAMMA BALANCE SHEET" subtitle="Gross positive, gross negative, net, and how much cancels out">
                  <BalanceSheetCard sheet={ge.balanceSheet} />
                </VisualCard>
                <VisualCard title="GAMMA CENTER OF GRAVITY" subtitle="OI-weighted average strike, not just the two walls">
                  <CenterOfGravityCard cog={ge.centerOfGravity} />
                </VisualCard>
              </div>
              {gp && (
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                  <VisualCard title="GAMMA CONCENTRATION">
                    <ConcentrationRow stats={gp.concentration} />
                  </VisualCard>
                  <VisualCard title="UPPER VS. LOWER ASYMMETRY">
                    <AsymmetryRow stats={gp.asymmetry} />
                  </VisualCard>
                </div>
              )}
              <VisualCard title="FORWARD GAMMA CLOCK" subtitle="Deterministic forward decay of the current book, not a historical projection">
                <HowToUse
                  use="Holds spot and today's smile constant, then recalculates the whole structure at each point in time as the session runs down. Watch how the pin basin, flip, and cliff move - a basin that stays put across the clock is more durable than one that drifts or disappears."
                  source="The static-model conventional-sign book, re-derived at each snapshot's own time-to-expiry."
                />
                <ForwardClockTable snapshots={ge.forwardClock} />
              </VisualCard>
            </>
          )}

          <DiagnosticStrip
            pricingEngine={ge.diagnostics.pricingEngine}
            ivSurfaceFitError={ge.diagnostics.ivSurfaceFitError}
            validContracts={ge.diagnostics.validContracts}
            dealerSignAssumption={ge.diagnostics.dealerSignAssumption}
            modelDispersionLabel={ge.diagnostics.modelDispersionLabel}
            oiFreshnessLabel={ge.diagnostics.oiFreshnessLabel}
            lastCalculatedAt={ge.diagnostics.lastCalculatedAt}
          />

          <AdvancedToggle open={advancedOpen} onToggle={() => setAdvancedOpen((v) => !v)} />
        </>
      )}

      {gp && advancedOpen && (
        <>
          <div className="flex items-center justify-between">
            <SectionTitle>1 · DETAILED GEX STRIKE PROFILE</SectionTitle>
            <GexProfileModeToggle mode={mode} onChange={setMode} />
          </div>
          <VisualCard title="GEX BY STRIKE" subtitle={`${mode === "net" ? "Net" : mode === "gross" ? "Gross (call/put split)" : "Density (% of peak)"} — 22 strikes nearest spot`}>
            <HowToUse
              use={
                mode === "net"
                  ? "Green bars above zero = dealers estimated net long gamma at that strike (their hedging tends to stabilize price there); red bars below zero = net short gamma (hedging tends to amplify a move through there)."
                  : mode === "gross"
                    ? "Call (green) and put (red) contributions shown separately without canceling out - use this when net GEX looks small but you suspect it's actually two large offsetting positions, not genuinely quiet."
                    : "Each strike's gross gamma scaled to % of the single biggest strike - use this to spot concentration at a glance without reading raw dollar values."
              }
              source={`${data.symbol} 0DTE chain from /zero_dte (strike, side, open interest, IV), repriced through whichever pricer engine is selected above (Black-Scholes / American tree / CRR).`}
            />
            <ExposureBarChart data={chartData} mode={mode === "gross" ? "split" : "net"} unitLabel={mode === "density" ? "%" : "GEX"} markers={markers} />
            <MarkerLegend
              items={[
                { label: "Spot", value: fmtNum(data.spot, 2), color: "var(--text)" },
                { label: "Call wall", value: fmtNum(data.callWall, 0), color: "var(--up)" },
                { label: "Put wall", value: fmtNum(data.putWall, 0), color: "var(--down)" },
                ...(data.gammaFlip !== null ? [{ label: "Gamma flip", value: fmtNum(data.gammaFlip, 2), color: "var(--accent)" }] : []),
                { label: "Expected-move low", value: fmtNum(emLow, 2), color: "var(--text-faint)" },
                { label: "Expected-move high", value: fmtNum(emHigh, 2), color: "var(--text-faint)" },
              ]}
            />
          </VisualCard>
          <VisualCard title="GEX HEATMAP" subtitle="Same data, intensity-scaled — useful for a quick scan across many strikes at once">
            <ExposureHeatmap data={chartData} mode={mode === "gross" ? "split" : "net"} />
          </VisualCard>

          <SectionTitle>2 · GAMMA FEEDBACK CURVE</SectionTitle>
          <VisualCard title="AGGREGATE GEX ACROSS HYPOTHETICAL PRICE" subtitle="The scenario surface's 'now' row, stretched into a smooth line">
            <HowToUse
              use="Trace the curve from left to right: every place it crosses zero is a gamma flip (not just the one nearest spot), and the steepness between crossings shows whether the regime changes gradually or abruptly. A flat stretch near zero over a wide price range is a genuinely uncertain regime, not a typo."
              source="Same repricing as the scenario surface above, at the current time-to-expiry only, sampled across a finer price grid for a smoother line."
            />
            <GammaFeedbackChart curve={gp.feedbackCurve} spot={data.spot} callWall={data.callWall} putWall={data.putWall} gammaFlip={data.gammaFlip} emLow={emLow} emHigh={emHigh} />
            <MarkerLegend
              items={[
                { label: "Spot", value: fmtNum(data.spot, 2), color: "var(--text)" },
                { label: "Call wall", value: fmtNum(data.callWall, 0), color: "var(--up)" },
                { label: "Put wall", value: fmtNum(data.putWall, 0), color: "var(--down)" },
                ...(data.gammaFlip !== null ? [{ label: "Gamma flip (dot)", value: fmtNum(data.gammaFlip, 2), color: "var(--accent)" }] : []),
                { label: "Expected move", value: `${fmtNum(emLow, 1)}–${fmtNum(emHigh, 1)}`, color: "var(--text-faint)" },
              ]}
            />
          </VisualCard>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="flex flex-col gap-3">
              <SectionTitle>3/4 · GAMMA TRANSITION &amp; CLIFF MAP</SectionTitle>
              <VisualCard title="PRICE LADDER" subtitle="Nearest to spot">
                <HowToUse
                  use='"Transition intensity" and "cliff score" answer a different question than distance-to-flip: how violently would the gamma regime change if price moved a little from THIS price. A price can be near the flip but classified "low" (smooth), while another price further away is a "cliff" (a small move there swings the regime hard). Use this to find where a slow grind vs. a sharp regime flip is more likely.'
                  source="First and second numerical derivative of the gamma feedback curve above (section 3)."
                />
                <TransitionCliffTable rows={gp.transitionLadder} spot={data.spot} />
              </VisualCard>
            </div>
            <div className="flex flex-col gap-3">
              <SectionTitle>5 · GAMMA FLIP BAND</SectionTitle>
              <VisualCard title="FLIP UNDER SEVERAL DEALER-SIGN ASSUMPTIONS" subtitle="Not one number">
                <HowToUse
                  use="A public option chain can't reveal which side of each trade the dealer actually took, so the exact flip level is an estimate, not an observed fact. A narrow band + high sign agreement means the flip location is robust to that uncertainty; a wide band means don't lean on a single flip number here."
                  source="The same chain re-derived 7 times: standard dealer-sign convention, reduced/increased put or call weighting, and ±1 vol-point IV shifts."
                />
                <GammaFlipBandCard band={gp.gammaFlipBand} />
              </VisualCard>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="flex flex-col gap-3">
              <SectionTitle>6 · GAMMA WALL QUALITY</SectionTitle>
              <VisualCard title="DOMINANCE · SHARE · BREADTH · STABILITY" subtitle="A narrow spike can have high GEX but low wall quality">
                <HowToUse
                  use="Higher wall-quality score = more trustworthy level: it dominates its neighborhood, carries real share of total book gamma, has nearby strikes reinforcing it (not an isolated spike), and stays a top strike even when spot/time are nudged. A high-GEX strike with a low score here can evaporate on a single large trade."
                  source="Dominance/share/breadth from the current chain's per-strike GEX; stability from repricing at 5 nearby (price, time) scenarios and checking whether the strike stays in the top 8 by |GEX|."
                />
                <WallQualityTable rows={gp.wallQuality} />
              </VisualCard>
            </div>
            <div className="flex flex-col gap-3">
              <SectionTitle>7 · REACHABILITY-WEIGHTED GEX</SectionTitle>
              <VisualCard title="GAMMA INTERACTION RANK" subtitle="Touch-probability-adjusted, not a reversal prediction">
                <HowToUse
                  use="Raw GEX rank treats every strike as equally reachable today, which isn't true - a huge wall far outside today's realistic range matters less than a moderate one right near spot. The adjusted rank multiplies |GEX| by an estimated touch probability, so watch the adjusted-rank column, not the raw one, for what's actually likely to matter before the close."
                  source="Touch probability via the reflection-principle formula, using ATM IV from /zero_dte and hours remaining to expiry."
                />
                <ReachabilityTable rows={gp.reachability} />
              </VisualCard>
            </div>
          </div>

          <SectionTitle>8 · GAMMA PINNING BASIN (DETAIL)</SectionTitle>
          <VisualCard title="MODEL-IMPLIED PINNING PRESSURE" subtitle="A range, not a single predicted close">
            <HowToUse
              use="This is a region of strikes, not one 'max pain' number, where stabilizing hedging may concentrate enough to slow price down. The center is the score-weighted middle of that range; if price closes below the stated breakdown level, the basin's own logic (positive gamma, both-side support) no longer applies, so treat it as invalidated below that point."
              source="Per-strike concentration × touch probability × the same scenario-stability check as wall quality × how symmetric nearby gamma is on both sides of the strike."
            />
            <PinningBasinCard basins={gp.pinningBasins} />
          </VisualCard>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="flex flex-col gap-3">
              <SectionTitle>9 · GAMMA CONCENTRATION</SectionTitle>
              <VisualCard title="HHI · ENTROPY · EFFECTIVE STRIKES">
                <HowToUse
                  use="High HHI / low effective-strikes count = a couple of strikes control the whole gamma book, so it can flip fast if one strike's OI shifts. Low HHI / high effective count = gamma is spread broadly, which tends to make the regime steadier. 'Effective gamma strikes' is the easiest number to read directly: it's roughly how many equally-weighted strikes would produce the same concentration."
                  source="Herfindahl-Hirschman index and Shannon entropy over each strike's share of total |GEX| across the current chain."
                />
                <ConcentrationRow stats={gp.concentration} />
              </VisualCard>
            </div>
            <div className="flex flex-col gap-3">
              <SectionTitle>10 · UPPER VS. LOWER ASYMMETRY</SectionTitle>
              <VisualCard title="GAMMA PLACEMENT AROUND SPOT">
                <HowToUse
                  use="Shows which side of spot the book's gamma actually sits on. Strongly positive = upside strikes dominate (rallies may meet more resistance getting through); strongly negative = downside dominates. Near zero (the common case) means gamma is fairly balanced above/below spot right now - that's a real reading, not a broken one, when call/put walls sit roughly equidistant from spot."
                  source="Sum of |GEX| (and, separately, signed GEX) for strikes above vs. below current spot."
                />
                <AsymmetryRow stats={gp.asymmetry} />
              </VisualCard>
            </div>
          </div>

          <SectionTitle>11 · DISTANCE-ADJUSTED GAMMA PRESSURE</SectionTitle>
          <VisualCard title="FULL BOOK VS. EXPECTED-MOVE-ADJUSTED VS. NEAR-SPOT">
            <HowToUse
              use="Full-book net GEX (top card) includes every strike, even deep OTM noise. Compare it against the expected-move-adjusted figure (only strikes within today's realistic range) and the near-spot figure (distance-decay-weighted) - if they're similar, the headline number is mostly real near-spot positioning; if they diverge a lot, far OTM strikes are swinging the headline number more than what's actually reachable today."
              source="expectedMove1s from /zero_dte sets the distance scale (lambda) for both the hard window and the soft decay weighting."
            />
            <ProximityRow stats={gp.proximity} />
          </VisualCard>

          <SectionTitle>12 · GAMMA-DRIVEN HEDGE REQUIREMENT SCENARIOS</SectionTitle>
          <VisualCard title="ESTIMATED DEALER HEDGE SHARES" subtitle="Linear gamma-only approximation, not a full reprice">
            <HowToUse
              use="Rough estimate of shares dealers would need to trade to stay delta-hedged if spot moved this much right now, from gamma alone. The impact ratio divides that by the live 5-minute candle's volume - a small ratio means the hedging flow is minor next to current trading activity; a ratio approaching or exceeding 100% means the hedging flow alone could be a meaningful fraction of all volume in that window."
              source="Net GEX scaled by move % and spot (closed-form, not bump-and-reprice); volume from the live 5-minute /chart candle for this symbol."
            />
            <HedgeScenarioTable rows={gp.hedgeScenarios} />
          </VisualCard>

          <SectionTitle>13 · CROSS-EXPIRY GAMMA STACK</SectionTitle>
          <VisualCard title="HOW MUCH THE SAME-DAY CHAIN DOMINATES">
            <HowToUse
              use="High 0DTE gamma control % means today's chain is what actually drives dealer hedging right now; a low % means next week's or a monthly expiry's OI dominates the total book, and today's 0DTE moves may get overwhelmed by longer-dated hedging flow instead."
              source="/option-matrix's per-expiration net GEX, summed by |value| and expressed as a share of the total across every expiry it returns. Best-effort upstream call - shows 'unavailable' if it doesn't land in time."
            />
            <CrossExpiryStackTable stack={gp.crossExpiryStack} />
          </VisualCard>

          <SectionTitle>14 · 0DTE–NEXT EXPIRY GAMMA CONFLUENCE</SectionTitle>
          <VisualCard title="SAME-DAY GAMMA VS. THE STRONGEST NEARBY WEEKLY" subtitle="Next dominant expiry floats with the calendar (largest OI among dte>0, not a fixed 4DTE)">
            <HowToUse
              use="When aligned, the same strike is a wall in both today's 0DTE book AND the next big expiry's book - a more durable level than either alone, since it isn't just a same-day artifact that resets tomorrow. 'None' doesn't mean nothing is happening; it means the two books currently disagree on where the wall sits."
              source="0DTE call/put wall (section 1) compared against /option-matrix's call_resistance/put_support for whichever dte>0 expiry currently carries the largest total open interest."
            />
            <GammaConfluenceCard confluence={gp.gammaConfluence} />
          </VisualCard>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="flex flex-col gap-3">
              <SectionTitle>15 · SPEED EXPOSURE</SectionTitle>
              <VisualCard title="d(GAMMA)/dS BY STRIKE" subtitle="How fast gamma itself changes as spot moves - one derivative past GEX">
                <HowToUse
                  use="GEX tells you how much gamma exists right now; speed tells you how fast that gamma itself would change for a small move in spot. A strike with modest GEX but large speed is where the gamma picture could shift quickly on a small move - GEX alone won't show that."
                  source="Third derivative of option price with respect to spot (5-point finite-difference stencil), dollar-scaled the same way as GEX, same dealer-sign convention (call +, put -)."
                />
                <ExposureBarChart
                  data={nearStrikeWindow(gp.speedExposure.perStrike, data.spot, 22).map((r) => ({ strike: r.strike, net: r.speed }))}
                  mode="net"
                  unitLabel="Speed"
                />
              </VisualCard>
            </div>
            <div className="flex flex-col gap-3">
              <SectionTitle>16 · COLOR-ADJUSTED FORWARD GEX</SectionTitle>
              <VisualCard title="LINEAR PROJECTION VS. ACTUAL REPRICE" subtitle="How well a simple linear time-decay estimate holds up">
                <HowToUse
                  use="The linear projection assumes gamma decays at today's current rate (via 'color') in a straight line; the actual reprice column is the same full nonlinear repricing the scenario surface (section 2) uses. Small divergence = the linear shortcut is fine for that horizon; growing divergence at longer horizons is expected and shows where you should stop trusting the linear number."
                  source="Color = d(Gamma)/dT, bump-and-reprice; actual reprice = same closed-form Black-Scholes engine as section 2, held at current spot."
                />
                <ColorForwardTable rows={gp.colorForward} />
              </VisualCard>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="flex flex-col gap-3">
              <SectionTitle>17 · ZOMMA / IV-SCENARIO GEX</SectionTitle>
              <VisualCard title="d(GAMMA)/d(VOL) BY STRIKE, AND NET GEX ACROSS A UNIFORM IV SHIFT" subtitle="Section 2/3 vary price; this varies IV instead, holding price fixed at spot">
                <HowToUse
                  use="Zomma bars: which strikes' gamma is most sensitive to an IV change (not a price change) - a strike with large zomma can flip from a minor to a major gamma contributor purely from IV moving, no spot move needed. IV-scenario table: if IV parallel-shifts by the stated number of vol points right now (spot unchanged), this is what net GEX becomes - the highlighted row is today's actual IV level."
                  source="Zomma via bump-and-reprice gamma at ±1 vol point; IV-scenario table reprices the whole chain with every quote shifted by a uniform vol offset."
                />
                <ExposureBarChart
                  data={nearStrikeWindow(gp.zommaExposure.perStrike, data.spot, 22).map((r) => ({ strike: r.strike, net: r.zomma }))}
                  mode="net"
                  unitLabel="Zomma"
                />
                <div className="mt-4">
                  <IvScenarioTable points={gp.ivScenarioCurve} />
                </div>
              </VisualCard>
            </div>
            <div className="flex flex-col gap-3">
              <SectionTitle>18 · GAMMA FLIP GRADIENT</SectionTitle>
              <VisualCard title="HOW FAST THE FLIP LEVEL ITSELF MOVES" subtitle="A continuous-parameter question, distinct from the flip band's discrete dealer-sign scenarios">
                <HowToUse
                  use="This isn't about which dealer-sign assumption is right (that's the flip band, section 6) - it's about how much the flip level drifts from everyday IV and time drift alone. A steep number here means the flip is a moving target even without anything unusual happening; a flat number means it's comparatively anchored."
                  source="Central finite difference of the flip's zero-crossing location, bumping IV by ±1 vol point and bumping time by ~10 minutes."
                />
                <GammaFlipGradientCard gradient={gp.gammaFlipGradient} />
              </VisualCard>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="flex flex-col gap-3">
              <SectionTitle>19 · SURFACE-ADJUSTED GEX</SectionTitle>
              <VisualCard title="STICKY-STRIKE VS. STICKY-MONEYNESS" subtitle="What the frozen-IV assumption used everywhere else on this page actually costs">
                <HowToUse
                  use="Every other scenario on this page freezes each strike's IV as spot moves (sticky-strike). This instead recomputes each strike's IV from the fitted smile at its new moneyness (sticky-moneyness) at a few nearby prices. A small divergence means the frozen-IV shortcut used elsewhere barely matters here; a large one means the smile's own shape is doing real work that the simpler scenarios are missing."
                  source="Sticky-moneyness IV via the same SVI fit used to smooth the Black-Scholes engine's smile (see /zero_dte + SVI fit in route.ts)."
                />
                <SurfaceAdjustedTable rows={gp.surfaceAdjusted} />
              </VisualCard>
            </div>
            <div className="flex flex-col gap-3">
              <SectionTitle>20 · IMPLIED SKEWNESS &amp; KURTOSIS</SectionTitle>
              <VisualCard title="FROM TODAY'S SMILE, NOT PAST RETURNS" subtitle="Different from the historical skew/kurtosis shown elsewhere in this app">
                <HowToUse
                  use="This describes the shape of the terminal distribution the OPTION SMILE is pricing in right now (via Breeden-Litzenberger), not what actually happened historically. Negative skew = the market is pricing a fatter downside tail than upside; high excess kurtosis = fatter tails than a lognormal distribution, i.e. the smile is pricing more tail risk than a plain constant-vol model would."
                  source="Second derivative of the Black-Scholes call price with respect to strike (using the fitted SVI smile's IV at each strike), normalized into a density in log-moneyness space."
                />
                <ImpliedMomentsRow moments={gp.impliedMoments} />
              </VisualCard>
            </div>
          </div>

          <p className="m-0 border-t border-[var(--border)] pt-4 font-mono text-[0.62rem] leading-relaxed text-[var(--text-faint)]">
            Assumptions disclosed: dealer sign convention is "long calls, short puts" unless a gamma-flip-band scenario
            says otherwise (not observed fact - OI doesn't reveal the true dealer side). Scenario repricing (feedback
            curve, transition/cliff, flip band, wall-quality stability) always uses closed-form Black-Scholes on the
            SVI-smoothed smile for grid speed, independent of the page's own pricer-engine toggle above. Touch
            probabilities use ATM IV uniformly, not each strike's own smile-local IV. Hedge-share scenarios are a
            linear gamma-only approximation (no bump-and-reprice), scaled directly off net GEX. Cross-expiry data
            (sections 13-14) depends on the upstream option-matrix endpoint, which is best-effort and can time out.
            Speed/color/zomma (sections 15-17) are dollar-scaled with the same Greek×OI×spot²×0.01 convention this
            page uses for GEX/DEX/vega - a stated, consistent choice, not a claimed industry-standard "dollar speed"
            (no such standard exists the way it does for GEX/DEX). Implied skewness/kurtosis (section 20) describes
            today's option smile, not historical realized returns.
          </p>
        </>
      )}
    </div>
  );
}

function DexExposureView({ data }: { data: GexResponse }) {
  const [deltaPillar, setDeltaPillar] = useState<DeltaPillarId>("regime");
  const top = useMemo(() => nearStrikeWindow(data.perStrike, data.spot, 22), [data]);
  const chartData: ExposureBarDatum[] = top.map((r) => ({ strike: r.strike, net: r.dex }));
  const de = data.deltaEngine;

  const nearestShelf = de ? [...de.deltaShelves].sort((a, b) => Math.abs(a.center - data.spot) - Math.abs(b.center - data.spot))[0] ?? null : null;
  const nearestTrigger = de ? [...de.rehedgeTriggers].sort((a, b) => Math.abs(a.price - data.spot) - Math.abs(b.price - data.spot))[0] ?? null : null;
  const worstUnwind = de ? [...de.unwindScenarios].sort((a, b) => (b.impactRatio ?? 0) - (a.impactRatio ?? 0))[0] ?? null : null;

  return (
    <div className="flex flex-col gap-6">
      <p className="m-0 font-sans text-[0.85rem] leading-relaxed text-[var(--text-dim)]">
        {data.symbol} 0DTE book ({data.resolvedExpiry}) — the Delta Decision Engine below answers a different question
        than the GEX page: not how hedge sensitivity changes with price, but what underlying-equivalent hedge
        inventory is implied by the option book right now, and how that inventory would rotate under defined
        scenarios. Current DEX is inventory, not flow - it does not imply dealers still need to execute the whole
        hedge, or that it isn't already offset elsewhere (see the cross-product warning at the bottom).
      </p>

      {de && (
        <>
          <DeltaHeroBanner heroStatement={de.heroStatement} phase={de.phase} />

          <DeltaPillarSummaryCards
            active={deltaPillar}
            onChange={setDeltaPillar}
            phase={de.phase}
            consensus={de.consensus}
            balanceSheet={de.balanceSheet}
            inventoryPivot={de.inventoryPivot}
            nearestShelf={nearestShelf}
            nearestTrigger={nearestTrigger}
            confluence={de.confluence}
            worstUnwind={worstUnwind}
            gapRisk={de.gapRisk}
            oiFreshness={de.oiFreshness}
            hedgeCrowding={de.hedgeCrowding}
            concentrationEffectiveStrikes={de.concentration.effectiveStrikes}
          />

          <DeltaPillarNav active={deltaPillar} onChange={setDeltaPillar} />

          {deltaPillar === "regime" && (
            <>
              <VisualCard title="OPTION-BOOK DELTA VS. THEORETICAL HEDGE" subtitle="Always shown together — positive DEX does not mean dealers are buying right now">
                <HowToUse
                  use="The option book's own delta and the theoretical dealer hedge are opposite signs by construction. A positive option-book delta implies a theoretical SHORT underlying hedge, not immediate buying - read both numbers together, never the top one alone."
                  source={`${data.symbol} 0DTE chain from /zero_dte, repriced through the selected pricer engine above.`}
                />
                <OptionBookVsHedgeCard balanceSheet={de.balanceSheet} />
              </VisualCard>
              <VisualCard title="DELTA CONSENSUS" subtitle="2 delta views × 6 dealer-sign scenarios, not one fragile estimate">
                <HowToUse
                  use="The static and surface-consistent views mostly agree at today's actual spot; the dealer-sign scenarios are where the real uncertainty lives, since a public chain can't reveal which side of each trade the dealer actually took."
                  source="Static (frozen IV) and surface-consistent (sticky-moneyness) delta, each under 6 dealer-position-sign weightings."
                />
                <DeltaConsensusTable consensus={de.consensus} />
              </VisualCard>
              <VisualCard title="DEX BY STRIKE" subtitle="22 strikes nearest spot">
                <ExposureBarChart data={chartData} mode="net" unitLabel="DEX" />
              </VisualCard>
            </>
          )}

          {deltaPillar === "levels" && (
            <>
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <VisualCard title="INVENTORY PIVOT" subtitle="Distance-weighted local zero-crossing, more relevant intraday than the full-book delta-neutral price">
                  <HowToUse
                    use="This is where the estimated hedge posture would switch from hedge-long to hedge-short - discounted by distance so far deep-ITM contracts don't distort it the way they can the full delta-neutral price below."
                    source="Local DEX ladder weighted by exp(-|K-spot|/λ), λ set from today's 0DTE expected move."
                  />
                  <div className="font-mono text-[1.1rem] font-semibold">{de.inventoryPivot !== null ? de.inventoryPivot.toFixed(2) : "—"}</div>
                </VisualCard>
                <VisualCard title="DELTA NEUTRAL ZONE" subtitle="Full-book zero crossing, banded across dealer-sign scenarios">
                  <DeltaNeutralBandCard band={de.deltaNeutralBand} />
                </VisualCard>
              </div>
              <VisualCard title="DELTA SHELVES" subtitle="Where inventory is concentrated — not resistance or support">
                <HowToUse
                  use="A broad cluster outranks an isolated spike here. These are regions carrying a large share of underlying-equivalent inventory, not price levels expected to hold."
                  source="±3-strike local breadth of |DEX|, kept only where a strike carries ≥3% of gross DEX."
                />
                <DeltaShelfTable shelves={de.deltaShelves} />
              </VisualCard>
              <VisualCard title="REHEDGE TRIGGERS" subtitle="Prices where the required hedge change exceeds 25% of recent 5-min volume">
                <HowToUse use="Far more actionable than a raw DEX wall: this is specifically where the CHANGE in required hedge (not the level itself) becomes large relative to what the market can currently absorb." source="Hedge change vs. current spot, normalized by the live 5-minute /chart candle." />
                <RehedgeTriggerTable triggers={de.rehedgeTriggers} />
              </VisualCard>
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <VisualCard title="HEDGE ROTATION ZONE" subtitle="Range where posture flips, not a single ambiguous line">
                  <HedgeRotationZoneCard zone={de.hedgeRotationZone} />
                </VisualCard>
                <VisualCard title="CROSS-EXPIRY DELTA CONFLUENCE" subtitle="Vs. whichever dte>0 expiry currently carries the most gross DEX">
                  <DeltaConfluenceCard confluence={de.confluence} />
                </VisualCard>
              </div>
            </>
          )}

          {deltaPillar === "risks" && (
            <>
              <VisualCard title="HEDGE UNWIND RISK" subtitle="Scenario-specific liquidity demand, not a generic warning">
                <HowToUse use="For each scenario, this is how much the required hedge would change from right now, sized against recent volume - not a prediction any of these happen, a measure of what it would cost if one did." source="Hedge change at each scenario price vs. current spot, normalized by recent 15-minute volume." />
                <UnwindScenarioTable scenarios={de.unwindScenarios} />
              </VisualCard>
              <VisualCard title="GAP REHEDGE RISK" subtitle="Sudden gaps can demand a larger adjustment than dealers can execute gradually">
                <GapRiskTable rows={de.gapRisk} />
              </VisualCard>
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <VisualCard title="HEDGE CROWDING RISK">
                  <HowToUse use="High only when net inventory is one-sided, concentrated, cross-expiry-reinforcing, AND liquidity is thin - all at once. Any single factor being mild pulls this down a lot, by design." source="|DBR| × concentration × cross-expiry alignment × liquidity burden." />
                  <HedgeCrowdingCard crowding={de.hedgeCrowding} />
                </VisualCard>
                <VisualCard title="OI FRESHNESS RISK">
                  <DeltaOiFreshnessCard freshness={de.oiFreshness} />
                </VisualCard>
              </div>
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <VisualCard title="DEALER INVENTORY UNCERTAINTY">
                  <DeltaInventoryUncertaintyCard uncertainty={de.inventoryUncertainty} />
                </VisualCard>
                <VisualCard title="CROSS-PRODUCT NETTING RISK">
                  <CrossProductWarningCard warning={de.diagnostics.crossProductWarning} />
                </VisualCard>
              </div>
            </>
          )}

          {deltaPillar === "structure" && (
            <>
              <VisualCard title="DELTA BALANCE SHEET">
                <DeltaBalanceSheetCard sheet={de.balanceSheet} />
              </VisualCard>
              <VisualCard title="CUMULATIVE DEX LADDER" subtitle="Where the inventory balance actually changes across strikes — often clearer than a per-strike histogram">
                <HowToUse use="Read the slope, not just the level: a steep climb means a lot of inventory concentrates in that strike range; a flat stretch means little changes there." source="Running sum of call/put/net DEX, sorted low to high strike." />
                <CumulativeDexLadderChart points={de.cumulativeLadder} spot={data.spot} />
              </VisualCard>
              <VisualCard title="EXPIRY DELTA STACK" subtitle="How much today's chain controls the total delta book across all expiries">
                <ExpiryDexStackTable stack={de.expiryStack} />
              </VisualCard>
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <VisualCard title="DELTA CONCENTRATION">
                  <DeltaConcentrationRow stats={de.concentration} />
                </VisualCard>
                <VisualCard title="ABOVE / BELOW-SPOT ASYMMETRY">
                  <DeltaAsymmetryRow stats={de.asymmetry} />
                </VisualCard>
              </div>
              <VisualCard title="DELTA CENTER OF INVENTORY" subtitle="Call / put / gross / reachability-weighted centers, vs. spot">
                <CenterOfInventoryCard cog={de.centerOfInventory} spot={data.spot} />
              </VisualCard>
              <VisualCard title="MONEYNESS STRUCTURE" subtitle="Deep ITM → deep OTM, by |delta| bucket">
                <HowToUse use="Deep-ITM options carry substantial static delta that barely moves; near-ATM options can rotate their delta rapidly (that rate-of-change itself is a gamma concept and stays on the GEX page); far-OTM options may contribute little delta despite large OI." source="Bucketed by |delta| at current spot: >0.85 deep ITM, 0.6-0.85 ITM, 0.4-0.6 near ATM, 0.15-0.4 OTM, <0.15 deep OTM." />
                <MoneynessStructureChart rows={de.moneyness} />
              </VisualCard>
            </>
          )}

          <VisualCard title="PRICE-TIME REHEDGE SURFACE" subtitle="The signature Delta visualization — how much the hedge inventory would need to rotate under each future (price, time) state">
            <HowToUse
              use="Not just DEX at a hypothetical point - this shows the CHANGE in required hedge relative to right now. Red = dealers would need to buy more than they hold now; green = sell more. The outlined column is current spot."
              source="Static-model DEX repriced at every (price, minutes-to-expiry) grid point, differenced against current DEX."
            />
            <RehedgeSurfaceChart grid={de.rehedgeSurface.grid} priceValues={de.rehedgeSurface.priceValues} minutesValues={de.rehedgeSurface.minutesValues} spot={data.spot} />
          </VisualCard>

          <DeltaDiagnosticStrip
            pricingModel={de.diagnostics.pricingModel}
            surfaceModel={de.diagnostics.surfaceModel}
            contractsIncluded={de.diagnostics.contractsIncluded}
            invalidContracts={de.diagnostics.invalidContracts}
            dealerSignConvention={de.diagnostics.dealerSignConvention}
            oiFreshnessLabel={de.diagnostics.oiFreshnessLabel}
            crossProductWarning={de.diagnostics.crossProductWarning}
            lastCalculatedAt={de.diagnostics.lastCalculatedAt}
          />
        </>
      )}

      {!de && (
        <>
          <VisualCard title="DEX BY STRIKE" subtitle="Net dealer delta exposure, 22 strikes nearest spot">
            <ExposureBarChart data={chartData} mode="net" unitLabel="DEX" />
          </VisualCard>
          <VisualCard title="DEX HEATMAP" subtitle="Intensity-scaled, net row">
            <ExposureHeatmap data={chartData} mode="net" />
          </VisualCard>
        </>
      )}
    </div>
  );
}

function ThetaExposureView({ data }: { data: GexResponse }) {
  const [thetaPillar, setThetaPillar] = useState<ThetaPillarId>("regime");
  const top = useMemo(() => nearStrikeWindow(data.perStrike, data.spot, 22), [data]);
  const chartData: ExposureBarDatum[] = top.map((r) => ({ strike: r.strike, net: r.tex }));
  const totalTex = data.perStrike.reduce((sum, r) => sum + r.tex, 0);
  const te = data.thetaEngine;

  const worstCarry = te ? [...te.carryWipeoutScenarios].sort((a, b) => (b.carryRiskRatio ?? 0) - (a.carryRiskRatio ?? 0))[0] ?? null : null;

  return (
    <div className="flex flex-col gap-6">
      <p className="m-0 font-sans text-[0.85rem] leading-relaxed text-[var(--text-dim)]">
        {data.symbol} 0DTE book ({data.resolvedExpiry}) — the Theta Decision Engine below is not a directional-flow
        page: theta does not directly force dealers to buy or sell the underlying, and a high-theta strike is not
        automatically support, resistance, or a reversal level. Its purpose is measuring where premium is
        disappearing, how quickly, and how much movement is required to overcome it.
      </p>

      {te && (
        <>
          <ThetaHeroBanner heroStatement={te.heroStatement} phase={te.phase} />

          <ThetaPillarSummaryCards
            active={thetaPillar}
            onChange={setThetaPillar}
            phase={te.phase}
            regime={te.regime}
            decayCenters={te.decayCenters}
            burnBasin={te.burnBasin.basin}
            escapeBands={te.escapeBands}
            escapeAsymmetry30m={te.escapeAsymmetry30m}
            worstCarry={worstCarry}
            ivStability={te.ivStability}
            oiFreshness={te.oiFreshness}
            balanceSheet={te.balanceSheet}
            concentrationEffectiveStrikes={te.concentration.effectiveStrikes}
          />

          <ThetaPillarNav active={thetaPillar} onChange={setThetaPillar} />

          {thetaPillar === "regime" && (
            <>
              <VisualCard title="THETA DECISION LADDER" subtitle="Compression zone → premium burned → movement required, by horizon">
                <HowToUse
                  use="One row per horizon: the compression zone is where decay dominates (from the escape bands), premium burned is the burn fraction at that horizon, and movement required is the average distance to escape as a % of spot. Read down the rows to see how the picture widens the further out you look."
                  source="Combines the escape bands and burn-fraction figures below into one table."
                />
                <ThetaDecisionLadderTable rows={te.decisionLadder} />
              </VisualCard>
              <VisualCard title="BURN BY HORIZON" subtitle="Finite-horizon reprice, not linear per-day theta extrapolation">
                <HowToUse
                  use="Theta is nonlinear near expiration - these are actual reprices at each horizon (V(tau) minus V(tau-h)), not today's per-day theta multiplied out. Burn fraction is the easiest number to trust: it's independent of chain size."
                  source="Black-Scholes reprice of the full active chain at (spot, IV) held fixed, differenced across forward time."
                />
                <BurnHorizonTable regime={te.regime} />
              </VisualCard>
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <VisualCard title="TIME-VALUE HALF-LIFE" subtitle="Minutes until half of current extrinsic value disappears">
                  <HalfLifeCard regime={te.regime} />
                </VisualCard>
                <VisualCard title="DECAY DOMINANCE">
                  <HowToUse use="Compares today's implied movement budget against the move needed to escape 30-minute decay. This is not a trading edge - it compares two pricing assumptions, not an observed forecast." source="30-min implied move (scaled from expected-move) vs. the ATM straddle's 30-min escape distance." />
                  <DecayDominanceCard regime={te.regime} />
                </VisualCard>
              </div>
              <VisualCard title="ESTIMATED DEALER CARRY BY SCENARIO" subtitle="6 dealer-sign scenarios - OI doesn't reveal who's actually long or short">
                <ThetaConsensusTable scenarios={te.consensusScenarios} />
              </VisualCard>
              <VisualCard title="THETA EXPOSURE BY STRIKE" subtitle="Net TEX, 22 strikes nearest spot">
                <ExposureBarChart data={chartData} mode="net" unitLabel="TEX" />
              </VisualCard>
            </>
          )}

          {thetaPillar === "levels" && (
            <>
              <VisualCard title="DECAY CENTER" subtitle="Where current premium decay is centered - not a price magnet">
                <DecayCentersCard centers={te.decayCenters} />
              </VisualCard>
              <VisualCard title="BURN BASIN" subtitle="Region where decay density stays above 60% of its peak">
                <HowToUse use="This is where the option book loses premium most rapidly if spot remains in that region - it does NOT mean price will remain there." source="Gaussian-smoothed density of |theta exposure| across strikes." />
                <BurnBasinCard basin={te.burnBasin.basin} />
              </VisualCard>
              <VisualCard title="THETA ESCAPE BANDS" subtitle="Prices where movement offsets time decay, by horizon">
                <HowToUse
                  use="Inside these bands, the modeled long-premium position loses value; outside them, movement has offset the projected decay (holding the surface assumption constant). The region between the bands is the Decay Compression Zone."
                  source="Bisection search on an ATM-straddle basket: the future price where V(S',tau-h) recovers today's V(spot,tau)."
                />
                <EscapeBandTable bands={te.escapeBands} />
              </VisualCard>
              <VisualCard title="ESCAPE ASYMMETRY" subtitle="Upside vs. downside skew in the move required to escape decay">
                <EscapeAsymmetryCard asymmetry={te.escapeAsymmetry30m} />
              </VisualCard>
              <VisualCard title="THETA SHELVES" subtitle="Strike clusters carrying a large share of decay exposure - not support or resistance">
                <ThetaShelfTable shelves={te.thetaShelves} />
              </VisualCard>
              <VisualCard title="CROSS-EXPIRY THETA CONFLUENCE" subtitle="Vs. whichever other expiry currently carries the most gross theta in the source's own grid">
                <ThetaConfluenceCard confluence={te.confluence} />
              </VisualCard>
            </>
          )}

          {thetaPillar === "risks" && (
            <>
              <VisualCard title="CARRY WIPEOUT RISK" subtitle="Scenario loss vs. projected theta carry - the primary risk metric on this page">
                <HowToUse use="Theta sellers collect limited decay but remain exposed to potentially large directional moves. A ratio above 1x means a scenario loss would exceed the entire projected 30-minute carry." source="Full option-book reprice at each scenario price and 30 minutes forward, differenced against today's book value." />
                <CarryWipeoutTable scenarios={te.carryWipeoutScenarios} />
              </VisualCard>
              <VisualCard title="CONVEXITY DEFICIT" subtitle="Movement required for gamma P&amp;L to offset theta - approximation, not full reprice">
                <HowToUse use="Theta income is compensation for assuming gamma risk. This is the classic sqrt(2|Θ|Δt/Γ) approximation - the Escape Bands above use full repricing instead and are the more trustworthy number; this is here as the simpler, commonly-cited cross-check." source="Aggregate 30-minute burn (already computed) paired with the book's current aggregate dollar gamma." />
                <ConvexityDeficitCard deficit={te.convexityDeficit} />
              </VisualCard>
              <VisualCard title="IV STABILITY RISK" subtitle="Does the theta conclusion survive plausible IV shifts?">
                <IvStabilityCard stability={te.ivStability} />
              </VisualCard>
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <VisualCard title="THETA MIRAGE RISK" subtitle="A large gross number can mislead if long/short cancel">
                  <ThetaMirageCard mirage={te.thetaMirage} />
                </VisualCard>
                <VisualCard title="OI FRESHNESS RISK">
                  <ThetaOiFreshnessCard freshness={te.oiFreshness} />
                </VisualCard>
              </div>
              <VisualCard title="ASSIGNMENT &amp; SETTLEMENT RISK">
                <AssignmentRiskNote note={te.diagnostics.assignmentSettlementNote} />
              </VisualCard>
            </>
          )}

          {thetaPillar === "structure" && (
            <>
              <VisualCard title="THETA BALANCE SHEET">
                <ThetaBalanceSheetCard sheet={te.balanceSheet} />
              </VisualCard>
              {te.thetaHeatmap && (
                <VisualCard title="STRIKE × EXPIRY THETA HEATMAP" subtitle="The standard structure chart for this page">
                  <ThetaStrikeExpiryHeatmap heatmap={te.thetaHeatmap} spot={data.spot} />
                </VisualCard>
              )}
              <VisualCard title="EXPIRY THETA STACK" subtitle="How much of the total cross-expiry theta book is today's chain">
                <HowToUse use="A longer-dated contract can carry meaningful daily theta, but 0DTE may still dominate the next hour's decay. This is the gross share across every expiry in the source's own theta grid." source="Source's own /theta grid, summed |net theta| per expiration." />
                <ExpiryThetaStackTable stack={te.expiryStack} />
              </VisualCard>
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <VisualCard title="THETA CONCENTRATION">
                  <ThetaConcentrationRow stats={te.concentration} />
                </VisualCard>
                <VisualCard title="THETA EXPOSURE HEATMAP" subtitle="Same strike data, intensity-scaled">
                  <ExposureHeatmap data={chartData} mode="net" />
                </VisualCard>
              </div>
              <VisualCard title="MONEYNESS STRUCTURE" subtitle="30-minute burn by |delta| bucket">
                <ThetaMoneynessStructureChart rows={te.moneyness} />
              </VisualCard>
              <VisualCard title="FORWARD THETA CLOCK" subtitle="Deterministic forward decay of the current snapshot">
                <ThetaForwardClockTable snapshots={te.forwardClock} />
              </VisualCard>
            </>
          )}

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <VisualCard title="PRICE-TIME THETA BURN SURFACE" subtitle="Signature visualization 1 — how much premium disappears by each future (price, time) state">
              <BurnSurfaceChart grid={te.burnSurface.grid} priceValues={te.burnSurface.priceValues} minutesValues={te.burnSurface.minutesValues} spot={data.spot} />
            </VisualCard>
            <VisualCard title="PRICE-TIME SURVIVAL MAP" subtitle="Signature visualization 2 — modeled long-premium P&amp;L, not pure theta">
              <HowToUse use="This DOES include price movement, unlike the burn surface. Green regions mean movement has overcome decay by that point; red means decay still dominates. The zero contour traces the escape bands." source="Full option-book reprice at each (price, time) grid point, differenced against today's book value." />
              <SurvivalMapChart grid={te.survivalMap.grid} priceValues={te.survivalMap.priceValues} minutesValues={te.survivalMap.minutesValues} spot={data.spot} />
            </VisualCard>
          </div>

          <ThetaDiagnosticStrip
            pricingModel={te.diagnostics.pricingModel}
            exactExpirationLabel={te.diagnostics.exactExpirationLabel}
            thetaUnit={te.diagnostics.thetaUnit}
            staticIvAssumption={te.diagnostics.staticIvAssumption}
            validContracts={te.diagnostics.validContracts}
            dealerSignAssumption={te.diagnostics.dealerSignAssumption}
            oiFreshnessLabel={te.diagnostics.oiFreshnessLabel}
            assignmentSettlementNote={te.diagnostics.assignmentSettlementNote}
            lastCalculatedAt={te.diagnostics.lastCalculatedAt}
          />
        </>
      )}

      {!te && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile label="TOTAL THETA EXPOSURE" value={fmtUsd(totalTex)} tone={tone(totalTex)} />
            <StatTile label="CALL WALL" value={fmtNum(data.callWall, 0)} tone="up" />
            <StatTile label="PUT WALL" value={fmtNum(data.putWall, 0)} tone="down" />
          </div>
          <VisualCard title="THETA EXPOSURE BY STRIKE" subtitle="Net TEX — 22 strikes nearest spot">
            <ExposureBarChart data={chartData} mode="net" unitLabel="TEX" />
          </VisualCard>
          <VisualCard title="THETA EXPOSURE HEATMAP" subtitle="Intensity-scaled, net row">
            <ExposureHeatmap data={chartData} mode="net" />
          </VisualCard>
        </>
      )}
    </div>
  );
}

function VannaExposureView({ data }: { data: GexResponse }) {
  const [vannaPillar, setVannaPillar] = useState<VannaPillarId>("regime");
  const top = useMemo(() => nearStrikeWindow(data.perStrike, data.spot, 22), [data]);
  const chartData: ExposureBarDatum[] = top.map((r) => ({ strike: r.strike, net: r.vex }));
  const totalVex = data.perStrike.reduce((sum, r) => sum + r.vex, 0);
  const ve = data.vannaEngine;

  const nearestShelf = ve ? [...ve.shelves].sort((a, b) => Math.abs(a.center - data.spot) - Math.abs(b.center - data.spot))[0] ?? null : null;

  return (
    <div className="flex flex-col gap-6">
      <p className="m-0 font-sans text-[0.85rem] leading-relaxed text-[var(--text-dim)]">
        {data.symbol} 0DTE book ({data.resolvedExpiry}) — the Vanna Decision Engine below answers one question: how
        will an implied-volatility change alter dealer delta, and therefore the theoretical underlying hedge? Vanna
        sign depends on moneyness, not option side - never assume calls are positive vanna or puts negative. Every
        hedge-flow number here is conditional on a stated IV move, never a directional prediction on its own.
      </p>

      {ve && (
        <>
          <VannaHeroBanner heroStatement={ve.heroStatement} phase={ve.phase} />

          <VannaPillarSummaryCards
            active={vannaPillar}
            onChange={setVannaPillar}
            phase={ve.phase}
            consensus={ve.consensus}
            flipBand={ve.flipBand}
            nearestShelf={nearestShelf}
            confluence={ve.confluence}
            linearizationRisk={ve.linearizationRisk}
            vannaHalfLifeMinutes={ve.vannaHalfLifeMinutes}
            oiFreshness={ve.oiFreshness}
            balanceSheet={ve.balanceSheet}
            concentrationEffectiveStrikes={ve.concentration.effectiveStrikes}
          />

          <VannaPillarNav active={vannaPillar} onChange={setVannaPillar} />

          {vannaPillar === "regime" && (
            <>
              <VisualCard title="IV-SHOCK HEDGE-FLOW SCENARIOS" subtitle="Headline numbers use full delta repricing, not linear vanna scaling">
                <HowToUse
                  use="Each row assumes the stated IV move happens - it is not a prediction that it will. 'Full reprice' repriced every contract's delta at the shocked vol and summed; 'linear' just scales net VEX by the shock size. The gap between them is reported as Linearization Risk in the Risks tab."
                  source="Black-Scholes delta at (spot, quoted IV + shock) for every live contract, summed and dealer-sign weighted."
                />
                <IvShockScenarioTable scenarios={ve.ivShockScenarios} />
              </VisualCard>
              <VisualCard title="SPOT-VOL INTERACTION" subtitle="Signature metric — the genuinely cross-effect part of the hedge change">
                <HowToUse use="Isolates the part of the hedge change that neither a spot-only move nor a vol-only move would explain on its own - the true cross term." source="4-point finite difference: H(S+dS,vol+dvol) - H(S+dS,vol) - H(S,vol+dvol) + H(S,vol)." />
                <SpotVolInteractionCard interaction={ve.spotVolInteraction} />
              </VisualCard>
              <VisualCard title="VANNA CONSENSUS" subtitle="2 pricing views × 6 dealer-sign scenarios">
                <VannaConsensusTable consensus={ve.consensus} />
              </VisualCard>
              <VisualCard title="VANNA EXPOSURE BY STRIKE" subtitle="Net VEX — 22 strikes nearest spot">
                <ExposureBarChart data={chartData} mode="net" unitLabel="VEX" />
              </VisualCard>
            </>
          )}

          {vannaPillar === "levels" && (
            <>
              <VisualCard title="VANNA FLIP" subtitle="Where net vanna exposure changes sign">
                <VannaFlipBandCard band={ve.flipBand} />
              </VisualCard>
              <VisualCard title="COMPRESSION / EXPANSION PIVOTS" subtitle="Where the ±1pt hedge-flow reprice changes sign across price">
                <VannaPivotsCard compressionPivot={ve.compressionPivot} expansionPivot={ve.expansionPivot} />
              </VisualCard>
              <VisualCard title="VANNA SHELVES" subtitle="Strike clusters carrying a large share of gross VEX">
                <VannaShelfTable shelves={ve.shelves} />
              </VisualCard>
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <VisualCard title="VOLATILITY GATE" subtitle="Price with the largest hedge sensitivity to an IV shock">
                  <VolatilityGateCard gate={ve.volatilityGate} />
                </VisualCard>
                <VisualCard title="VANNA VACUUM" subtitle="Lowest-density zone near spot">
                  <VannaVacuumCard vacuum={ve.vacuum} />
                </VisualCard>
              </div>
              <VisualCard title="CROSS-EXPIRY VANNA CONFLUENCE" subtitle="Vs. whichever other expiry currently carries the most gross raw vanna">
                <VannaConfluenceCard confluence={ve.confluence} />
              </VisualCard>
            </>
          )}

          {vannaPillar === "risks" && (
            <>
              <VisualCard title="SURFACE-SHAPE RISK" subtitle="Level / skew / curvature decomposition — Δσ(k)=a+bk+ck²">
                <HowToUse use="Separates a parallel IV move (level) from a skew rotation (downside gets more vol) and a wing-curvature bump. Skew amplification compares the skew shock's hedge impact to the plain level shock's." source="Full delta reprice with each contract's vol shifted by a function of its log-moneyness k=ln(strike/forward)." />
                <SurfaceShapeRiskCard risk={ve.surfaceShapeRisk} />
              </VisualCard>
              <VisualCard title="LINEARIZATION RISK" subtitle="How much the linear vanna approximation misses vs. full repricing">
                <LinearizationRiskCard risk={ve.linearizationRisk} />
              </VisualCard>
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <VisualCard title="VANNA HALF-LIFE" subtitle="Expiry-collapse risk">
                  <VannaHalfLifeCard minutes={ve.vannaHalfLifeMinutes} />
                </VisualCard>
                <VisualCard title="DEALER-SIGN UNCERTAINTY">
                  <DealerSignUncertaintyCard uncertainty={ve.dealerSignUncertainty} />
                </VisualCard>
              </div>
              <VisualCard title="OI FRESHNESS RISK">
                <VannaOiFreshnessCard freshness={ve.oiFreshness} />
              </VisualCard>
              <VisualCard title="CROSS-PRODUCT NETTING">
                <VannaCrossProductWarningCard warning={ve.diagnostics.crossProductWarning} />
              </VisualCard>
            </>
          )}

          {vannaPillar === "structure" && (
            <>
              <VisualCard title="VANNA BALANCE SHEET">
                <VannaBalanceSheetCard sheet={ve.balanceSheet} />
              </VisualCard>
              <VisualCard title="STRIKE × EXPIRY VANNA HEATMAP" subtitle="Source's own /vanna_surface, no open interest — magnitude proxy only">
                <VannaHeatmapGrid heatmap={ve.heatmap} />
              </VisualCard>
              <VisualCard title="0DTE VANNA CONTROL" subtitle="Share of gross raw vanna magnitude in today's expiry">
                <ZeroDteVannaControlCard control={ve.zeroDteControl} />
              </VisualCard>
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <VisualCard title="VANNA CONCENTRATION">
                  <VannaConcentrationRow stats={ve.concentration} />
                </VisualCard>
                <VisualCard title="VANNA EXPOSURE HEATMAP" subtitle="Same strike data, intensity-scaled">
                  <ExposureHeatmap data={chartData} mode="net" />
                </VisualCard>
              </div>
              <VisualCard title="VANNA CENTER" subtitle="5 weighting variants">
                <VannaCenterCard center={ve.center} spot={data.spot} />
              </VisualCard>
              <VisualCard title="VANNA ASYMMETRY">
                <VannaAsymmetryRow stats={ve.asymmetry} />
              </VisualCard>
              <VisualCard title="FORWARD VANNA CLOCK" subtitle="Deterministic forward evolution of the current snapshot">
                <ForwardVannaClockTable clock={ve.forwardClock} />
              </VisualCard>
            </>
          )}

          <VisualCard title="SPOT × IV HEDGE FIELD" subtitle="Signature visualization — theoretical hedge change across hypothetical spot and IV shock">
            <HowToUse
              use="Each cell is the full-reprice hedge change vs. right now, at that hypothetical (spot, IV shock) pair - not a linear vanna approximation. Red means dealers would need to buy, green means sell."
              source="Black-Scholes delta reprice of the full chain at each grid point, summed."
            />
            <HedgeFieldChart grid={ve.hedgeField.grid} spotValues={ve.hedgeField.spotValues} ivShockValues={ve.hedgeField.ivShockValues} spot={data.spot} />
          </VisualCard>

          <VannaDiagnosticStrip
            pricingModel={ve.diagnostics.pricingModel}
            surfaceModel={ve.diagnostics.surfaceModel}
            contractsIncluded={ve.diagnostics.contractsIncluded}
            invalidContracts={ve.diagnostics.invalidContracts}
            dealerSignConvention={ve.diagnostics.dealerSignConvention}
            oiFreshnessLabel={ve.diagnostics.oiFreshnessLabel}
            crossProductWarning={ve.diagnostics.crossProductWarning}
            vannaSurfaceDataNote={ve.diagnostics.vannaSurfaceDataNote}
            signConventionWarning={ve.diagnostics.signConventionWarning}
            lastCalculatedAt={ve.diagnostics.lastCalculatedAt}
          />
        </>
      )}

      {!ve && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile label="TOTAL VANNA EXPOSURE" value={fmtUsd(totalVex)} tone={tone(totalVex)} />
            <StatTile label="CALL WALL" value={fmtNum(data.callWall, 0)} tone="up" />
            <StatTile label="PUT WALL" value={fmtNum(data.putWall, 0)} tone="down" />
          </div>
          <VisualCard title="VANNA EXPOSURE BY STRIKE" subtitle="Net VEX — 22 strikes nearest spot">
            <ExposureBarChart data={chartData} mode="net" unitLabel="VEX" />
          </VisualCard>
          <VisualCard title="VANNA EXPOSURE HEATMAP" subtitle="Intensity-scaled, net row">
            <ExposureHeatmap data={chartData} mode="net" />
          </VisualCard>
        </>
      )}
    </div>
  );
}

function CharmExposureView({ data }: { data: GexResponse }) {
  const [charmPillar, setCharmPillar] = useState<CharmPillarId>("regime");
  const top = useMemo(() => nearStrikeWindow(data.perStrike, data.spot, 22), [data]);
  const chartData: ExposureBarDatum[] = top.map((r) => ({ strike: r.strike, net: r.cex }));
  const totalCex = data.perStrike.reduce((sum, r) => sum + r.cex, 0);
  const ce = data.charmEngine;

  const largestInterval = ce ? [...ce.flowSchedule].sort((a, b) => Math.abs(b.hedgeChangeShares) - Math.abs(a.hedgeChangeShares))[0] ?? null : null;

  return (
    <div className="flex flex-col gap-6">
      <p className="m-0 font-sans text-[0.85rem] leading-relaxed text-[var(--text-dim)]">
        {data.symbol} 0DTE book ({data.resolvedExpiry}) — the Charm Decision Engine below answers one question: if
        spot and IV stopped moving, how would time alone change dealer delta and the underlying hedge? Every number
        is a modeled hedge requirement over a stated horizon, not a raw charm sign - a passive buy drift is not
        automatically bullish, since the estimated hedge may already be partially executed, internalized, or offset
        elsewhere.
      </p>

      {ce && (
        <>
          <CharmHeroBanner heroStatement={ce.heroStatement} phase={ce.phase} />

          <CharmPillarSummaryCards
            active={charmPillar}
            onChange={setCharmPillar}
            phase={ce.phase}
            consensus={ce.consensus}
            horizonFlows={ce.horizonFlows}
            pivots={ce.pivots}
            rotationZone={ce.rotationZone}
            gate={ce.gate}
            lateDaySurge={ce.lateDaySurge}
            reversalRisk={ce.reversalRisk}
            gammaConflict={ce.gammaConflict}
            vannaContamination={ce.vannaContamination}
            balanceSheet={ce.balanceSheet}
            zeroDteControl={ce.zeroDteControl}
            deltaDestination={ce.deltaDestination}
          />

          <CharmPillarNav active={charmPillar} onChange={setCharmPillar} />

          {charmPillar === "regime" && (
            <>
              <VisualCard title="NEXT-HORIZON HEDGE FLOW" subtitle="Modeled hedge adjustment if spot and IV hold, by horizon">
                <HowToUse
                  use="Each row is the full-reprice delta migration from now to that horizon, summed and dealer-sign weighted - not charm-per-day multiplied out. Positive means modeled buying, negative means modeled selling."
                  source="Black-Scholes delta at (spot, quoted IV, T) vs. (spot, quoted IV, T-h) for every live contract."
                />
                <HorizonFlowTable flows={ce.horizonFlows} />
              </VisualCard>
              <VisualCard title="CHARM ACCELERATION" subtitle="Is the time-driven flow rate strengthening?">
                <CharmAccelerationCard acceleration={ce.acceleration} />
              </VisualCard>
              <VisualCard title="CHARM CONSENSUS" subtitle="2 pricing views × 6 dealer-sign scenarios, at the 30-minute horizon">
                <CharmConsensusTable consensus={ce.consensus} />
              </VisualCard>
              <VisualCard title="CHARM EXPOSURE BY STRIKE" subtitle="Net CEX — 22 strikes nearest spot">
                <ExposureBarChart data={chartData} mode="net" unitLabel="CEX" />
              </VisualCard>
            </>
          )}

          {charmPillar === "levels" && (
            <>
              <VisualCard title="CHARM FLOW PIVOTS" subtitle="Where the finite-horizon hedge adjustment crosses zero, by horizon">
                <CharmPivotTable pivots={ce.pivots} />
              </VisualCard>
              <VisualCard title="CHARM ROTATION ZONE" subtitle="Region where 30-minute charm flow stays small">
                <CharmRotationZoneCard zone={ce.rotationZone} />
              </VisualCard>
              <VisualCard title="CHARM SHELVES" subtitle="Strike regions contributing the greatest delta migration from time">
                <CharmShelfTable shelves={ce.shelves} />
              </VisualCard>
              <VisualCard title="CHARM GATE" subtitle="Price where time-driven hedge demand is largest relative to liquidity">
                <CharmGateCard gate={ce.gate} />
              </VisualCard>
              <VisualCard title="CHARM DEAD ZONE" subtitle="Where time passage produces little hedge adjustment">
                <CharmDeadZoneCard deadZone={ce.deadZone} />
              </VisualCard>
              <VisualCard title="CROSS-EXPIRY CHARM CONFLUENCE" subtitle="Vs. whichever other expiry currently carries the most gross raw charm">
                <CharmConfluenceCard confluence={ce.confluence} />
              </VisualCard>
            </>
          )}

          {charmPillar === "risks" && (
            <>
              <VisualCard title="LATE-DAY CHARM SURGE">
                <LateDaySurgeCard surge={ce.lateDaySurge} />
              </VisualCard>
              <VisualCard title="CHARM DIRECTION REVERSAL RISK" subtitle="How close is price to flipping the modeled flow direction?">
                <ReversalRiskCard risk={ce.reversalRisk} />
              </VisualCard>
              <VisualCard title="CHARM-GAMMA CONFLICT" subtitle="Does gamma-driven hedging point the same way as time-driven hedging?">
                <GammaConflictCard conflict={ce.gammaConflict} />
              </VisualCard>
              <VisualCard title="VANNA CONTAMINATION RISK" subtitle="Pure charm assumes IV holds still - does the flow direction survive a realistic IV move?">
                <VannaContaminationCard risk={ce.vannaContamination} />
              </VisualCard>
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <VisualCard title="LINEARIZATION RISK">
                  <CharmLinearizationRiskCard risk={ce.linearizationRisk} />
                </VisualCard>
                <VisualCard title="EXPIRY DISCONTINUITY RISK">
                  <ExpiryDiscontinuityCard risk={ce.expiryDiscontinuityRisk} />
                </VisualCard>
              </div>
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <VisualCard title="DEALER-SIGN UNCERTAINTY">
                  <CharmDealerSignUncertaintyCard uncertainty={ce.dealerSignUncertainty} />
                </VisualCard>
                <VisualCard title="OI FRESHNESS RISK">
                  <CharmOiFreshnessCard freshness={ce.oiFreshness} />
                </VisualCard>
              </div>
              <VisualCard title="HEDGE-TIMING RISK">
                <HedgeTimingNoteCard note={ce.diagnostics.hedgeTimingNote} />
              </VisualCard>
            </>
          )}

          {charmPillar === "structure" && (
            <>
              <VisualCard title="CHARM BALANCE SHEET">
                <CharmBalanceSheetCard sheet={ce.balanceSheet} />
              </VisualCard>
              <VisualCard title="DELTA DESTINATION MAP" subtitle="Where the chain's deltas are trying to migrate before expiration">
                <HowToUse use="Compares each strike's current delta inventory to its projected delta a few minutes before expiration, at unchanged spot and IV - the near-close point avoids the discontinuity exactly at expiry." source="Black-Scholes delta reprice at (spot, quoted IV, T) vs. (spot, quoted IV, near-close), OI-weighted, summed by strike." />
                <DeltaDestinationChart destination={ce.deltaDestination} spot={data.spot} />
              </VisualCard>
              <VisualCard title="STRIKE × EXPIRY CHARM HEATMAP" subtitle="Source's own /charm_surface, no open interest — magnitude proxy only">
                <CharmHeatmapGrid heatmap={ce.heatmap} />
              </VisualCard>
              <VisualCard title="0DTE CHARM CONTROL" subtitle="Share of gross raw charm magnitude in today's expiry">
                <ZeroDteCharmControlCard control={ce.zeroDteControl} />
              </VisualCard>
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <VisualCard title="CHARM CONCENTRATION">
                  <CharmConcentrationRow stats={ce.concentration} />
                </VisualCard>
                <VisualCard title="CHARM EXPOSURE HEATMAP" subtitle="Same strike data, intensity-scaled">
                  <ExposureHeatmap data={chartData} mode="net" />
                </VisualCard>
              </div>
              <VisualCard title="CALL/PUT CHARM CENTERS">
                <CharmCentersCard centers={ce.centers} spot={data.spot} />
              </VisualCard>
              <VisualCard title="FORWARD CHARM CLOCK" subtitle="Deterministic forward re-derivation of the full charm structure">
                <ForwardCharmClockTable clock={ce.forwardClock} />
              </VisualCard>
            </>
          )}

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <VisualCard title="PRICE × TIME CHARM FIELD" subtitle="Signature visualization 1 — how the direction of time-driven hedging depends on where price sits">
              <HowToUse use="Each cell is the full-reprice hedge change from now to that future time, at that hypothetical stationary price - not a linear charm approximation." source="Black-Scholes delta reprice of the full chain at each (price, time) grid point, summed." />
              <CharmFieldChart grid={ce.charmField.grid} spotValues={ce.charmField.spotValues} minutesValues={ce.charmField.minutesValues} spot={data.spot} />
            </VisualCard>
            <VisualCard title="CHARM FLOW SCHEDULE" subtitle="Signature visualization 2 — modeled buy/sell requirement by time interval through expiration">
              <FlowScheduleChart intervals={ce.flowSchedule} largest={largestInterval} />
            </VisualCard>
          </div>

          <CharmDiagnosticStrip diagnostics={ce.diagnostics} />
        </>
      )}

      {!ce && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile label="TOTAL CHARM EXPOSURE" value={fmtUsd(totalCex)} tone={tone(totalCex)} />
            <StatTile label="CALL WALL" value={fmtNum(data.callWall, 0)} tone="up" />
            <StatTile label="PUT WALL" value={fmtNum(data.putWall, 0)} tone="down" />
          </div>
          <VisualCard title="CHARM EXPOSURE BY STRIKE" subtitle="Net CEX — 22 strikes nearest spot">
            <ExposureBarChart data={chartData} mode="net" unitLabel="CEX" />
          </VisualCard>
          <VisualCard title="CHARM EXPOSURE HEATMAP" subtitle="Intensity-scaled, net row">
            <ExposureHeatmap data={chartData} mode="net" />
          </VisualCard>
        </>
      )}
    </div>
  );
}

function ReversalLevelsView({ data }: { data: GexResponse }) {
  const re = data.reversalEngine;

  return (
    <div className="flex flex-col gap-6">
      <p className="m-0 font-sans text-[0.85rem] leading-relaxed text-[var(--text-dim)]">
        {data.symbol} 0DTE book ({data.resolvedExpiry}) — this page answers one question: the best price zone where
        option positioning and current price behavior suggest a meaningful reversal is most likely. Every Greek is
        converted into modeled underlying hedge shares via one unified full-chain reprice, never added together
        raw. A level is only ever called high-probability after live price behavior confirms it — until then it is
        a projected structure, not a signal.
      </p>

      {re && (
        <>
          <VisualCard title="REVERSAL LEVELS" subtitle="Every candidate potential high/low this request, ranked by structural quality">
            <LevelListPanel levels={re.levels} spot={data.spot} />
          </VisualCard>
          <ReversalDiagnosticStrip diagnostics={re.diagnostics} />
        </>
      )}

      {!re && <p className="m-0 font-mono text-[0.75rem] text-[var(--text-faint)]">Unavailable this request.</p>}
    </div>
  );
}

function BlindSpotsView({ data }: { data: GexResponse }) {
  const bs = data.blindSpots;
  return (
    <div className="flex flex-col gap-6">
      <div className="border border-[var(--border)] bg-[var(--panel)] p-2">
        <div className="text-center font-mono text-[0.6rem] uppercase tracking-[0.12em] text-[var(--text-faint)]">Blind Spots</div>
        {bs ? <BlindSpotsLadder levels={bs.levels} spot={data.spot} /> : <p className="m-0 py-12 text-center font-mono text-[0.75rem] text-[var(--text-faint)]">Unavailable this request.</p>}
      </div>
    </div>
  );
}

function OpFloView({ data }: { data: GexResponse }) {
  const bias = data.opfloBias;
  return (
    <div className="flex flex-col gap-6">
      {bias ? <OpFloCard bias={bias} /> : <p className="m-0 py-12 text-center font-mono text-[0.75rem] text-[var(--text-faint)]">Unavailable this request.</p>}
    </div>
  );
}

export default function OptionsFlowPage({ view }: { view: OptionsFlowView }) {
  const [symbol, setSymbol] = useState<GexSymbol>("QQQ");
  const [engine, setEngine] = useState<PricerEngine>("bs");
  const [data, setData] = useState<GexResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/gex?symbol=${symbol}`, { cache: "no-store" })
      .then((res) => {
        if (!res.ok) throw new Error(`request failed (${res.status})`);
        return res.json();
      })
      .then((json: GexResponse) => {
        if (cancelled) return;
        if (!json.ok) throw new Error("upstream returned an error");
        setData(json);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [symbol, view]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <SymbolToggle symbol={symbol} onChange={setSymbol} />
          <EngineToggle engine={engine} onChange={setEngine} />
        </div>
        {data && (
          <div className="font-mono text-[0.62rem] text-[var(--text-faint)]">
            as of {new Date(data.asOf).toLocaleTimeString()} · 0DTE {data.resolvedExpiry}
          </div>
        )}
      </div>

      {loading && (
        <div className="border border-[var(--border)] bg-[var(--panel)] p-8 text-center font-mono text-[0.8rem] text-[var(--text-faint)]">
          Loading {symbol} options flow…
        </div>
      )}

      {!loading && error && (
        <div className="border border-[var(--border)] bg-[var(--panel)] p-8 text-center font-mono text-[0.8rem]" style={{ color: "var(--down)" }}>
          ERR: {error}
        </div>
      )}

      {!loading && !error && data && (
        <>
          {view === "gex" && <GexExposureView data={withEngine(data, engine)} />}
          {view === "dex" && <DexExposureView data={withEngine(data, engine)} />}
          {view === "theta" && <ThetaExposureView data={withEngine(data, engine)} />}
          {view === "vanna" && <VannaExposureView data={withEngine(data, engine)} />}
          {view === "charm" && <CharmExposureView data={withEngine(data, engine)} />}
          {view === "reversal" && <ReversalLevelsView data={data} />}
          {view === "blindspots" && <BlindSpotsView data={data} />}
          {view === "opflo" && <OpFloView data={data} />}
        </>
      )}
    </div>
  );
}
