"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, Line, Text, Billboard } from "@react-three/drei";
import * as THREE from "three";
import { zScoreSurface } from "@/lib/stats";
import type { HistoryPoint } from "@/lib/macroData";

const WINDOWS = [10, 15, 20, 30, 45, 60, 90, 120];
const WIDTH = 6.4;
const DEPTH = 4.2;
const HEIGHT = 2.0;

function zToColor(z: number): THREE.Color {
  const clamped = Math.max(-3, Math.min(3, z));
  const t = (clamped + 3) / 6; // 0..1
  // diverging: down (blue-red) -> neutral amber -> up (green), via HSL sweep
  const down = new THREE.Color("#f87171");
  const mid = new THREE.Color("#e8a33d");
  const up = new THREE.Color("#4ade80");
  if (t < 0.5) return down.clone().lerp(mid, t / 0.5);
  return mid.clone().lerp(up, (t - 0.5) / 0.5);
}

function Surface({
  grid,
  cols,
  rows,
}: {
  grid: (number | null)[][];
  cols: number;
  rows: number;
}) {
  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(WIDTH, DEPTH, cols - 1, rows - 1);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c;
        const raw = grid[r][c];
        const z = raw ?? 0;
        const height = (z / 3) * HEIGHT;
        pos.setZ(idx, height);
        const color = zToColor(z);
        colors[idx * 3] = color.r;
        colors[idx * 3 + 1] = color.g;
        colors[idx * 3 + 2] = color.b;
      }
    }
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    return geo;
  }, [grid, cols, rows]);

  return (
    <mesh geometry={geometry} rotation={[-Math.PI / 2.35, 0, 0]}>
      <meshStandardMaterial vertexColors side={THREE.DoubleSide} roughness={0.55} metalness={0.1} />
    </mesh>
  );
}

function Wireframe({ grid, cols, rows }: { grid: (number | null)[][]; cols: number; rows: number }) {
  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(WIDTH, DEPTH, cols - 1, rows - 1);
    const pos = geo.attributes.position;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c;
        const z = grid[r][c] ?? 0;
        pos.setZ(idx, (z / 3) * HEIGHT);
      }
    }
    return geo;
  }, [grid, cols, rows]);

  return (
    <mesh geometry={geometry} rotation={[-Math.PI / 2.35, 0, 0]}>
      <meshBasicMaterial color="#0b0e13" wireframe transparent opacity={0.15} />
    </mesh>
  );
}

function BaseGrid() {
  const lines = [];
  const step = WIDTH / 8;
  for (let i = 0; i <= 8; i++) {
    const x = -WIDTH / 2 + i * step;
    lines.push([
      [x, -DEPTH / 2, -HEIGHT * 0.62],
      [x, DEPTH / 2, -HEIGHT * 0.62],
    ]);
  }
  const stepZ = DEPTH / 6;
  for (let i = 0; i <= 6; i++) {
    const y = -DEPTH / 2 + i * stepZ;
    lines.push([
      [-WIDTH / 2, y, -HEIGHT * 0.62],
      [WIDTH / 2, y, -HEIGHT * 0.62],
    ]);
  }
  return (
    <group rotation={[-Math.PI / 2.35, 0, 0]}>
      {lines.map((pts, i) => (
        <Line key={i} points={pts as [number, number, number][]} color="#232a35" lineWidth={1} transparent opacity={0.5} />
      ))}
    </group>
  );
}

function fmtAxisDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

function Axes({
  windows,
  dates,
}: {
  windows: number[];
  dates: string[];
}) {
  const base = -HEIGHT * 0.62;
  const xTickIdx = Array.from({ length: 5 }, (_, i) => Math.round((i / 4) * (dates.length - 1)));
  const yTickWindows = windows.length > 6 ? windows.filter((_, i) => i % 2 === 0) : windows;

  const tick = (text: string, pos: [number, number, number], color = "#8993a3") => (
    <Billboard position={pos}>
      <Text fontSize={0.16} color={color} anchorX="center" anchorY="middle">
        {text}
      </Text>
    </Billboard>
  );

  return (
    <group rotation={[-Math.PI / 2.35, 0, 0]}>
      {/* X axis — time */}
      <Line points={[[-WIDTH / 2, -DEPTH / 2, base], [WIDTH / 2, -DEPTH / 2, base]]} color="#e8a33d" lineWidth={1.5} />
      {xTickIdx.map((idx) => {
        const x = -WIDTH / 2 + (idx / (dates.length - 1)) * WIDTH;
        return <group key={idx}>{tick(fmtAxisDate(dates[idx]), [x, -DEPTH / 2 - 0.32, base])}</group>;
      })}
      {tick("TIME →", [0, -DEPTH / 2 - 0.65, base], "#e8a33d")}

      {/* Y axis (depth) — window length */}
      <Line points={[[-WIDTH / 2, -DEPTH / 2, base], [-WIDTH / 2, DEPTH / 2, base]]} color="#4ade80" lineWidth={1.5} />
      {yTickWindows.map((w) => {
        const i = windows.indexOf(w);
        const y = -DEPTH / 2 + (i / (windows.length - 1 || 1)) * DEPTH;
        return <group key={w}>{tick(`w${w}`, [-WIDTH / 2 - 0.4, y, base])}</group>;
      })}
      {tick("← WINDOW (periods)", [-WIDTH / 2 - 0.4, 0, base - 0.55], "#4ade80")}

      {/* Z axis (height) — z-score */}
      <Line points={[[-WIDTH / 2, -DEPTH / 2, -HEIGHT], [-WIDTH / 2, -DEPTH / 2, HEIGHT]]} color="#f87171" lineWidth={1.5} />
      {[-3, 0, 3].map((s) => (
        <group key={s}>{tick(`${s > 0 ? "+" : ""}${s}σ`, [-WIDTH / 2 - 0.35, -DEPTH / 2 - 0.05, (s / 3) * HEIGHT])}</group>
      ))}
      {tick("↑ Z-SCORE (σ)", [-WIDTH / 2 - 0.35, -DEPTH / 2 - 0.4, HEIGHT * 0.55], "#f87171")}
    </group>
  );
}

function CameraRig() {
  const { camera } = useThree();
  useMemo(() => {
    camera.position.set(6.6, 5.0, 6.6);
  }, [camera]);
  return null;
}

export default function ZScoreSurface3D({ history, seriesName }: { history: HistoryPoint[]; seriesName: string }) {
  const [ready, setReady] = useState(false);
  const [inView, setInView] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const usableWindows = WINDOWS.filter((w) => w < history.length / 2);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { rootMargin: "300px 0px", threshold: 0.01 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const surface = useMemo(() => {
    if (usableWindows.length === 0) return null;
    const full = zScoreSurface(history, usableWindows);
    const cols = 48;
    const step = Math.max(1, Math.floor(full.dates.length / cols));
    const sampledDates: string[] = [];
    const sampledGrid: (number | null)[][] = full.grid.map(() => []);
    for (let i = 0; i < full.dates.length; i += step) {
      sampledDates.push(full.dates[i]);
      full.grid.forEach((row, r) => sampledGrid[r].push(row[i]));
    }
    return { windows: usableWindows, dates: sampledDates, grid: sampledGrid };
  }, [history, usableWindows]);

  if (!surface || surface.dates.length < 5) return null;

  const rows = surface.windows.length;
  const cols = surface.dates.length;

  return (
    <div ref={containerRef}>
      <div className="mb-1.5 flex items-baseline justify-between">
        <div className="font-sans text-[0.7rem] font-semibold uppercase tracking-wide text-[var(--text-dim)]">
          Z-score surface — window × time (drag to rotate)
        </div>
        <div className="flex gap-2.5 font-mono text-[0.68rem] text-[var(--text-faint)]">
          <span><span className="text-[var(--down)]">■</span> −3σ</span>
          <span><span className="text-[var(--accent)]">■</span> 0σ</span>
          <span><span className="text-[var(--up)]">■</span> +3σ</span>
        </div>
      </div>
      <div className="h-[420px] w-full overflow-hidden rounded-md border border-[var(--border)] bg-[color-mix(in_srgb,var(--panel-2)_60%,black)]">
        {inView ? (
          <Canvas
            dpr={[1, 1.6]}
            camera={{ fov: 42, near: 0.1, far: 100 }}
            onCreated={() => setReady(true)}
            style={{ opacity: ready ? 1 : 0, transition: "opacity 300ms" }}
          >
            <CameraRig />
            <ambientLight intensity={0.65} />
            <directionalLight position={[4, 6, 4]} intensity={1.1} />
            <directionalLight position={[-4, 3, -4]} intensity={0.35} />
            <BaseGrid />
            <Axes windows={surface.windows} dates={surface.dates} />
            <Wireframe grid={surface.grid} cols={cols} rows={rows} />
            <Surface grid={surface.grid} cols={cols} rows={rows} />
            <OrbitControls
              enablePan={false}
              minDistance={4}
              maxDistance={12}
              autoRotate
              autoRotateSpeed={0.6}
              target={[0, 0, 0]}
            />
          </Canvas>
        ) : (
          <div className="flex h-full items-center justify-center font-sans text-[0.7rem] text-[var(--text-faint)]">
            Scroll into view to render surface…
          </div>
        )}
      </div>
      <div className="mt-1 flex justify-between font-mono text-[0.56rem] text-[var(--text-faint)]">
        <span>{new Date(surface.dates[0]).toLocaleDateString("en-US", { month: "short", year: "2-digit" })}</span>
        <span>{seriesName} · windows {surface.windows[0]}–{surface.windows[surface.windows.length - 1]}</span>
        <span>{new Date(surface.dates[surface.dates.length - 1]).toLocaleDateString("en-US", { month: "short", year: "2-digit" })}</span>
      </div>
    </div>
  );
}
