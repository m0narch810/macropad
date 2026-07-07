"use client";

import Sparkline from "@/components/Sparkline";
import { alignByDate, pearson } from "@/lib/stats";
import type { MarketRow } from "@/lib/getMarkets";
import type { HistoryPoint } from "@/lib/macroData";

export default function MarketLink({
  market,
  rationale,
  indicatorHistory,
}: {
  market: MarketRow;
  rationale: string;
  indicatorHistory: HistoryPoint[];
}) {
  const r =
    market.history && market.history.length >= 20
      ? (() => {
          const aligned = alignByDate(indicatorHistory, market.history!, 6);
          return pearson(aligned.a, aligned.b);
        })()
      : null;

  const toneColor = market.status === "up" ? "var(--up)" : market.status === "down" ? "var(--down)" : "var(--text-faint)";

  return (
    <div className="flex items-center gap-3 rounded-md border border-[var(--border)] bg-[var(--panel-2)] px-3.5 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="font-sans text-[0.68rem] uppercase tracking-wide text-[var(--text-faint)]">Linked market</span>
          <span className="font-sans text-[0.78rem] font-semibold text-[var(--text)]">{market.name}</span>
        </div>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="font-mono text-[1.05rem] font-semibold" style={{ color: toneColor }}>
            {market.value}
          </span>
          {r !== null && (
            <span className="font-mono text-[0.72rem] text-[var(--text-faint)]">
              r = {r > 0 ? "+" : ""}
              {r.toFixed(2)}
            </span>
          )}
        </div>
        <p className="m-0 mt-1 font-sans text-[0.72rem] leading-snug text-[var(--text-faint)]">{rationale}</p>
      </div>
      {market.sparkline && market.sparkline.length >= 5 && (
        <div className="w-16 shrink-0">
          <Sparkline data={market.sparkline} tone={market.status} heightClass="h-10" />
        </div>
      )}
    </div>
  );
}
