import Link from "next/link";

export default function MarketingNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--bg)_88%,transparent)] backdrop-blur">
      <div className="mx-auto flex max-w-[1180px] items-center justify-between px-5 py-4 sm:px-8">
        <Link href="/" className="font-display text-[1.15rem] uppercase leading-none tracking-[-0.01em]">
          MACRO<span className="glow-accent" style={{ color: "var(--accent)" }}>PAD</span>
        </Link>

        <nav className="hidden items-center gap-7 md:flex">
          <Link href="/#product" className="font-sans text-[0.82rem] text-[var(--text-dim)] transition-colors hover:text-[var(--text)]">
            Product
          </Link>
          <Link href="/#coverage" className="font-sans text-[0.82rem] text-[var(--text-dim)] transition-colors hover:text-[var(--text)]">
            Coverage
          </Link>
          <Link href="/pricing" className="font-sans text-[0.82rem] text-[var(--text-dim)] transition-colors hover:text-[var(--text)]">
            Pricing
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          <Link href="/app" className="hidden font-sans text-[0.82rem] text-[var(--text-dim)] transition-colors hover:text-[var(--text)] sm:block">
            Sign in
          </Link>
          <Link
            href="/app"
            className="border border-[var(--accent)] px-4 py-2 font-sans text-[0.78rem] font-semibold uppercase tracking-wide text-[var(--accent)] transition-colors hover:bg-[color-mix(in_srgb,var(--accent)_12%,transparent)]"
          >
            Launch app
          </Link>
        </div>
      </div>
    </header>
  );
}
