"use client";

import { useMemo, useState } from "react";
import type { MacroPanel } from "@/lib/macroData";
import { getIndicatorDoc } from "@/lib/indicatorDocs";

const HIDDEN_PANELS = new Set(["asset-news", "calendar"]);

interface SearchRow {
  id: string;
  name: string;
  panelTitle: string;
  note: string;
  doc: string;
}

function buildIndex(panels: MacroPanel[]): SearchRow[] {
  const rows: SearchRow[] = [];
  for (const panel of panels) {
    for (const s of panel.series) {
      if (s.id === "geo:news-feed" && panel.id !== "geopolitics") continue;
      rows.push({
        id: s.id,
        name: s.name,
        panelTitle: HIDDEN_PANELS.has(panel.id) ? "Asset News" : panel.title,
        note: s.note,
        doc: getIndicatorDoc(s.id, s.note),
      });
    }
  }
  return rows;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-[var(--border)] py-8">
      <h2 className="font-display m-0 mb-4 text-[1.15rem] uppercase leading-none tracking-[-0.01em]">{title}</h2>
      <div className="flex flex-col gap-3 font-sans text-[0.86rem] leading-relaxed text-[var(--text-dim)]">{children}</div>
    </div>
  );
}

export default function DocumentationPage({ panels }: { panels: MacroPanel[] }) {
  const [query, setQuery] = useState("");
  const index = useMemo(() => buildIndex(panels), [panels]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return index;
    return index.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.panelTitle.toLowerCase().includes(q) ||
        r.note.toLowerCase().includes(q) ||
        r.doc.toLowerCase().includes(q)
    );
  }, [index, query]);

  return (
    <div className="flex flex-col gap-10">
      <div>
        <Section title="What YYY Terminal is">
          <p className="m-0">
            YYY Terminal is a macro desk on one screen. It tracks the indicators that drive risk assets across
            six areas, US macro, rates, futures positioning, cross asset transmission, geopolitics, and
            volatility, scores each one for direction and strength, and rolls the whole set into a composite
            bias you can inspect and replay. Everything on this page is about how to use it.
          </p>
        </Section>

        <Section title="The Board">
          <p className="m-0">
            Board is the first page you land on. Every indicator appears as one compact tile: the name, the
            current value, and its signal score, colored by which way it leans. It is built to be read top to
            bottom in one pass, a full status check of the macro picture in under a minute. Tiles with a
            strong reading carry a colored edge on their left side so the loudest signals catch your eye
            first. Hover any tile for a one line explanation of what the reading means right now.
          </p>
        </Section>

        <Section title="How to read the colors and scores">
          <p className="m-0">
            One convention runs through the entire desk. Green means the reading currently leans bullish for
            risk assets, red means it leans bearish, and gray or dim means it is flat or has no strong lean.
            Next to most readings you will see a score between -1 and +1: the sign is the lean, the size is
            the conviction. A score near zero is a shrug; a score past 0.5 is worth your attention.
          </p>
          <p className="m-0">
            The lean is about meaning, not arithmetic direction. A rising unemployment rate reads bearish
            even though the number went up, because what matters is what the move implies for the economy.
            Each indicator is judged the way that fits it: some against a long run anchor, some against a
            threshold like curve inversion, some by their own pace, and positioning by how stretched it is
            within its range.
          </p>
        </Section>

        <Section title="Panel pages">
          <p className="m-0">
            The sidebar splits the board into panels: US Macroeconomics, Yield Rates, COT Positioning,
            Transmission Check, Geopolitics, and Volatility. Open a panel and every series in it becomes an
            expandable row showing the name, current value, and score. Click a row to expand it: you get the
            full price history, a chart of the reading over time, and the specialized stats that matter for
            that particular series. Use the panels when the Board flags something and you want the story
            behind the number.
          </p>
        </Section>

        <Section title="Macro Bias">
          <p className="m-0">
            Macro Bias is the desk&apos;s composite read. It rolls every scored indicator into one overall
            risk-on or risk-off verdict, then breaks it into pillars, growth, inflation, liquidity, rates,
            credit, positioning, and volatility, so you can see exactly what is driving the call. Each pillar
            expands into the individual indicators behind it with their contribution.
          </p>
          <p className="m-0">
            Two controls shape the read. The timeframe selector sets the lookback, from one day out to two
            years, so you can ask what changed this week or what the regime looks like on a one year view.
            The asset scope reweights the read toward the indicators that matter most for equities, rates,
            the dollar, or commodities. The same board can lean risk-on for equities and risk-off for the
            dollar; the scope control is how you ask the question precisely.
          </p>
        </Section>

        <Section title="Replay">
          <p className="m-0">
            Replay recomputes the macro bias as of past dates and charts how the read evolved into today.
            Use it to see whether the current lean is fresh or has been building for months, and to sanity
            check the desk against periods you remember trading. If the bias flipped somewhere, Replay shows
            you when.
          </p>
        </Section>

        <Section title="Regime Fingerprint">
          <p className="m-0">
            Regime Fingerprint treats today&apos;s pillar scores as a profile and searches history for the
            dates that looked most similar. The radar chart shows the current shape of the regime, the match
            list shows when markets last looked like this, and you can pull a full report for any date to
            compare it side by side with now. It answers the question every discretionary trader asks:
            when have we seen this before?
          </p>
        </Section>

        <Section title="News and sentiment">
          <p className="m-0">
            The News page has a General tab and one tab per tracked asset. The General tab pools macro and
            policy headlines and scores each one for bullish or bearish tone. The displayed sentiment number
            is recency weighted: a headline from the last few hours moves it far more than one from
            yesterday, and the number decays back toward neutral as headlines age out.
          </p>
          <p className="m-0">
            The asset tabs work differently, and this is the part worth internalizing. They are not built
            from headlines. Each asset has a defined set of indicators that actually move it, and each fresh
            indicator reading becomes a dated, scored event in the feed, tagged DATA. Matching headlines are
            merged in on top for color, but they are the supplement, not the source of the number. That is
            why every asset has a real read even on a day when nobody publishes about it.
          </p>
          <p className="m-0">
            Treat headline sentiment as a directional read across many items rather than a verdict on any
            single one. DATA tagged events are the firmer signal, since they come straight from indicator
            readings. The scatter under each feed plots every item by time and score so you can see
            clustering and shifts in tone at a glance.
          </p>
        </Section>

        <Section title="Calendar">
          <p className="m-0">
            The Calendar lists upcoming and recent release dates for the indicators the board tracks, with
            an importance flag on each. Released entries show the new reading next to the prior one, so you
            get an instant better-or-worse read. Check it in the morning to know what is about to hit the
            board.
          </p>
        </Section>

        <Section title="Freshness">
          <p className="m-0">
            Everything refreshes automatically on a daily schedule; there is nothing to import, connect, or
            configure. The sidebar shows the exact last synced time, so you always know how current the
            board is.
          </p>
        </Section>
      </div>

      <div className="border-t border-[var(--border)] pt-8">
        <h2 className="font-display m-0 mb-2 text-[1.15rem] uppercase leading-none tracking-[-0.01em]">
          Look up an indicator
        </h2>
        <p className="m-0 mb-4 font-sans text-[0.84rem] leading-relaxed text-[var(--text-dim)]">
          Every series on the board, explained in plain language: what it measures and how to read it.
        </p>

        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search an indicator, e.g. VIX, unemployment, breakeven"
          className="w-full rounded-md border px-3.5 py-2.5 font-sans text-[16px] outline-none sm:text-[0.86rem]"
          style={{ borderColor: "var(--border-strong)", background: "var(--panel)", color: "var(--text)" }}
        />

        <div className="mt-2 font-mono text-[0.68rem] text-[var(--text-faint)]">
          {results.length} {results.length === 1 ? "match" : "matches"}
        </div>

        <div className="mt-4 flex flex-col gap-3">
          {results.map((r) => (
            <div key={r.id} className="border border-[var(--border)] px-4 py-3.5">
              <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                <h3 className="m-0 text-[0.95rem] font-semibold text-[var(--text)]">{r.name}</h3>
                <span className="eyebrow" style={{ color: "var(--accent)" }}>{r.panelTitle}</span>
              </div>
              <p className="m-0 mt-2 font-sans text-[0.84rem] leading-relaxed text-[var(--text-dim)]">{r.doc}</p>
            </div>
          ))}
          {results.length === 0 && (
            <p className="m-0 font-sans text-[0.85rem] text-[var(--text-faint)]">No indicator matches that search.</p>
          )}
        </div>
      </div>
    </div>
  );
}
