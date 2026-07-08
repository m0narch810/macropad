"use client";

import { useEffect, useState } from "react";
import type { MacroPanel } from "@/lib/macroData";
import type { MarketRow } from "@/lib/getMarkets";
import SeriesCard from "@/components/SeriesCard";
import QuantCard from "@/components/QuantCard";
import NewsFeedCard from "@/components/NewsFeedCard";
import MarketTicker from "@/components/MarketTicker";
import PanelIcon from "@/components/PanelIcon";
import AsciiLogo from "@/components/AsciiLogo";
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

function NavButton({
  isActive,
  onClick,
  icon,
  title,
  subtitle,
}: {
  isActive: boolean;
  onClick: () => void;
  icon: string;
  title: string;
  subtitle: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="group relative flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-left font-sans transition-all duration-150"
      style={
        isActive
          ? {
              background: "color-mix(in srgb, var(--accent) 11%, transparent)",
              boxShadow: "inset 0 0 0 1px color-mix(in srgb, var(--accent) 30%, transparent)",
            }
          : undefined
      }
    >
      {isActive && (
        <span
          className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full"
          style={{ background: "var(--accent)" }}
        />
      )}
      <PanelIcon id={icon} className="shrink-0 transition-colors" style={{ color: isActive ? "var(--accent)" : "var(--text-faint)" }} />
      <div className="min-w-0 flex-1">
        <div
          className={`truncate text-[0.85rem] font-semibold transition-colors ${
            isActive ? "text-[var(--text)]" : "text-[var(--text-dim)] group-hover:text-[var(--text)]"
          }`}
        >
          {title}
        </div>
        <div className="mt-0.5 text-[0.66rem] text-[var(--text-faint)]">{subtitle}</div>
      </div>
    </button>
  );
}

/** Sticky page header so the context survives scrolling through dense lists. */
function PageHead({ title, meta }: { title: string; meta?: React.ReactNode }) {
  return (
    <header
      className="sticky top-0 z-20 -mx-4 mb-6 flex items-baseline gap-3 border-b border-[var(--border)] px-4 py-3 backdrop-blur-md sm:-mx-6 sm:px-6 lg:-mx-9 lg:px-9"
      style={{ background: "color-mix(in srgb, var(--bg) 84%, transparent)" }}
    >
      <h1 className="font-display m-0 text-balance text-[1.35rem] font-semibold leading-none">{title}</h1>
      {meta && <span className="font-mono text-[0.66rem] text-[var(--text-faint)]">{meta}</span>}
    </header>
  );
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
  const [navOpen, setNavOpen] = useState(false);
  const active = panels.find((p) => p.id === activeId);
  const pickPage = (id: string) => {
    setActiveId(id);
    setFocusSeriesId(null);
    setNavOpen(false);
  };
  const openFromBoard = (panelId: string, seriesId: string) => {
    setActiveId(panelId);
    setFocusSeriesId(seriesId);
    setNavOpen(false);
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

  return (
    <div className="flex min-h-screen flex-col">
      <MarketTicker markets={markets} />

      <div className="flex items-center gap-3 border-b border-[var(--border)] bg-[var(--panel-2)] px-4 py-3 lg:hidden">
        <button
          onClick={() => setNavOpen((v) => !v)}
          aria-label="Toggle navigation"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[var(--border)] text-[var(--text-dim)]"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M2 4H14" />
            <path d="M2 8H14" />
            <path d="M2 12H14" />
          </svg>
        </button>
        <AsciiLogo tapeLength={10} className="flex items-baseline gap-2.5 [&>div:last-child]:mt-0" />
      </div>

      {navOpen && (
        <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setNavOpen(false)} aria-hidden="true" />
      )}

      <div className="flex flex-1">
        <aside
          className={`fixed inset-y-0 left-0 z-40 flex w-[248px] shrink-0 -translate-x-full flex-col overflow-y-auto border-r border-[var(--border)] bg-[var(--panel-2)] transition-transform duration-200 lg:static lg:translate-x-0 ${
            navOpen ? "translate-x-0" : ""
          }`}
        >
          <div className="hidden border-b border-[var(--border)] px-5 py-5 lg:block">
            <AsciiLogo tapeLength={18} />
          </div>

          <div className="border-b border-[var(--border)] px-3.5 py-3.5">
            <label className="mb-1.5 block font-sans text-[0.64rem] font-semibold uppercase tracking-wide text-[var(--text-faint)]">
              Asset lens
            </label>
            <div className="relative">
              <select
                value={assetFilter}
                onChange={(e) => setAssetFilter(e.target.value)}
                className="w-full appearance-none rounded-md border px-3 py-2 pr-8 font-sans text-[0.82rem] font-medium outline-none"
                style={{
                  borderColor: assetFilter ? "color-mix(in srgb, var(--accent) 45%, transparent)" : "var(--border)",
                  background: assetFilter ? "color-mix(in srgb, var(--accent) 10%, transparent)" : "var(--panel)",
                  color: assetFilter ? "var(--accent)" : "var(--text-dim)",
                }}
              >
                <option value="">All indicators</option>
                {MARKET_SYMBOLS.map((m) => (
                  <option key={m.symbol} value={m.symbol}>
                    {m.label}
                  </option>
                ))}
              </select>
              <svg
                width="12"
                height="12"
                viewBox="0 0 16 16"
                fill="none"
                className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2"
                style={{ color: assetFilter ? "var(--accent)" : "var(--text-faint)" }}
              >
                <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            {assetFilter && (
              <p className="m-0 mt-1.5 font-sans text-[0.68rem] leading-snug text-[var(--text-faint)]">
                Indicators with no mapped impact on {assetLabel} are dimmed below.
              </p>
            )}
          </div>

          <nav className="flex flex-1 flex-col gap-1 p-3">
            <NavButton
              isActive={isBoard}
              onClick={() => pickPage(BOARD_ID)}
              icon="board"
              title="The Board"
              subtitle="every series · one screen"
            />
            <NavButton isActive={isNews} onClick={() => pickPage(NEWS_ID)} icon="news" title="News" subtitle="headline sentiment" />
            {panels.map((panel) => {
              const { bull, bear } = panelSignals(panel);
              return (
                <NavButton
                  key={panel.id}
                  isActive={panel.id === activeId}
                  onClick={() => pickPage(panel.id)}
                  icon={panel.id}
                  title={panel.title}
                  subtitle={
                    bull + bear === 0 ? (
                      "no strong reads"
                    ) : (
                      <span className="font-mono">
                        {bull > 0 && <span className="text-[var(--up)]">{bull} bull</span>}
                        {bull > 0 && bear > 0 && " · "}
                        {bear > 0 && <span className="text-[var(--down)]">{bear} bear</span>}
                        <span> strong</span>
                      </span>
                    )
                  }
                />
              );
            })}

            <div className="my-2 border-t border-[var(--border)]" />

            <NavButton
              isActive={isCustomDashboard}
              onClick={() => pickPage(CUSTOM_DASHBOARD_ID)}
              icon="custom-dashboard"
              title="Custom Dashboard"
              subtitle="pick your own indicators"
            />
            <NavButton
              isActive={isCustomBias}
              onClick={() => pickPage(CUSTOM_BIAS_ID)}
              icon="custom-bias"
              title="Custom Bias"
              subtitle="your own weights + thresholds"
            />
          </nav>

          <div className="whitespace-nowrap border-t border-[var(--border)] px-4 py-3 font-mono text-[0.64rem] text-[var(--text-faint)]">
            {totalSeries} series │ {lastUpdated ? `synced ${new Date(lastUpdated).toLocaleTimeString()}` : "not synced"} │{" "}
            <span className="blink-cursor text-[var(--accent)]">▊</span>
          </div>
        </aside>

        <main className="dotgrid min-w-0 flex-1 px-4 pb-6 sm:px-6 lg:px-9 lg:pb-8">
          {isBoard ? (
            <>
              <PageHead
                title="The Board"
                meta={
                  <>
                    {totalSeries} series ·{" "}
                    <span className="text-[var(--up)]">{totals.bull}▲</span>{" "}
                    <span className="text-[var(--down)]">{totals.bear}▼</span> strong
                  </>
                }
              />
              <OverviewBoard panels={panels} assetFilter={assetFilter || null} onOpen={openFromBoard} />
            </>
          ) : isNews ? (
            <>
              <PageHead title="News" />
              {newsSeries ? <NewsFeedCard series={newsSeries} /> : <p className="font-sans text-[0.85rem] text-[var(--text-faint)]">No news data yet.</p>}
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
                  .map((series) =>
                    DEEP_PANELS.has(active.id) ? (
                      <div key={series.id} id={`card-${series.id}`} className="scroll-mt-16">
                        <QuantCard
                          series={series}
                          markets={markets}
                          assetFilter={assetFilter || null}
                          assetLabel={assetLabel}
                          defaultOpen={focusSeriesId === series.id}
                        />
                      </div>
                    ) : (
                      <div key={series.id} id={`card-${series.id}`} className="scroll-mt-16">
                        <SeriesCard series={series} assetFilter={assetFilter || null} assetLabel={assetLabel} />
                      </div>
                    )
                  )}
              </div>
            </>
          ) : null}
        </main>
      </div>
    </div>
  );
}
