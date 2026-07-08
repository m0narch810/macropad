"use client";

import { useEffect, useRef } from "react";

/**
 * Ambient ASCII flow field — layered sines approximate perlin noise, mapped
 * onto a character density ramp in dim monochrome. Renders one static frame
 * under prefers-reduced-motion.
 */
const RAMP = [" ", " ", ".", "·", ":", "-", "=", "+", "*", "#", "%", "@"];

export default function PerlinField({ className, opacity = 0.5 }: { className?: string; opacity?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const CELL = 12;
    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const draw = (t: number) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.font = "11px monospace";
      const cols = Math.ceil(canvas.width / CELL);
      const rows = Math.ceil(canvas.height / CELL);
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const n =
            Math.sin(x * 0.11 + t * 0.65) +
            Math.sin(y * 0.23 - t * 0.4) +
            Math.sin((x + y) * 0.07 + t * 0.25) +
            Math.sin(Math.hypot(x - cols / 2, y - rows / 2) * 0.16 - t * 0.5);
          const v = (n + 4) / 8; // 0..1
          const ch = RAMP[Math.min(RAMP.length - 1, Math.max(0, Math.floor(v * RAMP.length)))];
          if (ch === " ") continue;
          ctx.fillStyle = `rgba(242, 242, 242, ${(0.05 + v * 0.3).toFixed(3)})`;
          ctx.fillText(ch, x * CELL, y * CELL + 10);
        }
      }
    };

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      draw(1.7);
      return () => window.removeEventListener("resize", resize);
    }

    let raf = 0;
    let last = 0;
    const step = (ms: number) => {
      raf = requestAnimationFrame(step);
      if (ms - last < 90) return;
      last = ms;
      draw(ms / 1000);
    };
    raf = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={ref} className={className} style={{ opacity }} aria-hidden="true" />;
}
