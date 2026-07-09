"use client";

import { useEffect, useRef } from "react";

/*
 * The Macropad mark: contour rings of a single peak, drifting like weather
 * on a topo map. Same terrain language as AsciiContour, reduced to an
 * emblem. Canvas is tiny (<= 32px), redraws at ~15fps, freezes under
 * prefers-reduced-motion, and pauses offscreen via rAF backgrounding.
 */

const RINGS = 4;

function ringRadius(base: number, theta: number, ring: number, t: number): number {
  return (
    base *
    (1 +
      0.16 * Math.sin(theta * 2 + ring * 1.7 + t * 0.7) +
      0.1 * Math.sin(theta * 3 - ring * 0.9 - t * 0.45) +
      0.06 * Math.sin(theta * 5 + t * 0.3))
  );
}

export default function BrandMark({ size = 20, className }: { size?: number; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const c = size / 2;
    const draw = (t: number) => {
      ctx.clearRect(0, 0, size, size);
      // Clip to the badge circle so drifting rings stay contained.
      ctx.save();
      ctx.beginPath();
      ctx.arc(c, c, c - 0.5, 0, Math.PI * 2);
      ctx.clip();

      for (let ring = 0; ring < RINGS; ring++) {
        const base = (c - 1.5) * ((ring + 1.15) / (RINGS + 0.4));
        ctx.beginPath();
        const STEPS = 40;
        for (let s = 0; s <= STEPS; s++) {
          const theta = (s / STEPS) * Math.PI * 2;
          const r = ringRadius(base, theta, ring, t);
          // Peak sits slightly off-center, like a real summit.
          const x = c + size * 0.06 + Math.cos(theta) * r;
          const y = c - size * 0.04 + Math.sin(theta) * r;
          if (s === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.strokeStyle = `rgba(244, 244, 245, ${(0.85 - ring * 0.17).toFixed(2)})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Summit.
      ctx.beginPath();
      ctx.arc(c + size * 0.06, c - size * 0.04, Math.max(1, size * 0.05), 0, Math.PI * 2);
      ctx.fillStyle = "rgba(244, 244, 245, 0.95)";
      ctx.fill();
      ctx.restore();
    };

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      draw(1.3);
      return;
    }

    let raf = 0;
    let last = 0;
    const step = (ms: number) => {
      raf = requestAnimationFrame(step);
      if (ms - last < 66) return; // ~15fps
      last = ms;
      draw(ms / 1000);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [size]);

  return (
    <canvas ref={ref} className={className} style={{ width: size, height: size }} aria-hidden="true" />
  );
}
