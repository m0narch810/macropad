"use client";

import type { MacroPanel } from "@/lib/macroData";
import type { MarketRow } from "@/lib/getMarkets";
import { MARKET_SYMBOLS, marketRowId } from "@/lib/markets";
import { computeNetBias, type Horizon } from "@/lib/netBias";

const SHORT: Record<string, string> = {
  "^GSPC": "SPX",
  "^IXIC": "NDX",
  "CL=F": "WTI",
  "GC=F": "GOLD",
  "HG=F": "COPPER",
  "DX-Y.NYB": "DXY",
  HYG: "HYG",
  TLT: "TLT",
  "SI=F": "SILVER",
  "NG=F": "NATGAS",
};

function toneColor(tone: "up" | "down" | "flat"): string {
  return tone === "up" ? "var(--up)" : tone === "down" ? "var(--down)" : "var(--text-faint)";
}

function BiasItem({
  symbol,
  panels,
  markets,
  horizon,
  isActive,
  onPick,
}: {
  symbol: string;
  panels: MacroPanel[];
  markets: MarketRow[];
  horizon: Horizon;
  isActive: boolean;
  onPick: (symbol: string) => void;
}) {
  const market = markets.find((m) => m.id === marketRowId(symbol));
  const result = computeNetBias(panels, markets, symbol, horizon);
  const clamped = Math.max(-1, Math.min(1, result.score));
  // Rounded: Chromium's CSSOM re-serializes long floats (and expands the
  // `background` shorthand), which trips React hydration diffing.
  const halfPct = Math.round(Math.abs(clamped) * 5000) / 100;
  const color = toneColor(result.tone);

  return (
    <button
      onClick={() => onPick(symbol)}
      title={`${SHORT[symbol]}: ${result.verdict}, ${Math.round(result.conviction * 100)}% agreement`}
      className="group w-[132px] shrink-0 border-r border-[var(--border)] px-3.5 py-2.5 text-left transition-colors"
      style={isActive ? { background: "var(--panel)", boxShadow: "inset 0 -2px 0 var(--accent)" } : undefined}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-mono text-[0.7rem] font-semibold tracking-wide text-[var(--text-dim)] group-hover:text-[var(--text)]">
          {SHORT[symbol]}
        </span>
        <span className="font-mono text-[0.7rem] text-[var(--text-faint)]">{market?.value ?? ""}</span>
      </div>
      <div className="relative mt-1.5 h-[4px] rounded-[2px] bg-[var(--border)]">
        <div className="absolute left-1/2 top-[-2px] h-[8px] w-px bg-[var(--border-strong)]" />
        <div
          className="absolute top-0 h-full rounded-[2px]"
          style={{ width: `${halfPct}%`, backgroundColor: color, [clamped >= 0 ? "left" : "right"]: "50%" }}
        />
      </div>
      <div className="mt-1 flex items-baseline justify-between gap-1 text-[0.64rem] font-medium" style={{ color }}>
        <span>{result.verdict}</span>
        <span className="font-mono">{clamped >= 0 ? "+" : ""}{Math.round(clamped * 100)}%</span>
      </div>
    </button>
  );
}

/**
 * The bias tape: every asset's cadence-weighted net macro bias, scrolling
 * horizontally like the price ticker above it — one continuous strip
 * instead of a wrapped grid, so it reads the same way at any width.
 */
export default function BiasTape({
  panels,
  markets,
  horizon,
  activeSymbol,
  onPick,
}: {
  panels: MacroPanel[];
  markets: MarketRow[];
  horizon: Horizon;
  activeSymbol: string;
  onPick: (symbol: string) => void;
}) {
  return (
    <div className="overflow-hidden border-b border-[var(--border)] bg-[var(--panel-2)]">
      <div className="bias-tape-track flex w-max">
        <div className="flex">
          {MARKET_SYMBOLS.map(({ symbol }) => (
            <BiasItem key={symbol} symbol={symbol} panels={panels} markets={markets} horizon={horizon} isActive={activeSymbol === symbol} onPick={onPick} />
          ))}
        </div>
        <div className="flex" aria-hidden="true">
          {MARKET_SYMBOLS.map(({ symbol }) => (
            <BiasItem key={`${symbol}-dup`} symbol={symbol} panels={panels} markets={markets} horizon={horizon} isActive={activeSymbol === symbol} onPick={onPick} />
          ))}
        </div>
      </div>

      <style>{`
        .bias-tape-track {
          animation: bias-tape-scroll 34s linear infinite;
        }
        .bias-tape-track:hover {
          animation-play-state: paused;
        }
        @keyframes bias-tape-scroll {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        @media (prefers-reduced-motion: reduce) {
          .bias-tape-track {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
}
