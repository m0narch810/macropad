"use client";

import { useEffect, useMemo, useState } from "react";
import type { GexResponse, GexSymbol, HedgePressureRow, HedgeTaylorTerm } from "@/lib/gex";
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

const TERM_COLOR: Record<HedgeTaylorTerm["key"], string> = {
  gamma: "var(--up)",
  charm: "var(--down)",
  vanna: "#8b7fd6",
  speed: "var(--accent)",
  color: "#4aa8d8",
  zomma: "#d9a441",
  vomma: "var(--text-dim)",
};

/** Stacked contribution bar - each Taylor term's $ share of the total, signed terms shown by |dollars|. */
function TaylorBreakdownBar({ terms }: { terms: HedgeTaylorTerm[] }) {
  const totalAbs = terms.reduce((sum, t) => sum + Math.abs(t.dollars), 0);
  return (
    <div className="flex h-4 w-full overflow-hidden bg-[var(--panel-2)]">
      {terms.map((t) => {
        const widthPct = totalAbs > 0 ? (Math.abs(t.dollars) / totalAbs) * 100 : 0;
        return widthPct > 0.5 ? (
          <div key={t.key} title={`${t.label}: ${fmtUsd(t.dollars)}`} style={{ width: `${widthPct}%`, background: TERM_COLOR[t.key] }} />
        ) : null;
      })}
    </div>
  );
}

function HedgePressureRankRow({ rank, row, maxFlow }: { rank: number; row: HedgePressureRow; maxFlow: number }) {
  const [expanded, setExpanded] = useState(false);
  const widthPct = maxFlow > 0 ? (row.expectedFlow / maxFlow) * 100 : 0;

  return (
    <div className="border-b border-[var(--border)] last:border-0">
      <button onClick={() => setExpanded((v) => !v)} className="flex w-full items-center gap-3 py-2.5 text-left">
        <div className="w-6 shrink-0 font-mono text-[0.68rem] text-[var(--text-faint)]">{rank}</div>
        <div className="w-16 shrink-0 font-mono text-[0.82rem] font-semibold">{fmtNum(row.strike, 0)}</div>
        <div className="relative h-6 flex-1 overflow-hidden bg-[var(--panel-2)]">
          <div
            className="h-full transition-[width] duration-300"
            style={{ width: `${widthPct}%`, background: row.taylorFlow >= 0 ? "var(--up)" : "var(--down)" }}
          />
          <div className="absolute inset-0 flex items-center justify-end px-2 font-mono text-[0.66rem] text-[var(--text)]">
            {fmtUsd(row.expectedFlow)}
          </div>
        </div>
        <div
          className="hidden w-16 shrink-0 text-center font-mono text-[0.6rem] font-semibold uppercase tracking-[0.05em] sm:block"
          style={{ color: CONFIDENCE_COLOR[row.confidence] }}
        >
          {row.confidence}
        </div>
        <div className="hidden w-16 shrink-0 text-right font-mono text-[0.6rem] text-[var(--text-faint)] md:block">
          p={row.densityWeight.toFixed(2)}
        </div>
        <div className="flex w-28 shrink-0 flex-wrap justify-end gap-1">
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
          <TaylorBreakdownBar terms={row.terms} />
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-[0.64rem] text-[var(--text-dim)] sm:grid-cols-4">
            {row.terms.map((t) => (
              <div key={t.key} className="flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 shrink-0" style={{ background: TERM_COLOR[t.key] }} />
                {t.label}: {fmtUsd(t.dollars)}
              </div>
            ))}
          </div>
          <div className="font-mono text-[0.64rem] text-[var(--text-faint)]">
            Raw Taylor flow: {fmtUsd(row.taylorFlow)} × density weight {row.densityWeight.toFixed(2)} = expected {fmtUsd(row.expectedFlow)}
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
  const { rows: ranked, context } = useMemo(() => computeHedgePressure(data, 15), [data]);
  const maxFlow = ranked[0]?.expectedFlow ?? 1;

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
          METHODOLOGY — SECOND-ORDER TAYLOR EXPANSION, NOT A WEIGHTED GUESS
        </div>
        <p className="m-0 font-sans text-[0.82rem] leading-relaxed text-[var(--text-dim)]">
          A dealer&apos;s forced rehedge <i>is</i> the change in their delta, and the change in delta is exactly a Taylor
          expansion in the greeks — the same math risk desks use for P&amp;L-attribution, not a percentage someone
          picked:
        </p>
        <div className="my-3 overflow-x-auto rounded-[2px] border border-[var(--border)] bg-[var(--panel-2)] p-3 font-mono text-[0.72rem]">
          ΔHedge(K) = Gamma·dS + Charm·dt + Vanna·dσ + ½Speed·dS² + Color·dt·dS + Zomma·dS·dσ + ½Vomma·dσ²
        </div>
        <div className="grid grid-cols-1 gap-3 font-sans text-[0.78rem] leading-relaxed text-[var(--text-dim)] sm:grid-cols-2">
          <p className="m-0">
            <b style={{ color: TERM_COLOR.gamma }}>Gamma·dS</b> — forced trade per $1 move, scaled by <b>dS</b>, this
            book&apos;s own last-observed move size ({fmtNum(context.dSPct, 2)}%), not a guess.
          </p>
          <p className="m-0">
            <b style={{ color: TERM_COLOR.charm }}>Charm·dt</b> — forced rebalancing from time decay alone, over{" "}
            <b>dt</b> = {context.dtDays} trading day, even at a frozen price.
          </p>
          <p className="m-0">
            <b style={{ color: TERM_COLOR.vanna }}>Vanna·dσ</b> — forced rebalancing from IV drift alone, scaled by{" "}
            <b>dσ</b>, this book&apos;s own realized ATM-IV change ({fmtNum(context.dSigmaPts, 2)} vol pts) — the third
            real trigger, usually ignored by simple GEX boards.
          </p>
          <p className="m-0">
            <b style={{ color: TERM_COLOR.speed }}>½Speed·dS², Color·dt·dS, Zomma·dS·dσ, ½Vomma·dσ²</b> — the second-order
            terms a first-order gamma+charm model drops entirely: how gamma itself shifts with price, time, and vol.
          </p>
        </div>
        <p className="m-0 mt-3 font-sans text-[0.78rem] leading-relaxed text-[var(--text-dim)]">
          The ranking metric is <b>expected</b> flow: |ΔHedge(K)| weighted by this book&apos;s own risk-neutral
          probability density (Breeden-Litzenberger, extracted from the chain) of spot actually landing near K — a real
          market-implied probability, not an arbitrary distance decay. <b>Confidence</b> is kept fully separate from the
          dollar estimate: it counts how many independent signals — gamma/charm/vanna dominance, live OI build, and
          cross-expiry wall alignment — agree the strike matters, rather than folding durability into the size.
        </p>
        <p className="m-0 mt-3 font-sans text-[0.72rem] leading-relaxed text-[var(--text-faint)]">
          Why not a full stochastic-vol (Heston) model: that needs numerical calibration against a raw IV surface to
          fit mean-reversion and vol-of-vol, and the smile it would capture is already priced into these greeks. The
          Taylor expansion is exact at this point and uses only what the feed gives — no re-derivation of the pricing
          model. This is a composite estimate from public options-chain exposure, not a literal dealer book — the sign
          convention (dealers long calls, short puts) is the standard assumption, not observed fact. 0DTE book only.
        </p>
      </div>

      <div className="border border-[var(--border)] bg-[var(--panel)] p-5">
        <div className="mb-3 flex items-center justify-between">
          <div className="partno" style={{ color: "var(--text-faint)" }}>
            RANKED BY EXPECTED HEDGE FLOW
          </div>
          <div className="font-mono text-[0.6rem] text-[var(--text-faint)]">TAP A ROW FOR ITS TAYLOR-TERM BREAKDOWN</div>
        </div>
        {ranked.map((row, i) => (
          <HedgePressureRankRow key={row.strike} rank={i + 1} row={row} maxFlow={maxFlow} />
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
