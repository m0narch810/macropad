"use client";

/**
 * The Structure Rail - a live vertical price ladder built entirely from this
 * request's own data: spot (animated between updates) inside the ±1σ
 * expected-move band, the self-derived call/put walls, gamma flip, max pain
 * and king node as dashed levels, and every strike's |$GEX| mass as a
 * hairline bar growing leftward off the axis. Replaces the decorative cube:
 * every mark here is a real number a trader can act on, in the app's own
 * monochrome-hairline idiom (no glow, no shadows, no canvas).
 */

import type { StrikeRow0DTE } from "@/lib/gex";
import { fmtNum } from "@/lib/gex";

const AXIS_PCT = 58; // vertical axis position: bars live left of it, labels right

interface LadderLabel {
  label: string;
  price: number;
  color: string;
  py: number;
  isSpot?: boolean;
}

export function LevelLadder({
  spot,
  tickDir,
  perStrike,
  callWall,
  putWall,
  gammaFlip,
  maxPain,
  kingNode,
  expectedMove1s,
  height = 260,
}: {
  spot: number;
  tickDir: "up" | "down" | null;
  perStrike: StrikeRow0DTE[];
  callWall: number | null;
  putWall: number | null;
  gammaFlip: number | null;
  maxPain: number;
  kingNode: { strike: number; gex: number; type: "repellor" | "pin" } | null;
  expectedMove1s: number | null;
  height?: number;
}) {
  const levels = [
    callWall !== null ? { label: "CALL WALL", price: callWall, color: "var(--up)" } : null,
    putWall !== null ? { label: "PUT WALL", price: putWall, color: "var(--down)" } : null,
    gammaFlip !== null ? { label: "G-FLIP", price: gammaFlip, color: "var(--text-dim)" } : null,
    maxPain > 0 ? { label: "MAX PAIN", price: maxPain, color: "var(--text-dim)" } : null,
    kingNode ? { label: kingNode.type === "pin" ? "KING · PIN" : "KING · REPEL", price: kingNode.strike, color: "var(--text-faint)" } : null,
  ].filter((l): l is { label: string; price: number; color: string } => l !== null);

  const em = expectedMove1s !== null && expectedMove1s > 0 ? expectedMove1s : null;

  // Domain spans every marker plus the expected-move band, padded so nothing
  // sits on the very edge; degenerate spans (all levels equal) get a floor.
  const anchors = [spot, ...levels.map((l) => l.price), ...(em ? [spot + em, spot - em] : [])];
  const rawLo = Math.min(...anchors);
  const rawHi = Math.max(...anchors);
  const span = Math.max(rawHi - rawLo, spot * 0.004);
  const lo = rawLo - span * 0.12;
  const hi = rawHi + span * 0.12;
  const y = (p: number) => ((hi - p) / (hi - lo)) * 100;

  const rows = perStrike.filter((r) => r.strike >= lo && r.strike <= hi);
  const maxAbs = Math.max(1e-9, ...rows.map((r) => Math.abs(r.gex)));

  // Right-column labels: nudge to a minimum vertical gap so CALL WALL / MAX
  // PAIN / SPOT stay readable even when the prices themselves nearly overlap.
  // Lines and axis ticks stay at the true price; only the text shifts.
  const minGap = 16;
  const labelItems: LadderLabel[] = [
    ...levels.map((l) => ({ ...l, py: (y(l.price) / 100) * height })),
    { label: "SPOT", price: spot, color: "var(--text)", py: (y(spot) / 100) * height, isSpot: true },
  ].sort((a, b) => a.py - b.py);
  for (let i = 1; i < labelItems.length; i++) {
    if (labelItems[i].py - labelItems[i - 1].py < minGap) labelItems[i].py = labelItems[i - 1].py + minGap;
  }
  const overflow = labelItems.length ? labelItems[labelItems.length - 1].py - (height - 8) : 0;
  if (overflow > 0) for (const l of labelItems) l.py = Math.max(8, l.py - overflow);

  return (
    <div className="flex w-full flex-col gap-2">
      <div className="relative w-full select-none" style={{ height }}>
        {em && (
          <div
            className="absolute left-0"
            style={{
              top: `${y(spot + em)}%`,
              height: `${y(spot - em) - y(spot + em)}%`,
              width: `${AXIS_PCT}%`,
              background: "color-mix(in srgb, var(--text) 4%, transparent)",
              transition: "top 700ms var(--ease-out), height 700ms var(--ease-out)",
            }}
          />
        )}

        <div className="absolute bottom-0 top-0 w-px bg-[var(--border-strong)]" style={{ left: `${AXIS_PCT}%` }} />

        {rows.map((r) => (
          <div
            key={r.strike}
            className="absolute h-px"
            style={{
              top: `${y(r.strike)}%`,
              right: `${100 - AXIS_PCT}%`,
              width: `${(Math.abs(r.gex) / maxAbs) * (AXIS_PCT - 4)}%`,
              background: r.gex >= 0 ? "var(--up)" : "var(--down)",
              opacity: 0.55,
              transition: "width 600ms var(--ease-out)",
            }}
          />
        ))}

        {levels.map((l) => (
          <div key={l.label}>
            <div
              className="absolute border-t border-dashed"
              style={{ top: `${y(l.price)}%`, left: 0, width: `${AXIS_PCT}%`, borderColor: l.color, opacity: 0.65 }}
            />
            <div className="absolute h-px w-[5px]" style={{ top: `${y(l.price)}%`, left: `${AXIS_PCT}%`, background: l.color }} />
          </div>
        ))}

        <div
          className="absolute left-0 right-0 h-px"
          style={{ top: `${y(spot)}%`, background: "var(--text)", transition: "top 700ms var(--ease-out)" }}
        />

        {labelItems.map((l) => (
          <div
            key={l.label}
            className="absolute flex items-center gap-1.5 whitespace-nowrap font-mono"
            style={{ left: `calc(${AXIS_PCT}% + 10px)`, top: l.py, transform: "translateY(-50%)", transition: "top 700ms var(--ease-out)" }}
          >
            {l.isSpot ? (
              <>
                <span className="bg-[var(--text)] px-1.5 py-0.5 text-[0.62rem] font-bold leading-none text-[var(--bg)]">{fmtNum(l.price, 2)}</span>
                {tickDir && (
                  <span className="text-[0.6rem] leading-none" style={{ color: tickDir === "up" ? "var(--up)" : "var(--down)" }}>
                    {tickDir === "up" ? "▲" : "▼"}
                  </span>
                )}
              </>
            ) : (
              <>
                <span className="text-[0.55rem] font-medium tracking-[0.1em]" style={{ color: l.color }}>
                  {l.label}
                </span>
                <span className="text-[0.62rem] font-semibold text-[var(--text-dim)]">{fmtNum(l.price, 2)}</span>
              </>
            )}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 border-t border-[var(--border)] pt-2">
        <span className="font-mono text-[0.55rem] uppercase tracking-[0.12em] text-[var(--text-faint)]">◂ |$GEX| by strike</span>
        {em && <span className="font-mono text-[0.55rem] uppercase tracking-[0.12em] text-[var(--text-faint)]">band = ±1σ move</span>}
      </div>
    </div>
  );
}
