"use client";

import { useEffect, useMemo, useState } from "react";
import { Area, AreaChart, ReferenceDot, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { GexResponse, GexSymbol, HedgePressureRow, TesseractZone } from "@/lib/gex";
import { computeHedgePressure, computeTesseractZones, fmtNum, fmtUsd, nearStrikeWindow } from "@/lib/gex";
import type { HedgeTerrainResponse } from "@/app/api/hedgeterrain/route";
import ExposureBarChart, { type ExposureBarDatum } from "@/components/optionsflow/ExposureBarChart";
import ExposureHeatmap from "@/components/optionsflow/ExposureHeatmap";
import Sparkline from "@/components/Sparkline";

export type OptionsFlowView = "gex" | "dex" | "hedgepressure" | "tesseract" | "volregime" | "hedgeterrain";

const SYMBOLS: GexSymbol[] = ["QQQ", "SPY"];
const TESSERACT_SYMBOLS: GexSymbol[] = ["QQQ", "SPY", "SPX", "NDX"];

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
  const top = useMemo(() => nearStrikeWindow(data.perStrike, data.spot, 22), [data]);
  const chartData: ExposureBarDatum[] = top.map((r) => ({ strike: r.strike, net: r.gex }));

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="TOTAL GEX (0DTE)" value={fmtUsd(data.totalGex0dte)} tone={tone(data.totalGex0dte)} />
        <StatTile label="CALL WALL" value={fmtNum(data.callWall, 0)} tone="up" />
        <StatTile label="PUT WALL" value={fmtNum(data.putWall, 0)} tone="down" />
        <StatTile label="GAMMA FLIP" value={data.gammaFlip !== null ? fmtNum(data.gammaFlip, 2) : "—"} />
      </div>
      <p className="m-0 font-sans text-[0.85rem] leading-relaxed text-[var(--text-dim)]">
        {data.symbol} 0DTE book ({data.resolvedExpiry}) — gamma exposure per strike for contracts expiring today only.
        Walls are self-derived by peak prominence on this curve (a backtested method, not raw magnitude), not trusted
        from any aggregate wall field.
      </p>

      <VisualCard title="GEX BY STRIKE" subtitle="Net GEX — positive (green) above zero, negative (red) below, 22 strikes nearest spot">
        <ExposureBarChart data={chartData} mode="net" unitLabel="GEX" />
      </VisualCard>

      <VisualCard title="GEX HEATMAP" subtitle="Intensity-scaled, net row">
        <ExposureHeatmap data={chartData} mode="net" />
      </VisualCard>
    </div>
  );
}

function DexExposureView({ data }: { data: GexResponse }) {
  const top = useMemo(() => nearStrikeWindow(data.perStrike, data.spot, 22), [data]);
  const chartData: ExposureBarDatum[] = top.map((r) => ({ strike: r.strike, net: r.dex }));

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="CALL WALL" value={fmtNum(data.callWall, 0)} tone="up" />
        <StatTile label="PUT WALL" value={fmtNum(data.putWall, 0)} tone="down" />
        <StatTile label="KING NODE" value={`${fmtNum(data.kingNode.strike, 0)} (${data.kingNode.type})`} />
        <StatTile label="MAX PAIN" value={fmtNum(data.maxPain, 0)} />
      </div>
      <p className="m-0 font-sans text-[0.85rem] leading-relaxed text-[var(--text-dim)]">
        Net delta exposure per strike, 0DTE only — positive means dealers are net long delta and must sell into rallies
        to stay hedged; negative means the opposite. Unit not documented by the source API; read directionally.
      </p>

      <VisualCard title="DEX BY STRIKE" subtitle="Net dealer delta exposure, 22 strikes nearest spot">
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

function HedgePressureRankRow({ rank, row, maxFlow }: { rank: number; row: HedgePressureRow; maxFlow: number }) {
  const [expanded, setExpanded] = useState(false);
  const widthPct = maxFlow > 0 ? (row.expectedFlow / maxFlow) * 100 : 0;

  return (
    <div className="border-b border-[var(--border)] last:border-0" style={{ borderLeft: `3px solid ${CONFIDENCE_COLOR[row.confidence]}` }}>
      <button onClick={() => setExpanded((v) => !v)} className="flex w-full items-center gap-3 py-2.5 pl-3 text-left">
        <div className="w-6 shrink-0 font-mono text-[0.68rem] text-[var(--text-faint)]">{rank}</div>
        <div className="w-16 shrink-0 font-mono text-[0.82rem] font-semibold">{fmtNum(row.strike, 0)}</div>
        <div className="relative h-6 flex-1 overflow-hidden bg-[var(--panel-2)]">
          <div
            className="h-full transition-[width] duration-300"
            style={{ width: `${widthPct}%`, background: row.gex >= 0 ? "var(--up)" : "var(--down)" }}
          />
          <div className="absolute inset-0 flex items-center justify-end px-2 font-mono text-[0.66rem] text-[var(--text)]">
            {fmtUsd(row.expectedFlow)}
          </div>
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
          <div className="font-mono text-[0.66rem] text-[var(--text-dim)]">
            0DTE GEX: {fmtUsd(row.gex)} × same-day reach weight {row.reachWeight.toFixed(3)} ({row.sigmaZ >= 0 ? "+" : ""}
            {row.sigmaZ.toFixed(2)}σ from spot) = expected {fmtUsd(row.expectedFlow)}
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-[0.64rem] text-[var(--text-dim)]">
            <div>Charm (self-computed, $): {fmtUsd(row.cex)}</div>
            <div>Vanna (self-computed, $): {fmtUsd(row.vex)}</div>
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

const CONFIDENCE_TIERS: { key: HedgePressureRow["confidence"]; label: string; note: string }[] = [
  { key: "HIGH", label: "HIGH CONFIDENCE", note: "2-3 independent signals corroborate this level: reachable within 2σ today, and/or this book's own self-derived call/put wall or king node." },
  { key: "MEDIUM", label: "MEDIUM CONFIDENCE", note: "1 corroborating signal — a real ranked strike, fewer independent checks agree." },
  { key: "LOW", label: "LOW CONFIDENCE", note: "No corroborating signal — ranked by dollars alone, nothing else backs it up." },
];

function HedgePressureView({ data }: { data: GexResponse }) {
  const { rows: ranked, context } = useMemo(() => computeHedgePressure(data, 15), [data]);
  const maxFlow = ranked[0]?.expectedFlow ?? 1;
  const grouped = CONFIDENCE_TIERS.map((tier) => ({ ...tier, rows: ranked.filter((r) => r.confidence === tier.key) })).filter(
    (g) => g.rows.length > 0
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="0DTE EXPIRY" value={data.resolvedExpiry} />
        <StatTile label="TOP STRIKE" value={fmtNum(ranked[0]?.strike, 0)} />
        <StatTile label="1-DAY MOVE (68%)" value={`+${fmtNum(context.sigmaUpPct, 2)}% / -${fmtNum(context.sigmaDownPct, 2)}%`} />
        <StatTile label="MAX PAIN" value={fmtNum(data.maxPain, 0)} />
      </div>

      <div className="border border-[var(--border)] bg-[var(--panel)] p-5">
        <div className="partno mb-2" style={{ color: "var(--text-faint)" }}>
          METHODOLOGY — LEISEN-REIMER + SVI, SELF-COMPUTED, REAL EMPIRICAL REACHABILITY
        </div>
        <p className="m-0 font-sans text-[0.82rem] leading-relaxed text-[var(--text-dim)]">
          GEX (and charm/vanna/dex/vega/theta) are no longer borrowed from a black box. This chain&apos;s real
          per-contract implied vol is first smoothed with a single-slice raw SVI fit (OI-weighted, so one noisy thin
          strike can&apos;t swing its own Greeks) before it reaches the pricer: a Leisen-Reimer American binomial tree
          (dividend yield {fmtNum(data.pricerInputs.q * 100, 1)}%, risk-free rate {fmtNum(data.pricerInputs.r * 100, 2)}%
          from FRED, dte {fmtNum(data.dteHours, 1)} hours) — American exercise matters here since SPY/QQQ/NDX options
          are early-exercise-eligible, unlike European Black-Scholes, and Leisen-Reimer converges smoothly at low step
          counts where plain CRR oscillates (validated directly against a Black-Scholes reference before this shipped).
          Dollar exposure uses the standard convention (Γ·OI·M·S²·0.01 for GEX, Δ·OI·M·S for DEX) with dealers assumed
          long calls / short puts — puts flip sign for GEX, charm, and vanna (that&apos;s what makes a put wall a
          support instead of adding to the call side); DEX doesn&apos;t need the flip since put delta is already
          negative on its own.
        </p>
        <p className="m-0 mt-3 font-sans text-[0.82rem] leading-relaxed text-[var(--text-dim)]">
          Ranked by <b>expected same-day hedge flow</b>: |GEX(K)| weighted by same-day reachability — a Gaussian in
          log-return space, but now scored against this chain&apos;s <b>real historical empirical distribution</b>{" "}
          (skewness {fmtNum(context.skewness, 2)}, excess kurtosis {fmtNum(context.excessKurtosis, 2)} — genuinely
          fat-tailed, not assumed Gaussian) instead of an OI-based proxy. Up-moves and down-moves each get their own
          real band width (+{fmtNum(context.sigmaUpPct, 2)}% / -{fmtNum(context.sigmaDownPct, 2)}%), not a symmetric
          assumption.
        </p>
        <p className="m-0 mt-3 font-sans text-[0.78rem] leading-relaxed text-[var(--text-dim)]">
          <b>Confidence</b> is a separate tag from the rank: it counts how many independent signals agree — reachable
          within 2σ today, and whether the strike is this book&apos;s own self-derived call/put wall or king node. A
          strike can rank #1 by dollars and still show MEDIUM if fewer of those corroborate — that&apos;s the tag
          doing its job, not a contradiction of the rank above it. Charm and vanna are shown per strike (now real
          dollar figures, confirmed units) as context, not folded into the ranked number — combining them correctly
          needs a real vol-change scenario this snapshot doesn&apos;t give us on its own.
        </p>
        <p className="m-0 mt-3 font-sans text-[0.72rem] leading-relaxed text-[var(--text-faint)]">
          Walls and king node are self-derived by peak-prominence on the 0DTE gex-by-strike curve (backtested on SPY
          2020-2026: next-day |return| was 0.70% near the top-persistence wall vs 1.07% far from it, Mann-Whitney
          p=9.7e-13) — not trusted from any aggregate, multi-expiry wall field. Stated simplifications: continuous
          dividend yield instead of discrete ex-dividend jumps, frozen-IV Greeks (no sticky-delta/local-vol surface
          response), single-slice SVI (this one expiry only, not a full multi-expiry SSVI surface). This is a
          composite estimate from public options-chain exposure, not a literal dealer book. 0DTE (today,{" "}
          {data.resolvedExpiry}) throughout.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        {grouped.map((group) => (
          <div key={group.key} className="border border-[var(--border)] bg-[var(--panel)] p-5">
            <div className="mb-1 flex items-center gap-2">
              <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: CONFIDENCE_COLOR[group.key] }} />
              <div className="partno" style={{ color: CONFIDENCE_COLOR[group.key] }}>
                {group.label}
              </div>
              <div className="font-mono text-[0.6rem] text-[var(--text-faint)]">({group.rows.length})</div>
            </div>
            <p className="m-0 mb-3 font-sans text-[0.72rem] leading-relaxed text-[var(--text-faint)]">{group.note}</p>
            {group.rows.map((row) => (
              <HedgePressureRankRow key={row.strike} rank={ranked.indexOf(row) + 1} row={row} maxFlow={maxFlow} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

const ZONE_RANK_COLOR = ["var(--up)", "var(--accent)", "#8b7fd6", "#4aa8d8", "#d9a441"];

/** The overlap-density curve across price, with each zone marked - the "shape" the tesseract name refers to. */
function TesseractCurveChart({ curve, zones, spot }: { curve: { x: number; c: number }[]; zones: TesseractZone[]; spot: number }) {
  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={curve} margin={{ top: 12, right: 16, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="tesseractFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.55} />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity={0.03} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="x"
            type="number"
            domain={["dataMin", "dataMax"]}
            tickFormatter={(v) => fmtNum(Number(v), 0)}
            tick={{ fill: "var(--text-faint)", fontSize: 10 }}
            tickLine={false}
            axisLine={{ stroke: "var(--border)" }}
          />
          <YAxis hide domain={[0, "dataMax"]} />
          <Tooltip
            contentStyle={{ background: "var(--panel)", border: "1px solid var(--border-strong)", borderRadius: 3, fontSize: 11 }}
            labelFormatter={(x) => `${fmtNum(Number(x), 1)}`}
            formatter={(v) => [Number(v).toFixed(2), "overlap"]}
          />
          <Area type="monotone" dataKey="c" stroke="var(--accent)" strokeWidth={1.5} fill="url(#tesseractFill)" isAnimationActive={false} dot={false} />
          {zones.map((z, i) => (
            <ReferenceDot
              key={z.rank}
              x={z.price}
              y={z.score}
              r={4}
              fill={ZONE_RANK_COLOR[Math.min(i, ZONE_RANK_COLOR.length - 1)]}
              stroke="var(--bg)"
              strokeWidth={1.5}
            />
          ))}
          <ReferenceDot x={spot} y={0} r={5} fill="var(--text)" stroke="var(--bg)" strokeWidth={1.5} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function TesseractZoneRow({ zone, maxScore, rankColor }: { zone: TesseractZone; maxScore: number; rankColor: string }) {
  const [expanded, setExpanded] = useState(false);
  const widthPct = maxScore > 0 ? (zone.score / maxScore) * 100 : 0;

  return (
    <div className="border-b border-[var(--border)] last:border-0">
      <button onClick={() => setExpanded((v) => !v)} className="flex w-full items-center gap-3 py-2.5 text-left">
        <div className="flex w-9 shrink-0 items-center gap-1.5 font-mono text-[0.68rem] font-semibold text-[var(--text-faint)]">
          <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: rankColor }} />
          {zone.rank}
        </div>
        <div className="w-20 shrink-0 font-mono text-[0.82rem] font-semibold">{fmtNum(zone.price, 1)}</div>
        <div className="relative h-6 flex-1 overflow-hidden bg-[var(--panel-2)]">
          <div className="h-full transition-[width] duration-300" style={{ width: `${widthPct}%`, background: rankColor }} />
          <div className="absolute inset-0 flex items-center justify-end px-2 font-mono text-[0.66rem] text-[var(--text)]">
            {zone.score.toFixed(2)}
          </div>
        </div>
        <div className="hidden w-28 shrink-0 text-right font-mono text-[0.62rem] text-[var(--text-faint)] sm:block">
          {zone.contributors.length} level{zone.contributors.length === 1 ? "" : "s"}
        </div>
        <div className="w-4 shrink-0 text-center font-mono text-[0.6rem] text-[var(--text-faint)]">{expanded ? "▾" : "▸"}</div>
      </button>

      {expanded && (
        <div className="mb-3 ml-11 flex flex-col gap-1.5 border-l border-[var(--border)] py-2 pl-4">
          {zone.contributors.map((c, i) => (
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

function TesseractZonesView() {
  const [bySymbol, setBySymbol] = useState<Partial<Record<GexSymbol, GexResponse>> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    async function fetchOne(symbol: GexSymbol): Promise<GexResponse> {
      const res = await fetch(`/api/gex?symbol=${symbol}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error ?? `request failed (${res.status})`);
      return json;
    }
    Promise.all(TESSERACT_SYMBOLS.map(fetchOne))
      .then((results) => {
        if (cancelled) return;
        const map: Partial<Record<GexSymbol, GexResponse>> = {};
        TESSERACT_SYMBOLS.forEach((s, i) => (map[s] = results[i]));
        setBySymbol(map);
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
        Loading {TESSERACT_SYMBOLS.join(" + ")} confluence…
      </div>
    );
  }
  const home = bySymbol?.QQQ;
  const others = bySymbol ? TESSERACT_SYMBOLS.slice(1).map((s) => bySymbol[s]).filter((d): d is GexResponse => !!d) : [];
  if (error || !home || others.length < TESSERACT_SYMBOLS.length - 1) {
    return (
      <div className="border border-[var(--border)] bg-[var(--panel)] p-8 text-center font-mono text-[0.8rem]" style={{ color: "var(--down)" }}>
        ERR: {error ?? "missing data"}
      </div>
    );
  }

  const { zones, bandwidth, curve } = computeTesseractZones(home, others, 5);
  const maxScore = zones[0]?.score ?? 1;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="QQQ SPOT" value={fmtNum(home.spot, 2)} />
        <StatTile label="ASSETS" value={TESSERACT_SYMBOLS.join(" · ")} />
        <StatTile label="TOP ZONE" value={fmtNum(zones[0]?.price, 1)} />
        <StatTile label="BAND" value={`±${fmtNum(bandwidth, 2)}`} />
      </div>

      <VisualCard title="CONFLUENCE CURVE" subtitle="Peaks = where multiple assets' levels line up (dot = spot)">
        <TesseractCurveChart curve={curve} zones={zones} spot={home.spot} />
      </VisualCard>

      <div className="border border-[var(--border)] bg-[var(--panel)] p-5">
        <div className="mb-3 flex items-center justify-between">
          <div className="partno" style={{ color: "var(--text-faint)" }}>
            TESSERACT ZONES (QQQ SCALE)
          </div>
          <div className="font-mono text-[0.6rem] text-[var(--text-faint)]">TAP A ROW FOR ITS CONTRIBUTING LEVELS</div>
        </div>
        {zones.map((zone, i) => (
          <TesseractZoneRow key={zone.rank} zone={zone} maxScore={maxScore} rankColor={ZONE_RANK_COLOR[Math.min(i, ZONE_RANK_COLOR.length - 1)]} />
        ))}
      </div>
    </div>
  );
}

interface VolIndex {
  symbol: string;
  label: string;
  note: string;
  price: number | null;
  history: number[];
}

function sparklineTone(history: number[]): "up" | "down" | "flat" {
  if (history.length < 2) return "flat";
  const delta = history[history.length - 1] - history[0];
  if (Math.abs(delta) < history[0] * 0.005) return "flat";
  return delta > 0 ? "up" : "down";
}

function VolIndexTile({ index }: { index: VolIndex }) {
  const tone = sparklineTone(index.history);
  const color = tone === "up" ? "var(--up)" : tone === "down" ? "var(--down)" : "var(--text)";
  return (
    <div className="border border-[var(--border)] bg-[var(--panel)] p-4">
      <div className="mb-1 flex items-baseline justify-between">
        <div className="font-mono text-[0.78rem] font-bold tracking-[0.06em]">{index.label}</div>
        <div className="font-mono text-[1.05rem] font-semibold" style={{ color }}>
          {index.price !== null ? index.price.toFixed(2) : "—"}
        </div>
      </div>
      <p className="m-0 mb-2 font-sans text-[0.68rem] leading-snug text-[var(--text-faint)]">{index.note}</p>
      {index.history.length >= 2 && <Sparkline data={index.history} tone={tone} heightClass="h-8" />}
    </div>
  );
}

/** Plain-language read of the standard cross-index relationships - conventional, publicly-cited thresholds, not a proprietary model. */
function volRegimeNotes(byId: Record<string, VolIndex>): string[] {
  const notes: string[] = [];
  const vix1d = byId.VIX1D?.price;
  const vix = byId.VIX?.price;
  const vxn = byId.VXN?.price;
  const vvix = byId.VVIX?.price;
  const skew = byId.SKEW?.price;

  if (vix1d !== null && vix !== null && vix1d !== undefined && vix !== undefined) {
    if (vix1d > vix) notes.push(`VIX1D (${vix1d.toFixed(1)}) above VIX (${vix.toFixed(1)}) — short-term stress priced above the 30-day term structure, event risk for today specifically.`);
    else if (vix1d < vix * 0.75) notes.push(`VIX1D well below VIX — calm session, no near-term event priced in.`);
  }
  if (vxn !== null && vix !== null && vxn !== undefined && vix !== undefined) {
    if (vxn > vix * 1.15) notes.push(`VXN (${vxn.toFixed(1)}) notably above VIX (${vix.toFixed(1)}) — Nasdaq-specific stress exceeds the broad market.`);
  }
  if (vvix !== null && vvix !== undefined) {
    if (vvix > 100) notes.push(`VVIX (${vvix.toFixed(1)}) above 100 — elevated vol-of-vol, larger swings in VIX itself are more likely.`);
    else if (vvix < 85) notes.push(`VVIX (${vvix.toFixed(1)}) below 85 — vol-of-vol is quiet.`);
  }
  if (skew !== null && skew !== undefined) {
    if (skew > 135) notes.push(`SKEW (${skew.toFixed(1)}) above 135 — tail-risk pricing is elevated (market paying up for downside protection).`);
    else if (skew < 115) notes.push(`SKEW (${skew.toFixed(1)}) below 115 — tail-risk pricing is contained.`);
  }
  if (!notes.length) notes.push("No index is outside its conventional reference range right now.");
  return notes;
}

function VolRegimeView() {
  const [indices, setIndices] = useState<VolIndex[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch("/api/volregime", { cache: "no-store" })
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return;
        if (!json.ok) throw new Error("upstream returned an error");
        setIndices(json.indices);
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
        Loading vol regime indices…
      </div>
    );
  }
  if (error || !indices) {
    return (
      <div className="border border-[var(--border)] bg-[var(--panel)] p-8 text-center font-mono text-[0.8rem]" style={{ color: "var(--down)" }}>
        ERR: {error ?? "missing data"}
      </div>
    );
  }

  const byId = Object.fromEntries(indices.map((i) => [i.symbol, i]));
  const notes = volRegimeNotes(byId);

  return (
    <div className="flex flex-col gap-6">
      <p className="m-0 font-sans text-[0.78rem] leading-relaxed text-[var(--text-faint)]">
        CBOE&apos;s own published volatility and tail-risk indices, live — not derived from the options feed above.
      </p>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {indices.map((idx) => (
          <VolIndexTile key={idx.symbol} index={idx} />
        ))}
      </div>

      <div className="border border-[var(--border)] bg-[var(--panel)] p-5">
        <div className="partno mb-2" style={{ color: "var(--text-faint)" }}>
          REGIME READ
        </div>
        <ul className="m-0 flex flex-col gap-2 pl-4 font-sans text-[0.8rem] leading-relaxed text-[var(--text-dim)]">
          {notes.map((n, i) => (
            <li key={i}>{n}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** Diverging color for a hedge-shares value: green = dealers must buy, red = dealers must sell, scaled by magnitude relative to the grid's own max. */
function hedgeColor(value: number, maxAbs: number): string {
  if (maxAbs <= 0) return "var(--panel-2)";
  const t = Math.max(-1, Math.min(1, value / maxAbs));
  const pct = Math.round(Math.abs(t) * 85);
  const base = t >= 0 ? "var(--up)" : "var(--down)";
  return `color-mix(in srgb, ${base} ${pct}%, var(--panel-2) ${100 - pct}%)`;
}

function HedgeTerrainHeatmap({ grid }: { grid: HedgeTerrainResponse["grid"] }) {
  const hoursAheadValues = [...new Set(grid.map((p) => p.hoursAhead))].sort((a, b) => a - b);
  const priceValues = [...new Set(grid.map((p) => p.price))].sort((a, b) => a - b);
  const maxAbs = Math.max(1, ...grid.map((p) => Math.abs(p.dealerHedgeShares)));
  const byKey = new Map(grid.map((p) => [`${p.hoursAhead}:${p.price}`, p]));

  return (
    <div className="overflow-x-auto">
      <div className="flex flex-col gap-px" style={{ minWidth: 640 }}>
        {hoursAheadValues.map((hours) => (
          <div key={hours} className="flex items-stretch gap-px">
            <div className="flex w-16 shrink-0 items-center justify-end pr-2 font-mono text-[0.6rem] text-[var(--text-faint)]">
              +{hours.toFixed(1)}h
            </div>
            <div className="flex flex-1 gap-px">
              {priceValues.map((price) => {
                const point = byKey.get(`${hours}:${price}`);
                const value = point?.dealerHedgeShares ?? 0;
                return (
                  <div
                    key={price}
                    title={`${fmtNum(price, 2)} @ +${hours.toFixed(1)}h: ${fmtNum(value, 0)} shares`}
                    className="h-7 flex-1"
                    style={{ background: hedgeColor(value, maxAbs) }}
                  />
                );
              })}
            </div>
          </div>
        ))}
        <div className="flex gap-px pl-16">
          {priceValues.map((price, i) => (
            <div
              key={price}
              className="flex-1 text-center font-mono text-[0.56rem] text-[var(--text-faint)]"
              style={{ visibility: i % 3 === 0 ? "visible" : "hidden" }}
            >
              {fmtNum(price, 0)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function HedgeTerrainView() {
  const [symbol, setSymbol] = useState<GexSymbol>("QQQ");
  const [data, setData] = useState<HedgeTerrainResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/hedgeterrain?symbol=${symbol}`, { cache: "no-store" })
      .then((res) => res.json())
      .then((json: HedgeTerrainResponse) => {
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
            as of {new Date(data.asOf).toLocaleTimeString()} · 0DTE {data.resolvedExpiry}
          </div>
        )}
      </div>

      {loading && (
        <div className="border border-[var(--border)] bg-[var(--panel)] p-8 text-center font-mono text-[0.8rem] text-[var(--text-faint)]">
          Repricing the book across a price/time grid…
        </div>
      )}
      {!loading && (error || !data) && (
        <div className="border border-[var(--border)] bg-[var(--panel)] p-8 text-center font-mono text-[0.8rem]" style={{ color: "var(--down)" }}>
          ERR: {error ?? "missing data"}
        </div>
      )}

      {!loading && !error && data && (
        <>
          <p className="m-0 font-sans text-[0.78rem] leading-relaxed text-[var(--text-faint)]">
            Every cell is a real reprice (Leisen-Reimer, frozen IV) at a hypothetical price and a hypothetical hours-
            ahead projection — not historical data (this app has no snapshot storage), a forward projection from right
            now.
          </p>

          <VisualCard title="HEDGE-PRESSURE TERRAIN" subtitle="Rows = hours ahead, columns = hypothetical price · green = dealers must buy, red = must sell">
            <HedgeTerrainHeatmap grid={data.grid} />
          </VisualCard>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="border border-[var(--border)] bg-[var(--panel)] p-5">
              <div className="partno mb-3" style={{ color: "var(--text-faint)" }}>
                DELTA-REHEDGING CLIFFS
              </div>
              {data.cliffs.length === 0 && <p className="m-0 font-sans text-[0.78rem] text-[var(--text-faint)]">No steep sections found right now.</p>}
              {data.cliffs.slice(0, 6).map((c, i) => (
                <div key={i} className="flex items-center justify-between border-b border-[var(--border)] py-2 last:border-0 font-mono text-[0.72rem]">
                  <span className="font-semibold">{fmtNum(c.price, 1)}</span>
                  <span
                    className="uppercase tracking-[0.06em]"
                    style={{ color: c.classification === "accelerating" ? "var(--down)" : c.classification === "stabilizing" ? "var(--up)" : "var(--text-faint)" }}
                  >
                    {c.classification}
                  </span>
                  <span className="text-[var(--text-faint)]">{fmtNum(c.steepness, 0)} sh/$</span>
                </div>
              ))}
            </div>

            <div className="border border-[var(--border)] bg-[var(--panel)] p-5">
              <div className="partno mb-3" style={{ color: "var(--text-faint)" }}>
                HEDGE BASIN
              </div>
              {data.basin ? (
                <div className="flex flex-col gap-1.5 font-mono text-[0.72rem] text-[var(--text-dim)]">
                  <div>
                    Center: <b>{fmtNum(data.basin.center, 2)}</b>
                  </div>
                  <div>
                    Inner range: {fmtNum(data.basin.innerLow, 1)} – {fmtNum(data.basin.innerHigh, 1)}
                  </div>
                  <div>
                    Escape boundaries: <span style={{ color: "var(--down)" }}>{fmtNum(data.basin.escapeLow, 1)}</span> /{" "}
                    <span style={{ color: "var(--up)" }}>{fmtNum(data.basin.escapeHigh, 1)}</span>
                  </div>
                </div>
              ) : (
                <p className="m-0 font-sans text-[0.78rem] text-[var(--text-faint)]">Not enough grid data.</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="border border-[var(--border)] bg-[var(--panel)] p-5">
              <div className="partno mb-3" style={{ color: "var(--text-faint)" }}>
                ACCELERATION (IGNITION) POINTS
              </div>
              {data.acceleration.length === 0 && <p className="m-0 font-sans text-[0.78rem] text-[var(--text-faint)]">None found.</p>}
              {data.acceleration.map((a, i) => (
                <div key={i} className="flex items-center justify-between border-b border-[var(--border)] py-2 last:border-0 font-mono text-[0.72rem]">
                  <span className="font-semibold">{fmtNum(a.price, 1)}</span>
                  <span className="text-[var(--text-faint)]">d²(hedge)/dP² = {fmtNum(a.acceleration, 1)}</span>
                </div>
              ))}
            </div>

            <div className="border border-[var(--border)] bg-[var(--panel)] p-5">
              <div className="partno mb-3" style={{ color: "var(--text-faint)" }}>
                GAMMA-FLIP UNCERTAINTY BAND
              </div>
              <p className="m-0 mb-2 font-sans text-[0.72rem] leading-relaxed text-[var(--text-faint)]">
                Dealer positioning direction is an assumption. Two conventions, not one line:
              </p>
              <div className="flex flex-col gap-1 font-mono text-[0.72rem] text-[var(--text-dim)]">
                <div>Standard (long calls / short puts): {data.gammaFlipBand.conventionA !== null ? fmtNum(data.gammaFlipBand.conventionA, 2) : "—"}</div>
                <div>Inverted (short calls / long puts): {data.gammaFlipBand.conventionB !== null ? fmtNum(data.gammaFlipBand.conventionB, 2) : "—"}</div>
                <div style={{ color: data.gammaFlipBand.agrees ? "var(--up)" : "var(--down)" }}>
                  {data.gammaFlipBand.agrees ? "Agrees within 0.5% — a trustworthy flip level." : "Diverges — this flip is fragile to the sign assumption."}
                </div>
              </div>
            </div>
          </div>

          <div className="border border-[var(--border)] bg-[var(--panel)] p-5">
            <div className="partno mb-3" style={{ color: "var(--text-faint)" }}>
              SVI SURFACE RESIDUALS — LARGEST DEVIATIONS FROM THE FITTED CURVE
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] font-mono text-[0.7rem]">
                <thead>
                  <tr className="border-b border-[var(--border)] text-left text-[var(--text-faint)]">
                    <th className="px-2 py-1.5">STRIKE</th>
                    <th className="px-2 py-1.5">SIDE</th>
                    <th className="px-2 py-1.5">RAW IV</th>
                    <th className="px-2 py-1.5">FITTED IV</th>
                    <th className="px-2 py-1.5">RESIDUAL</th>
                  </tr>
                </thead>
                <tbody>
                  {data.sviResiduals.slice(0, 8).map((r, i) => (
                    <tr key={i} className="border-b border-[var(--border)] last:border-0">
                      <td className="px-2 py-1.5 font-semibold">{fmtNum(r.strike, 0)}</td>
                      <td className="px-2 py-1.5 uppercase text-[var(--text-dim)]">{r.side}</td>
                      <td className="px-2 py-1.5">{(r.rawIv * 100).toFixed(1)}%</td>
                      <td className="px-2 py-1.5">{(r.fittedIv * 100).toFixed(1)}%</td>
                      <td className="px-2 py-1.5" style={{ color: r.residualPct >= 0 ? "var(--up)" : "var(--down)" }}>
                        {r.residualPct >= 0 ? "+" : ""}
                        {r.residualPct.toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="border border-[var(--border)] bg-[var(--panel)] p-5">
            <div className="partno mb-3" style={{ color: "var(--text-faint)" }}>
              CROSS-EXPIRY CONVERGENCE
            </div>
            {data.crossExpiry.length === 0 && (
              <p className="m-0 font-sans text-[0.78rem] text-[var(--text-faint)]">
                Cross-expiry data timed out this load (the upstream endpoint is slow) — try again shortly.
              </p>
            )}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] font-mono text-[0.7rem]">
                <thead>
                  <tr className="border-b border-[var(--border)] text-left text-[var(--text-faint)]">
                    <th className="px-2 py-1.5">EXPIRATION</th>
                    <th className="px-2 py-1.5">DTE</th>
                    <th className="px-2 py-1.5">CALL RESISTANCE</th>
                    <th className="px-2 py-1.5">PUT SUPPORT</th>
                    <th className="px-2 py-1.5">TOTAL OI</th>
                  </tr>
                </thead>
                <tbody>
                  {data.crossExpiry.map((row, i) => (
                    <tr key={i} className="border-b border-[var(--border)] last:border-0">
                      <td className="px-2 py-1.5 font-semibold">{row.expiration}</td>
                      <td className="px-2 py-1.5 text-[var(--text-dim)]">{row.dte}</td>
                      <td className="px-2 py-1.5" style={{ color: "var(--up)" }}>
                        {row.callResistance !== null ? fmtNum(row.callResistance, 0) : "—"}
                      </td>
                      <td className="px-2 py-1.5" style={{ color: "var(--down)" }}>
                        {row.putSupport !== null ? fmtNum(row.putSupport, 0) : "—"}
                      </td>
                      <td className="px-2 py-1.5 text-[var(--text-dim)]">{fmtNum(row.totalOi, 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
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
    if (view === "tesseract" || view === "volregime" || view === "hedgeterrain") return;
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

  if (view === "tesseract") return <TesseractZonesView />;
  if (view === "volregime") return <VolRegimeView />;
  if (view === "hedgeterrain") return <HedgeTerrainView />;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <SymbolToggle symbol={symbol} onChange={setSymbol} />
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
          {view === "gex" && <GexExposureView data={data} />}
          {view === "dex" && <DexExposureView data={data} />}
          {view === "hedgepressure" && <HedgePressureView data={data} />}
        </>
      )}
    </div>
  );
}
