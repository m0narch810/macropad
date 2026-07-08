import { backtestTooltip, type BacktestEvidence } from "@/lib/backtestImportance";

/**
 * Tiny "this input mattered in the backtest" marker. Amber on purpose —
 * evidence is non-directional, so it must never read as green/red.
 */
export default function BacktestChip({ evidence }: { evidence: BacktestEvidence }) {
  return (
    <span
      className="shrink-0 whitespace-nowrap font-mono text-[0.62rem] font-semibold uppercase tracking-wide"
      style={{ color: "var(--amber)" }}
      title={backtestTooltip(evidence)}
    >
      [bt#{evidence.rank}·{Math.round(evidence.weeklyShare * 100)}%]
    </span>
  );
}
