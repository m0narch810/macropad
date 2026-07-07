export default function ZScoreBar({ z }: { z: number }) {
  const clamped = Math.max(-3, Math.min(3, z));
  const pct = ((clamped + 3) / 6) * 100;
  const extreme = Math.abs(z) >= 2;
  const color = extreme ? (z > 0 ? "var(--up)" : "var(--down)") : "var(--accent)";

  return (
    <div className="flex items-center gap-2.5">
      <div className="relative h-1.5 flex-1 rounded-full bg-[var(--border)]">
        <div className="absolute left-1/2 top-1/2 h-3 w-px -translate-x-1/2 -translate-y-1/2 bg-[var(--text-faint)]" />
        <div
          className="absolute top-1/2 h-2.5 w-2.5 -translate-y-1/2 -translate-x-1/2 rounded-full border-2 border-[var(--panel)]"
          style={{ left: `${pct}%`, background: color }}
        />
      </div>
      <span className="font-mono text-[0.72rem] font-semibold" style={{ color }}>
        {z > 0 ? "+" : ""}
        {z.toFixed(2)}σ
      </span>
    </div>
  );
}
