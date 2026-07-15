"use client";

import { fmtNum, fmtUsd } from "@/lib/gex";
import type { HedgeCliffResult } from "@/lib/hedgeCliffEngine";

function fmtPerDollar(v: number): string {
  return `${fmtUsd(v)}/$`;
}

const TYPE_COLOR: Record<string, string> = { stabilizing: "var(--up)", destabilizing: "var(--down)" };

export function HedgeStructurePanel({ hedgeCliff }: { hedgeCliff: HedgeCliffResult | null }) {
  if (!hedgeCliff) {
    return (
      <div className="hud border border-[var(--border)] bg-[var(--panel)] p-4">
        <div className="partno">Hedge Structure</div>
        <p className="m-0 mt-3 py-4 text-center font-mono text-[0.7rem] text-[var(--text-faint)]">Unavailable this request.</p>
      </div>
    );
  }

  const { upsideCliff, downsideCliff, maxPinning, feedbackFlip, hedgeBalanceZero, diagnostics } = hedgeCliff;

  return (
    <div className="hud flex flex-col gap-4 border border-[var(--border)] bg-[var(--panel)] p-4">
      <div className="partno">Hedge Structure</div>

      <div className="flex flex-col gap-1 border-b border-[var(--border)] pb-3">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[0.68rem] font-semibold text-[var(--text)]">UPSIDE CLIFF</span>
          <span className="font-mono text-[0.85rem] font-semibold" style={{ color: "var(--up)" }}>
            {upsideCliff ? fmtNum(upsideCliff.price, 2) : "—"}
          </span>
        </div>
        {upsideCliff && (
          <>
            <div className="flex items-center justify-between font-mono text-[0.62rem] text-[var(--text-faint)]">
              <span>TYPE</span>
              <span style={{ color: TYPE_COLOR[upsideCliff.type] }}>{upsideCliff.type.toUpperCase()}</span>
            </div>
            <div className="flex items-center justify-between font-mono text-[0.62rem] text-[var(--text-faint)]">
              <span>PRESSURE AFTER</span>
              <span className="text-[var(--text-dim)]">{fmtPerDollar(upsideCliff.pressureAfter)}</span>
            </div>
            <div className="flex items-center justify-between font-mono text-[0.62rem] text-[var(--text-faint)]">
              <span>CLIFF SCORE</span>
              <span className="text-[var(--text-dim)]">{upsideCliff.score.toFixed(1)}</span>
            </div>
          </>
        )}
        {!upsideCliff && <p className="m-0 font-mono text-[0.62rem] text-[var(--text-faint)]">No qualifying cliff above spot this request.</p>}
      </div>

      <div className="flex flex-col gap-1 border-b border-[var(--border)] pb-3">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[0.68rem] font-semibold text-[var(--text)]">DOWNSIDE CLIFF</span>
          <span className="font-mono text-[0.85rem] font-semibold" style={{ color: "var(--down)" }}>
            {downsideCliff ? fmtNum(downsideCliff.price, 2) : "—"}
          </span>
        </div>
        {downsideCliff && (
          <>
            <div className="flex items-center justify-between font-mono text-[0.62rem] text-[var(--text-faint)]">
              <span>TYPE</span>
              <span style={{ color: TYPE_COLOR[downsideCliff.type] }}>{downsideCliff.type.toUpperCase()}</span>
            </div>
            <div className="flex items-center justify-between font-mono text-[0.62rem] text-[var(--text-faint)]">
              <span>PRESSURE BELOW</span>
              <span className="text-[var(--text-dim)]">{fmtPerDollar(downsideCliff.pressureAfter)}</span>
            </div>
            <div className="flex items-center justify-between font-mono text-[0.62rem] text-[var(--text-faint)]">
              <span>CLIFF SCORE</span>
              <span className="text-[var(--text-dim)]">{downsideCliff.score.toFixed(1)}</span>
            </div>
          </>
        )}
        {!downsideCliff && <p className="m-0 font-mono text-[0.62rem] text-[var(--text-faint)]">No qualifying cliff below spot this request.</p>}
      </div>

      <div className="flex flex-col gap-1 border-b border-[var(--border)] pb-3">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[0.68rem] font-semibold text-[var(--text)]">MAX PINNING</span>
          <span className="font-mono text-[0.85rem] font-semibold" style={{ color: "var(--accent)" }}>
            {maxPinning.price !== null ? fmtNum(maxPinning.price, 2) : "—"}
          </span>
        </div>
        <div className="flex items-center justify-between font-mono text-[0.62rem] text-[var(--text-faint)]">
          <span>PRESSURE</span>
          <span className="text-[var(--text-dim)]">{maxPinning.pressure !== null ? fmtPerDollar(maxPinning.pressure) : "—"}</span>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[0.68rem] font-semibold text-[var(--text)]">FEEDBACK FLIP</span>
          <span className="font-mono text-[0.85rem] font-semibold" style={{ color: "#d9a441" }}>
            {feedbackFlip ? fmtNum(feedbackFlip.price, 2) : "—"}
          </span>
        </div>
        {feedbackFlip ? (
          <>
            <div className="flex items-center justify-between font-mono text-[0.62rem] text-[var(--text-faint)]">
              <span>ABOVE</span>
              <span style={{ color: TYPE_COLOR[feedbackFlip.aboveType] }}>{feedbackFlip.aboveType.toUpperCase()}</span>
            </div>
            <div className="flex items-center justify-between font-mono text-[0.62rem] text-[var(--text-faint)]">
              <span>BELOW</span>
              <span style={{ color: TYPE_COLOR[feedbackFlip.belowType] }}>{feedbackFlip.belowType.toUpperCase()}</span>
            </div>
          </>
        ) : (
          <p className="m-0 font-mono text-[0.62rem] text-[var(--text-faint)]">H'(S) does not change sign within the scanned range - one regime holds throughout.</p>
        )}
        <div className="mt-2 flex items-center justify-between font-mono text-[0.62rem] text-[var(--text-faint)]">
          <span>HEDGE BALANCE ZERO</span>
          <span className="text-[var(--text-dim)]">{hedgeBalanceZero.price !== null ? fmtNum(hedgeBalanceZero.price, 2) : "None besides spot"}</span>
        </div>
      </div>

      <div className="flex flex-col gap-1.5 border-t border-[var(--border)] pt-3 font-mono text-[0.58rem] leading-relaxed text-[var(--text-faint)]">
        {diagnostics.disclosures.map((d, i) => (
          <p key={i} className="m-0">
            {d}
          </p>
        ))}
        <div className="mt-1">Pricing model: {diagnostics.pricingModel}</div>
        <div>Grid: ±{diagnostics.gridRangePct.toFixed(1)}% around spot, ${diagnostics.gridStep.toFixed(3)} step</div>
        <div>Last calculated: {new Date(diagnostics.lastCalculatedAt).toLocaleTimeString()}</div>
      </div>
    </div>
  );
}
