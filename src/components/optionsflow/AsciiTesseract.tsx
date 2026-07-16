"use client";

/**
 * The Tesseract, done properly this time: a real 4-dimensional hypercube
 * (16 vertices, 32 edges) under a continuous double rotation in the XW/YZ/ZW
 * planes, perspective-projected 4D -> 3D -> 2D and rendered as depth-shaded
 * ASCII characters on a canvas - the donut.c school of graphics, native to a
 * terminal UI. Because the motion is a closed rotation in SO(4) there is no
 * loop point and nothing to "cut off": every frame is computed, not keyframed.
 * Edges that span the W axis (the ones binding the inner cube to the outer)
 * render in the accent ink. Respects prefers-reduced-motion (static frame)
 * and skips work while hidden.
 */

import { useEffect, useRef } from "react";

const RAMP = " .·:;+=oxX#@";
const CELL_W = 6;
const CELL_H = 10;
const D4 = 3.1; // 4D -> 3D camera distance (in units of the unit 4-cube)
const D3 = 3.4; // 3D -> 2D camera distance
const EDGE_SAMPLES = 26;

// 16 vertices of the unit 4-cube; 32 edges = vertex pairs differing in exactly one axis.
const VERTS: [number, number, number, number][] = Array.from({ length: 16 }, (_, i) => [i & 1 ? 1 : -1, i & 2 ? 1 : -1, i & 4 ? 1 : -1, i & 8 ? 1 : -1]);
const EDGES: [number, number][] = [];
for (let a = 0; a < 16; a++) {
  for (let b = a + 1; b < 16; b++) {
    const diff = a ^ b;
    if ((diff & (diff - 1)) === 0) EDGES.push([a, b]);
  }
}
const isWEdge = (a: number, b: number) => (a ^ b) === 8; // spans inner cube <-> outer cube

export function AsciiTesseract({ height = 170 }: { height?: number }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Resolve the design tokens once - canvas can't consume CSS var() directly.
    const s = getComputedStyle(document.documentElement);
    const readVar = (n: string, fb: string) => {
      const v = s.getPropertyValue(n).trim();
      return v || fb;
    };
    const inkColor = readVar("--text", "#f4f4f5");
    const accentColor = readVar("--accent", inkColor);
    const monoFam = readVar("--font-mono", "") || readVar("--font-data", "") || "ui-monospace, monospace";

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

      const cols = Math.max(8, Math.floor(W / CELL_W));
      const rows = Math.max(8, Math.floor(H / CELL_H));
      // Per-cell max intensity + whether the brightest contributor was a W-edge.
      const grid = new Float32Array(cols * rows);
      const tone = new Uint8Array(cols * rows);

      // Double rotation: three plane angles at incommensurate rates so the
      // tumble never visibly repeats.
      const a1 = t * 0.9; // XW
      const a2 = t * 0.61; // YZ
      const a3 = t * 0.37; // ZW
      const c1 = Math.cos(a1), s1 = Math.sin(a1);
      const c2 = Math.cos(a2), s2 = Math.sin(a2);
      const c3 = Math.cos(a3), s3 = Math.sin(a3);

      const scale = Math.min(W, H) * 0.32;
      const cx = W / 2;
      const cy = H / 2 + Math.sin(t * 0.8) * 2; // faint float, computed not keyframed

      // Project all 16 vertices once per frame.
      const proj: { x: number; y: number; z: number }[] = VERTS.map(([x0, y0, z0, w0]) => {
        // XW
        let x = x0 * c1 - w0 * s1;
        let w = x0 * s1 + w0 * c1;
        // YZ
        let y = y0 * c2 - z0 * s2;
        let z = y0 * s2 + z0 * c2;
        // ZW
        const z2 = z * c3 - w * s3;
        w = z * s3 + w * c3;
        z = z2;
        // 4D -> 3D perspective by w
        const k4 = D4 / (D4 - w * 0.9);
        x *= k4;
        y *= k4;
        z *= k4;
        // 3D -> 2D perspective by z
        const k3 = D3 / (D3 - z * 0.7);
        return { x: cx + x * k3 * scale, y: cy + y * k3 * scale, z };
      });

      // Rasterize edges into the character grid, keeping the brightest hit per cell.
      for (const [a, b] of EDGES) {
        const A = proj[a];
        const B = proj[b];
        const wEdge = isWEdge(a, b);
        for (let i = 0; i <= EDGE_SAMPLES; i++) {
          const f = i / EDGE_SAMPLES;
          const x = A.x + (B.x - A.x) * f;
          const y = A.y + (B.y - A.y) * f;
          const z = A.z + (B.z - A.z) * f;
          const col = Math.round(x / CELL_W);
          const row = Math.round(y / CELL_H);
          if (col < 0 || col >= cols || row < 0 || row >= rows) continue;
          // Depth shading: near (+z toward camera) bright, far dim - wide
          // contrast so the front face pops and the back face recedes.
          const intensity = Math.max(0.1, Math.min(1, 0.55 + z * 0.45));
          const idx = row * cols + col;
          if (intensity > grid[idx]) {
            grid[idx] = intensity;
            tone[idx] = wEdge ? 1 : 0;
          }
        }
      }
      // Vertices punch through at full brightness.
      for (const p of proj) {
        const col = Math.round(p.x / CELL_W);
        const row = Math.round(p.y / CELL_H);
        if (col < 0 || col >= cols || row < 0 || row >= rows) continue;
        const idx = row * cols + col;
        grid[idx] = Math.max(grid[idx], Math.min(1, 0.75 + p.z * 0.25));
      }

      ctx.font = `9px ${monoFam}`;
      ctx.textBaseline = "middle";
      ctx.textAlign = "center";
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const v = grid[row * cols + col];
          if (v <= 0) continue;
          const ch = RAMP[Math.min(RAMP.length - 1, Math.round(v * (RAMP.length - 1)))];
          if (ch === " ") continue;
          ctx.globalAlpha = 0.3 + 0.7 * v;
          ctx.fillStyle = tone[row * cols + col] ? accentColor : inkColor;
          ctx.fillText(ch, col * CELL_W + CELL_W / 2, row * CELL_H + CELL_H / 2);
        }
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
      t += 0.008;
      draw();
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  return <canvas ref={canvasRef} className="w-full" style={{ height }} aria-hidden="true" />;
}
