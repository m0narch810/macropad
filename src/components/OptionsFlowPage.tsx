"use client";

import { useEffect, useMemo, useState } from "react";
import type { GexResponse, GexSymbol } from "@/lib/gex";
import { fmtNum, fmtRaw, fmtUsd } from "@/lib/gex";
import { computeTopWalls, StrikeExpiryHeatmapChart, TerminalExposureChart, type WallMarker } from "@/components/optionsflow/TerminalChart";
import { MajorWallsPanel } from "@/components/optionsflow/MajorWalls";
import { CrossExpiryPanel } from "@/components/optionsflow/CrossExpiryPanel";
import { CumulativeExposureChart } from "@/components/optionsflow/CumulativeExposureChart";
import TopoSurface from "@/components/optionsflow/TopoSurface";
import { AiPromptPanel } from "@/components/optionsflow/AiPromptPanel";

export type OptionsFlowView = "terminal";

const SYMBOLS: GexSymbol[] = ["QQQ", "SPY"];

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

function MetricTile({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div className="eyebrow">{label}</div>
      <div className="mt-0.5 font-mono text-[0.9rem] font-semibold" style={{ color: color ?? "var(--text)" }}>
        {value}
      </div>
    </div>
  );
}

const PHASE_COLOR: Record<string, string> = {
  pinned: "var(--up)",
  damped: "var(--up)",
  fragile_balance: "#d9a441",
  transition: "#d9a441",
  reflexive: "var(--down)",
  open_field: "var(--down)",
};

type Metric = "gex" | "dex" | "vex" | "cex" | "tex" | "vegaex";
const METRIC_LABEL: Record<Metric, string> = { gex: "GEX", dex: "DEX", vex: "VEX", cex: "CHEX", tex: "THETA", vegaex: "VEGA" };
const METRIC_ORDER: Metric[] = ["gex", "dex", "vex", "cex", "tex", "vegaex"];

/** Nearest 30 strikes to spot (~±15), keeping the grid's row/column shape. */
function windowHeatmap(grid: { columns: { label: string; dte: number | null }[]; strikes: number[]; values: (number | null)[][] } | null | undefined, spot: number, count = 30) {
  if (!grid) return null;
  const indexed = grid.strikes.map((strike, i) => ({ strike, i }));
  const kept = indexed
    .sort((a, b) => Math.abs(a.strike - spot) - Math.abs(b.strike - spot))
    .slice(0, count)
    .sort((a, b) => a.strike - b.strike);
  return { columns: grid.columns, strikes: kept.map((k) => k.strike), values: kept.map((k) => grid.values[k.i]) };
}

/** Reshapes Effective/Shadow's per-strike up/down scenario rows into the same {columns,strikes,values} grid shape the heatmap renders, so it's just two columns ("+X%"/"-X%") instead of a DTE axis. */
function effectiveGexAsGrid(result: GexResponse["effectiveGex"] | undefined, mode: "effective" | "shadow") {
  if (!result || !result.rows.length) return null;
  const columns = [
    { label: `+${(result.moveUpPct * 100).toFixed(1)}%`, dte: null },
    { label: `-${(result.moveDownPct * 100).toFixed(1)}%`, dte: null },
  ];
  const sorted = [...result.rows].sort((a, b) => a.strike - b.strike);
  return {
    columns,
    strikes: sorted.map((r) => r.strike),
    values: sorted.map((r) => (mode === "effective" ? [r.upEffective, r.downEffective] : [r.shadowGammaUp, r.shadowGammaDown])),
  };
}

type Section = "chart" | "topo" | "heatmap" | "crossexpiry" | "crossasset" | "aiprompt";
const SECTION_LABEL: Record<Section, string> = {
  chart: "CHART",
  topo: "TOPO",
  heatmap: "HEATMAP",
  crossexpiry: "CROSS-EXPIRY",
  crossasset: "CROSS ASSET",
  aiprompt: "AI PROMPT",
};
const SECTION_ORDER: Section[] = ["chart", "topo", "heatmap", "crossexpiry", "crossasset", "aiprompt"];

type ChartMode = "traditional" | "effective" | "shadow";
const CHART_MODE_LABEL: Record<ChartMode, string> = { traditional: "TRADITIONAL", effective: "EFFECTIVE", shadow: "SHADOW" };
const CHART_MODE_ORDER: ChartMode[] = ["traditional", "effective", "shadow"];
const CROSS_ASSET_TICKERS: GexSymbol[] = ["QQQ", "SPY", "SPX", "NDX"];

function MosaicTile({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="hud flex flex-col justify-center gap-1 border border-[var(--border)] bg-[var(--panel)] px-3 py-2.5 transition-colors duration-150 hover:border-[var(--border-strong)]">
      <div className="eyebrow" style={{ fontSize: "0.56rem" }}>{label}</div>
      <div className="font-mono text-[0.85rem] font-semibold" style={{ color: color ?? "var(--text)" }}>
        {value}
      </div>
    </div>
  );
}

function TerminalView({ data }: { data: GexResponse }) {
  const [metric, setMetric] = useState<Metric>("gex");
  const [section, setSection] = useState<Section>("chart");
  const [chartView, setChartView] = useState<"bars" | "cumulative">("bars");
  const [chartDteIndex, setChartDteIndex] = useState(0);
  const [dteScope, setDteScope] = useState<"single" | "cumulative">("single");
  const [chartMode, setChartMode] = useState<ChartMode>("traditional");
  const [effectiveDir, setEffectiveDir] = useState<"up" | "down">("up");
  const [heatmapMode, setHeatmapMode] = useState<ChartMode>("traditional");
  const [topoMode, setTopoMode] = useState<ChartMode>("traditional");

  const gammaEngine = data.gammaEngine;
  const deltaEngine = data.deltaEngine;
  const vannaEngine = data.vannaEngine;

  const dteColumns = data.strikeExpiryHeatmaps?.[metric]?.columns ?? [];
  const clampedDteIndex = Math.min(chartDteIndex, Math.max(0, dteColumns.length - 1));

  // TRADITIONAL: every column, including 0DTE, comes from the /heatmap
  // endpoint - the same real per-strike, per-expiry source the heatmap/topo
  // views use (see strikeExpiryHeatmaps.ts). This app's own self-computed
  // 0DTE chain is NOT used here: it's ATM-dominated and doesn't reflect
  // real OI walls away from spot, confirmed directly against a live vendor
  // $-GEX table. "Single" isolates the selected expiration; "cumulative"
  // sums every expiration up to and including it.
  //
  // EFFECTIVE / SHADOW: a full delta reprice of this app's own 0DTE chain
  // at a scenario spot (+/-1%), 0DTE-only - there's no per-contract chain
  // for other expirations to run the same reprice on. See
  // effectiveGexEngine.ts.
  const chartData = useMemo(() => {
    const windowNearest = (rows: { strike: number; value: number }[]) =>
      [...rows].sort((a, b) => Math.abs(a.strike - data.spot) - Math.abs(b.strike - data.spot)).slice(0, 30).sort((a, b) => a.strike - b.strike);

    if (chartMode !== "traditional") {
      const rows = data.effectiveGex?.rows ?? [];
      const pick = (r: NonNullable<GexResponse["effectiveGex"]>["rows"][number]) =>
        chartMode === "effective" ? (effectiveDir === "up" ? r.upEffective : r.downEffective) : effectiveDir === "up" ? r.shadowGammaUp : r.shadowGammaDown;
      return windowNearest(rows.map((r) => ({ strike: r.strike, value: pick(r) })));
    }

    const grid = data.strikeExpiryHeatmaps?.[metric];
    if (!grid) return [];

    if (dteScope === "single") {
      return windowNearest(grid.strikes.map((strike, i) => ({ strike, value: grid.values[i][clampedDteIndex] ?? 0 })));
    }

    const acc = new Map<number, number>();
    for (let col = 0; col <= clampedDteIndex; col++) {
      grid.strikes.forEach((strike, i) => {
        const v = grid.values[i][col];
        if (v !== null) acc.set(strike, (acc.get(strike) ?? 0) + v);
      });
    }
    return windowNearest([...acc.entries()].map(([strike, value]) => ({ strike, value })));
  }, [data, metric, clampedDteIndex, dteScope, chartMode, effectiveDir]);
  const walls: WallMarker[] = computeTopWalls(chartData, chartMode === "traditional" ? metric : "gex", 2);
  const chartUnitLabel = chartMode === "traditional" ? METRIC_LABEL[metric] : chartMode === "effective" ? "EFF GEX" : "SHADOW γ";

  // Hero tile Call Wall/Put Wall - same computeTopWalls the Chart/Heatmap
  // graphs use (top-magnitude GEX strikes), always the traditional 0DTE GEX
  // column regardless of whatever metric/mode the Chart tab happens to be
  // showing right now, so the hero stat doesn't silently change meaning
  // when someone switches the Chart to DEX or Effective mode.
  const heroWalls: WallMarker[] = useMemo(() => {
    const grid = data.strikeExpiryHeatmaps?.gex;
    if (!grid) return [];
    const rows = grid.strikes
      .map((strike, i) => ({ strike, value: grid.values[i][0] ?? 0 }))
      .sort((a, b) => Math.abs(a.strike - data.spot) - Math.abs(b.strike - data.spot))
      .slice(0, 30);
    return computeTopWalls(rows, "gex", 2);
  }, [data]);
  const heroCallWall = heroWalls.find((w) => w.label === "Call Wall")?.price ?? null;
  const heroPutWall = heroWalls.find((w) => w.label === "Put Wall")?.price ?? null;

  const heatmapWalls: WallMarker[] = useMemo(() => {
    if (heatmapMode === "traditional" || !data.effectiveGex) return [];
    const rows = data.effectiveGex.rows.map((r) => ({ strike: r.strike, value: heatmapMode === "effective" ? r.upEffective : r.shadowGammaUp }));
    return computeTopWalls(rows, "gex", 2);
  }, [data, heatmapMode]);

  // TOPO's terrain is built around the tenor axis (0DTE/1W/2W/M+) - Effective/
  // Shadow are single 0DTE scenarios with no tenor dimension. Repurposes the
  // first two tenor slots as the +move/-move scenarios (relabeled below) and
  // zeroes the other two; only the GEX surface carries real data in this
  // mode since this app doesn't compute a per-Greek scenario delta.
  const topoRows = useMemo(() => {
    if (topoMode === "traditional") return data.topo ?? [];
    const zero: [number, number, number, number] = [0, 0, 0, 0];
    return (data.effectiveGex?.rows ?? []).map((r) => ({
      strike: r.strike,
      gex: [topoMode === "effective" ? r.upEffective : r.shadowGammaUp, topoMode === "effective" ? r.downEffective : r.shadowGammaDown, 0, 0] as [number, number, number, number],
      dex: zero,
      vanna: zero,
      charm: zero,
      theta: zero,
      vega: zero,
    }));
  }, [data, topoMode]);
  const topoTenorLabels =
    topoMode === "traditional"
      ? undefined
      : [`+${data.effectiveGex ? (data.effectiveGex.moveUpPct * 100).toFixed(1) : "—"}%`, `-${data.effectiveGex ? (data.effectiveGex.moveDownPct * 100).toFixed(1) : "—"}%`, "", ""];

  const phaseColor = gammaEngine ? PHASE_COLOR[gammaEngine.phase.phase] ?? "var(--text-faint)" : "var(--text-faint)";

  const metricTabs = (size: "sm" | "md") => (
    <div className="inline-flex flex-wrap border border-[var(--border)]">
      {METRIC_ORDER.map((m) => (
        <button
          key={m}
          onClick={() => {
            setMetric(m);
            setChartDteIndex(0);
          }}
          className={`font-mono font-semibold tracking-[0.04em] transition-colors duration-150 ${size === "sm" ? "px-2.5 py-1 text-[0.62rem]" : "px-3 py-1.5 text-[0.68rem]"} ${
            m === metric ? "bg-[var(--text)] text-[var(--bg)]" : "text-[var(--text-dim)] hover:text-[var(--text)]"
          }`}
        >
          {METRIC_LABEL[m]}
        </button>
      ))}
    </div>
  );

  const grossGex = data.perStrike.reduce((s, r) => s + Math.abs(r.gex), 0);

  return (
    <div className="flex flex-col gap-4">
      {/* Bento hero: big regime tile + dense stat mosaic, replacing four equal-width cards */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.6fr_1fr]">
        <div className="blueprint hud relative flex flex-col gap-4 overflow-hidden border-l-4 bg-[var(--panel)] p-5" style={{ borderColor: phaseColor }}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="glow-accent display-hero font-mono text-[2.4rem] text-[var(--text)]">${fmtNum(data.spot, 2)}</div>
              <div className="eyebrow mt-1.5">
                {data.symbol} · 0DTE {data.resolvedExpiry}
              </div>
            </div>
            {gammaEngine && (
              <div className="inline-flex items-center gap-1.5 border px-2.5 py-1" style={{ borderColor: phaseColor, background: `color-mix(in srgb, ${phaseColor} 8%, transparent)` }}>
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: phaseColor }} />
                <span className="font-mono text-[0.7rem] font-semibold uppercase tracking-[0.04em]" style={{ color: phaseColor }}>
                  {gammaEngine.phase.label}
                </span>
              </div>
            )}
          </div>
          {gammaEngine && <p className="m-0 font-sans text-[0.72rem] leading-relaxed text-[var(--text-dim)]">{gammaEngine.phase.interpretation}</p>}
          <div className="mt-auto grid grid-cols-2 gap-3 border-t border-[var(--border)] pt-3 sm:grid-cols-4">
            <MetricTile label="Call Wall" value={heroCallWall !== null ? fmtNum(heroCallWall, 2) : "—"} color="var(--up)" />
            <MetricTile label="Put Wall" value={heroPutWall !== null ? fmtNum(heroPutWall, 2) : "—"} color="var(--down)" />
            <MetricTile label="Max Pain" value={fmtNum(data.maxPain, 2)} />
            <MetricTile label="G-Flip" value={data.gammaFlip !== null ? fmtNum(data.gammaFlip, 2) : "—"} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-2">
          <MosaicTile label="Net GEX" value={fmtUsd(data.totalGex0dte)} color={data.totalGex0dte >= 0 ? "var(--up)" : "var(--down)"} />
          <MosaicTile label="Gross GEX" value={fmtUsd(grossGex)} />
          <MosaicTile label="ATM IV" value={data.atmIv !== undefined ? `${(data.atmIv * 100).toFixed(1)}%` : "—"} />
          <MosaicTile label="Expected Move" value={data.zeroDte ? `±${fmtNum(data.zeroDte.expectedMove1s, 2)}` : "—"} />
          <MosaicTile
            label="Net DEX"
            value={deltaEngine ? fmtNum(deltaEngine.balanceSheet.netDex / 1000, 0) + "K sh" : "—"}
            color={deltaEngine && deltaEngine.balanceSheet.netDex >= 0 ? "var(--up)" : "var(--down)"}
          />
          <MosaicTile label="P/C Ratio" value={data.zeroDte ? data.zeroDte.pcRatio.toFixed(2) : "—"} />
          <MosaicTile label="Vol Trigger" value={vannaEngine?.flipBand.center !== null && vannaEngine ? fmtNum(vannaEngine.flipBand.center as number, 2) : "—"} />
          <MosaicTile label="Dealer Z" value={data.dealerFlow ? data.dealerFlow.currentZ.toFixed(2) : "—"} color={data.dealerFlow && Math.abs(data.dealerFlow.currentZ) >= data.dealerFlow.zThreshold ? "#d9a441" : undefined} />
        </div>
      </div>

      {/* Segmented view switcher - one heavy visual on screen at a time instead of an ever-growing scroll */}
      <div className="inline-flex w-fit border border-[var(--border)]">
        {SECTION_ORDER.map((s) => (
          <button
            key={s}
            onClick={() => setSection(s)}
            className={`px-4 py-1.5 font-mono text-[0.7rem] font-semibold tracking-[0.06em] transition-colors duration-150 ${
              s === section ? "bg-[var(--accent)] text-[var(--bg)]" : "text-[var(--text-dim)] hover:text-[var(--text)]"
            }`}
          >
            {SECTION_LABEL[s]}
          </button>
        ))}
      </div>

      {section === "chart" && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
          <div className="hud flex flex-col gap-4 border border-[var(--border)] bg-[var(--panel)] p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="inline-flex border border-[var(--border)]">
                {CHART_MODE_ORDER.map((m) => (
                  <button
                    key={m}
                    onClick={() => setChartMode(m)}
                    className={`px-3 py-1.5 font-mono text-[0.66rem] font-semibold tracking-[0.05em] transition-colors duration-150 ${
                      m === chartMode ? "bg-[var(--accent)] text-[var(--bg)]" : "text-[var(--text-dim)] hover:text-[var(--text)]"
                    }`}
                  >
                    {CHART_MODE_LABEL[m]}
                  </button>
                ))}
              </div>
              {chartMode === "traditional" ? metricTabs("md") : (
                <div className="inline-flex border border-[var(--border)]">
                  {(["up", "down"] as const).map((d) => (
                    <button
                      key={d}
                      onClick={() => setEffectiveDir(d)}
                      className={`px-2.5 py-1 font-mono text-[0.62rem] font-semibold uppercase tracking-[0.05em] transition-colors duration-150 ${
                        d === effectiveDir ? "bg-[var(--text)] text-[var(--bg)]" : "text-[var(--text-dim)] hover:text-[var(--text)]"
                      }`}
                    >
                      {d === "up"
                        ? `+${data.effectiveGex ? fmtNum(data.effectiveGex.moveUpPct * 100, 1) : "—"}% Spot`
                        : `-${data.effectiveGex ? fmtNum(data.effectiveGex.moveDownPct * 100, 1) : "—"}% Spot`}
                    </button>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-2">
                {chartMode === "traditional" && dteColumns.length > 1 && (
                  <>
                    <div className="inline-flex border border-[var(--border)]">
                      {(["single", "cumulative"] as const).map((s) => (
                        <button
                          key={s}
                          onClick={() => setDteScope(s)}
                          className={`px-2.5 py-1 font-mono text-[0.6rem] font-semibold uppercase tracking-[0.05em] transition-colors duration-150 ${
                            s === dteScope ? "bg-[var(--text)] text-[var(--bg)]" : "text-[var(--text-dim)] hover:text-[var(--text)]"
                          }`}
                          title={s === "single" ? "This expiration only" : "Sum of every real expiration up to this one"}
                        >
                          {s === "single" ? "One Expiry" : "Through"}
                        </button>
                      ))}
                    </div>
                    <select
                      value={clampedDteIndex}
                      onChange={(e) => setChartDteIndex(Number(e.target.value))}
                      className="border border-[var(--border)] bg-[var(--panel)] px-2 py-1 font-mono text-[0.62rem] font-semibold text-[var(--text)] outline-none"
                    >
                      {dteColumns.map((c, i) => (
                        <option key={i} value={i}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </>
                )}
                <div className="inline-flex border border-[var(--border)]">
                  {(["bars", "cumulative"] as const).map((v) => (
                    <button
                      key={v}
                      onClick={() => setChartView(v)}
                      className={`px-2.5 py-1 font-mono text-[0.6rem] font-semibold uppercase tracking-[0.05em] transition-colors duration-150 ${
                        v === chartView ? "bg-[var(--accent)] text-[var(--bg)]" : "text-[var(--text-dim)] hover:text-[var(--text)]"
                      }`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>
              <div className="eyebrow w-full">
                ±15 strikes around spot
                {chartMode === "traditional" && dteScope === "cumulative" && clampedDteIndex > 0 ? ` · summed through ${dteColumns[clampedDteIndex]?.label ?? ""}` : ""}
              </div>
            </div>
            {chartView === "bars" ? (
              <TerminalExposureChart data={chartData} unitLabel={chartUnitLabel} spot={data.spot} walls={walls} valueFormatter={chartMode === "traditional" ? fmtRaw : fmtUsd} />
            ) : (
              <CumulativeExposureChart data={chartData} unitLabel={chartUnitLabel} spot={data.spot} valueFormatter={chartMode === "traditional" ? fmtRaw : fmtUsd} />
            )}
          </div>
          <MajorWallsPanel metricLabel={chartUnitLabel} walls={walls} />
        </div>
      )}

      {section === "topo" && (
        <div className="hud border border-[var(--border)] bg-[var(--panel)] p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="font-display text-[0.95rem] text-[var(--text)]">Market Topography</div>
              <div className="eyebrow mt-1">
                {topoMode === "traditional"
                  ? `${data.symbol} · dealer book as 3D terrain — strike × expiry tenor, one surface per Greek`
                  : `${data.symbol} · GEX-only, this app's own 0DTE delta reprice, real $ — other Greek surfaces are flat (no scenario data computed for them)`}
              </div>
            </div>
            <div className="inline-flex border border-[var(--border)]">
              {CHART_MODE_ORDER.map((m) => (
                <button
                  key={m}
                  onClick={() => setTopoMode(m)}
                  className={`px-2.5 py-1 font-mono text-[0.6rem] font-semibold tracking-[0.05em] transition-colors duration-150 ${
                    m === topoMode ? "bg-[var(--accent)] text-[var(--bg)]" : "text-[var(--text-dim)] hover:text-[var(--text)]"
                  }`}
                >
                  {CHART_MODE_LABEL[m]}
                </button>
              ))}
            </div>
          </div>
          <TopoSurface rows={topoRows} spot={data.spot} tenorLabels={topoTenorLabels} />
        </div>
      )}

      {section === "heatmap" && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
          <div className="hud border border-[var(--border)] bg-[var(--panel)] p-5">
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
              <div className="partno">
                {data.symbol} · {heatmapMode === "traditional" ? METRIC_LABEL[metric] : heatmapMode === "effective" ? "Effective GEX" : "Shadow Gamma"} Heatmap
              </div>
              <div className="flex items-center gap-2">
                <div className="inline-flex border border-[var(--border)]">
                  {CHART_MODE_ORDER.map((m) => (
                    <button
                      key={m}
                      onClick={() => setHeatmapMode(m)}
                      className={`px-2.5 py-1 font-mono text-[0.6rem] font-semibold tracking-[0.05em] transition-colors duration-150 ${
                        m === heatmapMode ? "bg-[var(--accent)] text-[var(--bg)]" : "text-[var(--text-dim)] hover:text-[var(--text)]"
                      }`}
                    >
                      {CHART_MODE_LABEL[m]}
                    </button>
                  ))}
                </div>
                {heatmapMode === "traditional" && metricTabs("sm")}
              </div>
            </div>
            {heatmapMode !== "traditional" && <div className="eyebrow mb-3">+move / -move columns instead of a DTE axis</div>}
            {heatmapMode === "traditional" ? (
              <StrikeExpiryHeatmapChart grid={windowHeatmap(data.strikeExpiryHeatmaps?.[metric], data.spot)} spot={data.spot} walls={walls} unitLabel={METRIC_LABEL[metric]} valueFormatter={fmtRaw} />
            ) : (
              <StrikeExpiryHeatmapChart
                grid={windowHeatmap(effectiveGexAsGrid(data.effectiveGex, heatmapMode), data.spot)}
                spot={data.spot}
                walls={heatmapWalls}
                unitLabel={heatmapMode === "effective" ? "EFF GEX" : "SHADOW γ"}
                valueFormatter={fmtUsd}
              />
            )}
          </div>
          <MajorWallsPanel metricLabel={heatmapMode === "traditional" ? METRIC_LABEL[metric] : heatmapMode === "effective" ? "EFF GEX" : "SHADOW γ"} walls={heatmapMode === "traditional" ? walls : heatmapWalls} />
        </div>
      )}

      {section === "crossexpiry" && (
        <div className="hud border border-[var(--border)] bg-[var(--panel)] p-5">
          <div className="mb-4">
            <div className="font-display text-[0.95rem] text-[var(--text)]">Cross-Expiry Exposure</div>
            <div className="eyebrow mt-1">Compare positioning across expirations, Greeks, and tickers</div>
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <CrossExpiryPanel defaultSymbol={data.symbol} />
            <CrossExpiryPanel defaultSymbol={data.symbol} />
          </div>
        </div>
      )}

      {section === "crossasset" && (
        <div className="hud border border-[var(--border)] bg-[var(--panel)] p-5">
          <div className="mb-4">
            <div className="font-display text-[0.95rem] text-[var(--text)]">Cross-Asset Exposure</div>
            <div className="eyebrow mt-1">QQQ, SPY, SPX, NDX side by side — same Greek, independent tickers</div>
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {CROSS_ASSET_TICKERS.map((sym) => (
              <CrossExpiryPanel key={sym} defaultSymbol={sym} />
            ))}
          </div>
        </div>
      )}

      {section === "aiprompt" && (
        <div className="hud border border-[var(--border)] bg-[var(--panel)] p-5">
          <div className="mb-4">
            <div className="font-display text-[0.95rem] text-[var(--text)]">AI Prompt</div>
            <div className="eyebrow mt-1">{data.symbol} · copy this request's real data into a ready-made prompt for ChatGPT or any other LLM</div>
          </div>
          <AiPromptPanel data={data} />
        </div>
      )}
    </div>
  );
}

export default function OptionsFlowPage({ view }: { view: OptionsFlowView }) {
  const [symbol, setSymbol] = useState<GexSymbol>("QQQ");
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

      {!loading && !error && data && <TerminalView data={data} />}
    </div>
  );
}
