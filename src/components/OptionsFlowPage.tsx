"use client";

import { useEffect, useMemo, useState } from "react";
import { Area, AreaChart, ReferenceDot, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { GexResponse, GexSymbol, HedgePressureRow, TesseractZone } from "@/lib/gex";
import { computeHedgePressure, computeTesseractZones, fmtNum, fmtUsd, nearStrikeWindow } from "@/lib/gex";
import ExposureBarChart, { type ExposureBarDatum } from "@/components/optionsflow/ExposureBarChart";
import ExposureHeatmap from "@/components/optionsflow/ExposureHeatmap";

export type OptionsFlowView = "gex" | "dex" | "hedgepressure" | "tesseract";

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
        <ExposureBarChart data={chartData} mode="net" unitLabel="GEX ($M)" />
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
            <div>Charm share of its own range: {(row.charmShare * 100).toFixed(0)}%</div>
            <div>Vanna share of its own range: {(row.vannaShare * 100).toFixed(0)}%</div>
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
  { key: "HIGH", label: "HIGH CONFIDENCE", note: "3+ independent signals corroborate this level (reachable today, charm/vanna elevated, self-derived wall or king node)." },
  { key: "MEDIUM", label: "MEDIUM CONFIDENCE", note: "2 corroborating signals — a real ranked strike, fewer independent checks agree." },
  { key: "LOW", label: "LOW CONFIDENCE", note: "0-1 corroborating signals — ranked by dollars alone, little else backs it up." },
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
        <StatTile label="1-DAY MOVE (1σ)" value={`±${fmtNum(context.sigma1dPct, 2)}%`} />
        <StatTile label="MAX PAIN" value={fmtNum(data.maxPain, 0)} />
      </div>

      <div className="border border-[var(--border)] bg-[var(--panel)] p-5">
        <div className="partno mb-2" style={{ color: "var(--text-faint)" }}>
          METHODOLOGY — CONFIRMED-UNIT DOLLARS ONLY, EVERYTHING ELSE IS CORROBORATION
        </div>
        <p className="m-0 font-sans text-[0.82rem] leading-relaxed text-[var(--text-dim)]">
          Ranked by <b>expected same-day hedge flow</b>: |0DTE GEX(K)| — the one greek this source documents a unit
          for ($M) — weighted by a strict same-day reachability Gaussian in log-return space, scored against this
          chain&apos;s own OI-weighted strike dispersion (±{fmtNum(context.sigma1dPct, 2)}% today), not an external vol
          number or the option&apos;s own multi-day risk-neutral density.
        </p>
        <p className="m-0 mt-3 font-sans text-[0.82rem] leading-relaxed text-[var(--text-dim)]">
          This data source also exposes charm, vanna, theta, and vega per strike — but doesn&apos;t document their
          units, and nothing here confirms they&apos;re on the same dollar scale as GEX. Rather than guess and risk
          another wrong number, they&apos;re shown per strike as a 0-100% share of their own grid&apos;s range —
          corroboration, never summed into the ranked dollar figure.
        </p>
        <p className="m-0 mt-3 font-sans text-[0.78rem] leading-relaxed text-[var(--text-dim)]">
          <b>Confidence</b> is a separate tag from the rank: it counts how many independent signals agree — reachable
          within 2σ today, charm or vanna meaningfully elevated, and whether the strike is this book&apos;s own
          self-derived call/put wall or king node. A strike can rank #1 by dollars and still show MEDIUM if fewer of
          those corroborate — that&apos;s the tag doing its job, not a contradiction of the rank above it.
        </p>
        <p className="m-0 mt-3 font-sans text-[0.72rem] leading-relaxed text-[var(--text-faint)]">
          Walls and king node are self-derived by peak-prominence on the 0DTE gex-by-strike curve (backtested on SPY
          2020-2026: next-day |return| was 0.70% near the top-persistence wall vs 1.07% far from it, Mann-Whitney
          p=9.7e-13) — not trusted from any aggregate, multi-expiry wall field. Open interest is aggregate across all
          expiries (this source doesn&apos;t expose OI per expiry), so OI-based signals are an approximation, not
          0DTE-pure. This is a composite estimate from public options-chain exposure, not a literal dealer book — the
          sign convention (dealers long calls, short puts) is the standard assumption, not observed fact. 0DTE (today,{" "}
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

export default function OptionsFlowPage({ view }: { view: OptionsFlowView }) {
  const [symbol, setSymbol] = useState<GexSymbol>("QQQ");
  const [data, setData] = useState<GexResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (view === "tesseract") return;
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
