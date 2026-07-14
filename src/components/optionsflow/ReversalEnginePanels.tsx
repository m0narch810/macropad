"use client";

import { fmtNum } from "@/lib/gex";
import type { LevelState, ReversalLevel } from "@/lib/reversalEngine";

const STATE_LABEL: Record<LevelState, string> = { projected: "Projected", armed: "Armed", trade_ready: "Trade-Ready", elite: "Elite Reversal" };
const STATE_COLOR: Record<LevelState, string> = { projected: "var(--text-faint)", armed: "#d9a441", trade_ready: "var(--up)", elite: "var(--accent)" };

export function StateBadge({ state }: { state: LevelState }) {
  const color = STATE_COLOR[state];
  return (
    <span className="rounded-[2px] px-2 py-1 font-mono text-[0.68rem] font-semibold uppercase tracking-[0.04em]" style={{ color, background: `color-mix(in srgb, ${color} 15%, transparent)` }}>
      {STATE_LABEL[state]}
    </span>
  );
}

function scoreColor(score: number): string {
  if (score >= 70) return "var(--up)";
  if (score >= 40) return "#d9a441";
  return "var(--text-faint)";
}

export function LevelListPanel({ levels, spot }: { levels: ReversalLevel[]; spot: number }) {
  if (!levels.length) {
    return <p className="m-0 font-mono text-[0.75rem] text-[var(--text-faint)]">No reversal level cleared the minimum signal threshold this request.</p>;
  }

  const lows = levels.filter((l) => l.direction === "lower");
  const highs = levels.filter((l) => l.direction === "upper");

  const Row = ({ level }: { level: ReversalLevel }) => {
    const color = level.direction === "lower" ? "var(--up)" : "var(--down)";
    return (
      <div className="flex flex-col gap-2 border p-3" style={{ borderColor: color }}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="font-mono text-[1.05rem] font-semibold" style={{ color }}>
            {fmtNum(level.price, 2)}
          </div>
          <StateBadge state={level.state} />
        </div>
        <div className="flex items-center gap-3 font-mono text-[0.72rem] text-[var(--text-dim)]">
          <span>{fmtNum(Math.abs(level.price - spot), 2)} pts {level.direction === "lower" ? "below" : "above"} spot</span>
          <span>·</span>
          <span>Failure boundary {fmtNum(level.failureBoundary, 2)}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-[2px]" style={{ background: "var(--panel-2)" }}>
            <div className="h-full" style={{ width: `${Math.max(0, Math.min(100, level.score))}%`, background: scoreColor(level.score) }} />
          </div>
          <span className="font-mono text-[0.72rem] font-semibold" style={{ color: scoreColor(level.score) }}>
            {level.score.toFixed(0)}/100
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div className="flex flex-col gap-2">
        <div className="font-mono text-[0.62rem] uppercase tracking-[0.06em] text-[var(--text-faint)]">Potential lows (support)</div>
        {lows.length ? lows.map((l, i) => <Row key={i} level={l} />) : <p className="m-0 font-mono text-[0.72rem] text-[var(--text-faint)]">None found this request.</p>}
      </div>
      <div className="flex flex-col gap-2">
        <div className="font-mono text-[0.62rem] uppercase tracking-[0.06em] text-[var(--text-faint)]">Potential highs (resistance)</div>
        {highs.length ? highs.map((l, i) => <Row key={i} level={l} />) : <p className="m-0 font-mono text-[0.72rem] text-[var(--text-faint)]">None found this request.</p>}
      </div>
    </div>
  );
}

export function ReversalDiagnosticStrip({
  diagnostics,
}: {
  diagnostics: { pricingModel: string; levelsFound: number; fallbackUsed: boolean; crossProductWarning: string; lastCalculatedAt: number };
}) {
  return (
    <div className="flex flex-col gap-1.5 border-t border-[var(--border)] pt-3 font-mono text-[0.62rem] text-[var(--text-faint)]">
      <div>Pricing model: {diagnostics.pricingModel}</div>
      <div className="flex flex-wrap gap-x-6">
        <span>Levels found: {diagnostics.levelsFound}</span>
        <span>Fallback used: {diagnostics.fallbackUsed ? "yes" : "no"}</span>
        <span>Last calculated: {new Date(diagnostics.lastCalculatedAt).toLocaleTimeString()}</span>
      </div>
      <div>{diagnostics.crossProductWarning}</div>
    </div>
  );
}
