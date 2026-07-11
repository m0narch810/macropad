import Link from "next/link";
import { Suspense } from "react";
import MarketingNav from "@/components/marketing/MarketingNav";
import MarketingFooter from "@/components/marketing/MarketingFooter";
import { TerminalPreview, BoardPreview, SignalPreview, BiasPreview, NewsPreview } from "@/components/marketing/ProductPreviews";
import Reveal from "@/components/fx/Reveal";
import { getLandingPanels } from "@/lib/landingData";
import { macroPanels } from "@/lib/macroData";

const HIDDEN_PANELS = new Set(["asset-news", "calendar"]);
const PANELS = macroPanels.filter((p) => !HIDDEN_PANELS.has(p.id));
const TOTAL_SERIES = PANELS.reduce((n, p) => n + p.series.length, 0);

/*
 * Each module row pairs the claim with a live slice of the actual product,
 * rendered from the same feed the app runs on. The copy only says things
 * the visual next to it can prove.
 */
const MODULES = [
  {
    tag: "BOARD",
    title: "Every indicator on one screen",
    desc: `The board shows all ${TOTAL_SERIES} series as one dense grid: current value, direction, and a signal score on every row. You read the whole macro picture top to bottom in under a minute, without building anything first.`,
  },
  {
    tag: "SIGNALS",
    title: "Scores that fit the indicator",
    desc: "Every series carries a score from -1 to +1 that says which way it leans for risk assets and how strongly. Inflation is judged against target, the yield curve against inversion, payrolls against their own pace, and futures positioning against its range. The method matches the series, so the number means something.",
  },
  {
    tag: "BIAS",
    title: "One composite read, fully inspectable",
    desc: "Macro Bias rolls every scored indicator into a single risk-on or risk-off verdict, broken into pillars: growth, inflation, liquidity, rates, credit, positioning, and volatility. Pick a lookback from one day to two years and an asset scope, and drill into exactly which indicators drive the read.",
  },
  {
    tag: "NEWS",
    title: "Sentiment that follows the data",
    desc: "Headlines are pooled from macro and policy desks and scored for tone, weighted toward the last few hours. Per-asset feeds are built from each asset's own indicator readings, so every asset has a real read even on a day when nobody writes about it.",
  },
];

const DESK_PAGES = [
  {
    name: "Replay",
    desc: "Recompute the bias as of any past date and watch how the read evolved into today.",
  },
  {
    name: "Regime Fingerprint",
    desc: "Match today's pillar profile against history and see which past regimes looked most like now.",
  },
  {
    name: "Calendar",
    desc: "Release dates for every tracked indicator, so you know what hits the board next.",
  },
];

function StripSkeleton() {
  return <div className="h-[280px] border border-[var(--border)] bg-[var(--panel)]" aria-hidden />;
}

async function ModuleRows() {
  const { panels } = await getLandingPanels();
  const visuals = [
    <BoardPreview key="board" panels={panels} />,
    <SignalPreview key="signals" panels={panels} />,
    <BiasPreview key="bias" panels={panels} />,
    <NewsPreview key="news" panels={panels} />,
  ];

  return (
    <div className="mt-14 flex flex-col gap-16">
      {MODULES.map((m, i) => (
        <Reveal key={m.tag} delay={i * 60}>
          <div className="grid grid-cols-1 items-center gap-x-14 gap-y-6 border-t border-[var(--border)] pt-10 lg:grid-cols-2">
            <div className={i % 2 === 1 ? "lg:order-2" : undefined}>
              <span className="partno">[{m.tag}]</span>
              <h3 className="m-0 mt-3 text-[1.35rem] font-semibold leading-snug sm:text-[1.55rem]">{m.title}</h3>
              <p className="m-0 mt-3 max-w-md font-sans text-[0.92rem] leading-relaxed text-[var(--text-dim)]">
                {m.desc}
              </p>
            </div>
            <div className={i % 2 === 1 ? "lg:order-1" : undefined}>{visuals[i]}</div>
          </div>
        </Reveal>
      ))}
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <MarketingNav />

      <main className="flex-1">
        {/* Hero — the live board sells itself (site-wide backdrop shows through) */}
        <section className="relative border-b border-[var(--border)]">
          <div className="relative mx-auto max-w-[1120px] px-5 pt-20 sm:px-8 sm:pt-28">
            <div className="eyebrow mb-6 flex items-center gap-2">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--up)] opacity-60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--up)]" />
              </span>
              Live macro desk
            </div>

            <h1 className="display-hero m-0 max-w-3xl text-balance text-[2.9rem] sm:text-[4.6rem]">
              Read the regime, not the noise.
            </h1>

            <p className="mt-6 max-w-xl font-sans text-[1.02rem] leading-relaxed text-[var(--text-dim)] sm:text-[1.1rem]">
              Trifekta puts the whole macro picture on one screen: {TOTAL_SERIES} series across liquidity,
              rates, positioning, transmission, geopolitics, and volatility, each scored for direction and
              strength. The terminal below is the live product, not a screenshot.
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link href="/signup" className="btn btn-primary">
                Launch the desk
              </Link>
              <Link href="/coverage" className="btn btn-ghost">
                See what it tracks
              </Link>
            </div>

            <div className="partno mt-8 w-fit bg-[color-mix(in_srgb,var(--bg)_82%,transparent)] py-1" style={{ color: "var(--text-dim)" }}>
              {PANELS.length} PANELS · {TOTAL_SERIES} SERIES · SYNCED DAILY
            </div>

            <div className="relative mt-14 pb-20 sm:pb-24">
              <Suspense fallback={<StripSkeleton />}>
                <TerminalPreview />
              </Suspense>
            </div>
          </div>
        </section>

        {/* System — each claim paired with the live piece of the product it describes */}
        <section id="system" className="border-b border-[var(--border)]">
          <div className="mx-auto max-w-[1120px] px-5 py-24 sm:px-8">
            <Reveal>
              <div className="eyebrow mb-3">System</div>
              <h2 className="font-display m-0 max-w-xl text-[1.9rem] leading-[1.08] sm:text-[2.5rem]">
                What you see below is the desk itself, live.
              </h2>
            </Reveal>

            <Suspense fallback={<div className="mt-14 h-[400px]" aria-hidden />}>
              <ModuleRows />
            </Suspense>
          </div>
        </section>

        {/* The rest of the desk */}
        <section className="border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--panel)_62%,transparent)]">
          <div className="mx-auto max-w-[1120px] px-5 py-20 sm:px-8">
            <Reveal>
              <div className="eyebrow mb-3">Also on the desk</div>
              <div className="grid grid-cols-1 gap-px overflow-hidden border border-[var(--border)] bg-[var(--border)] sm:grid-cols-3">
                {DESK_PAGES.map((p) => (
                  <div key={p.name} className="bg-[var(--panel)] px-5 py-5">
                    <div className="font-sans text-[0.95rem] font-semibold text-[var(--text)]">{p.name}</div>
                    <p className="m-0 mt-1.5 font-sans text-[0.8rem] leading-relaxed text-[var(--text-dim)]">{p.desc}</p>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>
        </section>

        {/* Coverage — the catalog lives on its own page */}
        <section className="border-b border-[var(--border)]">
          <div className="mx-auto max-w-[1120px] px-5 py-20 sm:px-8">
            <Reveal>
              <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <div className="eyebrow mb-3">Coverage</div>
                  <h2 className="font-display m-0 max-w-lg text-[1.7rem] leading-[1.08] sm:text-[2.1rem]">
                    {PANELS.length} panels, {TOTAL_SERIES} series.
                  </h2>
                  <p className="m-0 mt-4 max-w-md font-sans text-[0.92rem] leading-relaxed text-[var(--text-dim)]">
                    Every series on the board earns its slot, and every one is documented: what it measures,
                    why it matters, and how to read it.
                  </p>
                </div>
                <Link href="/coverage" className="btn btn-ghost shrink-0 self-start sm:self-auto">
                  Browse the full catalog
                </Link>
              </div>
            </Reveal>
          </div>
        </section>

        {/* CTA */}
        <section className="relative">
          <div className="relative mx-auto max-w-[1120px] px-5 py-28 text-center sm:px-8">
            <Reveal>
              <h2 className="font-display m-0 text-[2rem] leading-[1.05] sm:text-[2.8rem]">
                Stop rebuilding this in a spreadsheet.
              </h2>
              <p className="mx-auto mt-4 max-w-md font-sans text-[0.95rem] leading-relaxed text-[var(--text-dim)]">
                One board, synced daily, zero setup. Free during launch.
              </p>
              <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
                <Link href="/signup" className="btn btn-primary">
                  Launch the desk
                </Link>
                <Link href="/pricing" className="btn btn-ghost">
                  See pricing
                </Link>
              </div>
            </Reveal>
          </div>
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
}
