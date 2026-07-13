"use client";

import { useEffect, useMemo, useState } from "react";
import type { BlindSpotCluster, GexResponse, GexSymbol, HedgePressureRow, HedgeTaylorTerm } from "@/lib/gex";
import { computeBlindSpots, computeHedgePressure, fmtNum, fmtUsd, topStrikesByMagnitude } from "@/lib/gex";
import ExposureBarChart, { type ExposureBarDatum } from "@/components/optionsflow/ExposureBarChart";
import ExposureHeatmap from "@/components/optionsflow/ExposureHeatmap";

export type OptionsFlowView = "gex" | "dex" | "hedgepressure" | "blindspots";

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
          {row.sigmaZ >= 0 ? "+" : ""}
          {row.sigmaZ.toFixed(1)}σ
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
            Raw Taylor flow: {fmtUsd(row.taylorFlow)} × same-day reach weight {row.reachWeight.toFixed(3)} ({row.sigmaZ >= 0 ? "+" : ""}
            {row.sigmaZ.toFixed(2)}σ from spot) = expected {fmtUsd(row.expectedFlow)}
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
        <StatTile label="1-DAY MOVE (1σ)" value={`±${fmtNum(context.sigma1dPct, 2)}%`} />
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
          The ranking metric is <b>expected</b> flow: |ΔHedge(K)| weighted by same-day reachability — a Gaussian in
          log-return space, scored against this book&apos;s own explicit 1-trading-day move estimate (±
          {fmtNum(context.sigma1dPct, 2)}% today), not the option&apos;s own risk-neutral density. That density answers
          &ldquo;can spot reach K by expiry&rdquo; — often several days out even on the book this feed labels
          &ldquo;0dte&rdquo; — which let far-out strikes look reachable over a multi-day window while being a tail
          event for a single session. Scoring same-day reachability directly fixes that: strikes decay toward zero with
          no floor once they&apos;re more than a couple of standard deviations from spot, so &ldquo;most likely to see a
          reaction today&rdquo; is exactly what the rank means. Each row shows its distance in σ (standard deviations)
          from spot.
        </p>
        <p className="m-0 mt-3 font-sans text-[0.78rem] leading-relaxed text-[var(--text-dim)]">
          <b>Confidence</b> is a separate tag, not a second likelihood score — reachability is already priced into the
          rank, so it doesn&apos;t need repeating. Confidence instead asks whether <i>other, independent</i> evidence
          corroborates this being a real, durable level: is it within 2σ today, does gamma or charm actually dominate
          the breakdown (rather than the smaller higher-order terms), is vanna meaningful, is OI at this strike actively
          building, is it also a wall in another expiry, and is it this book&apos;s own call/put wall. A strike can rank
          #1 by dollars and still show MEDIUM if fewer of those corroborate — that&apos;s the tag doing its job, not a
          contradiction of the rank above it.
        </p>
        <p className="m-0 mt-3 font-sans text-[0.72rem] leading-relaxed text-[var(--text-faint)]">
          Why not a full stochastic-vol (Heston) model: that needs numerical calibration against a raw IV surface to
          fit mean-reversion and vol-of-vol, and the smile it would capture is already priced into these greeks. The
          Taylor expansion is exact at this point and uses only what the feed gives — no re-derivation of the pricing
          model. This is a composite estimate from public options-chain exposure, not a literal dealer book — the sign
          convention (dealers long calls, short puts) is the standard assumption, not observed fact. Same-day (1
          trading day) reachability throughout, regardless of the underlying contract&apos;s actual days to expiry.
        </p>
      </div>

      <div className="border border-[var(--border)] bg-[var(--panel)] p-5">
        <div className="mb-3 flex items-center justify-between">
          <div className="partno" style={{ color: "var(--text-faint)" }}>
            RANKED BY EXPECTED HEDGE FLOW — MOST LIKELY STRIKES TO REACT TODAY
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

function BlindSpotClusterRow({ cluster, maxScore }: { cluster: BlindSpotCluster; maxScore: number }) {
  const [expanded, setExpanded] = useState(false);
  const widthPct = maxScore > 0 ? (cluster.score / maxScore) * 100 : 0;

  return (
    <div className="border-b border-[var(--border)] last:border-0">
      <button onClick={() => setExpanded((v) => !v)} className="flex w-full items-center gap-3 py-2.5 text-left">
        <div className="w-8 shrink-0 font-mono text-[0.68rem] font-semibold text-[var(--text-faint)]">BL{cluster.rank}</div>
        <div className="w-20 shrink-0 font-mono text-[0.82rem] font-semibold">{fmtNum(cluster.price, 1)}</div>
        <div className="relative h-6 flex-1 overflow-hidden bg-[var(--panel-2)]">
          <div className="h-full bg-[var(--accent)] transition-[width] duration-300" style={{ width: `${widthPct}%` }} />
          <div className="absolute inset-0 flex items-center justify-end px-2 font-mono text-[0.66rem] text-[var(--text)]">
            {cluster.score.toFixed(2)}
          </div>
        </div>
        <div className="hidden w-28 shrink-0 text-right font-mono text-[0.62rem] text-[var(--text-faint)] sm:block">
          {cluster.contributors.length} level{cluster.contributors.length === 1 ? "" : "s"}
        </div>
        <div className="w-4 shrink-0 text-center font-mono text-[0.6rem] text-[var(--text-faint)]">{expanded ? "▾" : "▸"}</div>
      </button>

      {expanded && (
        <div className="mb-3 ml-11 flex flex-col gap-1.5 border-l border-[var(--border)] py-2 pl-4">
          {cluster.contributors.map((c, i) => (
            <div key={i} className="flex items-center gap-2 font-mono text-[0.66rem] text-[var(--text-dim)]">
              <span
                className="border border-[var(--border-strong)] px-1.5 py-0.5 font-semibold uppercase tracking-[0.04em]"
                style={{ color: c.asset === "QQQ" ? "var(--up)" : "var(--accent)" }}
              >
                {c.asset}
              </span>
              {c.label} @ {fmtNum(c.nativePrice, 1)}
              {c.asset !== "QQQ" && <span className="text-[var(--text-faint)]">→ {fmtNum(c.convertedPrice, 1)} (QQQ-equiv)</span>}
              <span className="text-[var(--text-faint)]">weight {c.weight.toFixed(2)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function BlindSpotsView() {
  const [qqq, setQqq] = useState<GexResponse | null>(null);
  const [spx, setSpx] = useState<GexResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      fetch("/api/gex?symbol=QQQ", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/gex?symbol=SPX", { cache: "no-store" }).then((r) => r.json()),
    ])
      .then(([qqqJson, spxJson]: [GexResponse, GexResponse]) => {
        if (cancelled) return;
        if (!qqqJson.ok || !spxJson.ok) throw new Error("upstream returned an error");
        setQqq(qqqJson);
        setSpx(spxJson);
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
  }, []);

  if (loading) {
    return (
      <div className="border border-[var(--border)] bg-[var(--panel)] p-8 text-center font-mono text-[0.8rem] text-[var(--text-faint)]">
        Loading QQQ + SPX confluence…
      </div>
    );
  }
  if (error || !qqq || !spx) {
    return (
      <div className="border border-[var(--border)] bg-[var(--panel)] p-8 text-center font-mono text-[0.8rem]" style={{ color: "var(--down)" }}>
        ERR: {error ?? "missing data"}
      </div>
    );
  }

  const { clusters, ratio, bandwidth } = computeBlindSpots(qqq, spx, 8);
  const maxScore = clusters[0]?.score ?? 1;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="QQQ SPOT" value={fmtNum(qqq.rnd.forward, 2)} />
        <StatTile label="SPX SPOT" value={fmtNum(spx.rnd.forward, 2)} />
        <StatTile label="RATIO (QQQ/SPX)" value={fmtNum(ratio, 4)} />
        <StatTile label="CLUSTER BAND" value={`±${fmtNum(bandwidth, 2)}`} />
      </div>

      <div className="border border-[var(--border)] bg-[var(--panel)] p-5">
        <div className="partno mb-2" style={{ color: "var(--text-faint)" }}>
          METHODOLOGY — REDUCED 2-ASSET CONFLUENCE, NOT MENTHORQ&apos;S MODEL
        </div>
        <p className="m-0 font-sans text-[0.82rem] leading-relaxed text-[var(--text-dim)]">
          MenthorQ&apos;s published Blind Spots idea: take option-derived levels from several correlated instruments
          (for NQ: NQ futures options, NDX, QQQ, and MAG7 stocks), convert every level onto one instrument&apos;s price
          scale, and cluster where several land near each other — the overlap density, not any single chain, is the
          signal. This feed only carries QQQ and SPX, so this is that same mechanic run on two assets instead of five
          or six — a smaller, honest version of the idea, not a reproduction of their product.
        </p>
        <p className="m-0 mt-3 font-sans text-[0.82rem] leading-relaxed text-[var(--text-dim)]">
          Each symbol contributes Call Resistance, Put Support, King Node, HVL (gamma flip), Max Pain, and its top 3
          secondary GEX strikes. SPX levels are converted to QQQ-equivalent prices via the ratio method (
          <code>level × QQQspot/SPXspot</code>) — appropriate here since the two trade at very different numeric
          levels. Every candidate price is scored by a Gaussian-kernel overlap density — weight × proximity to every
          contributing level, summed — and the ranked local maxima are the Blind Spots (BL1 = strongest overlap).
        </p>
        <p className="m-0 mt-3 font-sans text-[0.72rem] leading-relaxed text-[var(--text-faint)]">
          MenthorQ does not publish its weighting formula, clustering tolerance, correlation window, or dealer-side
          classifier — the weights, the ±0.4%-of-spot bandwidth, and the 0.85x discount on converted (non-native)
          levels here are stated assumptions, not recovered constants. 0DTE book only.
        </p>
      </div>

      <div className="border border-[var(--border)] bg-[var(--panel)] p-5">
        <div className="mb-3 flex items-center justify-between">
          <div className="partno" style={{ color: "var(--text-faint)" }}>
            RANKED BLIND SPOTS (QQQ SCALE)
          </div>
          <div className="font-mono text-[0.6rem] text-[var(--text-faint)]">TAP A ROW FOR ITS CONTRIBUTING LEVELS</div>
        </div>
        {clusters.map((cluster) => (
          <BlindSpotClusterRow key={cluster.rank} cluster={cluster} maxScore={maxScore} />
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
    if (view === "blindspots") return;
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

  if (view === "blindspots") return <BlindSpotsView />;

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
