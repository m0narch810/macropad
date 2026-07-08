"use client";

import Sparkline from "@/components/Sparkline";
import type { MarketRow } from "@/lib/getMarkets";

function TickerItem({ m }: { m: MarketRow }) {
  return (
    <div className="flex shrink-0 items-center gap-2.5 px-5">
      <div>
        <div className="font-sans text-[0.62rem] leading-none text-[var(--text-faint)]">{m.name}</div>
        <div className="mt-0.5 flex items-baseline gap-1.5">
          <span
            className="font-mono text-[0.88rem] font-semibold leading-none"
            style={{ color: m.status === "up" ? "var(--up)" : m.status === "down" ? "var(--down)" : "var(--text)" }}
          >
            {m.value}
          </span>
        </div>
      </div>
      {m.sparkline && m.sparkline.length >= 5 && (
        <div className="w-14">
          <Sparkline data={m.sparkline} tone={m.status} heightClass="h-7" />
        </div>
      )}
      <span className="text-[var(--border)]">|</span>
    </div>
  );
}

export default function MarketTicker({ markets }: { markets: MarketRow[] }) {
  if (markets.length === 0) return null;

  return (
    <div className="overflow-hidden border-b border-[var(--border)] bg-[var(--panel-2)] py-2.5">
      <div className="ticker-track flex w-max items-center">
        <div className="flex items-center">
          {markets.map((m) => (
            <TickerItem key={m.id} m={m} />
          ))}
        </div>
        <div className="flex items-center" aria-hidden="true">
          {markets.map((m) => (
            <TickerItem key={`${m.id}-dup`} m={m} />
          ))}
        </div>
      </div>

      <style>{`
        .ticker-track {
          animation: ticker-scroll 42s linear infinite;
        }
        .ticker-track:hover {
          animation-play-state: paused;
        }
        @keyframes ticker-scroll {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        @media (prefers-reduced-motion: reduce) {
          .ticker-track {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
}
