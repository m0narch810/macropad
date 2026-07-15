"use client";

import { useEffect, useMemo, useState } from "react";
import type { GexResponse, GexSymbol, PricerEngine } from "@/lib/gex";
import { fmtNum, fmtUsd, nearStrikeWindow } from "@/lib/gex";
import { computeTopWalls, StrikeExpiryHeatmapChart, TerminalExposureChart, type WallMarker } from "@/components/optionsflow/TerminalChart";
import { MajorWallsPanel } from "@/components/optionsflow/MajorWalls";
import { CrossExpiryPanel } from "@/components/optionsflow/CrossExpiryPanel";
import { CumulativeExposureChart } from "@/components/optionsflow/CumulativeExposureChart";
import { HedgeCliffCharts } from "@/components/optionsflow/HedgeCliffCharts";
import { HedgeStructurePanel } from "@/components/optionsflow/HedgeStructurePanel";

export type OptionsFlowView = "terminal";

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

/** Projects a GexResponse onto the chosen engine's per-strike rows/stats, so the chart/heatmap stay engine-agnostic. */
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

type Section = "chart" | "heatmap" | "crossexpiry" | "crossasset" | "cliffmap";
const SECTION_LABEL: Record<Section, string> = { chart: "CHART", heatmap: "HEATMAP", crossexpiry: "CROSS-EXPIRY", crossasset: "CROSS ASSET", cliffmap: "CLIFF MAP" };
const SECTION_ORDER: Section[] = ["chart", "heatmap", "crossexpiry", "crossasset", "cliffmap"];
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
  const top = useMemo(() => nearStrikeWindow(data.perStrike, data.spot, 30), [data]);

  const gammaEngine = data.gammaEngine;
  const deltaEngine = data.deltaEngine;
  const vannaEngine = data.vannaEngine;

  const dteColumns = data.strikeExpiryHeatmaps?.[metric]?.columns ?? [];
  const clampedDteIndex = Math.min(chartDteIndex, Math.max(0, dteColumns.length - 1));

  // Column 0 is always this app's own self-computed 0DTE chain (real per-contract IV/OI) - the most
  // precise source available. Any other column comes from the source's own cross-expiry surface
  // (/gex_surface, /vanna_surface, /charm_surface, /theta), a documented raw-magnitude proxy since
  // this app doesn't hold a full per-contract chain for those expirations - see the heatmap's own note.
  // "Single" isolates the selected expiration; "cumulative" sums every real expiration up to and
  // including it (0DTE contribution still self-computed, only dte>0 columns come from the surface).
  const chartData = useMemo(() => {
    const grid = data.strikeExpiryHeatmaps?.[metric];
    const windowNearest = (rows: { strike: number; value: number }[]) =>
      [...rows].sort((a, b) => Math.abs(a.strike - data.spot) - Math.abs(b.strike - data.spot)).slice(0, 30).sort((a, b) => a.strike - b.strike);

    if (dteScope === "single") {
      if (clampedDteIndex === 0) return top.map((r) => ({ strike: r.strike, value: r[metric] }));
      if (!grid) return [];
      return windowNearest(grid.strikes.map((strike, i) => ({ strike, value: grid.values[i][clampedDteIndex] ?? 0 })));
    }

    const acc = new Map<number, number>();
    for (const r of top) acc.set(r.strike, r[metric]);
    if (grid) {
      for (let col = 1; col <= clampedDteIndex; col++) {
        grid.strikes.forEach((strike, i) => {
          const v = grid.values[i][col];
          if (v !== null) acc.set(strike, (acc.get(strike) ?? 0) + v);
        });
      }
    }
    return windowNearest([...acc.entries()].map(([strike, value]) => ({ strike, value })));
  }, [data, metric, clampedDteIndex, dteScope, top]);
  const walls: WallMarker[] = computeTopWalls(chartData, metric, 2);

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
            <MetricTile label="Call Wall" value={fmtNum(data.callWall, 2)} color="var(--up)" />
            <MetricTile label="Put Wall" value={fmtNum(data.putWall, 2)} color="var(--down)" />
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
              {metricTabs("md")}
              <div className="flex items-center gap-2">
                {dteColumns.length > 1 && (
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
              <div className="eyebrow">
                ±15 strikes around spot
                {dteScope === "cumulative"
                  ? ` · 0DTE self-computed + ${clampedDteIndex} further expiration${clampedDteIndex === 1 ? "" : "s"} from source surface`
                  : clampedDteIndex > 0
                    ? " · source cross-expiry surface, no OI weighting"
                    : " · self-computed 0DTE"}
              </div>
            </div>
            {chartView === "bars" ? (
              <TerminalExposureChart data={chartData} unitLabel={METRIC_LABEL[metric]} spot={data.spot} walls={walls} />
            ) : (
              <CumulativeExposureChart data={chartData} unitLabel={METRIC_LABEL[metric]} spot={data.spot} />
            )}
          </div>
          <MajorWallsPanel metricLabel={METRIC_LABEL[metric]} walls={walls} />
        </div>
      )}

      {section === "heatmap" && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
          <div className="hud border border-[var(--border)] bg-[var(--panel)] p-5">
            <div className="mb-4 flex items-baseline justify-between gap-2">
              <div className="partno">
                {data.symbol} · {METRIC_LABEL[metric]} Heatmap
              </div>
              {metricTabs("sm")}
            </div>
            <StrikeExpiryHeatmapChart grid={windowHeatmap(data.strikeExpiryHeatmaps?.[metric], data.spot)} spot={data.spot} walls={walls} unitLabel={METRIC_LABEL[metric]} />
          </div>
          <MajorWallsPanel metricLabel={METRIC_LABEL[metric]} walls={walls} />
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

      {section === "cliffmap" && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
          <div className="hud border border-[var(--border)] bg-[var(--panel)] p-5">
            <div className="mb-3">
              <div className="font-display text-[0.95rem] text-[var(--text)]">Hedge Acceleration &amp; Cliff Map</div>
              <div className="eyebrow mt-1">{data.symbol} · how fast the estimated dealer-hedging response changes as spot moves — not another GEX-by-strike view</div>
            </div>
            {data.hedgeCliff ? (
              <HedgeCliffCharts
                curve={data.hedgeCliff.curve}
                spot={data.spot}
                upsideCliff={data.hedgeCliff.upsideCliff}
                downsideCliff={data.hedgeCliff.downsideCliff}
                maxPinning={data.hedgeCliff.maxPinning}
                feedbackFlip={data.hedgeCliff.feedbackFlip}
              />
            ) : (
              <p className="m-0 py-16 text-center font-mono text-[0.72rem] text-[var(--text-faint)]">Unavailable this request.</p>
            )}
          </div>
          <HedgeStructurePanel hedgeCliff={data.hedgeCliff ?? null} />
        </div>
      )}
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

      {!loading && !error && data && <TerminalView data={withEngine(data, engine)} />}
    </div>
  );
}
