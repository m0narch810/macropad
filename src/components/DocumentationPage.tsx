"use client";

import { useMemo, useState } from "react";
import type { MacroPanel } from "@/lib/macroData";
import { getIndicatorDoc } from "@/lib/indicatorDocs";

const HIDDEN_PANELS = new Set(["asset-news"]);

interface SearchRow {
  id: string;
  name: string;
  panelTitle: string;
  note: string;
  source: string;
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
        source: s.source,
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
        r.source.toLowerCase().includes(q) ||
        r.doc.toLowerCase().includes(q)
    );
  }, [index, query]);

  return (
    <div className="flex flex-col gap-10">
      <div>
        <Section title="What Macropad is">
          <p className="m-0">
            Macropad is a live macro desk. It pulls US macroeconomic data, Treasury yields, CFTC positioning,
            cross asset transmission ratios, geopolitical uncertainty measures, volatility indices, and scored
            news headlines into one place, and rolls all of it into a per asset directional bias. The goal is a
            single screen that replaces a spreadsheet full of manually updated series.
          </p>
        </Section>

        <Section title="Board">
          <p className="m-0">
            Board is the landing page inside the app. It shows every indicator across every panel as a dense,
            one line per row list, colored by whether the reading is bullish, bearish, or flat. Nothing here
            requires scrolling through separate pages. It is meant to be the page you check first, a full status
            read of the macro picture in one glance.
          </p>
        </Section>

        <Section title="Panel pages">
          <p className="m-0">
            Each panel groups related indicators: US Macroeconomics, Yield Rates, COT Positioning, Transmission
            Check, Geopolitics, and Volatility. Clicking a panel in the sidebar opens a detail view of every
            series inside it, including the full history chart, sparkline, and any extra stats attached to that
            series (for example the Sahm Rule reading attached to Unemployment, or the COT index attached to
            each positioning series).
          </p>
          <p className="m-0">
            Colors follow the same convention everywhere: green means the reading currently leans bullish for
            risk assets, red means it leans bearish, and gray or dim means the reading is flat or has no strong
            lean right now. The bias for a series is not simply whether the number went up or down, it depends
            on the indicator. A rising unemployment rate is read as bearish even though the number itself is
            going up, because what matters is what the number means for the economy, not its direction alone.
          </p>
        </Section>

        <Section title="Signal scores and thresholds">
          <p className="m-0">
            Most series carry a signal score from negative 1 to positive 1, shown as the colored bar or number
            near each indicator. This is not a statistical z-score despite living in a field with that name
            historically. It is a method based score computed one of a few ways depending on what kind of
            indicator it is: momentum based (is it moving up or down relative to its own recent history),
            positioning based (used for COT series, where it reflects how crowded a position is within its own
            multi year range), anchor based (distance from a fixed target, like inflation versus the 2 percent
            target), or threshold based (distance from a fixed trigger level, like the Sahm Rule's 0.50 point
            recession threshold).
          </p>
          <p className="m-0">
            A score near 0 means the indicator is near its neutral zone. A score approaching positive 1 or
            negative 1 means the indicator is at an extreme relative to the method it is being judged by. The
            window label under each indicator's value tells you the lookback period and method used, for
            example 3y daily, momentum 20d, which means the score is computed over a 3 year daily history using
            20 day momentum.
          </p>
        </Section>

        <Section title="News and sentiment scoring">
          <p className="m-0">
            The News page pools headlines from real macro and policy news desks (CNBC Economy, the Federal
            Reserve, WSJ Markets, Yahoo Finance, and FXStreet) rather than per ticker stock headlines. Each
            headline is scored by a finance specific keyword lexicon, a hand built dictionary of bullish and
            bearish financial terms with assigned weights, plus a negation check so that phrases like not
            rising flip the expected direction. Two word phrases such as rate cut or soft landing are matched
            before single words so they are not misread by one of their component words alone.
          </p>
          <p className="m-0">
            Raw scores are polarized, meaning mild scores are pulled toward neutral and strong scores are
            pushed further toward the extremes, so a headline with a genuinely clear lean reads clearly on the
            board instead of blending into the middle. The displayed sentiment number and the Sentiment over
            time chart both use a recency weighted average with an exponential half life, so a headline from
            the last hour moves the number more than a headline from yesterday, and the number naturally decays
            back toward neutral as headlines age out of relevance.
          </p>
          <p className="m-0">
            Switch between the General tab, pooled macro headlines, and per asset tabs for ticker specific
            headline sentiment on any of the tracked assets. The 3D scatter under each feed plots headlines by
            time on one axis and sentiment score on another, with color marking bullish, bearish, or neutral,
            so you can see clustering and shifts in tone at a glance without reading every headline.
          </p>
        </Section>

        <Section title="Custom Dashboard and Custom Bias">
          <p className="m-0">
            Custom Dashboard lets you pick any subset of indicators from across every panel and pin them
            together on one page, useful if you only care about a handful of series rather than the full board.
          </p>
          <p className="m-0">
            Custom Bias goes further: you choose your own set of indicators, assign your own weights to each
            one, and set your own thresholds for what counts as bullish or bearish. This produces a bias read
            specific to your own model of what matters, separate from the default bias logic used everywhere
            else in the app.
          </p>
        </Section>

        <Section title="Refresh and data currency">
          <p className="m-0">
            Data refreshes automatically on a schedule, and the sidebar shows the exact last synced time so you
            always know how current the board is. You never need to manually pull or import data yourself,
            everything is fetched and scored server side.
          </p>
        </Section>
      </div>

      <div className="border-t border-[var(--border)] pt-8">
        <h2 className="font-display m-0 mb-2 text-[1.15rem] uppercase leading-none tracking-[-0.01em]">
          Search by indicator
        </h2>
        <p className="m-0 mb-4 font-sans text-[0.84rem] leading-relaxed text-[var(--text-dim)]">
          Every metric on the board, explained: what it measures, where it comes from, and how to read it.
        </p>

        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search an indicator, e.g. VIX, unemployment, COT, breakeven"
          className="w-full rounded-md border px-3.5 py-2.5 font-sans text-[0.86rem] outline-none"
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
              <div className="mt-2.5 font-mono text-[0.66rem] uppercase tracking-wide text-[var(--text-faint)]">{r.source}</div>
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
