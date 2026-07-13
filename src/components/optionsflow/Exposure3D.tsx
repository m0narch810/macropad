"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { ExposureBarDatum } from "@/components/optionsflow/ExposureBarChart";

type ThemeColors = { up: string; down: string; faint: string; panel: string };

function useThemeColors(): ThemeColors {
  const [colors, setColors] = useState<ThemeColors>({ up: "#3ecf8e", down: "#f0555d", faint: "#6b6b70", panel: "#111113" });
  useEffect(() => {
    const read = () => {
      const cs = getComputedStyle(document.documentElement);
      const get = (name: string, fallback: string) => cs.getPropertyValue(name).trim() || fallback;
      setColors({
        up: get("--up", "#3ecf8e"),
        down: get("--down", "#f0555d"),
        faint: get("--text-faint", "#6b6b70"),
        panel: get("--panel", "#111113"),
      });
    };
    read();
    const mo = new MutationObserver(read);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "data-signal"] });
    return () => mo.disconnect();
  }, []);
  return colors;
}

/** R3F + OrbitControls both force touch-action: none, trapping page scroll on mobile. */
function TouchScrollFix() {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      gl.domElement.style.touchAction = "pan-y";
    });
    return () => cancelAnimationFrame(id);
  }, [gl]);
  return null;
}

function Bar({
  x,
  z,
  height,
  color,
  width,
}: {
  x: number;
  z: number;
  height: number;
  color: string;
  width: number;
}) {
  const h = Math.max(0.04, Math.abs(height));
  return (
    <mesh position={[x, (height >= 0 ? h : -h) / 2, z]}>
      <boxGeometry args={[width, h, width]} />
      <meshStandardMaterial color={color} roughness={0.45} metalness={0.1} />
    </mesh>
  );
}

function Floor({ span, colors }: { span: number; colors: ThemeColors }) {
  return (
    <gridHelper args={[span * 1.2, 20, colors.faint, colors.faint]} position={[0, 0, 0]} />
  );
}

const MAX_BAR_HEIGHT = 3.2;

export default function Exposure3D({ data, mode }: { data: ExposureBarDatum[]; mode: "split" | "net" }) {
  const [inView, setInView] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const colors = useThemeColors();

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), {
      rootMargin: "200px 0px",
      threshold: 0.01,
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const span = Math.max(1, data.length - 1);
  const maxAbs = useMemo(() => {
    if (mode === "split") {
      return Math.max(1, ...data.flatMap((d) => [Math.abs(d.call ?? 0), Math.abs(d.put ?? 0)]));
    }
    return Math.max(1, ...data.map((d) => Math.abs(d.net ?? 0)));
  }, [data, mode]);

  const step = span > 0 ? span / Math.max(1, data.length - 1) : 1;
  const barWidth = Math.min(0.5, (span / Math.max(1, data.length)) * 0.7);

  return (
    <div ref={containerRef} className="hud h-[340px] w-full overflow-hidden border border-[var(--border)] bg-[var(--panel-2)]">
      {inView ? (
        <Canvas camera={{ position: [span * 0.55, span * 0.65 + 2, span * 0.95 + 2], fov: 42 }} dpr={[1, 1.6]}>
          <ambientLight intensity={0.55} />
          <directionalLight position={[4, 6, 4]} intensity={0.9} color="#f4f6ff" />
          <directionalLight position={[-4, 3, -3]} intensity={0.35} color="#8fa8ff" />
          <group position={[-span / 2, 0, 0]}>
            <Floor span={span} colors={colors} />
            {data.map((d, i) => {
              const x = i * step;
              if (mode === "split") {
                return (
                  <group key={d.strike}>
                    <Bar x={x} z={-0.32} height={((d.call ?? 0) / maxAbs) * MAX_BAR_HEIGHT} color={colors.up} width={barWidth} />
                    <Bar x={x} z={0.32} height={(-Math.abs(d.put ?? 0) / maxAbs) * MAX_BAR_HEIGHT} color={colors.down} width={barWidth} />
                  </group>
                );
              }
              return <Bar key={d.strike} x={x} z={0} height={((d.net ?? 0) / maxAbs) * MAX_BAR_HEIGHT} color={(d.net ?? 0) >= 0 ? colors.up : colors.down} width={barWidth} />;
            })}
          </group>
          <OrbitControls enablePan={false} minDistance={span * 0.6} maxDistance={span * 2.4} rotateSpeed={0.6} />
          <TouchScrollFix />
        </Canvas>
      ) : (
        <div className="flex h-full items-center justify-center font-sans text-[0.7rem] text-[var(--text-faint)]">
          Scroll into view to render…
        </div>
      )}
    </div>
  );
}
