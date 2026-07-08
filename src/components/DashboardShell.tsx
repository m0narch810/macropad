"use client";

import { useEffect, useMemo, useState } from "react";
import type { MacroPanel, MacroSeries } from "@/lib/macroData";
import type { MarketRow } from "@/lib/getMarkets";
import SeriesCard from "@/components/SeriesCard";
import QuantCard from "@/components/QuantCard";
import NewsFeedCard from "@/components/NewsFeedCard";
import MarketTicker from "@/components/MarketTicker";
import OverviewBoard from "@/components/OverviewBoard";
import PerlinField from "@/components/PerlinField";
import PanelIcon from "@/components/PanelIcon";
import CustomDashboardPage from "@/components/CustomDashboardPage";
import CustomBiasPage from "@/components/CustomBiasPage";
import { MARKET_SYMBOLS } from "@/lib/markets";
import { getSignTone } from "@/lib/bias";
import { getBacktestEvidence } from "@/lib/backtestImportance";

const DEEP_PANELS = new Set(["us-macro", "yield-rates", "cot-positioning", "transmission", "geopolitics"]);
const BOARD_ID = "board";
const NEWS_ID = "news";
const CUSTOM_DASHBOARD_ID = "custom-dashboard";
const CUSTOM_BIAS_ID = "custom-bias";

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

const SPINNER = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

/** Braille spinner + wordmark; the one always-on ambient animation in the chrome. */
function Wordmark({ compact = false }: { compact?: boolean }) {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setFrame((f) => (f + 1) % SPINNER.length), 110);
    return () => clearInterval(id);
  }, []);
  return (
    <span className="flex select-none items-center gap-2.5 whitespace-nowrap">
      <span className="font-mono text-[0.95rem] text-[var(--text-dim)]">{SPINNER[frame]}</span>
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
}: {
  index: number;
  id: string;
  label: string;
  isActive: boolean;
  onClick: () => void;
  bull?: number;
  bear?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`group relative flex w-full items-center gap-3 px-4 py-[9px] text-left font-mono text-[0.7rem] tracking-wide transition-colors ${
        isActive ? "bg-[var(--panel-2)] text-[var(--text)]" : "text-[var(--text-faint)] hover:text-[var(--text-dim)]"
      }`}
    >
      {isActive && <span className="absolute left-0 top-1/2 h-4 w-px -translate-y-1/2 bg-[var(--text)]" />}
      <span className="w-4 shrink-0 text-[0.56rem] text-[var(--text-faint)]">{String(index).padStart(2, "0")}</span>
      <PanelIcon id={id} className="shrink-0" style={{ color: isActive ? "var(--text)" : "var(--text-faint)" }} />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {(bull ?? 0) + (bear ?? 0) > 0 && (
        <span className="shrink-0 text-[0.6rem]">
          {bull ? <span className="text-[var(--up)]">{bull}▲</span> : null}
          {bear ? <span className="text-[var(--down)]">{bear}▼</span> : null}
        </span>
      )}
    </button>
  );
}

function StatModule({
  label,
  value,
  sub,
  onClick,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  onClick?: () => void;
}) {
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      onClick={onClick}
      className={`hud flex flex-col gap-1.5 border border-[var(--border)] bg-[color-mix(in_srgb,var(--panel)_82%,transparent)] px-4 py-3.5 text-left backdrop-blur-[2px] ${
        onClick ? "transition-colors hover:bg-[var(--panel-2)]" : ""
      }`}
    >
      <span className="font-mono text-[0.58rem] uppercase tracking-[0.18em] text-[var(--text-faint)]">{label}</span>
      <span className="font-mono text-[1.15rem] font-semibold leading-none text-[var(--text)]">{value}</span>
      {sub && <span className="font-mono text-[0.62rem] text-[var(--text-dim)]">{sub}</span>}
    </Comp>
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

  // "/" jumps to the board search from anywhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (/^(input|textarea|select)$/i.test(tag)) return;
      e.preventDefault();
      setActiveId(BOARD_ID);
      setTimeout(() => document.getElementById("board-search")?.focus(), 60);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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

  const highlights = useMemo(() => {
    let strongest: { series: MacroSeries; panelId: string } | null = null;
    let evidence: { series: MacroSeries; panelId: string; rank: number } | null = null;
    for (const p of panels) {
      for (const s of p.series) {
        if (s.id === "geo:news-feed") continue;
        if (s.zscore !== null && (!strongest || Math.abs(s.zscore) > Math.abs(strongest.series.zscore ?? 0))) {
          strongest = { series: s, panelId: p.id };
        }
        const ev = getBacktestEvidence(s.id);
        if (ev && (!evidence || ev.rank < evidence.rank)) {
          evidence = { series: s, panelId: p.id, rank: ev.rank };
        }
      }
    }
    return { strongest, evidence };
  }, [panels]);

  const navItems: { id: string; label: string; bull?: number; bear?: number }[] = [
    { id: BOARD_ID, label: "board" },
    { id: NEWS_ID, label: "news" },
    ...panels.map((p) => ({ id: p.id, label: SHORT_LABEL[p.id] ?? p.id, ...panelSignals(p) })),
    { id: CUSTOM_DASHBOARD_ID, label: "custom-dash" },
    { id: CUSTOM_BIAS_ID, label: "custom-bias" },
  ];

  const sidebarInner = (
    <>
      <div className="relative overflow-hidden border-b border-[var(--border)] px-4 py-5">
        <PerlinField className="absolute inset-0 h-full w-full" opacity={0.16} />
        <div className="relative">
          <Wordmark />
          <div className="mt-2 font-mono text-[0.56rem] uppercase tracking-[0.2em] text-[var(--text-faint)]">
            macro intelligence
          </div>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto py-3">
        {navItems.map((item, i) => (
          <NavItem
            key={item.id}
            index={i}
            id={item.id}
            label={item.label}
            isActive={activeId === item.id}
            onClick={() => pickPage(item.id)}
            bull={item.bull}
            bear={item.bear}
          />
        ))}
      </nav>

      <div className="border-t border-[var(--border)] px-4 py-3.5">
        <label className="mb-1.5 block font-mono text-[0.56rem] uppercase tracking-[0.18em] text-[var(--text-faint)]">
          asset lens
        </label>
        <select
          value={assetFilter}
          onChange={(e) => setAssetFilter(e.target.value)}
          className="w-full appearance-none rounded border bg-transparent px-2 py-1.5 font-mono text-[0.68rem] outline-none"
          style={{
            borderColor: assetFilter ? "var(--border-strong)" : "var(--border)",
            color: assetFilter ? "var(--text)" : "var(--text-faint)",
          }}
        >
          <option value="">all series</option>
          {MARKET_SYMBOLS.map((m) => (
            <option key={m.symbol} value={m.symbol}>
              {m.label}
            </option>
          ))}
        </select>
        <div className="mt-3 flex items-center gap-1.5 font-mono text-[0.6rem] uppercase tracking-[0.14em] text-[var(--text-faint)]">
          <span className="keep-round h-1.5 w-1.5 rounded-full" style={{ background: lastUpdated ? "var(--up)" : "var(--text-faint)" }} />
          {lastUpdated ? "live" : "offline"} · {totalSeries} series
        </div>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen pb-8">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-[218px] shrink-0 flex-col border-r border-[var(--border)] bg-[var(--panel)] lg:flex">
        {sidebarInner}
      </aside>

      {/* Mobile drawer */}
      {navOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/60 lg:hidden" onClick={() => setNavOpen(false)} aria-hidden="true" />
          <aside className="fixed inset-y-0 left-0 z-50 flex w-[240px] flex-col border-r border-[var(--border)] bg-[var(--panel)] lg:hidden">
            {sidebarInner}
          </aside>
        </>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top strip */}
        <div className="flex items-center gap-3 border-b border-[var(--border)] bg-[var(--panel)] px-4 py-2.5 lg:hidden">
          <button
            onClick={() => setNavOpen(true)}
            aria-label="Open navigation"
            className="flex h-7 w-7 shrink-0 items-center justify-center border border-[var(--border)] text-[var(--text-dim)]"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="square">
              <path d="M2 4H14" />
              <path d="M2 8H14" />
              <path d="M2 12H14" />
            </svg>
          </button>
          <Wordmark compact />
        </div>

        <MarketTicker markets={markets} />

        <main className="blueprint min-w-0 flex-1">
          <div className="px-4 py-6 sm:px-6 lg:px-8">
            {isBoard ? (
              <>
                <div className="relative mb-7 overflow-hidden border border-[var(--border)]">
                  <PerlinField className="absolute inset-0 h-full w-full" opacity={0.35} />
                  <div className="relative grid grid-cols-2 gap-px bg-[var(--border)] xl:grid-cols-4">
                    <StatModule label="series live" value={totalSeries} sub={lastUpdated ? `synced ${new Date(lastUpdated).toLocaleTimeString("en-US", { hour12: false })}` : "not synced"} />
                    <StatModule
                      label="breadth · strong reads"
                      value={
                        <>
                          <span className="text-[var(--up)]">{totals.bull}▲</span>{" "}
                          <span className="text-[var(--down)]">{totals.bear}▼</span>
                        </>
                      }
                      sub={totals.bull >= totals.bear ? "net bullish tilt" : "net bearish tilt"}
                    />
                    <StatModule
                      label="strongest signal"
                      value={
                        highlights.strongest ? (
                          <span
                            style={{
                              color:
                                getSignTone(highlights.strongest.series.id, highlights.strongest.series.zscore) === "up"
                                  ? "var(--up)"
                                  : "var(--down)",
                            }}
                          >
                            {(highlights.strongest.series.zscore ?? 0) > 0 ? "+" : ""}
                            {Math.round((highlights.strongest.series.zscore ?? 0) * 100)}%
                          </span>
                        ) : (
                          "—"
                        )
                      }
                      sub={highlights.strongest?.series.name}
                      onClick={
                        highlights.strongest
                          ? () => openFromBoard(highlights.strongest!.panelId, highlights.strongest!.series.id)
                          : undefined
                      }
                    />
                    <StatModule
                      label="top backtest evidence"
                      value={highlights.evidence ? <span className="text-[var(--amber)]">bt #{highlights.evidence.rank}</span> : "—"}
                      sub={highlights.evidence?.series.name}
                      onClick={
                        highlights.evidence
                          ? () => openFromBoard(highlights.evidence!.panelId, highlights.evidence!.series.id)
                          : undefined
                      }
                    />
                  </div>
                </div>

                <OverviewBoard panels={panels} assetFilter={assetFilter || null} onOpen={openFromBoard} />
              </>
            ) : (
              <>
                <div className="mb-6 flex flex-wrap items-baseline gap-x-4 gap-y-1">
                  <h1 className="font-display m-0 text-[1.45rem] leading-none text-[var(--text)]">
                    <Scramble text={active?.title ?? (isNews ? "News" : isCustomDashboard ? "Custom Dashboard" : "Custom Bias")} />
                  </h1>
                  {active && (
                    <span className="font-mono text-[0.66rem] tracking-wide text-[var(--text-faint)]">
                      {(() => {
                        const { bull, bear } = panelSignals(active);
                        return bull + bear === 0 ? (
                          "no strong reads"
                        ) : (
                          <>
                            <span className="text-[var(--up)]">{bull}▲</span> <span className="text-[var(--down)]">{bear}▼</span> strong
                          </>
                        );
                      })()}
                    </span>
                  )}
                </div>

                {isNews ? (
                  newsSeries ? (
                    <NewsFeedCard series={newsSeries} />
                  ) : (
                    <p className="font-sans text-[0.85rem] text-[var(--text-faint)]">No news data yet.</p>
                  )
                ) : isCustomDashboard ? (
                  <CustomDashboardPage panels={panels} markets={markets} />
                ) : isCustomBias ? (
                  <CustomBiasPage panels={panels} />
                ) : active ? (
                  <div className={DEEP_PANELS.has(active.id) ? "flex flex-col gap-2" : "grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"}>
                    {active.series
                      .filter((series) => series.id !== "geo:news-feed")
                      .map((series) => (
                        <div key={series.id} id={`card-${series.id}`} className="scroll-mt-6">
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
                ) : null}
              </>
            )}
          </div>
        </main>
      </div>

      <footer className="fixed inset-x-0 bottom-0 z-40 flex h-8 items-center gap-x-4 overflow-hidden border-t border-[var(--border)] bg-[var(--bg)] px-3 font-mono text-[0.64rem] text-[var(--text-faint)] sm:px-4">
        <span className="tracking-[0.14em] text-[var(--text-dim)]">MACROPAD</span>
        <span className="hidden sm:inline">{navItems.find((t) => t.id === activeId)?.label}</span>
        <span>
          <span className="text-[var(--up)]">{totals.bull}▲</span> <span className="text-[var(--down)]">{totals.bear}▼</span>
        </span>
        <span className="hidden md:inline">press / to search</span>
        <span className="ml-auto flex items-center gap-1.5 text-[var(--text-dim)]">
          <Clock />
          <span className="blink-cursor">_</span>
        </span>
      </footer>
    </div>
  );
}
