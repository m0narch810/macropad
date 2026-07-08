"use client";

import type { MacroSeries } from "@/lib/macroData";
import { getBias, getSignTone } from "@/lib/bias";

function TickerItem({ s }: { s: MacroSeries }) {
  const tone = getSignTone(s.id, s.zscore);
  const color = tone === "up" ? "var(--up)" : tone === "down" ? "var(--down)" : "var(--text-faint)";
  const bias = getBias(s.id, s.zscore);

  return (
    <div className="flex shrink-0 items-center gap-2.5 px-5" title={bias?.label ?? s.note}>
      <div>
        <div className="font-mono text-[0.62rem] uppercase leading-none tracking-wide text-[var(--text-faint)]">{s.name}</div>
        <div className="mt-0.5 flex items-baseline gap-1.5">
          <span className="font-mono text-[0.82rem] font-semibold leading-none" style={{ color }}>
            {s.value}
          </span>
          {s.zscore !== null && (
            <span className="font-mono text-[0.66rem] leading-none" style={{ color }}>
              {s.zscore > 0 ? "+" : ""}
              {Math.round(s.zscore * 100)}%
            </span>
          )}
        </div>
      </div>
      <span className="text-[var(--border)]">|</span>
    </div>
  );
}

/** Second scrolling strip below the market price ticker - every tracked indicator, not just prices. */
export default function IndicatorTicker({ series }: { series: MacroSeries[] }) {
  if (series.length === 0) return null;

  return (
    <div className="overflow-hidden border-b border-[var(--border)] bg-[var(--panel)] py-2">
      <div className="indicator-ticker-track flex w-max items-center">
        <div className="flex items-center">
          {series.map((s) => (
            <TickerItem key={s.id} s={s} />
          ))}
        </div>
        <div className="flex items-center" aria-hidden="true">
          {series.map((s) => (
            <TickerItem key={`${s.id}-dup`} s={s} />
          ))}
        </div>
      </div>

      <style>{`
        .indicator-ticker-track {
          animation: indicator-ticker-scroll 90s linear infinite;
        }
        .indicator-ticker-track:hover {
          animation-play-state: paused;
        }
        @keyframes indicator-ticker-scroll {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        @media (prefers-reduced-motion: reduce) {
          .indicator-ticker-track {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
}
