"use client";

import { useEffect, useRef, useState } from "react";

/* ANSI-shadow MACROPAD. Rows must stay equal width for the decrypt sweep. */
const BANNER = String.raw`
███╗   ███╗ █████╗  ██████╗██████╗  ██████╗ ██████╗  █████╗ ██████╗
████╗ ████║██╔══██╗██╔════╝██╔══██╗██╔═══██╗██╔══██╗██╔══██╗██╔══██╗
██╔████╔██║███████║██║     ██████╔╝██║   ██║██████╔╝███████║██║  ██║
██║╚██╔╝██║██╔══██║██║     ██╔══██╗██║   ██║██╔═══╝ ██╔══██║██║  ██║
██║ ╚═╝ ██║██║  ██║╚██████╗██║  ██║╚██████╔╝██║     ██║  ██║██████╔╝
╚═╝     ╚═╝╚═╝  ╚═╝ ╚═════╝╚═╝  ╚═╝ ╚═════╝ ╚═╝     ╚═╝  ╚═╝╚═════╝`.slice(1);

const SCRAMBLE = "▓▒░<>/\\|=+*#%$@!?01";

/** Characters resolve left-to-right out of static; runs once on mount. */
function useDecrypt(target: string) {
  const [out, setOut] = useState(target);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const chars = target.split("");
    let progress = 0;
    const perFrame = Math.ceil(target.length / 55);
    const id = setInterval(() => {
      progress += perFrame;
      if (progress >= target.length) {
        setOut(target);
        clearInterval(id);
        return;
      }
      setOut(
        chars
          .map((c, i) => {
            if (c === " " || c === "\n" || i <= progress) return c;
            return SCRAMBLE[Math.floor(Math.random() * SCRAMBLE.length)];
          })
          .join("")
      );
    }, 24);
    return () => clearInterval(id);
  }, [target]);
  return out;
}

/** Types the line out once, then parks a blinking cursor at the end. */
function TypedLine({ text }: { text: string }) {
  const [n, setN] = useState(text.length);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setN(0);
    const id = setInterval(() => {
      setN((v) => {
        if (v >= text.length) {
          clearInterval(id);
          return v;
        }
        return v + 1;
      });
    }, 22);
    return () => clearInterval(id);
  }, [text]);
  return (
    <div className="font-mono text-[0.7rem] text-[var(--text-dim)] sm:text-[0.74rem]">
      <span className="text-[var(--accent)]">&gt;</span> {text.slice(0, n)}
      <span className="blink-cursor text-[var(--accent)]">▊</span>
    </div>
  );
}

function MatrixRain({ className }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const CELL = 14;
    const CHARS = "アイウエオカキクケコサシスセソタチツ0123456789$%+-#";
    let drops: number[] = [];
    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      drops = Array.from({ length: Math.ceil(canvas.width / CELL) }, () => Math.floor(Math.random() * -30));
    };
    resize();
    window.addEventListener("resize", resize);

    let raf = 0;
    let last = 0;
    const step = (t: number) => {
      raf = requestAnimationFrame(step);
      if (t - last < 75) return;
      last = t;
      ctx.fillStyle = "rgba(5, 8, 7, 0.24)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.font = `12px var(--font-jet), monospace`;
      for (let i = 0; i < drops.length; i++) {
        const ch = CHARS[Math.floor(Math.random() * CHARS.length)];
        ctx.fillStyle = "rgba(61, 214, 140, 0.85)";
        ctx.fillText(ch, i * CELL, drops[i] * CELL);
        drops[i] = drops[i] * CELL > canvas.height && Math.random() > 0.965 ? 0 : drops[i] + 1;
      }
    };
    raf = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);
  return <canvas ref={ref} className={className} aria-hidden="true" />;
}

export default function TerminalHero({
  seriesCount,
  bull,
  bear,
  lastUpdated,
}: {
  seriesCount: number;
  bull: number;
  bear: number;
  lastUpdated: string | null;
}) {
  const banner = useDecrypt(BANNER);
  const synced = lastUpdated ? new Date(lastUpdated).toLocaleTimeString("en-US", { hour12: false }) : "never";

  return (
    <header className="relative overflow-hidden border-b border-[var(--border)] bg-[var(--panel)]">
      <MatrixRain className="absolute inset-0 h-full w-full opacity-[0.18]" />
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "linear-gradient(180deg, transparent 30%, var(--panel) 96%)" }}
        aria-hidden="true"
      />
      <div className="relative px-4 pb-3.5 pt-4 sm:px-6 lg:px-8">
        <pre
          className="m-0 hidden select-none overflow-hidden font-mono font-bold leading-[1.08] sm:block"
          style={{
            fontSize: "clamp(5px, 0.85vw, 10px)",
            background: "linear-gradient(180deg, #7bf7bb 0%, #3dd68c 55%, #1f8f5c 100%)",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
            filter: "drop-shadow(0 0 7px rgba(61, 214, 140, 0.35))",
          }}
          aria-label="MACROPAD"
        >
          {banner}
        </pre>
        <div className="font-display text-[1.35rem] text-[var(--accent)] glow sm:hidden">Macropad</div>
        <div className="mt-2">
          <TypedLine
            text={`macro intelligence terminal — ${seriesCount} series live · ${bull} bullish / ${bear} bearish strong · synced ${synced}`}
          />
        </div>
      </div>
    </header>
  );
}
