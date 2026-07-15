"use client";

import { fmtNum, fmtUsd } from "@/lib/gex";
import type { EffectiveGexResult } from "@/lib/effectiveGexEngine";

const STRIKE_WINDOW = 30; // ~+-15 strikes around spot

function cell(value: number, maxAbs: number) {
  const t = maxAbs > 0 ? Math.max(-1, Math.min(1, value / maxAbs)) : 0;
  const pct = Math.round(Math.pow(Math.abs(t), 0.6) * 80);
  const base = value >= 0 ? "var(--up)" : "var(--down)";
  return `color-mix(in srgb, ${base} ${pct}%, var(--panel-2) ${100 - pct}%)`;
}

/**
 * Effective GEX: static (current-gamma) GEX vs a full delta-reprice at
 * spot+/-1%, so a strike whose static gamma looks small but whose delta
 * would swing hard on approach (a hedge cliff) doesn't hide behind a
 * deceptively small static number.
 */
export function EffectiveGexPanel({ result, spot }: { result: EffectiveGexResult | null | undefined; spot: number }) {
  if (!result || !result.rows.length) {
    return <p className="m-0 py-16 text-center font-mono text-[0.72rem] text-[var(--text-faint)]">Unavailable this request.</p>;
  }
  const rows = [...result.rows]
    .sort((a, b) => Math.abs(a.strike - spot) - Math.abs(b.strike - spot))
    .slice(0, STRIKE_WINDOW)
    .sort((a, b) => b.strike - a.strike);
  const maxAbs = Math.max(1, ...rows.flatMap((r) => [Math.abs(r.staticGex), Math.abs(r.upEffective), Math.abs(r.downEffective)]));
  const maxAccel = Math.max(1, ...rows.map((r) => r.acceleration));

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-[54px_1fr_1fr_1fr_64px] gap-px font-mono text-[0.58rem] uppercase tracking-[0.05em] text-[var(--text-faint)]">
        <div>Strike</div>
        <div className="text-right">Static ({fmtNum(result.moveUpPct * 100, 0)}% move)</div>
        <div className="text-right">Up +{fmtNum(result.moveUpPct * 100, 0)}%</div>
        <div className="text-right">Down -{fmtNum(result.moveDownPct * 100, 0)}%</div>
        <div className="text-right">Accel</div>
      </div>
      <div className="flex flex-col gap-px">
        {rows.map((r) => {
          const isSpotRow = Math.abs(r.strike - spot) < Math.abs((rows[1]?.strike ?? r.strike) - (rows[0]?.strike ?? r.strike) || 1) / 2;
          return (
            <div key={r.strike} className="grid grid-cols-[54px_1fr_1fr_1fr_64px] items-center gap-px">
              <div className="font-mono text-[0.66rem]" style={{ fontWeight: isSpotRow ? 700 : 400, color: isSpotRow ? "var(--text)" : "var(--text-faint)" }}>
                {fmtNum(r.strike, 0)}
              </div>
              <div className="flex h-6 items-center justify-end px-2 font-mono text-[0.62rem] font-semibold" style={{ background: cell(r.staticGex, maxAbs), color: "rgba(255,255,255,0.92)" }}>
                {fmtUsd(r.staticGex)}
              </div>
              <div className="flex h-6 items-center justify-end px-2 font-mono text-[0.62rem] font-semibold" style={{ background: cell(r.upEffective, maxAbs), color: "rgba(255,255,255,0.92)" }}>
                {fmtUsd(r.upEffective)}
              </div>
              <div className="flex h-6 items-center justify-end px-2 font-mono text-[0.62rem] font-semibold" style={{ background: cell(r.downEffective, maxAbs), color: "rgba(255,255,255,0.92)" }}>
                {fmtUsd(r.downEffective)}
              </div>
              <div className="flex h-6 items-center justify-end pr-1 font-mono text-[0.62rem] font-semibold" style={{ color: r.acceleration / maxAccel > 0.6 ? "#d9a441" : "var(--text-faint)" }}>
                {fmtNum(r.acceleration, 1)}x
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex flex-col gap-1 border-t border-[var(--border)] pt-3">
        {result.disclosures.map((d, i) => (
          <p key={i} className="m-0 font-mono text-[0.6rem] leading-relaxed text-[var(--text-faint)]">
            {d}
          </p>
        ))}
      </div>
    </div>
  );
}

/**
 * Shadow Gamma: the slice of the effective delta change caused specifically
 * by the vol surface moving with spot (vanna) - the part a frozen-IV
 * reprice would miss entirely, isolated on its own so it doesn't get lost
 * inside the combined effective-GEX figure.
 */
export function ShadowGammaPanel({ result, spot }: { result: EffectiveGexResult | null | undefined; spot: number }) {
  if (!result || !result.rows.length) {
    return <p className="m-0 py-16 text-center font-mono text-[0.72rem] text-[var(--text-faint)]">Unavailable this request.</p>;
  }
  const rows = [...result.rows]
    .sort((a, b) => Math.abs(a.strike - spot) - Math.abs(b.strike - spot))
    .slice(0, STRIKE_WINDOW)
    .sort((a, b) => b.strike - a.strike);
  const maxAbs = Math.max(1, ...rows.flatMap((r) => [Math.abs(r.shadowGammaUp), Math.abs(r.shadowGammaDown)]));

  return (
    <div className="flex flex-col gap-3">
      <p className="m-0 font-mono text-[0.66rem] leading-relaxed text-[var(--text-dim)]">
        Effective GEX minus a frozen-IV reprice at the same scenario spot - the hedge dollars attributable to the vol surface itself shifting with spot, not to gamma alone.
      </p>
      <div className="grid grid-cols-[54px_1fr_1fr] gap-px font-mono text-[0.58rem] uppercase tracking-[0.05em] text-[var(--text-faint)]">
        <div>Strike</div>
        <div className="text-right">Shadow Up +{fmtNum(result.moveUpPct * 100, 0)}%</div>
        <div className="text-right">Shadow Down -{fmtNum(result.moveDownPct * 100, 0)}%</div>
      </div>
      <div className="flex flex-col gap-px">
        {rows.map((r) => {
          const isSpotRow = Math.abs(r.strike - spot) < Math.abs((rows[1]?.strike ?? r.strike) - (rows[0]?.strike ?? r.strike) || 1) / 2;
          return (
            <div key={r.strike} className="grid grid-cols-[54px_1fr_1fr] items-center gap-px">
              <div className="font-mono text-[0.66rem]" style={{ fontWeight: isSpotRow ? 700 : 400, color: isSpotRow ? "var(--text)" : "var(--text-faint)" }}>
                {fmtNum(r.strike, 0)}
              </div>
              <div className="flex h-6 items-center justify-end px-2 font-mono text-[0.62rem] font-semibold" style={{ background: cell(r.shadowGammaUp, maxAbs), color: "rgba(255,255,255,0.92)" }}>
                {fmtUsd(r.shadowGammaUp)}
              </div>
              <div className="flex h-6 items-center justify-end px-2 font-mono text-[0.62rem] font-semibold" style={{ background: cell(r.shadowGammaDown, maxAbs), color: "rgba(255,255,255,0.92)" }}>
                {fmtUsd(r.shadowGammaDown)}
              </div>
            </div>
          );
        })}
      </div>
      <p className="m-0 border-t border-[var(--border)] pt-3 font-mono text-[0.6rem] leading-relaxed text-[var(--text-faint)]">
        Small values at most strikes are expected - vanna's contribution is usually a minor correction next to pure gamma, growing more visible near the money and on skewed strikes.
      </p>
    </div>
  );
}
