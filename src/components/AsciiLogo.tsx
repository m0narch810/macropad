"use client";

import { useEffect, useState } from "react";

const LEVELS = ["▁", "▂", "▃", "▄", "▅", "▆", "▇"];
/** SSR frame — animation only starts client-side so hydration always matches. */
const START = "▁▂▂▃▄▃▂▃▄▅▄▃▂▁▂▃▄▅▆▅▄▃▂▂";

/**
 * Wordmark over a live ASCII tape: a character sparkline that random-walks
 * left like a feed, with a blinking block cursor. Static under
 * prefers-reduced-motion.
 */
export default function AsciiLogo({ tapeLength = 16, className }: { tapeLength?: number; className?: string }) {
  const [tape, setTape] = useState(START.slice(0, tapeLength));

  useEffect(() => {
    setTape(START.slice(0, tapeLength));
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let level = 3;
    const id = setInterval(() => {
      const step = Math.random() < 0.5 ? -1 : 1;
      level = Math.min(LEVELS.length - 1, Math.max(0, level + step));
      setTape((t) => (t + LEVELS[level]).slice(-tapeLength));
    }, 170);
    return () => clearInterval(id);
  }, [tapeLength]);

  return (
    <div className={className}>
      <div className="font-display text-[1.3rem] leading-none">
        <span className="text-[var(--accent)]">Macro</span>pad
      </div>
      <div
        className="mt-1.5 select-none whitespace-nowrap font-mono text-[0.62rem] leading-none text-[var(--accent)]"
        aria-hidden="true"
      >
        {tape}
        <span className="blink-cursor">▊</span>
      </div>
    </div>
  );
}
