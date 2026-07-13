"use client";

import { useEffect, useMemo, useState } from "react";
import type { GexResponse, GexSymbol } from "@/lib/gex";
import { computeHedgePressure, fmtNum, fmtPct, fmtUsd, topStrikesByMagnitude } from "@/lib/gex";
import ExposureBarChart, { type ExposureBarDatum } from "@/components/optionsflow/ExposureBarChart";
import ExposureHeatmap from "@/components/optionsflow/ExposureHeatmap";

export type OptionsFlowView = "gex" | "dex" | "volsurface" | "walls" | "expectedmove" | "pressure" | "hedgepressure";

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

/** A titled card wrapping one visualization, consistent chrome across bar/heatmap/3D. */
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
        <StatTile label="ATM IV" value={fmtPct(data.quality.atmIv * 100, 1)} />
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

function VolSurfaceView({ data }: { data: GexResponse }) {
  const { skew } = data.shadow;
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="ATM IV" value={fmtPct(data.quality.atmIv * 100, 1)} />
        <StatTile label="CALL IV" value={fmtPct(skew.callIvPct, 1)} />
        <StatTile label="PUT IV" value={fmtPct(skew.putIvPct, 1)} />
        <StatTile label="SKEW GAP" value={`${fmtNum(skew.gapPts, 2)} pts`} tone={tone(skew.gapPts)} />
      </div>
      <div className="border border-[var(--border)] bg-[var(--panel)] p-5">
        <div className="partno mb-2" style={{ color: "var(--text-faint)" }}>
          SKEW READ
        </div>
        <div className="font-mono text-[1rem] font-semibold uppercase">{skew.read}</div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <StatTile label="FORWARD" value={fmtNum(data.rnd.forward, 2)} />
        <StatTile label="RND MEAN" value={fmtNum(data.rnd.mean, 2)} />
        <StatTile label="RND MASS" value={fmtPct(data.rnd.quality.mass * 100, 2)} />
      </div>
      <div className="overflow-x-auto border border-[var(--border)]">
        <table className="w-full min-w-[420px] font-mono text-[0.72rem]">
          <thead>
            <tr className="border-b border-[var(--border)] bg-[var(--panel)] text-left text-[var(--text-faint)]">
              <th className="px-3 py-2">P25</th>
              <th className="px-3 py-2">P50 (MEDIAN)</th>
              <th className="px-3 py-2">P75</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="px-3 py-1.5">{fmtNum(data.rnd.quality.p25, 2)}</td>
              <td className="px-3 py-1.5 font-semibold">{fmtNum(data.rnd.quality.p50, 2)}</td>
              <td className="px-3 py-1.5">{fmtNum(data.rnd.quality.p75, 2)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StrikeWallsView({ data }: { data: GexResponse }) {
  const { aggregate, structure } = data;
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="CALL WALL" value={fmtNum(aggregate.callWall, 0)} tone="up" />
        <StatTile label="PUT WALL" value={fmtNum(aggregate.putWall, 0)} tone="down" />
        <StatTile label="MAX PAIN" value={fmtNum(aggregate.maxPain, 0)} />
        <StatTile label="GAMMA FLIP" value={fmtNum(aggregate.flip.nearestFlip, 2)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <StatTile label="CALL WALL GEX" value={fmtUsd(aggregate.callWallGex)} tone="up" />
        <StatTile label="PUT WALL GEX" value={fmtUsd(aggregate.putWallGex)} tone="down" />
      </div>
      <div className="border border-[var(--border)] bg-[var(--panel)] p-5">
        <div className="partno mb-2" style={{ color: "var(--text-faint)" }}>
          KING NODE
        </div>
        <div className="font-mono text-[1rem] font-semibold">
          {fmtNum(structure.kingNode.strike, 0)} — {structure.kingNode.type} ({fmtUsd(structure.kingNode.gex)})
        </div>
      </div>
      <div className="overflow-x-auto border border-[var(--border)]">
        <table className="w-full min-w-[480px] font-mono text-[0.72rem]">
          <thead>
            <tr className="border-b border-[var(--border)] bg-[var(--panel)] text-left text-[var(--text-faint)]">
              <th className="px-3 py-2">LEVEL</th>
              <th className="px-3 py-2">TYPE</th>
              <th className="px-3 py-2">DIST %</th>
              <th className="px-3 py-2">GEX</th>
            </tr>
          </thead>
          <tbody>
            {structure.levels.map((l, i) => (
              <tr key={i} className="border-b border-[var(--border)] last:border-0">
                <td className="px-3 py-1.5 font-semibold">{fmtNum(l.price, 2)}</td>
                <td className="px-3 py-1.5 uppercase text-[var(--text-dim)]">{l.type}</td>
                <td className="px-3 py-1.5">{fmtPct(l.distPct, 2)}</td>
                <td className="px-3 py-1.5" style={{ color: l.gex >= 0 ? "var(--up)" : "var(--down)" }}>
                  {fmtUsd(l.gex)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ExpectedMoveView({ data }: { data: GexResponse }) {
  const { rnd, shadow, aggregate, development } = data;
  const upMove = rnd.forward * (1 + shadow.volMap.sigUpPts / 100) - rnd.forward;
  const downMove = rnd.forward - rnd.forward * (1 - shadow.volMap.sigDnPts / 100);
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="FORWARD" value={fmtNum(rnd.forward, 2)} />
        <StatTile label="EXP MOVE UP" value={`+${fmtNum(upMove, 2)}`} tone="up" />
        <StatTile label="EXP MOVE DOWN" value={`-${fmtNum(downMove, 2)}`} tone="down" />
        <StatTile label="VOL TRIGGER" value={fmtNum(aggregate.volTrigger.price, 2)} />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <StatTile label="P25 (LOW)" value={fmtNum(rnd.quality.p25, 2)} />
        <StatTile label="P50 (MEDIAN)" value={fmtNum(rnd.quality.p50, 2)} />
        <StatTile label="P75 (HIGH)" value={fmtNum(rnd.quality.p75, 2)} />
      </div>
      <div className="border border-[var(--border)] bg-[var(--panel)] p-5">
        <div className="partno mb-2" style={{ color: "var(--text-faint)" }}>
          MOVE STABILITY
        </div>
        <div className="font-mono text-[0.9rem]">
          Last observed move: {fmtPct(development.volTrig.movePct, 2)} — {development.volTrig.stability}
        </div>
      </div>
      <p className="m-0 font-sans text-[0.85rem] leading-relaxed text-[var(--text-dim)]">
        {aggregate.volTrigger.belowTrigger ? "Spot is below the vol trigger — " : "Spot is above the vol trigger — "}
        {aggregate.volTrigger.method}.
      </p>
    </div>
  );
}

function PutCallPressureView({ data }: { data: GexResponse }) {
  const { development, dealer } = data;
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="PUT/CALL RATIO" value={fmtNum(development.oi.pcr, 3)} tone={development.oi.pcr > 1 ? "down" : "up"} />
        <StatTile label="PCR TREND" value={development.oi.pcrTrend.toUpperCase()} />
        <StatTile label="DEALER BIAS" value={dealer.drift.bias} tone={dealer.drift.bias === "BULLISH" ? "up" : dealer.drift.bias === "BEARISH" ? "down" : "neutral"} />
        <StatTile label="NET DRIFT" value={fmtUsd(dealer.drift.netPerHourUsd) + "/hr"} tone={tone(dealer.drift.netPerHourUsd)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <StatTile label="CALL FLOW" value={`${fmtUsd(dealer.drift.call.perHourUsd)}/hr ${dealer.drift.call.direction}`} tone="up" />
        <StatTile label="PUT FLOW" value={`${fmtUsd(dealer.drift.put.perHourUsd)}/hr ${dealer.drift.put.direction}`} tone="down" />
      </div>
      <p className="m-0 font-sans text-[0.85rem] leading-relaxed text-[var(--text-dim)]">{dealer.drift.note}</p>
      <div className="border border-[var(--border)] bg-[var(--panel)] p-5">
        <div className="partno mb-2" style={{ color: "var(--text-faint)" }}>
          WALL ALIGNMENT
        </div>
        <div className="font-mono text-[0.85rem]">
          Front: call {fmtNum(dealer.alignment.front.callWall, 0)} / put {fmtNum(dealer.alignment.front.putWall, 0)} · All-book: call{" "}
          {fmtNum(dealer.alignment.allBook.callWall, 0)} / put {fmtNum(dealer.alignment.allBook.putWall, 0)} —{" "}
          {dealer.alignment.aligned ? "aligned" : "not aligned"}
        </div>
      </div>
    </div>
  );
}

function HedgePressureRow({ rank, row, maxScore }: { rank: number; row: ReturnType<typeof computeHedgePressure>[number]; maxScore: number }) {
  const widthPct = maxScore > 0 ? (row.score / maxScore) * 100 : 0;
  return (
    <div className="flex items-center gap-3 border-b border-[var(--border)] py-2.5 last:border-0">
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
      <div className="hidden w-24 shrink-0 text-right font-mono text-[0.66rem] text-[var(--text-faint)] sm:block">
        {fmtPct(row.distPct, 1)}
      </div>
      <div className="flex w-32 shrink-0 flex-wrap justify-end gap-1">
        {row.flags.map((f) => (
          <span
            key={f}
            className="border border-[var(--border-strong)] px-1.5 py-0.5 font-mono text-[0.56rem] font-semibold uppercase tracking-[0.04em] text-[var(--text-dim)]"
          >
            {f}
          </span>
        ))}
      </div>
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
          METHODOLOGY
        </div>
        <p className="m-0 font-sans text-[0.82rem] leading-relaxed text-[var(--text-dim)]">
          Dealers must stay delta-neutral, so hedging isn&apos;t optional — it&apos;s forced by three mechanics: <b>gamma</b> (a
          strike&apos;s exposure to a hedge trade per $1 spot move), <b>charm</b> (forced rebalancing from time decay alone,
          even with zero price movement), and <b>open interest concentration</b> (a strike only matters if size actually
          sits there). Score = 45% |GEX| + 30% |charm| + 15% OI share + 10% proximity to spot, each normalized against the
          book&apos;s max. This is a ranking built from public options-chain exposure, not a literal dealer position —
          treat it as where forced flow is most likely to concentrate, not certainty.
        </p>
      </div>

      <div className="border border-[var(--border)] bg-[var(--panel)] p-5">
        <div className="mb-3 flex items-center justify-between">
          <div className="partno" style={{ color: "var(--text-faint)" }}>
            RANKED BY HEDGE PRESSURE
          </div>
          <div className="font-mono text-[0.6rem] text-[var(--text-faint)]">STRIKE · SCORE · DIST% · FLAGS</div>
        </div>
        {ranked.map((row, i) => (
          <HedgePressureRow key={row.strike} rank={i + 1} row={row} maxScore={maxScore} />
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
          {view === "volsurface" && <VolSurfaceView data={data} />}
          {view === "walls" && <StrikeWallsView data={data} />}
          {view === "expectedmove" && <ExpectedMoveView data={data} />}
          {view === "pressure" && <PutCallPressureView data={data} />}
          {view === "hedgepressure" && <HedgePressureView data={data} />}
        </>
      )}
    </div>
  );
}
