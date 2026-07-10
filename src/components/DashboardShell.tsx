"use client";

import { useEffect, useState } from "react";
import type { MacroPanel } from "@/lib/macroData";
import type { MarketRow } from "@/lib/getMarkets";
import SeriesCard from "@/components/SeriesCard";
import QuantCard from "@/components/QuantCard";
import NewsFeedCard from "@/components/NewsFeedCard";
import MarketTicker from "@/components/MarketTicker";
import IndicatorTicker from "@/components/IndicatorTicker";
import PanelIcon from "@/components/PanelIcon";
import MacroBiasPage from "@/components/MacroBiasPage";
import ReplayPage from "@/components/ReplayPage";
import RegimeFingerprintPage from "@/components/RegimeFingerprintPage";
import CalendarPage from "@/components/CalendarPage";
import BoardPage from "@/components/BoardPage";
import DocumentationPage from "@/components/DocumentationPage";
import { MARKET_SYMBOLS } from "@/lib/markets";
import { getSignTone } from "@/lib/bias";
import SignOutButton from "@/components/marketing/SignOutButton";
import BrandMark from "@/components/fx/BrandMark";
import AsciiContour from "@/components/fx/AsciiContour";
import SettingsPanel from "@/components/SettingsPanel";
import { loadNavOrder, saveNavOrder, moveItem, type NavOrderState } from "@/lib/navOrder";

const DEEP_PANELS = new Set(["us-macro", "yield-rates", "cot-positioning", "transmission", "geopolitics", "volatility"]);
/** Catalogue-only panels - carry data (e.g. per-asset news) but never show up as their own nav entry. */
const HIDDEN_PANELS = new Set(["asset-news", "calendar"]);
const BOARD_ID = "board";
const NEWS_ID = "news";
const MACRO_BIAS_ID = "macro-bias";
const REPLAY_ID = "replay";
const FINGERPRINT_ID = "fingerprint";
const CALENDAR_ID = "calendar";
const DOCS_ID = "docs";

const SHORT_LABEL: Record<string, string> = {
  "us-macro": "US MACRO",
  "yield-rates": "RATES",
  "cot-positioning": "COT",
  transmission: "TRANSMISSION",
  geopolitics: "GEOPOLITICS",
  volatility: "VOLATILITY",
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

/** Brand mark + wordmark; the one always-on ambient animation in the chrome. */
function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex select-none items-center gap-2.5 whitespace-nowrap">
      <BrandMark size={compact ? 18 : 22} className="shrink-0" />
      <span className={`font-mono font-bold tracking-[0.2em] text-[var(--text)] ${compact ? "text-[0.8rem]" : "text-[0.88rem]"}`}>
        MACROPAD<span className="blink-cursor text-[var(--text-faint)]">_</span>
      </span>
    </span>
  );
}

/** Title text that resolves out of a short character scramble whenever it changes. */
function Scramble({ text }: { text: string }) {
  const [txt, setTxt] = useState(text);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setTxt(text);
      return;
    }
    const CH = "<>/#%*+=?";
    let frame = 0;
    const id = setInterval(() => {
      frame++;
      const reveal = Math.floor((frame * text.length) / 12);
      if (reveal >= text.length) {
        setTxt(text);
        clearInterval(id);
        return;
      }
      setTxt(
        text
          .split("")
          .map((c, i) => (c === " " || i <= reveal ? c : CH[Math.floor(Math.random() * CH.length)]))
          .join("")
      );
    }, 28);
    return () => clearInterval(id);
  }, [text]);
  return <>{txt}</>;
}

/** Live local clock for the statusline; blank until mounted so SSR matches. */
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

function NavItem({
  index,
  id,
  label,
  isActive,
  onClick,
  bull,
  bear,
  reorder,
}: {
  index: number;
  id: string;
  label: string;
  isActive: boolean;
  onClick: () => void;
  bull?: number;
  bear?: number;
  reorder?: { canMoveUp: boolean; canMoveDown: boolean; onMoveUp: () => void; onMoveDown: () => void };
}) {
  return (
    <div
      className={`group relative flex w-full items-center gap-3 px-4 py-[9px] text-left font-mono text-[0.7rem] tracking-wide transition-colors duration-150 ${
        isActive && !reorder ? "bg-[var(--panel-2)] text-[var(--text)]" : "text-[var(--text-faint)]"
      } ${reorder ? "" : "hover:text-[var(--text-dim)]"}`}
    >
      {isActive && !reorder && <span className="absolute left-0 top-1/2 h-4 w-px -translate-y-1/2 bg-[var(--text)]" />}
      <button onClick={onClick} disabled={!!reorder} className="flex min-w-0 flex-1 items-center gap-3 text-left disabled:cursor-default">
        <span className="w-4 shrink-0 text-[0.56rem] text-[var(--text-faint)]">{String(index).padStart(2, "0")}</span>
        <PanelIcon id={id} className="shrink-0" style={{ color: isActive && !reorder ? "var(--text)" : "var(--text-faint)" }} />
        <span className="min-w-0 flex-1 truncate">{label}</span>
      </button>
      {!reorder && (bull ?? 0) + (bear ?? 0) > 0 && (
        <span className="shrink-0 text-[0.6rem]">
          {bull ? <span className="text-[var(--up)]">{bull}▲</span> : null}
          {bear ? <span className="text-[var(--down)]">{bear}▼</span> : null}
        </span>
      )}
      {reorder && (
        <span className="flex shrink-0 gap-1">
          <button
            onClick={reorder.onMoveUp}
            disabled={!reorder.canMoveUp}
            aria-label={`Move ${label} up`}
            className="flex h-5 w-5 items-center justify-center rounded text-[var(--text-faint)] transition-colors hover:text-[var(--text)] disabled:opacity-25 disabled:hover:text-[var(--text-faint)]"
          >
            ▲
          </button>
          <button
            onClick={reorder.onMoveDown}
            disabled={!reorder.canMoveDown}
            aria-label={`Move ${label} down`}
            className="flex h-5 w-5 items-center justify-center rounded text-[var(--text-faint)] transition-colors hover:text-[var(--text)] disabled:opacity-25 disabled:hover:text-[var(--text-faint)]"
          >
            ▼
          </button>
        </span>
      )}
    </div>
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
  const [activeId, setActiveId] = useState(BOARD_ID);
  const [navOpen, setNavOpen] = useState(false);
  const [newsAssetTab, setNewsAssetTab] = useState<string>(""); // "" = general macro feed
  const visiblePanels = panels.filter((p) => !HIDDEN_PANELS.has(p.id));
  const active = visiblePanels.find((p) => p.id === activeId);
  const pickPage = (id: string) => {
    setActiveId(id);
    setNavOpen(false);
  };

  // Reorderable nav: Board and Docs stay pinned as structural anchors; News +
  // indicator panels (group A) and the analysis pages (group B) each have
  // their own persisted order so a reorder never mixes the two families.
  const defaultGroupA = [NEWS_ID, ...visiblePanels.map((p) => p.id)];
  const defaultGroupB = [MACRO_BIAS_ID, REPLAY_ID, FINGERPRINT_ID, CALENDAR_ID];
  const [navOrder, setNavOrder] = useState<NavOrderState>({ a: defaultGroupA, b: defaultGroupB });
  const [customizingNav, setCustomizingNav] = useState(false);

  useEffect(() => {
    setNavOrder(loadNavOrder(defaultGroupA, defaultGroupB));
    // Only reconcile against the default shape once on mount - re-running on
    // every panels re-render would fight a user's in-progress reorder.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function reorderGroup(group: "a" | "b", id: string, dir: -1 | 1) {
    setNavOrder((prev) => {
      const next = { ...prev, [group]: moveItem(prev[group], id, dir) };
      saveNavOrder(next);
      return next;
    });
  }
  const isBoard = activeId === BOARD_ID;
  const isNews = activeId === NEWS_ID;
  const isMacroBias = activeId === MACRO_BIAS_ID;
  const isReplay = activeId === REPLAY_ID;
  const isFingerprint = activeId === FINGERPRINT_ID;
  const isCalendar = activeId === CALENDAR_ID;
  const isDocs = activeId === DOCS_ID;
  const allSeries = panels.flatMap((p) => p.series);
  const newsSeries = allSeries.find((s) => s.id === "geo:news-feed") ?? null;
  const activeNewsSeries = newsAssetTab
    ? allSeries.find((s) => s.id === `asset-news:${newsAssetTab}`) ?? null
    : newsSeries;
  const boardNewsSeries = [
    newsSeries,
    ...MARKET_SYMBOLS.map((m) => allSeries.find((s) => s.id === `asset-news:${m.symbol}`) ?? null),
  ].filter((s): s is NonNullable<typeof s> => s !== null);
  const tickerSeries = visiblePanels.flatMap((p) => p.series).filter((s) => s.id !== "geo:news-feed");
  const indicatorCount = visiblePanels.reduce((n, p) => n + p.series.filter((s) => s.id !== "geo:news-feed").length, 0);
  const strongReads = visiblePanels.reduce(
    (acc, p) => {
      const s = panelSignals(p);
      acc.bull += s.bull;
      acc.bear += s.bear;
      return acc;
    },
    { bull: 0, bear: 0 }
  );

  // Sequential nav indexing: board, news, panels, customs, docs.
  let navIndex = -1;
  const nextIndex = () => ++navIndex;

  interface NavEntryMeta {
    id: string;
    iconId: string;
    label: string;
    onClick: () => void;
    bull?: number;
    bear?: number;
  }
  function resolveGroupAEntry(id: string): NavEntryMeta | null {
    if (id === NEWS_ID) return { id: NEWS_ID, iconId: "news", label: "NEWS", onClick: () => pickPage(NEWS_ID) };
    const panel = visiblePanels.find((p) => p.id === id);
    if (!panel) return null;
    const { bull, bear } = panelSignals(panel);
    return { id: panel.id, iconId: panel.id, label: SHORT_LABEL[panel.id] ?? panel.title.toUpperCase(), onClick: () => pickPage(panel.id), bull, bear };
  }
  function resolveGroupBEntry(id: string): NavEntryMeta | null {
    switch (id) {
      case MACRO_BIAS_ID:
        return { id, iconId: "macro-bias", label: "MACRO BIAS", onClick: () => pickPage(MACRO_BIAS_ID) };
      case REPLAY_ID:
        return { id, iconId: "replay", label: "REPLAY", onClick: () => pickPage(REPLAY_ID) };
      case FINGERPRINT_ID:
        return { id, iconId: "fingerprint", label: "FINGERPRINT", onClick: () => pickPage(FINGERPRINT_ID) };
      case CALENDAR_ID:
        return { id, iconId: "calendar", label: "CALENDAR", onClick: () => pickPage(CALENDAR_ID) };
      default:
        return null;
    }
  }
  const groupAEntries = navOrder.a.map(resolveGroupAEntry).filter((e): e is NavEntryMeta => e !== null);
  const groupBEntries = navOrder.b.map(resolveGroupBEntry).filter((e): e is NavEntryMeta => e !== null);

  const pageTitle = isBoard
    ? "Board"
    : isNews
      ? "News"
      : isMacroBias
        ? "Macro Bias"
        : isReplay
          ? "Replay"
          : isFingerprint
            ? "Regime Fingerprint"
            : isCalendar
            ? "Calendar"
            : isDocs
            ? "Documentation"
            : active?.title ?? "";

  return (
    <div className="flex min-h-screen flex-col">
      <MarketTicker markets={markets} />
      <IndicatorTicker series={tickerSeries} />

      <div className="flex items-center gap-3 border-b border-[var(--border)] bg-[var(--panel)] px-4 py-3 lg:hidden">
        <button
          onClick={() => setNavOpen((v) => !v)}
          aria-label="Toggle navigation"
          className="flex h-8 w-8 shrink-0 items-center justify-center border border-[var(--border)] text-[var(--text-dim)]"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M2 4H14" />
            <path d="M2 8H14" />
            <path d="M2 12H14" />
          </svg>
        </button>
        <a href="/" className="flex items-center">
          <Wordmark compact />
        </a>
      </div>

      {navOpen && (
        <div className="fixed inset-0 z-30 bg-black/60 lg:hidden" onClick={() => setNavOpen(false)} aria-hidden="true" />
      )}

      <div className="flex flex-1">
        <aside
          className={`fixed inset-y-0 left-0 z-40 flex w-[236px] shrink-0 -translate-x-full flex-col overflow-y-auto border-r border-[var(--border)] bg-[var(--panel)] transition-transform duration-200 lg:static lg:translate-x-0 ${
            navOpen ? "translate-x-0" : ""
          }`}
          style={{ transitionTimingFunction: "var(--ease-out)" }}
        >
          <div className="relative hidden overflow-hidden border-b border-[var(--border)] px-4 pb-5 pt-6 lg:block">
            <AsciiContour className="pointer-events-none absolute inset-0 h-full w-full" cell={11} maxAlpha={0.14} />
            <a href="/" className="relative block">
              <Wordmark />
            </a>
            <div className="relative mt-3 flex items-center gap-1.5 eyebrow">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--up)] opacity-60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--up)]" />
              </span>
              {lastUpdated ? `synced ${new Date(lastUpdated).toLocaleTimeString()}` : "not yet synced"}
            </div>
          </div>

          <nav className="flex flex-1 flex-col py-3">
            {customizingNav && (
              <div className="mx-4 mb-2 rounded-md border border-[var(--border-strong)] bg-[var(--panel-2)] px-2.5 py-1.5 font-sans text-[0.66rem] text-[var(--text-dim)]">
                Drag order with the arrows - Board and Docs stay pinned.
              </div>
            )}
            <NavItem index={nextIndex()} id="board" label="BOARD" isActive={isBoard} onClick={() => pickPage(BOARD_ID)} />

            <div className="mx-4 my-2 border-t border-[var(--border)]" />

            {groupAEntries.map((entry, i) => (
              <NavItem
                key={entry.id}
                index={nextIndex()}
                id={entry.iconId}
                label={entry.label}
                isActive={entry.id === activeId}
                onClick={entry.onClick}
                bull={entry.bull}
                bear={entry.bear}
                reorder={
                  customizingNav
                    ? {
                        canMoveUp: i > 0,
                        canMoveDown: i < groupAEntries.length - 1,
                        onMoveUp: () => reorderGroup("a", entry.id, -1),
                        onMoveDown: () => reorderGroup("a", entry.id, 1),
                      }
                    : undefined
                }
              />
            ))}

            <div className="mx-4 my-2 border-t border-[var(--border)]" />

            {groupBEntries.map((entry, i) => (
              <NavItem
                key={entry.id}
                index={nextIndex()}
                id={entry.iconId}
                label={entry.label}
                isActive={entry.id === activeId}
                onClick={entry.onClick}
                reorder={
                  customizingNav
                    ? {
                        canMoveUp: i > 0,
                        canMoveDown: i < groupBEntries.length - 1,
                        onMoveUp: () => reorderGroup("b", entry.id, -1),
                        onMoveDown: () => reorderGroup("b", entry.id, 1),
                      }
                    : undefined
                }
              />
            ))}
            <div className="mx-4 my-2 border-t border-[var(--border)]" />

            <NavItem index={nextIndex()} id="docs" label="DOCS" isActive={isDocs} onClick={() => pickPage(DOCS_ID)} />

            {customizingNav && (
              <div className="mx-4 mt-2">
                <button
                  onClick={() => setCustomizingNav(false)}
                  className="w-full rounded-md border border-[var(--border-strong)] px-2.5 py-1.5 font-mono text-[0.66rem] font-semibold text-[var(--text)] transition-colors hover:bg-[var(--panel-2)]"
                >
                  Done reordering
                </button>
              </div>
            )}
          </nav>

          <div className="shrink-0 border-t border-[var(--border)] px-4 py-3">
            <div className="flex items-center justify-between font-mono text-[0.62rem] text-[var(--text-faint)]">
              <Clock />
              <div className="flex items-center gap-3">
                <SettingsPanel onCustomizeTabs={() => setCustomizingNav(true)} />
                <SignOutButton className="font-mono text-[0.62rem] font-semibold uppercase tracking-[0.1em] text-[var(--text-faint)] transition-colors duration-150 hover:text-[var(--text)] disabled:opacity-50" />
              </div>
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-8 lg:px-12 lg:py-10">
          {isBoard ? (
            <>
              <header className="relative mb-6 overflow-hidden border border-[var(--border)] bg-[var(--panel)]">
                <AsciiContour className="pointer-events-none absolute inset-0 h-full w-full" cell={12} maxAlpha={0.2} />
                <div className="relative flex flex-wrap items-end justify-between gap-4 px-5 pb-4 pt-5">
                  <div>
                    <h1 className="font-display m-0 text-[1.6rem] leading-none">
                      <Scramble text="Board" />
                    </h1>
                    <span className="eyebrow mt-1.5 block">{indicatorCount} indicators · one screen</span>
                  </div>
                  <div className="flex flex-wrap gap-px bg-[var(--border)] p-px">
                    {[
                      ["STRONG BULL", <span key="b" style={{ color: "var(--up)" }}>{strongReads.bull}▲</span>],
                      ["STRONG BEAR", <span key="s" style={{ color: "var(--down)" }}>{strongReads.bear}▼</span>],
                      ["INDICATORS", String(indicatorCount)],
                      ["LAST SYNC", lastUpdated ? new Date(lastUpdated).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"],
                    ].map(([label, value]) => (
                      <div key={label as string} className="flex min-w-[6.5rem] flex-col gap-1 bg-[var(--panel)] px-3.5 py-2.5">
                        <span className="font-mono text-[0.56rem] uppercase tracking-[0.16em] text-[var(--text-faint)]">{label}</span>
                        <span className="font-mono text-[1rem] font-semibold leading-none text-[var(--text)]">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </header>
              <BoardPage panels={visiblePanels} newsSeries={boardNewsSeries} />
            </>
          ) : isNews ? (
            <>
              <header className="mb-6">
                <div className="eyebrow mb-2">Headline sentiment</div>
                <h1 className="font-display m-0 text-balance text-[2rem] leading-none sm:text-[2.6rem]">
                  <Scramble text="News" />
                </h1>
              </header>

              <div className="mb-6 flex flex-wrap gap-1.5">
                {[{ symbol: "", label: "General" }, ...MARKET_SYMBOLS].map((m) => {
                  const isOn = newsAssetTab === m.symbol;
                  return (
                    <button
                      key={m.symbol || "general"}
                      onClick={() => setNewsAssetTab(m.symbol)}
                      className={`border px-3 py-1.5 font-mono text-[0.66rem] font-semibold uppercase tracking-[0.1em] transition-colors duration-150 ${
                        isOn
                          ? "border-[var(--text-dim)] bg-[var(--panel-2)] text-[var(--text)]"
                          : "border-[var(--border)] text-[var(--text-faint)] hover:border-[var(--border-strong)] hover:text-[var(--text-dim)]"
                      }`}
                    >
                      {m.label}
                    </button>
                  );
                })}
              </div>

              {activeNewsSeries ? (
                <NewsFeedCard key={activeNewsSeries.id} series={activeNewsSeries} />
              ) : (
                <p className="font-sans text-[0.85rem] text-[var(--text-faint)]">No news data yet.</p>
              )}
            </>
          ) : isMacroBias ? (
            <>
              <header className="mb-8">
                <div className="eyebrow mb-2">Composite regime read</div>
                <h1 className="font-display m-0 text-balance text-[2rem] leading-none sm:text-[2.6rem]">
                  <Scramble text="Macro Bias" />
                </h1>
              </header>
              <MacroBiasPage panels={panels} />
            </>
          ) : isReplay ? (
            <>
              <header className="mb-8">
                <div className="eyebrow mb-2">Point-in-time scrub</div>
                <h1 className="font-display m-0 text-balance text-[2rem] leading-none sm:text-[2.6rem]">
                  <Scramble text="Replay" />
                </h1>
              </header>
              <ReplayPage panels={panels} />
            </>
          ) : isFingerprint ? (
            <>
              <header className="mb-8">
                <div className="eyebrow mb-2">Seven-pillar shape, then vs now</div>
                <h1 className="font-display m-0 text-balance text-[2rem] leading-none sm:text-[2.6rem]">
                  <Scramble text="Regime Fingerprint" />
                </h1>
              </header>
              <RegimeFingerprintPage panels={panels} markets={markets} />
            </>
          ) : isCalendar ? (
            <>
              <header className="mb-8">
                <div className="eyebrow mb-2">Real release dates</div>
                <h1 className="font-display m-0 text-balance text-[2rem] leading-none sm:text-[2.6rem]">
                  <Scramble text="Calendar" />
                </h1>
              </header>
              <CalendarPage panels={panels} />
            </>
          ) : isDocs ? (
            <>
              <header className="mb-8">
                <div className="eyebrow mb-2">Reference</div>
                <h1 className="font-display m-0 text-balance text-[2rem] leading-none sm:text-[2.6rem]">
                  <Scramble text="Documentation" />
                </h1>
              </header>
              <DocumentationPage panels={panels} />
            </>
          ) : active ? (
            <>
              <header className="mb-8">
                <div className="partno mb-2">
                  MP-{String(visiblePanels.findIndex((p) => p.id === active.id) + 1).padStart(2, "0")}
                </div>
                <h1 className="font-display m-0 text-balance text-[2rem] leading-none sm:text-[2.6rem]">
                  <Scramble text={pageTitle} />
                </h1>
              </header>

              <div className={DEEP_PANELS.has(active.id) ? "flex flex-col gap-2" : "grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"}>
                {active.series
                  .filter((series) => series.id !== "geo:news-feed")
                  .map((series) =>
                    DEEP_PANELS.has(active.id) ? (
                      <QuantCard key={series.id} series={series} markets={markets} assetFilter={null} assetLabel={null} />
                    ) : (
                      <SeriesCard key={series.id} series={series} assetFilter={null} assetLabel={null} />
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
