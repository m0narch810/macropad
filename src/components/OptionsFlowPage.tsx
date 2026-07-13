"use client";

import { useEffect, useMemo, useState } from "react";
import type { GexResponse, GexSymbol, HedgePressureComponent } from "@/lib/gex";
import { computeHedgePressure, fmtNum, fmtUsd, topStrikesByMagnitude } from "@/lib/gex";
import ExposureBarChart, { type ExposureBarDatum } from "@/components/optionsflow/ExposureBarChart";
import ExposureHeatmap from "@/components/optionsflow/ExposureHeatmap";

export type OptionsFlowView = "gex" | "dex" | "hedgepressure";

const SYMBOLS: GexSymbol[] = ["QQQ", "SPX"];

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

function GexExposureView({ data }: { data: GexResponse }) {
  const top = useMemo(() => topStrikesByMagnitude(data.exposure.perStrike, (r) => r.gex, 22), [data]);
  const netData: ExposureBarDatum[] = top.map((r) => ({ strike: r.strike, net: r.gex }));
  const splitData: ExposureBarDatum[] = top.map((r) => ({ strike: r.strike, call: r.callGex, put: r.putGex }));

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="TOTAL GEX" value={fmtUsd(data.exposure.totalGex)} tone={tone(data.exposure.totalGex)} />
        <StatTile label="REGIME" value={data.structure.regime.toUpperCase()} />
        <StatTile label="KING NODE" value={`${fmtNum(data.structure.kingNode.strike, 0)} (${data.structure.kingNode.type})`} />
        <StatTile label="GAMMA FLIP" value={fmtNum(data.aggregate.flip.nearestFlip, 2)} />
      </div>
      <p className="m-0 font-sans text-[0.85rem] leading-relaxed text-[var(--text-dim)]">{data.structure.regimeNote}</p>

      <VisualCard title="GEX BY STRIKE" subtitle="Net GEX — positive (green) above zero, negative (red) below, top 22 strikes by |GEX|">
        <ExposureBarChart data={netData} mode="net" unitLabel="GEX" />
      </VisualCard>

      <VisualCard title="GEX HEATMAP" subtitle="Intensity-scaled, call/put rows">
        <ExposureHeatmap data={splitData} mode="split" />
      </VisualCard>
    </div>
  );
}

function DexExposureView({ data }: { data: GexResponse }) {
  const top = useMemo(() => topStrikesByMagnitude(data.exposure.perStrike, (r) => r.dex, 22), [data]);
  const chartData: ExposureBarDatum[] = top.map((r) => ({ strike: r.strike, net: r.dex }));
  const totalDex = data.exposure.perStrike.reduce((sum, r) => sum + r.dex, 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="TOTAL DEX" value={fmtUsd(totalDex)} tone={tone(totalDex)} />
        <StatTile label="REGIME" value={data.structure.regime.toUpperCase()} />
        <StatTile label="KING NODE" value={`${fmtNum(data.structure.kingNode.strike, 0)} (${data.structure.kingNode.type})`} />
        <StatTile label="ATM IV" value={fmtNum(data.quality.atmIv * 100, 1) + "%"} />
      </div>
      <p className="m-0 font-sans text-[0.85rem] leading-relaxed text-[var(--text-dim)]">
        Net delta exposure per strike — positive means dealers are net long delta and must sell into rallies to stay hedged; negative means the opposite.
      </p>

      <VisualCard title="DEX BY STRIKE" subtitle="Net dealer delta exposure, top 22 strikes by |DEX|">
        <ExposureBarChart data={chartData} mode="net" unitLabel="DEX" />
      </VisualCard>

      <VisualCard title="DEX HEATMAP" subtitle="Intensity-scaled, net row">
        <ExposureHeatmap data={chartData} mode="net" />
      </VisualCard>
    </div>
  );
}

const CONFIDENCE_COLOR: Record<string, string> = {
  HIGH: "var(--up)",
  MEDIUM: "var(--amber, #d9a441)",
  LOW: "var(--text-faint)",
};

const COMPONENT_COLOR: Record<HedgePressureComponent["key"], string> = {
  gamma: "var(--up)",
  convexity: "var(--accent)",
  charm: "var(--down)",
  vanna: "#8b7fd6",
  oi: "var(--text-dim)",
  flow: "#4aa8d8",
  proximity: "var(--text-faint)",
};

/** Stacked contribution bar - shows each weighted component's share of the total score, not just the fused number. */
function ComponentBreakdownBar({ components, total }: { components: HedgePressureComponent[]; total: number }) {
  return (
    <div className="flex h-4 w-full overflow-hidden bg-[var(--panel-2)]">
      {components.map((c) => {
        const contribution = c.weight * c.normalized * 100;
        const widthPct = total > 0 ? (contribution / total) * 100 : 0;
        return widthPct > 0.5 ? (
          <div
            key={c.key}
            title={`${c.label}: ${contribution.toFixed(1)} pts`}
            style={{ width: `${widthPct}%`, background: COMPONENT_COLOR[c.key] }}
          />
        ) : null;
      })}
    </div>
  );
}

function HedgePressureRankRow({ rank, row, maxScore }: { rank: number; row: ReturnType<typeof computeHedgePressure>[number]; maxScore: number }) {
  const [expanded, setExpanded] = useState(false);
  const widthPct = maxScore > 0 ? (row.score / maxScore) * 100 : 0;

  return (
    <div className="border-b border-[var(--border)] last:border-0">
      <button onClick={() => setExpanded((v) => !v)} className="flex w-full items-center gap-3 py-2.5 text-left">
        <div className="w-6 shrink-0 font-mono text-[0.68rem] text-[var(--text-faint)]">{rank}</div>
        <div className="w-16 shrink-0 font-mono text-[0.82rem] font-semibold">{fmtNum(row.strike, 0)}</div>
        <div className="relative h-6 flex-1 overflow-hidden bg-[var(--panel-2)]">
          <div
            className="h-full transition-[width] duration-300"
            style={{ width: `${widthPct}%`, background: row.gex >= 0 ? "var(--up)" : "var(--down)" }}
          />
          <div className="absolute inset-0 flex items-center justify-end px-2 font-mono text-[0.66rem] text-[var(--text)]">
            {row.score.toFixed(1)}
          </div>
        </div>
        <div
          className="hidden w-16 shrink-0 text-center font-mono text-[0.6rem] font-semibold uppercase tracking-[0.05em] sm:block"
          style={{ color: CONFIDENCE_COLOR[row.confidence] }}
        >
          {row.confidence}
        </div>
        <div className="flex w-32 shrink-0 flex-wrap justify-end gap-1">
          {row.flags.slice(0, 2).map((f) => (
            <span
              key={f}
              className="border border-[var(--border-strong)] px-1.5 py-0.5 font-mono text-[0.56rem] font-semibold uppercase tracking-[0.04em] text-[var(--text-dim)]"
            >
              {f}
            </span>
          ))}
        </div>
        <div className="w-4 shrink-0 text-center font-mono text-[0.6rem] text-[var(--text-faint)]">{expanded ? "▾" : "▸"}</div>
      </button>

      {expanded && (
        <div className="mb-3 ml-9 flex flex-col gap-2 border-l border-[var(--border)] py-2 pl-4">
          <ComponentBreakdownBar components={row.components} total={row.score} />
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-[0.64rem] text-[var(--text-dim)] sm:grid-cols-4">
            {row.components.map((c) => (
              <div key={c.key} className="flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 shrink-0" style={{ background: COMPONENT_COLOR[c.key] }} />
                {c.label}: {(c.weight * c.normalized * 100).toFixed(1)}
              </div>
            ))}
          </div>
          {row.flags.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1">
              {row.flags.map((f) => (
                <span
                  key={f}
                  className="border border-[var(--border-strong)] px-1.5 py-0.5 font-mono text-[0.56rem] font-semibold uppercase tracking-[0.04em] text-[var(--text-dim)]"
                >
                  {f}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function HedgePressureView({ data }: { data: GexResponse }) {
  const ranked = useMemo(() => computeHedgePressure(data, 15), [data]);
  const maxScore = ranked[0]?.score ?? 1;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="REGIME" value={data.structure.regime.toUpperCase()} />
        <StatTile label="TOP STRIKE" value={fmtNum(ranked[0]?.strike, 0)} />
        <StatTile label="GAMMA FLIP" value={fmtNum(data.aggregate.flip.nearestFlip, 2)} />
        <StatTile label="MAX PAIN" value={fmtNum(data.aggregate.maxPain, 0)} />
      </div>

      <div className="border border-[var(--border)] bg-[var(--panel)] p-5">
        <div className="partno mb-2" style={{ color: "var(--text-faint)" }}>
          METHODOLOGY — SEVEN INDEPENDENT SIGNALS, NOT ONE FUSED NUMBER
        </div>
        <div className="grid grid-cols-1 gap-3 font-sans text-[0.78rem] leading-relaxed text-[var(--text-dim)] sm:grid-cols-2">
          <p className="m-0">
            <b style={{ color: COMPONENT_COLOR.gamma }}>Gamma (30%)</b> — |GEX| at the strike: forced hedge trade per $1
            spot move. The standard, OI-based measure.
          </p>
          <p className="m-0">
            <b style={{ color: COMPONENT_COLOR.convexity }}>Convexity (15%)</b> — a second, independent way to measure
            gamma: the local slope of the book-wide gamma-flip curve at that price. Where the curve is steepest, a small
            move changes the required hedge fastest — not just &ldquo;large,&rdquo; but accelerating.
          </p>
          <p className="m-0">
            <b style={{ color: COMPONENT_COLOR.charm }}>Charm (20%)</b> — forced rebalancing from time decay alone, even
            at a frozen price. Heaviest into the close.
          </p>
          <p className="m-0">
            <b style={{ color: COMPONENT_COLOR.vanna }}>Vanna (10%)</b> — forced rebalancing from IV changes alone, even
            at a frozen price and frozen clock. The third real trigger, usually ignored by simple GEX boards.
          </p>
          <p className="m-0">
            <b style={{ color: COMPONENT_COLOR.oi }}>OI concentration (10%)</b> — a strike only matters if real size sits
            there.
          </p>
          <p className="m-0">
            <b style={{ color: COMPONENT_COLOR.flow }}>OI flow / dDOI (10%)</b> — not a greek at all: is open interest at
            this strike building (live, growing risk) or dissolving (going stale)? Falls back to neutral until the feed
            has enough sessions.
          </p>
          <p className="m-0">
            <b style={{ color: COMPONENT_COLOR.proximity }}>Proximity (5%)</b> — closer strikes get triggered by smaller
            moves.
          </p>
          <p className="m-0">
            <b>Confidence</b> is scored separately from the ranking score: it counts how many independent signals
            (gamma, charm, vanna, cross-expiry wall alignment, live OI build) agree the strike matters, rather than
            trusting one blended number. Tap a row to see its breakdown.
          </p>
        </div>
        <p className="m-0 mt-3 font-sans text-[0.72rem] leading-relaxed text-[var(--text-faint)]">
          This is a composite ranking built from public options-chain exposure, not a literal dealer book — the sign
          convention (dealers long calls, short puts) is the standard assumption, not observed fact.
        </p>
      </div>

      <div className="border border-[var(--border)] bg-[var(--panel)] p-5">
        <div className="mb-3 flex items-center justify-between">
          <div className="partno" style={{ color: "var(--text-faint)" }}>
            RANKED BY HEDGE PRESSURE
          </div>
          <div className="font-mono text-[0.6rem] text-[var(--text-faint)]">TAP A ROW FOR ITS COMPONENT BREAKDOWN</div>
        </div>
        {ranked.map((row, i) => (
          <HedgePressureRankRow key={row.strike} rank={i + 1} row={row} maxScore={maxScore} />
        ))}
      </div>
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
  }, [symbol]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <SymbolToggle symbol={symbol} onChange={setSymbol} />
        {data && (
          <div className="font-mono text-[0.62rem] text-[var(--text-faint)]">
            as of {new Date(data.asOf).toLocaleTimeString()} · {data.selection.exp}
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
          {view === "gex" && <GexExposureView data={data} />}
          {view === "dex" && <DexExposureView data={data} />}
          {view === "hedgepressure" && <HedgePressureView data={data} />}
        </>
      )}
    </div>
  );
}
