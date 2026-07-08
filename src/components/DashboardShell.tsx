"use client";

import { useEffect, useState } from "react";
import type { MacroPanel } from "@/lib/macroData";
import type { MarketRow } from "@/lib/getMarkets";
import SeriesCard from "@/components/SeriesCard";
import QuantCard from "@/components/QuantCard";
import NewsFeedCard from "@/components/NewsFeedCard";
import MarketTicker from "@/components/MarketTicker";
import TerminalHero from "@/components/TerminalHero";
import OverviewBoard from "@/components/OverviewBoard";
import CustomDashboardPage from "@/components/CustomDashboardPage";
import CustomBiasPage from "@/components/CustomBiasPage";
import { MARKET_SYMBOLS } from "@/lib/markets";
import { getSignTone } from "@/lib/bias";

const DEEP_PANELS = new Set(["us-macro", "yield-rates", "cot-positioning", "transmission", "geopolitics"]);
const BOARD_ID = "board";
const NEWS_ID = "news";
const CUSTOM_DASHBOARD_ID = "custom-dashboard";
const CUSTOM_BIAS_ID = "custom-bias";

/** tmux-style short window names for the tab bar. */
const SHORT_LABEL: Record<string, string> = {
  "us-macro": "macro",
  "yield-rates": "rates",
  "cot-positioning": "cot",
  transmission: "transmission",
  geopolitics: "geo-vol",
};

/** Count of strong reads (|score| >= 0.5 on the -1..1 method scale) per panel, split by good/bad tone. */
function panelSignals(panel: MacroPanel): { bull: number; bear: number } {
  let bull = 0;
  let bear = 0;
  for (const s of panel.series) {
    if (s.zscore === null || Math.abs(s.zscore) < 0.5) continue;
    const tone = getSignTone(s.id, s.zscore);
    if (tone === "up") bull++;
    else if (tone === "down") bear++;
  }
  return { bull, bear };
}

function Tab({
  index,
  label,
  isActive,
  onClick,
  bull,
  bear,
}: {
  index: number;
  label: string;
  isActive: boolean;
  onClick: () => void;
  bull?: number;
  bear?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 font-mono text-[0.72rem] transition-colors ${
        isActive
          ? "border-[var(--accent)] text-[var(--accent)] glow"
          : "border-transparent text-[var(--text-dim)] hover:text-[var(--text)]"
      }`}
    >
      <span className={isActive ? "text-[var(--accent)]" : "text-[var(--text-faint)]"}>{index}:</span>
      {label}
      {(bull ?? 0) + (bear ?? 0) > 0 && (
        <span className="hidden text-[0.62rem] lg:inline">
          {bull ? <span className="text-[var(--up)]">{bull}▲</span> : null}
          {bear ? <span className="text-[var(--down)]">{bear}▼</span> : null}
        </span>
      )}
    </button>
  );
}

function PageHead({ title, meta }: { title: string; meta?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-baseline gap-3">
      <h1 className="font-display m-0 text-[1.1rem] leading-none text-[var(--accent)] glow">{title}</h1>
      {meta && <span className="font-mono text-[0.66rem] text-[var(--text-faint)]">{meta}</span>}
    </div>
  );
}

/** Live UTC-naive local clock for the statusline; blank until mounted so SSR matches. */
function Clock() {
  const [t, setT] = useState("");
  useEffect(() => {
    const tick = () => setT(new Date().toLocaleTimeString("en-US", { hour12: false }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return <span className="font-mono tabular-nums">{t}</span>;
}

export default function DashboardShell({
  panels,
  lastUpdated,
  markets,
}: {
  panels: MacroPanel[];
  lastUpdated: string | null;
  markets: MarketRow[];
}) {
  const [activeId, setActiveId] = useState<string>(BOARD_ID);
  const [focusSeriesId, setFocusSeriesId] = useState<string | null>(null);
  const [assetFilter, setAssetFilter] = useState<string>("");
  const active = panels.find((p) => p.id === activeId);

  const pickPage = (id: string) => {
    setActiveId(id);
    setFocusSeriesId(null);
  };
  const openFromBoard = (panelId: string, seriesId: string) => {
    setActiveId(panelId);
    setFocusSeriesId(seriesId);
  };

  useEffect(() => {
    if (!focusSeriesId) return;
    const t = setTimeout(() => {
      document.getElementById(`card-${focusSeriesId}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 90);
    return () => clearTimeout(t);
  }, [focusSeriesId, activeId]);

  const isBoard = activeId === BOARD_ID;
  const isNews = activeId === NEWS_ID;
  const isCustomDashboard = activeId === CUSTOM_DASHBOARD_ID;
  const isCustomBias = activeId === CUSTOM_BIAS_ID;
  const assetLabel = MARKET_SYMBOLS.find((m) => m.symbol === assetFilter)?.label ?? null;
  const newsSeries = panels.flatMap((p) => p.series).find((s) => s.id === "geo:news-feed") ?? null;

  const totalSeries = panels.reduce((n, p) => n + p.series.length, 0);
  const totals = panels.reduce(
    (acc, p) => {
      const { bull, bear } = panelSignals(p);
      return { bull: acc.bull + bull, bear: acc.bear + bear };
    },
    { bull: 0, bear: 0 }
  );

  const tabs: { id: string; label: string; bull?: number; bear?: number }[] = [
    { id: BOARD_ID, label: "board" },
    { id: NEWS_ID, label: "news" },
    ...panels.map((p) => ({ id: p.id, label: SHORT_LABEL[p.id] ?? p.id, ...panelSignals(p) })),
    { id: CUSTOM_DASHBOARD_ID, label: "custom-dash" },
    { id: CUSTOM_BIAS_ID, label: "custom-bias" },
  ];

  return (
    <div className="relative z-[1] flex min-h-screen flex-col pb-8">
      <TerminalHero seriesCount={totalSeries} bull={totals.bull} bear={totals.bear} lastUpdated={lastUpdated} />

      <MarketTicker markets={markets} />

      <div className="sticky top-0 z-30 flex items-stretch gap-1 border-b border-[var(--border)] bg-[var(--panel-2)] pr-2">
        <nav className="no-scrollbar flex flex-1 items-stretch overflow-x-auto px-1">
          {tabs.map((t, i) => (
            <Tab
              key={t.id}
              index={i}
              label={t.label}
              isActive={activeId === t.id}
              onClick={() => pickPage(t.id)}
              bull={t.bull}
              bear={t.bear}
            />
          ))}
        </nav>
        <div className="flex shrink-0 items-center py-1.5">
          <select
            value={assetFilter}
            onChange={(e) => setAssetFilter(e.target.value)}
            aria-label="Asset lens"
            className="appearance-none border px-2 py-1 font-mono text-[0.68rem] outline-none"
            style={{
              borderColor: assetFilter ? "color-mix(in srgb, var(--accent) 55%, transparent)" : "var(--border)",
              background: assetFilter ? "color-mix(in srgb, var(--accent) 12%, transparent)" : "var(--panel)",
              color: assetFilter ? "var(--accent)" : "var(--text-dim)",
            }}
          >
            <option value="">lens: all</option>
            {MARKET_SYMBOLS.map((m) => (
              <option key={m.symbol} value={m.symbol}>
                lens: {m.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <main className="dotgrid min-w-0 flex-1 px-4 py-5 sm:px-6 lg:px-8">
        {isBoard ? (
          <>
            <PageHead
              title="The Board"
              meta={
                <>
                  {totalSeries} series · <span className="text-[var(--up)]">{totals.bull}▲</span>{" "}
                  <span className="text-[var(--down)]">{totals.bear}▼</span> strong
                  {assetFilter && <> · lens {assetLabel}</>}
                </>
              }
            />
            <OverviewBoard panels={panels} assetFilter={assetFilter || null} onOpen={openFromBoard} />
          </>
        ) : isNews ? (
          <>
            <PageHead title="News" />
            {newsSeries ? (
              <NewsFeedCard series={newsSeries} />
            ) : (
              <p className="font-sans text-[0.85rem] text-[var(--text-faint)]">No news data yet.</p>
            )}
          </>
        ) : isCustomDashboard ? (
          <>
            <PageHead title="Custom Dashboard" />
            <CustomDashboardPage panels={panels} markets={markets} />
          </>
        ) : isCustomBias ? (
          <>
            <PageHead title="Custom Bias" />
            <CustomBiasPage panels={panels} />
          </>
        ) : active ? (
          <>
            <PageHead
              title={active.title}
              meta={(() => {
                const { bull, bear } = panelSignals(active);
                return bull + bear === 0 ? (
                  "no strong reads"
                ) : (
                  <>
                    <span className="text-[var(--up)]">{bull}▲</span> <span className="text-[var(--down)]">{bear}▼</span> strong
                  </>
                );
              })()}
            />

            <div className={DEEP_PANELS.has(active.id) ? "flex flex-col gap-2" : "grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"}>
              {active.series
                .filter((series) => series.id !== "geo:news-feed")
                .map((series) => (
                  <div key={series.id} id={`card-${series.id}`} className="scroll-mt-16">
                    {DEEP_PANELS.has(active.id) ? (
                      <QuantCard
                        series={series}
                        markets={markets}
                        assetFilter={assetFilter || null}
                        assetLabel={assetLabel}
                        defaultOpen={focusSeriesId === series.id}
                      />
                    ) : (
                      <SeriesCard series={series} assetFilter={assetFilter || null} assetLabel={assetLabel} />
                    )}
                  </div>
                ))}
            </div>
          </>
        ) : null}
      </main>

      <footer className="fixed inset-x-0 bottom-0 z-40 flex h-8 items-center gap-x-4 overflow-hidden border-t border-[var(--border)] bg-[var(--panel-2)] px-3 font-mono text-[0.66rem] text-[var(--text-dim)]">
        <span className="font-bold tracking-[0.08em] text-[var(--accent)]">MACROPAD</span>
        <span className="hidden sm:inline">{totalSeries} series</span>
        <span>
          <span className="text-[var(--up)]">{totals.bull}▲</span> <span className="text-[var(--down)]">{totals.bear}▼</span>
        </span>
        <span className="hidden md:inline">
          synced {lastUpdated ? new Date(lastUpdated).toLocaleTimeString("en-US", { hour12: false }) : "never"}
        </span>
        <span className="ml-auto flex items-center gap-1.5">
          <Clock />
          <span className="blink-cursor text-[var(--accent)]">▊</span>
        </span>
      </footer>
    </div>
  );
}
