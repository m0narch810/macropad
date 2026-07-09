"use client";

import { useEffect, useRef } from "react";

/*
 * ASCII topographic contour field — the signature decor. A slowly drifting
 * elevation field is sliced into contour bands; characters are drawn only
 * where a band boundary passes, so the output reads as a topo map drawn in
 * type. Each contour level gets its own glyph. Monochrome ink at subliminal
 * opacity; ~12fps (ASCII reads better slow, and it keeps CPU negligible);
 * paused offscreen; a single static frame under prefers-reduced-motion.
 */

const LEVEL_GLYPHS = ["·", ":", "-", "=", "+", "*", "─", "#", "%"];

/** Cheap smooth pseudo-noise: layered rotated sines, range ~0..1. */
function elevation(x: number, y: number, t: number): number {
  const n =
    Math.sin(x * 0.045 + t * 0.21) * 0.9 +
    Math.sin(y * 0.062 - t * 0.13) * 0.7 +
    Math.sin((x * 0.7 + y) * 0.038 + t * 0.09) * 0.8 +
    Math.sin((x - y * 0.6) * 0.031 - t * 0.06) * 0.6 +
    Math.sin(Math.hypot(x * 0.9, y * 1.1) * 0.05 + t * 0.11) * 0.5;
  return (n + 3.5) / 7;
}

export default function AsciiContour({
  className,
  opacity = 1,
  cell = 14,
  levels = 9,
  lineWidth = 0.09,
  maxAlpha = 0.34,
}: {
  className?: string;
  opacity?: number;
  cell?: number;
  levels?: number;
  /** Half-width of a contour line in band-fraction units (0..0.5). */
  lineWidth?: number;
  maxAlpha?: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(1.5, window.devicePixelRatio || 1);
    const resize = () => {
      canvas.width = Math.round(canvas.offsetWidth * dpr);
      canvas.height = Math.round(canvas.offsetHeight * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const draw = (t: number) => {
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      ctx.clearRect(0, 0, w, h);
      ctx.font = `${Math.round(cell * 0.78)}px ${getComputedStyle(canvas).fontFamily || "monospace"}`;
      ctx.textBaseline = "middle";
      const cols = Math.ceil(w / cell);
      const rows = Math.ceil(h / cell);
      for (let gy = 0; gy <= rows; gy++) {
        for (let gx = 0; gx <= cols; gx++) {
          const e = elevation(gx, gy, t);
          const band = e * levels;
          const f = band - Math.floor(band);
          const distToLine = Math.min(f, 1 - f);
          // Normalize by the local gradient (canvas fwidth): keeps contour
          // lines ~1 cell wide even where the terrain is nearly flat, so
          // flat regions render as crisp lines instead of wide blobs.
          const gxe = elevation(gx + 1, gy, t) - e;
          const gye = elevation(gx, gy + 1, t) - e;
          const grad = Math.hypot(gxe, gye) * levels;
          const cells = distToLine / Math.max(grad, 0.02);
          if (cells > lineWidth * 10) continue;
          const level = Math.max(0, Math.min(LEVEL_GLYPHS.length - 1, Math.floor(band) % LEVEL_GLYPHS.length));
          const edge = 1 - cells / (lineWidth * 10); // 1 at line center, 0 at edge
          const a = (0.3 + 0.7 * e) * edge * maxAlpha;
          if (a < 0.015) continue;
          ctx.fillStyle = `rgba(244, 244, 245, ${a.toFixed(3)})`;
          ctx.fillText(LEVEL_GLYPHS[level], gx * cell, gy * cell);
        }
      }
    };

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      draw(2.4);
      return () => window.removeEventListener("resize", resize);
    }

    let raf = 0;
    let last = 0;
    let running = false;
    const FRAME_MS = 83; // ~12fps

    const step = (ms: number) => {
      raf = requestAnimationFrame(step);
      if (ms - last < FRAME_MS) return;
      last = ms;
      draw(ms / 1000);
    };
    const start = () => {
      if (running) return;
      running = true;
      raf = requestAnimationFrame(step);
    };
    const stop = () => {
      running = false;
      cancelAnimationFrame(raf);
    };

    const io = new IntersectionObserver(([entry]) => (entry.isIntersecting ? start() : stop()), { threshold: 0 });
    io.observe(canvas);

    return () => {
      stop();
      io.disconnect();
      window.removeEventListener("resize", resize);
    };
  }, [cell, levels, lineWidth, maxAlpha]);

  return <canvas ref={ref} className={`font-mono ${className ?? ""}`} style={{ opacity }} aria-hidden="true" />;
}
