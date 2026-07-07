"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import type { NewsHeadlinePayload } from "@/lib/macroData";

const RADIUS = 2.6;

function toneColor(label: NewsHeadlinePayload["sentimentLabel"]): string {
  return label === "bullish" ? "#3ddc84" : label === "bearish" ? "#f45b69" : "#8993a3";
}

/** Deterministic, decorative placement on a sphere — NOT geolocation. Headlines have no real geographic origin here. */
function fibonacciSpherePoint(i: number, n: number): [number, number, number] {
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  const y = 1 - (i / Math.max(1, n - 1)) * 2;
  const radiusAtY = Math.sqrt(Math.max(0, 1 - y * y));
  const theta = goldenAngle * i;
  const x = Math.cos(theta) * radiusAtY;
  const z = Math.sin(theta) * radiusAtY;
  return [x * RADIUS, y * RADIUS, z * RADIUS];
}

function Dot({
  position,
  color,
  active,
  onHover,
}: {
  position: [number, number, number];
  color: string;
  active: boolean;
  onHover: (hovered: boolean) => void;
}) {
  return (
    <mesh
      position={position}
      onPointerOver={(e) => {
        e.stopPropagation();
        onHover(true);
      }}
      onPointerOut={() => onHover(false)}
    >
      <sphereGeometry args={[active ? 0.055 : 0.036, 12, 12]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={active ? 1.2 : 0.5} />
    </mesh>
  );
}

function Sphere() {
  return (
    <mesh>
      <sphereGeometry args={[RADIUS - 0.03, 32, 32]} />
      <meshStandardMaterial color="#0d1117" roughness={0.9} metalness={0.1} transparent opacity={0.85} />
    </mesh>
  );
}

function Wireframe() {
  const geo = useMemo(() => new THREE.SphereGeometry(RADIUS - 0.02, 20, 14), []);
  return (
    <lineSegments>
      <edgesGeometry args={[geo]} />
      <lineBasicMaterial color="#232a35" transparent opacity={0.4} />
    </lineSegments>
  );
}

export default function NewsGlobe({ headlines }: { headlines: NewsHeadlinePayload[] }) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [pinnedIdx, setPinnedIdx] = useState<number | null>(null);
  const [inView, setInView] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), {
      rootMargin: "300px 0px",
      threshold: 0.01,
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const points = useMemo(
    () => headlines.map((h, i) => ({ pos: fibonacciSpherePoint(i, headlines.length), headline: h })),
    [headlines]
  );

  const activeIdx = hoverIdx ?? pinnedIdx;
  const active = activeIdx !== null ? headlines[activeIdx] : null;

  const bullishCount = headlines.filter((h) => h.sentimentLabel === "bullish").length;
  const bearishCount = headlines.filter((h) => h.sentimentLabel === "bearish").length;
  const neutralCount = headlines.length - bullishCount - bearishCount;

  return (
    <div ref={containerRef}>
      <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-2">
        <div className="font-sans text-[0.7rem] font-semibold uppercase tracking-wide text-[var(--text-dim)]">
          {headlines.length} recent headlines (drag to rotate, hover a dot)
        </div>
        <div className="flex gap-3 font-mono text-[0.68rem] text-[var(--text-faint)]">
          <span style={{ color: "var(--up)" }}>● {bullishCount} bullish</span>
          <span style={{ color: "var(--text-faint)" }}>● {neutralCount} neutral</span>
          <span style={{ color: "var(--down)" }}>● {bearishCount} bearish</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_280px]">
        <div className="h-[360px] w-full overflow-hidden rounded-md border border-[var(--border)] bg-[color-mix(in_srgb,var(--panel-2)_60%,black)]">
          {inView ? (
            <Canvas camera={{ position: [0, 0, 6.5], fov: 42 }} dpr={[1, 1.6]}>
              <ambientLight intensity={0.7} />
              <directionalLight position={[4, 5, 4]} intensity={1} />
              <directionalLight position={[-4, -2, -3]} intensity={0.3} />
              <Sphere />
              <Wireframe />
              {points.map((p, i) => (
                <Dot
                  key={i}
                  position={p.pos}
                  color={toneColor(p.headline.sentimentLabel)}
                  active={activeIdx === i}
                  onHover={(hovered) => setHoverIdx(hovered ? i : null)}
                />
              ))}
              <OrbitControls enablePan={false} minDistance={4} maxDistance={10} autoRotate autoRotateSpeed={0.5} />
            </Canvas>
          ) : (
            <div className="flex h-full items-center justify-center font-sans text-[0.7rem] text-[var(--text-faint)]">
              Scroll into view to render globe…
            </div>
          )}
        </div>

        <div className="flex flex-col rounded-md border border-[var(--border)] bg-[var(--panel-2)] p-3.5">
          {active ? (
            <>
              <span
                className="mb-1.5 w-fit rounded-full border px-2 py-[2px] text-[0.6rem] font-bold uppercase tracking-wide"
                style={{
                  color: toneColor(active.sentimentLabel),
                  borderColor: `color-mix(in srgb, ${toneColor(active.sentimentLabel)} 40%, var(--border))`,
                  background: `color-mix(in srgb, ${toneColor(active.sentimentLabel)} 14%, transparent)`,
                }}
              >
                {active.sentimentLabel} · {active.sentimentScore > 0 ? "+" : ""}
                {active.sentimentScore.toFixed(2)}
              </span>
              <p className="m-0 font-sans text-[0.82rem] leading-snug text-[var(--text)]">{active.title}</p>
              <div className="mt-2 font-mono text-[0.66rem] text-[var(--text-faint)]">
                {active.source} · {new Date(active.pubDate).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
              </div>
              {active.link && (
                <a href={active.link} target="_blank" rel="noopener noreferrer" className="mt-2 font-sans text-[0.72rem] font-semibold text-[var(--accent)] hover:underline">
                  Open source ↗
                </a>
              )}
            </>
          ) : (
            <p className="m-0 font-sans text-[0.78rem] leading-snug text-[var(--text-faint)]">
              Hover any dot on the globe to read that headline and its sentiment score here.
            </p>
          )}
        </div>
      </div>

      <p className="mt-2 font-sans text-[0.68rem] leading-snug text-[var(--text-faint)] opacity-90">
        Dots are arranged decoratively around the sphere — headlines have no real geographic origin, this is not a
        map. Color is sentiment, scored by a finance-specific keyword lexicon (see the list below for exactly what
        matched each headline) — a real, inspectable signal but not an NLP model, so treat any single dot skeptically
        and read the aggregate instead.
      </p>
    </div>
  );
}
