"use client";

/**
 * A floating, glowing, slowly-rotating wireframe tesseract (nested cube in
 * cube) - pure CSS 3D transforms, no canvas/WebGL. Each cube's 12 edges are
 * computed once from its 8 vertices (axis-aligned, so every edge is exactly
 * X/Y/Z-aligned - orienting a bar means one of three fixed rotations, not a
 * general Rodrigues rotation). The outer cube and inner cube rotate at
 * different rates in the same preserve-3d scene for the classic hypercube
 * "shape within a shape" look.
 */

interface Edge {
  transform: string;
  length: number;
}

function cubeEdges(half: number): Edge[] {
  const verts: [number, number, number][] = [
    [-half, -half, -half],
    [half, -half, -half],
    [half, half, -half],
    [-half, half, -half],
    [-half, -half, half],
    [half, -half, half],
    [half, half, half],
    [-half, half, half],
  ];
  const pairs: [number, number][] = [
    [0, 1], [1, 2], [2, 3], [3, 0],
    [4, 5], [5, 6], [6, 7], [7, 4],
    [0, 4], [1, 5], [2, 6], [3, 7],
  ];
  return pairs.map(([a, b]) => {
    const [ax, ay, az] = verts[a];
    const [bx, by, bz] = verts[b];
    const mx = (ax + bx) / 2;
    const my = (ay + by) / 2;
    const mz = (az + bz) / 2;
    const length = Math.hypot(bx - ax, by - ay, bz - az);
    let rot = "";
    if (Math.abs(ay - by) > 0.01) rot = "rotateZ(90deg)";
    else if (Math.abs(az - bz) > 0.01) rot = "rotateY(90deg)";
    return { transform: `translate3d(${mx}px, ${my}px, ${mz}px) ${rot}`, length };
  });
}

const OUTER_EDGES = cubeEdges(72);
const INNER_EDGES = cubeEdges(34);

function EdgeBar({ edge, glow }: { edge: Edge; glow: string }) {
  return (
    <div
      className="tsrct-edge"
      style={{
        width: edge.length,
        transform: edge.transform,
        background: glow,
        boxShadow: `0 0 6px ${glow}, 0 0 14px ${glow}`,
      }}
    />
  );
}

export function Tesseract({ height = 200 }: { height?: number }) {
  return (
    <div className="flex h-full w-full items-center justify-center" style={{ height, perspective: 900 }}>
      <style>{`
        @keyframes tsrct-float { 0%, 100% { transform: translateY(-6px); } 50% { transform: translateY(6px); } }
        @keyframes tsrct-spin-outer { from { transform: rotateX(0deg) rotateY(0deg); } to { transform: rotateX(360deg) rotateY(360deg); } }
        @keyframes tsrct-spin-inner { from { transform: rotateX(0deg) rotateY(360deg) rotateZ(0deg); } to { transform: rotateX(-360deg) rotateY(0deg) rotateZ(360deg); } }
        .tsrct-float { animation: tsrct-float 5s ease-in-out infinite; transform-style: preserve-3d; }
        .tsrct-outer { animation: tsrct-spin-outer 18s linear infinite; transform-style: preserve-3d; }
        .tsrct-inner { animation: tsrct-spin-inner 11s linear infinite; transform-style: preserve-3d; }
        .tsrct-edge { position: absolute; top: 50%; left: 50%; height: 1.5px; margin-top: -0.75px; transform-origin: center; border-radius: 2px; }
        @media (prefers-reduced-motion: reduce) {
          .tsrct-float, .tsrct-outer, .tsrct-inner { animation: none; }
        }
      `}</style>
      <div className="tsrct-float" style={{ filter: "drop-shadow(0 0 18px var(--up)) drop-shadow(0 0 34px color-mix(in srgb, var(--up) 40%, transparent))" }}>
        <div className="tsrct-outer" style={{ position: "relative", width: 1, height: 1 }}>
          {OUTER_EDGES.map((edge, i) => (
            <EdgeBar key={i} edge={edge} glow="var(--up)" />
          ))}
          <div className="tsrct-inner" style={{ position: "absolute", top: 0, left: 0, width: 1, height: 1 }}>
            {INNER_EDGES.map((edge, i) => (
              <EdgeBar key={i} edge={edge} glow="var(--text)" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
