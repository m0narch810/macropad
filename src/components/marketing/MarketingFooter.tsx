import Link from "next/link";

export default function MarketingFooter() {
  return (
    <footer className="border-t border-[var(--border)]">
      <div className="mx-auto flex max-w-[1180px] flex-col gap-8 px-5 py-14 sm:px-8 md:flex-row md:items-start md:justify-between">
        <div className="max-w-xs">
          <div className="font-display text-[1.15rem] uppercase leading-none tracking-[-0.01em]">
            MACRO<span className="glow-accent" style={{ color: "var(--accent)" }}>PAD</span>
          </div>
          <p className="mt-3 font-sans text-[0.82rem] leading-relaxed text-[var(--text-faint)]">
            Live macro desk: regime signals, positioning, and per-asset net bias in one screen.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-x-12 gap-y-8 sm:grid-cols-3">
          <div>
            <div className="eyebrow mb-3">Product</div>
            <div className="flex flex-col gap-2.5">
              <Link href="/#product" className="font-sans text-[0.82rem] text-[var(--text-dim)] hover:text-[var(--text)]">Overview</Link>
              <Link href="/#coverage" className="font-sans text-[0.82rem] text-[var(--text-dim)] hover:text-[var(--text)]">Coverage</Link>
              <Link href="/pricing" className="font-sans text-[0.82rem] text-[var(--text-dim)] hover:text-[var(--text)]">Pricing</Link>
            </div>
          </div>
          <div>
            <div className="eyebrow mb-3">Company</div>
            <div className="flex flex-col gap-2.5">
              <a href="mailto:hello@macropad.io" className="font-sans text-[0.82rem] text-[var(--text-dim)] hover:text-[var(--text)]">Contact</a>
              <a href="mailto:hello@macropad.io" className="font-sans text-[0.82rem] text-[var(--text-dim)] hover:text-[var(--text)]">Support</a>
            </div>
          </div>
          <div>
            <div className="eyebrow mb-3">App</div>
            <div className="flex flex-col gap-2.5">
              <Link href="/app" className="font-sans text-[0.82rem] text-[var(--text-dim)] hover:text-[var(--text)]">Launch app</Link>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-[var(--border)] px-5 py-5 sm:px-8">
        <p className="m-0 font-mono text-[0.7rem] text-[var(--text-faint)]">
          &copy; {new Date().getFullYear()} Macropad. Data provided for informational purposes only — not investment advice.
        </p>
      </div>
    </footer>
  );
}
