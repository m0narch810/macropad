import Link from "next/link";
import MarketingNav from "@/components/marketing/MarketingNav";
import MarketingFooter from "@/components/marketing/MarketingFooter";
import Reveal from "@/components/fx/Reveal";

export const metadata = {
  title: "Pricing · Trifekta",
  description: "Free during launch, $29 a month after. One plan, the whole desk.",
};

const FEATURES = [
  "All six panels: US macro, rates, positioning, transmission, geopolitics, volatility",
  "A signal score on every series, method-fit to the indicator",
  "Macro Bias: composite risk-on or risk-off read with pillar breakdown",
  "Replay and Regime Fingerprint: recompute the bias historically, match today against past regimes",
  "Pooled and per-asset news with event-based sentiment",
  "Full history and specialized stats on every indicator",
  "Economic release calendar for every tracked series",
  "Daily sync with the exact timestamp on the board",
];

const LAUNCH_TERMS = [
  [
    "T-01",
    "Launch access is the full product",
    "Nothing is gated behind the paid tier during launch. What you use free now is exactly what Pro will be.",
  ],
  [
    "T-02",
    "Pro lands at $29 a month",
    "When the launch window closes, Pro switches on at $29 a month or $290 a year. There is one plan; there will never be a stripped-down tier that hides the good parts.",
  ],
  [
    "T-03",
    "You get 14 days notice",
    "Nothing converts automatically and no card is on file to charge. Before Pro switches on, every launch user gets at least 14 days notice and chooses whether to subscribe.",
  ],
] as const;

const FAQ = [
  {
    q: "What's included during launch?",
    a: "Everything. Every panel, every asset, the full bias and replay toolkit, news and sentiment, the calendar. There is no feature held back for later.",
  },
  {
    q: "What will it cost after launch?",
    a: "$29 a month, or $290 a year which works out to two months free. One plan with everything in it.",
  },
  {
    q: "Do I need to connect accounts or import data?",
    a: "No. Trifekta aggregates and scores everything server-side. You sign in and the board is already live.",
  },
  {
    q: "How often does it refresh?",
    a: "Daily on trading days. The board shows the exact last-synced timestamp, so you always know how current the read is.",
  },
  {
    q: "What happens to my account when pricing starts?",
    a: "You get at least 14 days notice, then you decide. Nothing is charged automatically because no card is required during launch.",
  },
];

export default function PricingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <MarketingNav />

      <main className="flex-1">
        <section className="relative border-b border-[var(--border)]">
          <div className="relative mx-auto max-w-[1120px] px-5 pb-16 pt-20 sm:px-8 sm:pt-24">
            <div className="eyebrow mb-4">Pricing</div>
            <h1 className="display-hero m-0 max-w-2xl text-[2.4rem] sm:text-[3.4rem]">
              Free during launch. $29 a month after.
            </h1>
            <p className="mt-5 max-w-lg font-sans text-[1rem] leading-relaxed text-[var(--text-dim)]">
              One plan, the whole desk. No card required during launch, and at least 14 days notice before
              Pro pricing switches on.
            </p>
          </div>
        </section>

        <section className="border-b border-[var(--border)]">
          <div className="mx-auto grid max-w-[1120px] grid-cols-1 gap-12 px-5 py-16 sm:px-8 lg:grid-cols-[1fr_1.1fr] lg:items-start">
            {/* The one plan: one surface step up, no colored border. */}
            <Reveal>
              <div className="hud flex flex-col border border-[var(--border-strong)] bg-[var(--panel-2)] p-8">
                <div className="flex items-baseline justify-between">
                  <span className="partno">PLAN-01 / PRO</span>
                  <span className="border border-[var(--border-strong)] px-2 py-0.5 font-mono text-[0.6rem] font-semibold uppercase tracking-[0.12em] text-[var(--text-dim)]">
                    Free during launch
                  </span>
                </div>

                <div className="mt-6 flex items-baseline gap-2">
                  <span className="font-display text-[3rem] leading-none tracking-[-0.03em]">$29</span>
                  <span className="font-mono text-[0.72rem] text-[var(--text-faint)]">/ month after launch</span>
                </div>
                <div className="mt-1.5 font-mono text-[0.7rem] text-[var(--text-faint)]">
                  $0 now · $290 / year when pricing starts
                </div>
                <p className="m-0 mt-3 font-sans text-[0.88rem] leading-relaxed text-[var(--text-dim)]">
                  This is the only plan. Signing up during launch gets you all of it free, with 14 days
                  notice before the price switches on.
                </p>

                <ul className="m-0 mt-8 flex flex-1 list-none flex-col gap-3 p-0">
                  {FEATURES.map((f) => (
                    <li key={f} className="flex items-start gap-3 font-sans text-[0.86rem] leading-snug text-[var(--text)]">
                      <span className="mt-[3px] shrink-0 font-mono text-[0.72rem] text-[var(--text-faint)]">+</span>
                      {f}
                    </li>
                  ))}
                </ul>

                <Link href="/signup" className="btn btn-primary mt-9 w-full">
                  Start free
                </Link>
              </div>
            </Reveal>

            <Reveal delay={80}>
              <div className="flex flex-col gap-8 lg:pt-4">
                <div>
                  <div className="eyebrow mb-3">Why free right now</div>
                  <h2 className="font-display m-0 text-[1.5rem] leading-[1.12] sm:text-[1.8rem]">
                    This is launch pricing, not the price.
                  </h2>
                  <p className="m-0 mt-4 font-sans text-[0.92rem] leading-relaxed text-[var(--text-dim)]">
                    Trifekta just launched. Free access is how the board gets in front of real desks before
                    the paid tier switches on. It is not a permanent free tier and it will not quietly turn
                    into one.
                  </p>
                </div>

                <div className="flex flex-col border-t border-[var(--border)]">
                  {LAUNCH_TERMS.map(([code, title, desc]) => (
                    <div key={code} className="grid grid-cols-[4rem_1fr] gap-4 border-b border-[var(--border)] py-5">
                      <span className="partno pt-0.5">{code}</span>
                      <div>
                        <div className="font-sans text-[0.92rem] font-semibold text-[var(--text)]">{title}</div>
                        <p className="m-0 mt-1.5 font-sans text-[0.85rem] leading-relaxed text-[var(--text-dim)]">{desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        <section className="mx-auto w-full max-w-[820px] px-5 py-20 sm:px-8">
          <Reveal>
            <div className="eyebrow mb-3">FAQ</div>
            <h2 className="font-display m-0 text-[1.7rem] leading-[1.08] sm:text-[2.1rem]">Questions, answered.</h2>
          </Reveal>

          <div className="mt-10 flex flex-col">
            {FAQ.map((item, i) => (
              <Reveal key={item.q} delay={i * 40}>
                <div className="border-t border-[var(--border)] py-6">
                  <h3 className="m-0 text-[0.98rem] font-semibold">{item.q}</h3>
                  <p className="m-0 mt-2.5 font-sans text-[0.87rem] leading-relaxed text-[var(--text-dim)]">{item.a}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
}
