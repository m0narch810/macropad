import Link from "next/link";
import MarketingNav from "@/components/marketing/MarketingNav";
import MarketingFooter from "@/components/marketing/MarketingFooter";
import { macroPanels } from "@/lib/macroData";

const HIDDEN_PANELS = new Set(["asset-news"]);
const PANELS = macroPanels.filter((p) => !HIDDEN_PANELS.has(p.id));

export const metadata = {
  title: "Coverage - Macropad",
  description: "Every panel and series Macropad tracks: US macro, yield rates, COT positioning, transmission, geopolitics, and volatility.",
};

export default function CoveragePage() {
  const totalSeries = PANELS.reduce((n, p) => n + p.series.length, 0);

  return (
    <div className="flex min-h-screen flex-col">
      <MarketingNav />

      <main className="flex-1">
        <section className="border-b border-[var(--border)]">
          <div className="mx-auto max-w-[1180px] px-5 pb-16 pt-20 sm:px-8 sm:pt-24">
            <div className="eyebrow mb-4">Coverage</div>
            <h1 className="font-display m-0 max-w-2xl text-[2.4rem] uppercase leading-[0.98] tracking-[-0.02em] sm:text-[3.4rem]">
              {PANELS.length} panels. {totalSeries} series.
            </h1>
            <p className="mt-5 max-w-lg font-sans text-[1rem] leading-relaxed text-[var(--text-dim)]">
              Every input feeding the board, with the exact source behind each one. Nothing on Macropad is a black box.
            </p>
          </div>
        </section>

        {PANELS.map((panel, i) => (
          <section
            key={panel.id}
            id={panel.id}
            className="border-b border-[var(--border)]"
            style={{ background: i % 2 === 1 ? "var(--panel)" : undefined }}
          >
            <div className="mx-auto max-w-[1180px] px-5 py-14 sm:px-8">
              <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_2fr]">
                <div>
                  <div className="eyebrow mb-2" style={{ color: "var(--accent)" }}>
                    {String(i + 1).padStart(2, "0")} / {String(PANELS.length).padStart(2, "0")}
                  </div>
                  <h2 className="font-display m-0 text-[1.5rem] uppercase leading-[1.05] tracking-[-0.01em] sm:text-[1.8rem]">
                    {panel.title}
                  </h2>
                  <p className="m-0 mt-3 font-sans text-[0.88rem] leading-relaxed text-[var(--text-dim)]">
                    {panel.description}
                  </p>
                  <div className="eyebrow mt-4">{panel.series.length} series</div>
                </div>

                <div className="grid grid-cols-1 gap-px overflow-hidden border border-[var(--border)] sm:grid-cols-2" style={{ background: "var(--border)" }}>
                  {panel.series.map((s) => (
                    <div key={s.id} className="bg-[var(--bg)] px-4 py-3">
                      <div className="font-sans text-[0.85rem] font-semibold text-[var(--text)]">{s.name}</div>
                      <div className="mt-1 font-sans text-[0.76rem] leading-snug text-[var(--text-faint)]">{s.note}</div>
                      <div className="mt-1.5 font-mono text-[0.66rem] uppercase tracking-wide text-[var(--text-faint)]">{s.source}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        ))}

        <section className="mx-auto max-w-[1180px] px-5 py-24 text-center sm:px-8">
          <h2 className="font-display m-0 text-[2rem] uppercase leading-[1.05] tracking-[-0.02em] sm:text-[2.8rem]">
            All of it, one screen.
          </h2>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/signup"
              className="border border-[var(--accent)] bg-[var(--accent)] px-6 py-3 font-sans text-[0.85rem] font-semibold uppercase tracking-wide text-black transition-opacity hover:opacity-85"
            >
              Launch the desk
            </Link>
            <Link
              href="/pricing"
              className="border border-[var(--border-strong)] px-6 py-3 font-sans text-[0.85rem] font-semibold uppercase tracking-wide text-[var(--text)] transition-colors hover:border-[var(--text-dim)]"
            >
              See pricing
            </Link>
          </div>
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
}
