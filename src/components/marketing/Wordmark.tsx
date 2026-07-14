import BrandMark from "@/components/fx/BrandMark";

export default function Wordmark({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const text = size === "lg" ? "text-[1.05rem]" : size === "sm" ? "text-[0.78rem]" : "text-[0.88rem]";
  const mark = size === "lg" ? 26 : size === "sm" ? 18 : 22;
  const blackletter = size === "lg" ? "text-[1.5rem]" : size === "sm" ? "text-[1.05rem]" : "text-[1.2rem]";
  return (
    <span className="flex select-none items-center gap-2.5 whitespace-nowrap">
      <BrandMark size={mark} className="shrink-0 news:hidden" />
      <span className={`font-mono font-bold tracking-[0.2em] text-[var(--text)] ${text} news:hidden`}>
        TRIFEKTA<span className="blink-cursor text-[var(--text-faint)]">_</span>
      </span>
      <span className={`masthead-title hidden text-[var(--text)] news:inline ${blackletter}`}>Trifekta</span>
    </span>
  );
}
