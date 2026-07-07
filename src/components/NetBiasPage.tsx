"use client";

import { useMemo, useState } from "react";
import type { MacroPanel } from "@/lib/macroData";
import type { MarketRow } from "@/lib/getMarkets";
import { MARKET_SYMBOLS } from "@/lib/markets";
import { computeNetBias, computeNetBiasAsOf, computeHorizonBias, type HorizonBias, type Horizon, type BiasContributor } from "@/lib/netBias";

function toneColor(tone: "up" | "down" | "flat"): string {
  return tone === "up" ? "var(--up)" : tone === "down" ? "var(--down)" : "var(--flat)";
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function minDateIso(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 30);
  return d.toISOString().slice(0, 10);
}

function NetBiasGauge({ score, tone }: { score: number; tone: "up" | "down" | "flat" }) {
  const clamped = Math.max(-1, Math.min(1, score));
  const pct = ((clamped + 1) / 2) * 100;
  return (
    <div className="relative h-2.5 rounded-full bg-[var(--border)]">
      <div className="absolute left-1/2 top-1/2 h-4 w-px -translate-x-1/2 -translate-y-1/2 bg-[var(--text-faint)]" />
      <div
        className="absolute top-1/2 h-4 w-4 -translate-y-1/2 -translate-x-1/2 rounded-full border-2 border-[var(--panel)]"
        style={{ left: `${pct}%`, background: toneColor(tone) }}
      />
    </div>
  );
}

function AssetSummaryCard({
  symbol,
  label,
  panels,
  market,
  horizon,
  onSelect,
}: {
  symbol: string;
  label: string;
  panels: MacroPanel[];
  market: MarketRow | undefined;
  horizon: Horizon;
  onSelect: () => void;
}) {
  const result = computeNetBias(panels, symbol, horizon);
  return (
    <button
      onClick={onSelect}
      className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-5 text-left transition-colors hover:border-[color-mix(in_srgb,var(--accent)_40%,var(--border))]"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-sans text-[0.95rem] font-semibold">{label}</div>
          {market && <div className="mt-0.5 font-mono text-[0.8rem] text-[var(--text-faint)]">{market.value}</div>}
        </div>
        <span
          className="rounded-full border px-2.5 py-1 text-[0.68rem] font-bold uppercase tracking-wide"
          style={{
            color: toneColor(result.tone),
            borderColor: `color-mix(in srgb, ${toneColor(result.tone)} 40%, var(--border))`,
            background: `color-mix(in srgb, ${toneColor(result.tone)} 12%, transparent)`,
          }}
        >
          {result.verdict}
        </span>
      </div>
      <div className="mt-3.5">
        <NetBiasGauge score={result.score} tone={result.tone} />
      </div>
      <div className="mt-2 font-sans text-[0.72rem] text-[var(--text-faint)]">
        {result.contributors.length} linked indicator{result.contributors.length === 1 ? "" : "s"}
      </div>
    </button>
  );
}

function HorizonCard({
  label,
  caption,
  data,
  isPrimary,
}: {
  label: string;
  caption: string;
  data: HorizonBias;
  isPrimary: boolean;
}) {
  return (
    <div
      className="rounded-lg border bg-[var(--panel)] p-4"
      style={
        isPrimary
          ? { borderColor: "color-mix(in srgb, var(--accent) 45%, var(--border))", boxShadow: "0 0 0 1px color-mix(in srgb, var(--accent) 20%, transparent)" }
          : { borderColor: "var(--border)" }
      }
    >
      <div className="flex items-baseline justify-between gap-2">
        <div className="flex items-center gap-1.5 font-sans text-[0.78rem] font-semibold">
          {label}
          {isPrimary && (
            <span className="rounded-full px-1.5 py-[1px] text-[0.58rem] font-bold uppercase tracking-wide" style={{ color: "var(--accent)", background: "color-mix(in srgb, var(--accent) 16%, transparent)" }}>
              sidebar
            </span>
          )}
        </div>
        <span
          className="rounded-full border px-2 py-[3px] text-[0.62rem] font-bold uppercase tracking-wide"
          style={{
            color: toneColor(data.tone),
            borderColor: `color-mix(in srgb, ${toneColor(data.tone)} 40%, var(--border))`,
            background: `color-mix(in srgb, ${toneColor(data.tone)} 12%, transparent)`,
          }}
        >
          {data.verdict}
        </span>
      </div>
      <div className="mt-3">
        <NetBiasGauge score={data.score} tone={data.tone} />
      </div>
      <div className="mt-2 flex items-center justify-between font-mono text-[0.68rem] text-[var(--text-faint)]">
        <span>score {data.score > 0 ? "+" : ""}{data.score.toFixed(2)}</span>
        <span>{data.daysUsed}d sampled</span>
      </div>
      <p className="m-0 mt-2 font-sans text-[0.7rem] leading-snug text-[var(--text-faint)]">{caption}</p>
    </div>
  );
}

function cadenceBadgeColor(weight: number): string {
  if (weight >= 0.85) return "var(--accent)";
  if (weight >= 0.5) return "var(--text-dim)";
  return "var(--text-faint)";
}

function ContributorRow({ c }: { c: BiasContributor }) {
  return (
    <div className="flex items-center gap-4 rounded-md border border-[var(--border)] bg-[var(--panel)] px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-sans text-[0.85rem] font-semibold">{c.name}</span>
          <span className="shrink-0 font-sans text-[0.66rem] uppercase tracking-wide text-[var(--text-faint)]">{c.panelTitle}</span>
          <span
            className="shrink-0 rounded-full border px-1.5 py-[1px] font-sans text-[0.6rem] font-semibold uppercase tracking-wide"
            style={{ color: cadenceBadgeColor(c.weight), borderColor: "var(--border)" }}
          >
            {c.cadence}
          </span>
        </div>
        <div className="mt-0.5 truncate font-sans text-[0.76rem]" style={{ color: toneColor(c.tone) }}>
          {c.label}
        </div>
      </div>
      <div className="shrink-0 text-right font-mono">
        <div className="text-[0.8rem]" style={{ color: toneColor(c.tone) }}>
          {c.zscore !== null ? `${c.zscore > 0 ? "+" : ""}${c.zscore.toFixed(2)}σ` : "—"}
        </div>
        <div className="mt-0.5 text-[0.66rem] text-[var(--text-faint)]">
          weight {(c.weight * 100).toFixed(0)}%
        </div>
      </div>
    </div>
  );
}

export default function NetBiasPage({
  panels,
  markets,
  assetFilter,
  onPickAsset,
  horizon,
}: {
  panels: MacroPanel[];
  markets: MarketRow[];
  assetFilter: string;
  onPickAsset: (symbol: string) => void;
  horizon: Horizon;
}) {
  const [asOfDate, setAsOfDate] = useState(todayIso());
  const marketBySymbol = new Map(markets.map((m) => [m.symbol, m]));
  const minDate = minDateIso();
  const maxDate = todayIso();
  const isReplay = asOfDate !== maxDate;

  const result = useMemo(
    () => (assetFilter ? computeNetBiasAsOf(panels, assetFilter, asOfDate, horizon) : null),
    [panels, assetFilter, asOfDate, horizon]
  );
  const horizonBias = useMemo(
    () => (assetFilter ? computeHorizonBias(panels, assetFilter, asOfDate, horizon) : null),
    [panels, assetFilter, asOfDate, horizon]
  );

  if (!assetFilter || !result || !horizonBias) {
    return (
      <div>
        <p className="m-0 mb-5 font-sans text-[0.85rem] text-[var(--text-dim)]">
          Pick an asset to see its detailed breakdown and replay history, or scan every asset's live net read below —
          weighted for the <strong className="text-[var(--text)]">{horizon}</strong> horizon selected in the sidebar.
        </p>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {MARKET_SYMBOLS.map((m) => (
            <AssetSummaryCard
              key={m.symbol}
              symbol={m.symbol}
              label={m.label}
              panels={panels}
              market={marketBySymbol.get(m.symbol)}
              horizon={horizon}
              onSelect={() => onPickAsset(m.symbol)}
            />
          ))}
        </div>
      </div>
    );
  }

  const label = MARKET_SYMBOLS.find((m) => m.symbol === assetFilter)?.label ?? assetFilter;
  const market = marketBySymbol.get(assetFilter);

  return (
    <div>
      <div className="mb-6 rounded-lg border border-[var(--border)] bg-[var(--panel-2)] p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2.5">
            <label className="font-sans text-[0.72rem] font-semibold uppercase tracking-wide text-[var(--text-faint)]">
              Replay date
            </label>
            <input
              type="date"
              value={asOfDate}
              min={minDate}
              max={maxDate}
              onChange={(e) => setAsOfDate(e.target.value)}
              className="rounded-md border px-2.5 py-1.5 font-mono text-[0.8rem] outline-none"
              style={{
                borderColor: isReplay ? "color-mix(in srgb, var(--accent) 45%, transparent)" : "var(--border)",
                background: "var(--panel)",
                color: isReplay ? "var(--accent)" : "var(--text)",
              }}
            />
          </div>
          {isReplay && (
            <button
              onClick={() => setAsOfDate(maxDate)}
              className="font-sans text-[0.72rem] font-semibold text-[var(--accent)] underline-offset-2 hover:underline"
            >
              Jump to today
            </button>
          )}
          <span className="font-sans text-[0.72rem] text-[var(--text-faint)]">
            Max 30 days back, no lookahead.
          </span>
          <span className="ml-auto rounded-full border px-2.5 py-1 font-sans text-[0.68rem] font-semibold uppercase tracking-wide" style={{ color: "var(--accent)", borderColor: "color-mix(in srgb, var(--accent) 40%, transparent)", background: "color-mix(in srgb, var(--accent) 10%, transparent)" }}>
            {horizon} weighting
          </span>
        </div>
      </div>

      <div className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="font-sans text-[0.68rem] uppercase tracking-wide text-[var(--text-faint)]">
              {isReplay ? `Net bias as of ${asOfDate}` : "Net bias for"}
            </div>
            <div className="mt-0.5 text-[1.3rem] font-semibold">{label}</div>
            {market && !isReplay && (
              <div className="mt-1 flex items-baseline gap-2 font-mono">
                <span className="text-[1.1rem] font-semibold">{market.value}</span>
                {market.zscore !== null && (
                  <span className="text-[0.78rem] text-[var(--text-faint)]">
                    {market.zscore > 0 ? "+" : ""}
                    {market.zscore.toFixed(2)}σ
                  </span>
                )}
              </div>
            )}
          </div>
          <span
            className="rounded-full border px-3.5 py-1.5 text-[0.82rem] font-bold uppercase tracking-wide"
            style={{
              color: toneColor(result.tone),
              borderColor: `color-mix(in srgb, ${toneColor(result.tone)} 40%, var(--border))`,
              background: `color-mix(in srgb, ${toneColor(result.tone)} 12%, transparent)`,
            }}
          >
            {result.verdict}
          </span>
        </div>

        <div className="mt-5">
          <div className="mb-1.5 flex justify-between font-sans text-[0.68rem] uppercase tracking-wide text-[var(--text-faint)]">
            <span>Bearish</span>
            <span className="font-mono normal-case">score {result.score > 0 ? "+" : ""}{result.score.toFixed(2)}</span>
            <span>Bullish</span>
          </div>
          <NetBiasGauge score={result.score} tone={result.tone} />
        </div>

        <p className="m-0 mt-4 max-w-[75ch] font-sans text-[0.8rem] leading-snug text-[var(--text-faint)]">
          Score averages each linked indicator's directional read, weighted twice over: by how far its z-score sits
          from normal (saturating at 2σ), and by how well its own release cadence matches the{" "}
          <strong className="text-[var(--text)]">{horizon}</strong> horizon selected in the sidebar — a monthly
          print counts less on a daily read, and vice versa. Computed from data as of {asOfDate}.
        </p>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <HorizonCard label="Daily bias" caption={`Point-in-time read on ${asOfDate} only.`} data={horizonBias.daily} isPrimary={horizon === "daily"} />
        <HorizonCard
          label="Weekly bias"
          caption="Averages the daily read over the trailing 7 calendar days — smooths single-day noise."
          data={horizonBias.weekly}
          isPrimary={horizon === "weekly"}
        />
        <HorizonCard
          label="Monthly bias"
          caption="Averages the daily read over the trailing 30 calendar days — shows the persistent backdrop."
          data={horizonBias.monthly}
          isPrimary={horizon === "monthly"}
        />
      </div>

      <div className="mt-6">
        <div className="mb-2 font-sans text-[0.68rem] uppercase tracking-wide text-[var(--text-faint)]">
          Contributing indicators as of {asOfDate}, ranked by weighted strength
        </div>
        {result.contributors.length === 0 ? (
          <p className="font-sans text-[0.85rem] text-[var(--text-faint)]">No linked indicators have enough history as of this date.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {result.contributors.map((c) => (
              <ContributorRow key={c.seriesId} c={c} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
