import { backtestTooltip, type BacktestEvidence } from "@/lib/backtestImportance";

/**
 * Tiny "this input mattered in the backtest" marker. Neutral accent color on
 * purpose — relevance says nothing about direction.
 */
export default function BacktestChip({ evidence }: { evidence: BacktestEvidence }) {
  return (
    <span
      className="shrink-0 whitespace-nowrap rounded-full border px-2 py-[2px] font-mono text-[0.6rem] font-semibold uppercase tracking-wide"
      style={{
        color: "var(--accent)",
        borderColor: "color-mix(in srgb, var(--accent) 35%, var(--border))",
        background: "color-mix(in srgb, var(--accent) 8%, transparent)",
      }}
      title={backtestTooltip(evidence)}
    >
      bt #{evidence.rank} · {Math.round(evidence.weeklyShare * 100)}%
    </span>
  );
}
