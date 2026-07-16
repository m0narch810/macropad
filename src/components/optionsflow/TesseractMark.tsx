"use client";

/**
 * The tesseract as an identity mark, not a data panel: a real 4D hypercube
 * (16 vertices, 32 edges) under a continuous SO(4) double rotation,
 * perspective-projected 4D -> 3D -> 2D and drawn as crisp 1px hairline
 * wireframe - the same voice as the app's borders and HUD brackets. Edge
 * opacity carries depth; the eight W-spanning edges (inner cube <-> outer
 * cube) take the accent ink. Because every frame is computed there is no
 * keyframe loop and nothing ever visibly resets. Respects
 * prefers-reduced-motion (static frame) and idles while hidden.
 */

import { useEffect, useRef } from "react";

// Gentle perspective (cameras pulled back): the projected figure swells far
// less at extreme W/Z, so a fixed canvas never clips a tumbling corner off.
const D4 = 3.6; // 4D -> 3D camera distance
const D3 = 4.2; // 3D -> 2D camera distance

const VERTS: [number, number, number, number][] = Array.from({ length: 16 }, (_, i) => [i & 1 ? 1 : -1, i & 2 ? 1 : -1, i & 4 ? 1 : -1, i & 8 ? 1 : -1]);
const EDGES: [number, number][] = [];
for (let a = 0; a < 16; a++) {
  for (let b = a + 1; b < 16; b++) {
    const diff = a ^ b;
    if ((diff & (diff - 1)) === 0) EDGES.push([a, b]);
  }
}
const isWEdge = (a: number, b: number) => (a ^ b) === 8; // binds inner cube to outer

export function TesseractMark({ size = 150 }: { size?: number }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

    const s = getComputedStyle(document.documentElement);
    const readVar = (n: string, fb: string) => s.getPropertyValue(n).trim() || fb;
    const inkColor = readVar("--text", "#f4f4f5");
    const accentColor = readVar("--accent", inkColor);

    let raf = 0;
    let t = 0.7; // start mid-tumble - t=0 is a degenerate face-on projection

    const draw = () => {
      const dpr = devicePixelRatio || 1;
      const W = canvas.offsetWidth;
      const H = canvas.offsetHeight;
      if (!W || !H) return;
      if (canvas.width !== W * dpr || canvas.height !== H * dpr) {
        canvas.width = W * dpr;
        canvas.height = H * dpr;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);

      // Double rotation at incommensurate rates - the tumble never repeats.
      const a1 = t * 0.9; // XW
      const a2 = t * 0.61; // YZ
      const a3 = t * 0.37; // ZW
      const c1 = Math.cos(a1), s1 = Math.sin(a1);
      const c2 = Math.cos(a2), s2 = Math.sin(a2);
      const c3 = Math.cos(a3), s3 = Math.sin(a3);

      const scale = Math.min(W, H) * 0.21;
      const cx = W / 2;
      const cy = H / 2;

      const proj = VERTS.map(([x0, y0, z0, w0]) => {
        let x = x0 * c1 - w0 * s1;
        let w = x0 * s1 + w0 * c1;
        let y = y0 * c2 - z0 * s2;
        let z = y0 * s2 + z0 * c2;
        const z2 = z * c3 - w * s3;
        w = z * s3 + w * c3;
        z = z2;
        const k4 = D4 / (D4 - w * 0.55);
        x *= k4;
        y *= k4;
        z *= k4;
        const k3 = D3 / (D3 - z * 0.45);
        return { x: cx + x * k3 * scale, y: cy + y * k3 * scale, z };
      });

      ctx.lineWidth = 1;
      ctx.lineCap = "round";
      for (const [a, b] of EDGES) {
        const A = proj[a];
        const B = proj[b];
        const depth = (A.z + B.z) / 2; // ~[-1.4, 1.4], camera side positive
        const alpha = Math.max(0.22, Math.min(0.95, 0.58 + depth * 0.3));
        ctx.strokeStyle = isWEdge(a, b) ? accentColor : inkColor;
        ctx.globalAlpha = isWEdge(a, b) ? alpha : alpha * 0.8;
        ctx.beginPath();
        ctx.moveTo(A.x, A.y);
        ctx.lineTo(B.x, B.y);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      for (const p of proj) {
        ctx.fillStyle = inkColor;
        ctx.globalAlpha = Math.max(0.35, Math.min(1, 0.65 + p.z * 0.3));
        ctx.fillRect(p.x - 1, p.y - 1, 2.5, 2.5);
      }
      ctx.globalAlpha = 1;
    };

    if (reduced) {
      draw();
      return;
    }

    const frame = () => {
      raf = requestAnimationFrame(frame);
      if (document.hidden || !canvas.offsetParent) return;
      t += 0.007;
      draw();
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  return <canvas ref={canvasRef} style={{ width: size, height: size }} aria-hidden="true" />;
}
