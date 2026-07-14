"use client";

import { fmtNum } from "@/lib/gex";
import type { BiasDirection, BiasMode, OpFloBiasResult } from "@/lib/opfloEngine";

const DIRECTION_LABEL: Record<BiasDirection, string> = {
  strong_bullish: "STRONG BULLISH",
  bullish: "BULLISH",
  neutral: "NEUTRAL",
  bearish: "BEARISH",
  strong_bearish: "STRONG BEARISH",
};
const DIRECTION_COLOR: Record<BiasDirection, string> = {
  strong_bullish: "var(--up)",
  bullish: "var(--up)",
  neutral: "var(--text-faint)",
  bearish: "var(--down)",
  strong_bearish: "var(--down)",
};
const MODE_LABEL: Record<BiasMode, string> = { supportive: "Supportive", reflexive: "Reflexive", mean_reverting: "Mean-Reverting", conflicted: "Conflicted" };
const STABILITY_LABEL: Record<OpFloBiasResult["stability"], string> = { high: "High", moderate: "Moderate", low: "Low" };
const CROSS_EXPIRY_LABEL: Record<OpFloBiasResult["crossExpiry"]["classification"], string> = {
  reinforcing: "Reinforcing",
  same_day_conflict: "Same-Day Conflict",
  structural_support: "Structural Support",
  intraday_dominant: "Intraday-Dominant",
  insufficient_data: "Insufficient Data",
};

function fmtShares(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "+";
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(2)}M shares`;
  if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(0)}K shares`;
  return `${sign}${Math.round(abs)} shares`;
}

function fmtMinutes(m: number): string {
  const h = Math.floor(m / 60);
  const mm = Math.round(m % 60);
  return h > 0 ? `${h}h ${mm}m` : `${mm}m`;
}

export function OpFloCard({ bias }: { bias: OpFloBiasResult }) {
  const color = DIRECTION_COLOR[bias.direction];
  return (
    <div className="flex flex-col gap-4 border p-6" style={{ borderColor: color, background: `color-mix(in srgb, ${color} 6%, var(--panel) 94%)` }}>
      <div className="font-mono text-[0.6rem] uppercase tracking-[0.12em] text-[var(--text-faint)]">OpFlo Rest-of-RTH Bias</div>

      <div className="flex items-baseline gap-4">
        <span className="font-mono text-[2rem] font-bold leading-none" style={{ color }}>
          {DIRECTION_LABEL[bias.direction]}
        </span>
        <span className="font-mono text-[1.5rem] font-semibold text-[var(--text)]">{Math.round(Math.abs(bias.score))} / 100</span>
      </div>

      <div className="grid grid-cols-2 gap-4 border-t border-[var(--border)] pt-4 font-mono text-[0.78rem] sm:grid-cols-3">
        <div>
          <div className="text-[0.6rem] uppercase tracking-[0.06em] text-[var(--text-faint)]">Mode</div>
          <div className="mt-1 font-semibold text-[var(--text)]">{MODE_LABEL[bias.mode]}</div>
        </div>
        <div>
          <div className="text-[0.6rem] uppercase tracking-[0.06em] text-[var(--text-faint)]">Horizon</div>
          <div className="mt-1 font-semibold text-[var(--text)]">Through close ({fmtMinutes(bias.horizonMinutes)})</div>
        </div>
        <div>
          <div className="text-[0.6rem] uppercase tracking-[0.06em] text-[var(--text-faint)]">Stability</div>
          <div className="mt-1 font-semibold text-[var(--text)]">{STABILITY_LABEL[bias.stability]}</div>
        </div>
        <div>
          <div className="text-[0.6rem] uppercase tracking-[0.06em] text-[var(--text-faint)]">Remaining Modeled Flow</div>
          <div className="mt-1 font-semibold" style={{ color: bias.remainingFlowShares >= 0 ? "var(--up)" : "var(--down)" }}>
            {fmtShares(bias.remainingFlowShares)}
          </div>
        </div>
        <div>
          <div className="text-[0.6rem] uppercase tracking-[0.06em] text-[var(--text-faint)]">Remaining Impact</div>
          <div className="mt-1 font-semibold text-[var(--text)]">{bias.remainingImpactRatioPct !== null ? `${bias.remainingImpactRatioPct.toFixed(1)}%` : "—"}</div>
        </div>
        <div>
          <div className="text-[0.6rem] uppercase tracking-[0.06em] text-[var(--text-faint)]">Bias Flip</div>
          <div className="mt-1 font-semibold text-[var(--text)]">
            {bias.biasFlipLow !== null && bias.biasFlipHigh !== null
              ? bias.biasFlipLow === bias.biasFlipHigh
                ? fmtNum(bias.biasFlipLow, 2)
                : `${fmtNum(bias.biasFlipLow, 2)}–${fmtNum(bias.biasFlipHigh, 2)}`
              : "—"}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 border-t border-[var(--border)] pt-4 font-mono text-[0.72rem] sm:grid-cols-3">
        <div>
          <div className="text-[0.6rem] uppercase tracking-[0.06em] text-[var(--text-faint)]">Peak Window</div>
          <div className="mt-1 font-semibold text-[var(--text)]">
            {bias.peakWindow ? `${fmtMinutes(bias.peakWindow.startMinutesFromNow)}–${fmtMinutes(bias.peakWindow.endMinutesFromNow)} from now (${bias.peakWindow.direction})` : "—"}
          </div>
        </div>
        <div>
          <div className="text-[0.6rem] uppercase tracking-[0.06em] text-[var(--text-faint)]">Cross-Expiry</div>
          <div className="mt-1 font-semibold text-[var(--text)]">{CROSS_EXPIRY_LABEL[bias.crossExpiry.classification]}</div>
        </div>
        <div>
          <div className="text-[0.6rem] uppercase tracking-[0.06em] text-[var(--text-faint)]">Weakens After</div>
          <div className="mt-1 font-semibold text-[var(--text)]">{bias.weakensAfterMinutes !== null ? `${fmtMinutes(bias.weakensAfterMinutes)} from now` : "Holds through close"}</div>
        </div>
      </div>

      <div className="border-t border-[var(--border)] pt-3 font-mono text-[0.6rem] leading-relaxed text-[var(--text-faint)]">
        {bias.diagnostics.disclosure}
        <div className="mt-1">Last calculated: {new Date(bias.diagnostics.lastCalculatedAt).toLocaleTimeString()}</div>
      </div>
    </div>
  );
}
