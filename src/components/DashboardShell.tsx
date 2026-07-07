"use client";

import { useState } from "react";
import type { MacroPanel } from "@/lib/macroData";
import type { MarketRow } from "@/lib/getMarkets";
import SeriesCard from "@/components/SeriesCard";
import QuantCard from "@/components/QuantCard";
import MarketTicker from "@/components/MarketTicker";
import TopologyGraph from "@/components/TopologyGraph";
import NetBiasPage from "@/components/NetBiasPage";
import PanelIcon from "@/components/PanelIcon";
import { MARKET_SYMBOLS } from "@/lib/markets";
import type { Horizon } from "@/lib/netBias";

const HORIZONS: { id: Horizon; label: string }[] = [
  { id: "daily", label: "Daily" },
  { id: "weekly", label: "Weekly" },
  { id: "monthly", label: "Monthly" },
];

const DEEP_PANELS = new Set(["us-macro", "yield-rates"]);
const TOPOLOGY_ID = "topology";
const NET_BIAS_ID = "net-bias";

function panelPulse(panel: MacroPanel): { up: number; down: number; flat: number; pending: number } {
  const counts = { up: 0, down: 0, flat: 0, pending: 0 };
  panel.series.forEach((s) => counts[s.status]++);
  return counts;
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
  const [activeId, setActiveId] = useState(panels[0]?.id ?? "");
  const [assetFilter, setAssetFilter] = useState<string>("");
  const [horizon, setHorizon] = useState<Horizon>("weekly");
  const active = panels.find((p) => p.id === activeId);
  const isTopology = activeId === TOPOLOGY_ID;
  const isNetBias = activeId === NET_BIAS_ID;
  const assetLabel = MARKET_SYMBOLS.find((m) => m.symbol === assetFilter)?.label ?? null;

  return (
    <div className="flex min-h-screen flex-col">
      <MarketTicker markets={markets} />

      <div className="flex flex-1">
        <aside className="flex w-[248px] shrink-0 flex-col border-r border-[var(--border)] bg-[var(--panel-2)]">
          <div className="border-b border-[var(--border)] px-5 py-5">
            <div className="flex items-center gap-2.5">
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md font-mono text-[0.8rem] font-bold"
                style={{
                  background: "color-mix(in srgb, var(--accent) 16%, transparent)",
                  border: "1px solid color-mix(in srgb, var(--accent) 45%, transparent)",
                  color: "var(--accent)",
                  boxShadow: "0 0 14px color-mix(in srgb, var(--accent) 25%, transparent)",
                }}
              >
                M
              </div>
              <div className="text-[1.05rem] font-semibold tracking-wide">
                <span className="text-[var(--accent)]">Macro</span>pad
              </div>
            </div>
            <div className="mt-2.5 flex items-center gap-1.5 font-sans text-[0.66rem] uppercase tracking-[0.09em] text-[var(--text-faint)]">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--up)] opacity-60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--up)]" />
              </span>
              {lastUpdated ? `synced ${new Date(lastUpdated).toLocaleTimeString()}` : "not yet synced"}
            </div>
          </div>

          <div className="border-b border-[var(--border)] px-3.5 py-3.5">
            <label className="mb-1.5 block font-sans text-[0.64rem] font-semibold uppercase tracking-wide text-[var(--text-faint)]">
              Filter by asset
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
                Indicators not linked to {assetLabel} are grayed out below.
              </p>
            )}
          </div>

          <div className="border-b border-[var(--border)] px-3.5 py-3.5">
            <label className="mb-1.5 block font-sans text-[0.64rem] font-semibold uppercase tracking-wide text-[var(--text-faint)]">
              Horizon
            </label>
            <div className="flex rounded-md border border-[var(--border)] bg-[var(--panel)] p-0.5">
              {HORIZONS.map((h) => {
                const isSel = horizon === h.id;
                return (
                  <button
                    key={h.id}
                    onClick={() => setHorizon(h.id)}
                    className="flex-1 rounded px-2 py-1.5 font-sans text-[0.72rem] font-semibold transition-colors"
                    style={
                      isSel
                        ? { background: "color-mix(in srgb, var(--accent) 18%, transparent)", color: "var(--accent)" }
                        : { color: "var(--text-faint)" }
                    }
                  >
                    {h.label}
                  </button>
                );
              })}
            </div>
            <p className="m-0 mt-1.5 font-sans text-[0.68rem] leading-snug text-[var(--text-faint)]">
              Weights Net Bias toward indicators that release on this cadence — a monthly print like CPI matters
              more for a monthly read than a daily one.
            </p>
          </div>

          <nav className="flex flex-1 flex-col gap-1 p-3">
            {panels.map((panel) => {
              const pulse = panelPulse(panel);
              const isActive = panel.id === activeId;
              return (
                <button
                  key={panel.id}
                  onClick={() => setActiveId(panel.id)}
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
                  <PanelIcon
                    id={panel.id}
                    className="shrink-0 transition-colors"
                    style={{ color: isActive ? "var(--accent)" : "var(--text-faint)" }}
                  />
                  <div className="min-w-0 flex-1">
                    <div
                      className={`truncate text-[0.85rem] font-semibold transition-colors ${
                        isActive ? "text-[var(--text)]" : "text-[var(--text-dim)] group-hover:text-[var(--text)]"
                      }`}
                    >
                      {panel.title}
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5">
                      {pulse.up > 0 && (
                        <span className="flex items-center gap-1 text-[0.66rem] font-semibold text-[var(--up)]">
                          <span className="inline-block h-1 w-1 rounded-full bg-[var(--up)]" />
                          {pulse.up}
                        </span>
                      )}
                      {pulse.down > 0 && (
                        <span className="flex items-center gap-1 text-[0.66rem] font-semibold text-[var(--down)]">
                          <span className="inline-block h-1 w-1 rounded-full bg-[var(--down)]" />
                          {pulse.down}
                        </span>
                      )}
                      {pulse.flat + pulse.pending > 0 && (
                        <span className="flex items-center gap-1 text-[0.66rem] font-semibold text-[var(--text-faint)]">
                          <span className="inline-block h-1 w-1 rounded-full bg-[var(--text-faint)]" />
                          {pulse.flat + pulse.pending}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}

            <div className="my-2 border-t border-[var(--border)]" />

            <button
              onClick={() => setActiveId(TOPOLOGY_ID)}
              className="group relative flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-left font-sans transition-all duration-150"
              style={
                isTopology
                  ? {
                      background: "color-mix(in srgb, var(--accent) 11%, transparent)",
                      boxShadow: "inset 0 0 0 1px color-mix(in srgb, var(--accent) 30%, transparent)",
                    }
                  : undefined
              }
            >
              {isTopology && (
                <span
                  className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full"
                  style={{ background: "var(--accent)" }}
                />
              )}
              <PanelIcon id="topology" className="shrink-0 transition-colors" style={{ color: isTopology ? "var(--accent)" : "var(--text-faint)" }} />
              <div className="min-w-0 flex-1">
                <div
                  className={`truncate text-[0.85rem] font-semibold transition-colors ${
                    isTopology ? "text-[var(--text)]" : "text-[var(--text-dim)] group-hover:text-[var(--text)]"
                  }`}
                >
                  Topology
                </div>
                <div className="mt-0.5 text-[0.66rem] text-[var(--text-faint)]">every indicator, linked</div>
              </div>
            </button>

            <button
              onClick={() => setActiveId(NET_BIAS_ID)}
              className="group relative flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-left font-sans transition-all duration-150"
              style={
                isNetBias
                  ? {
                      background: "color-mix(in srgb, var(--accent) 11%, transparent)",
                      boxShadow: "inset 0 0 0 1px color-mix(in srgb, var(--accent) 30%, transparent)",
                    }
                  : undefined
              }
            >
              {isNetBias && (
                <span
                  className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full"
                  style={{ background: "var(--accent)" }}
                />
              )}
              <PanelIcon id="net-bias" className="shrink-0 transition-colors" style={{ color: isNetBias ? "var(--accent)" : "var(--text-faint)" }} />
              <div className="min-w-0 flex-1">
                <div
                  className={`truncate text-[0.85rem] font-semibold transition-colors ${
                    isNetBias ? "text-[var(--text)]" : "text-[var(--text-dim)] group-hover:text-[var(--text)]"
                  }`}
                >
                  Net Bias
                </div>
                <div className="mt-0.5 text-[0.66rem] text-[var(--text-faint)]">combined read per asset</div>
              </div>
            </button>
          </nav>

          <div className="border-t border-[var(--border)] px-5 py-3.5 font-mono text-[0.66rem] text-[var(--text-faint)]">
            {panels.reduce((n, p) => n + p.series.length, 0)} live series
          </div>
        </aside>

        <main className="min-w-0 flex-1 px-9 py-8">
          {isTopology ? (
            <>
              <header className="mb-7">
                <h1 className="m-0 text-balance text-[1.5rem] font-semibold">Topology</h1>
                <p className="m-0 mt-1 max-w-[70ch] font-sans text-[0.9rem] text-[var(--text-dim)]">
                  Every indicator across every panel, linked to the tradable market it actually moves. Panel nodes
                  cluster their own indicators; drag anything to explore.
                </p>
              </header>
              <TopologyGraph panels={panels} markets={markets} />
            </>
          ) : isNetBias ? (
            <>
              <header className="mb-7">
                <h1 className="m-0 text-balance text-[1.5rem] font-semibold">Net Bias</h1>
                <p className="m-0 mt-1 max-w-[70ch] font-sans text-[0.9rem] text-[var(--text-dim)]">
                  Every linked indicator's bias combined into one read per asset — weighted by how far each sits
                  from its own normal range.
                </p>
              </header>
              <NetBiasPage
                panels={panels}
                markets={markets}
                assetFilter={assetFilter}
                onPickAsset={setAssetFilter}
                horizon={horizon}
              />
            </>
          ) : active ? (
            <>
              <header className="mb-7">
                <h1 className="m-0 text-balance text-[1.5rem] font-semibold">{active.title}</h1>
                <p className="m-0 mt-1 max-w-[60ch] font-sans text-[0.9rem] text-[var(--text-dim)]">
                  {active.description}
                </p>
              </header>

              <div className={DEEP_PANELS.has(active.id) ? "flex flex-col gap-2" : "grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"}>
                {active.series.map((series) =>
                  DEEP_PANELS.has(active.id) ? (
                    <QuantCard
                      key={series.id}
                      series={series}
                      markets={markets}
                      assetFilter={assetFilter || null}
                      assetLabel={assetLabel}
                    />
                  ) : (
                    <SeriesCard key={series.id} series={series} assetFilter={assetFilter || null} assetLabel={assetLabel} />
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
