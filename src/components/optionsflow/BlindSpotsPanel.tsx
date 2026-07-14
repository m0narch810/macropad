"use client";

import { fmtNum } from "@/lib/gex";
import type { BlindSpot } from "@/lib/blindSpotsEngine";

// Deliberately opaque, per design: no source assets, no Greek names, no
// numeric score. Strength and active/projected state are communicated only
// through line weight, opacity, and solid-vs-dashed - never a printed
// number - and the only text on hover is the strength word itself.

const STRENGTH_WEIGHT: Record<BlindSpot["strength"], number> = { high: 3, standard: 2, low: 1 };
const STRENGTH_OPACITY: Record<BlindSpot["strength"], number> = { high: 1, standard: 0.75, low: 0.45 };
const STRENGTH_LABEL: Record<BlindSpot["strength"], string> = { high: "High", standard: "Standard", low: "Low" };

function Level({ level }: { level: BlindSpot }) {
  const color = level.direction === "lower" ? "var(--up)" : "var(--down)";
  const weight = STRENGTH_WEIGHT[level.strength];
  return (
    <div className="flex w-full items-center gap-3 py-3" title={`Blind Spot\nStrength: ${STRENGTH_LABEL[level.strength]}`}>
      <div
        className="flex-1"
        style={
          level.active
            ? { height: weight, background: color, opacity: STRENGTH_OPACITY[level.strength], borderRadius: 1 }
            : { borderTop: `${weight}px dashed ${color}`, opacity: STRENGTH_OPACITY[level.strength] }
        }
      />
      <span className="w-16 shrink-0 text-right font-mono text-[0.78rem] font-semibold" style={{ color, opacity: STRENGTH_OPACITY[level.strength] }}>
        {fmtNum(level.price, 2)}
      </span>
    </div>
  );
}

export function BlindSpotsLadder({ levels, spot }: { levels: BlindSpot[]; spot: number }) {
  const upper = [...levels.filter((l) => l.direction === "upper")].sort((a, b) => b.price - a.price);
  const lower = [...levels.filter((l) => l.direction === "lower")].sort((a, b) => b.price - a.price);

  if (!upper.length && !lower.length) {
    return <p className="m-0 py-12 text-center font-mono text-[0.75rem] text-[var(--text-faint)]">No blind spot cleared this request.</p>;
  }

  return (
    <div className="flex flex-col items-center gap-1 py-6">
      {upper.map((l, i) => (
        <Level key={`u${i}`} level={l} />
      ))}
      <div className="flex w-full items-center gap-3 py-2">
        <div className="h-px flex-1" style={{ background: "var(--border)" }} />
        <span className="font-mono text-[0.68rem] text-[var(--text-faint)]">{fmtNum(spot, 2)}</span>
        <div className="h-px flex-1" style={{ background: "var(--border)" }} />
      </div>
      {lower.map((l, i) => (
        <Level key={`l${i}`} level={l} />
      ))}
    </div>
  );
}
