import Link from "next/link";
import MarketingNav from "@/components/marketing/MarketingNav";
import MarketingFooter from "@/components/marketing/MarketingFooter";

const TIERS = [
  {
    name: "Desk",
    price: "$0",
    period: "forever",
    tagline: "Full board, one refresh a day.",
    cta: "Launch the desk",
    featured: false,
    features: [
      "All 6 macro panels",
      "Per-asset net bias, 10 tickers",
      "Daily refresh (weekdays)",
      "General macro news feed",
      "Board overview page",
    ],
  },
  {
    name: "Pro",
    price: "$39",
    period: "/mo",
    tagline: "Faster sync, deeper asset coverage.",
    cta: "Start Pro",
    featured: true,
    features: [
      "Everything in Desk",
      "Hourly refresh during market hours",
      "Per-asset news + sentiment trend, all tickers",
      "Custom dashboards and bias pages",
      "3D headline scatter, full history",
      "Priority email support",
    ],
  },
  {
    name: "Desk+",
    price: "Talk to us",
    period: "",
    tagline: "For teams running this across a book.",
    cta: "Contact sales",
    featured: false,
    features: [
      "Everything in Pro",
      "Seats for a full desk",
      "Custom coverage — new panels on request",
      "SLA on refresh cadence",
      "Dedicated support channel",
    ],
  },
];

const FAQ = [
  {
    q: "Is the free tier actually usable, or a trial?",
    a: "It's the full board — six panels, ten assets, real bias, real news. No trial clock. Desk is free forever; upgrade only when you want faster refresh or deeper per-asset coverage.",
  },
  {
    q: "Where does the data come from?",
    a: "Macro releases and yield data from public series, COT from CFTC, headlines from real policy and markets desks (CNBC, Fed, WSJ, Yahoo, FXStreet), scored with a finance-specific sentiment lexicon.",
  },
  {
    q: "How often does it refresh?",
    a: "Desk syncs once a day on weekdays. Pro syncs hourly during market hours. Every board shows the exact last-synced timestamp — no guessing.",
  },
  {
    q: "Do I need to connect my own accounts?",
    a: "No. Macropad pulls and scores everything server-side. You just open the board.",
  },
  {
    q: "Can I cancel Pro anytime?",
    a: "Yes, no lock-in. Cancel and you drop back to Desk with your board still intact.",
  },
];

export default function PricingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <MarketingNav />

      <main className="flex-1">
        <section className="border-b border-[var(--border)]">
          <div className="mx-auto max-w-[1180px] px-5 pb-16 pt-20 sm:px-8 sm:pt-24">
            <div className="eyebrow mb-4">Pricing</div>
            <h1 className="font-display m-0 max-w-2xl text-[2.4rem] uppercase leading-[0.98] tracking-[-0.02em] sm:text-[3.4rem]">
              Simple. No seat games.
            </h1>
            <p className="mt-5 max-w-lg font-sans text-[1rem] leading-relaxed text-[var(--text-dim)]">
              Free tier is the real board, not a teaser. Pay only for faster sync and deeper coverage.
            </p>
          </div>
        </section>

        <section className="border-b border-[var(--border)]">
          <div className="mx-auto grid max-w-[1180px] grid-cols-1 gap-6 px-5 py-16 sm:px-8 md:grid-cols-3">
            {TIERS.map((tier) => (
              <div
                key={tier.name}
                className="relative flex flex-col border p-7"
                style={{
                  borderColor: tier.featured ? "var(--accent)" : "var(--border)",
                  background: tier.featured ? "color-mix(in srgb, var(--accent) 5%, var(--panel))" : "var(--panel)",
                }}
              >
                {tier.featured && (
                  <div
                    className="absolute -top-3 left-7 px-2 py-0.5 font-mono text-[0.62rem] font-bold uppercase tracking-wide"
                    style={{ background: "var(--accent)", color: "#000" }}
                  >
                    Most used
                  </div>
                )}

                <div className="eyebrow">{tier.name}</div>
                <div className="mt-3 flex items-baseline gap-1.5">
                  <span className="font-display text-[2.2rem] leading-none">{tier.price}</span>
                  {tier.period && <span className="font-sans text-[0.85rem] text-[var(--text-faint)]">{tier.period}</span>}
                </div>
                <p className="m-0 mt-2.5 font-sans text-[0.85rem] leading-relaxed text-[var(--text-dim)]">{tier.tagline}</p>

                <ul className="m-0 mt-7 flex flex-1 list-none flex-col gap-3 p-0">
                  {tier.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 font-sans text-[0.84rem] leading-snug text-[var(--text)]">
                      <span className="mt-[3px] shrink-0 font-mono text-[0.78rem]" style={{ color: "var(--accent)" }}>
                        &#9656;
                      </span>
                      {f}
                    </li>
                  ))}
                </ul>

                <Link
                  href={tier.cta === "Contact sales" ? "mailto:hello@macropad.io" : "/app"}
                  className="mt-8 block border py-3 text-center font-sans text-[0.8rem] font-semibold uppercase tracking-wide transition-opacity hover:opacity-85"
                  style={
                    tier.featured
                      ? { background: "var(--accent)", borderColor: "var(--accent)", color: "#000" }
                      : { borderColor: "var(--border-strong)", color: "var(--text)" }
                  }
                >
                  {tier.cta}
                </Link>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-[820px] px-5 py-20 sm:px-8">
          <div className="eyebrow mb-3">FAQ</div>
          <h2 className="font-display m-0 text-[1.7rem] uppercase leading-[1.05] tracking-[-0.02em] sm:text-[2.1rem]">
            Questions, answered.
          </h2>

          <div className="mt-10 flex flex-col">
            {FAQ.map((item) => (
              <div key={item.q} className="border-t border-[var(--border)] py-6">
                <h3 className="m-0 text-[0.98rem] font-semibold">{item.q}</h3>
                <p className="m-0 mt-2.5 font-sans text-[0.87rem] leading-relaxed text-[var(--text-dim)]">{item.a}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
}
