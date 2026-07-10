"use client";

import { useMemo, useState } from "react";
import type { MacroPanel } from "@/lib/macroData";
import {
  computeMacroBias,
  TIMEFRAMES,
  DEFAULT_TIMEFRAME,
  ASSET_SCOPES,
  DEFAULT_ASSET_SCOPE,
  type IndicatorRead,
  type PillarResult,
} from "@/lib/macroBias";

function toneColor(tone: "up" | "down" | "flat"): string {
  return tone === "up" ? "var(--up)" : tone === "down" ? "var(--down)" : "var(--flat)";
}

function verdictLabel(tone: "up" | "down" | "flat", strength: "mild" | "strong" | "extreme" | null): string {
  if (tone === "flat" || !strength) return "Neutral / mixed";
  const side = tone === "up" ? "Risk-on" : "Risk-off";
  if (strength === "extreme") return `Extreme ${side.toLowerCase()}`;
  if (strength === "strong") return `Strong ${side.toLowerCase()}`;
  return `Mild ${side.toLowerCase()}`;
}

function Bar({ score, tone }: { score: number; tone: "up" | "down" | "flat" }) {
  const clamped = Math.max(-1, Math.min(1, score));
  const pct = ((clamped + 1) / 2) * 100;
  return (
    <div className="relative h-2 rounded-full bg-[var(--border)]">
      <div className="absolute left-1/2 top-1/2 h-3.5 w-px -translate-x-1/2 -translate-y-1/2 bg-[var(--text-faint)]" />
      <div
        className="absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 -translate-x-1/2 rounded-full border-2 border-[var(--panel)]"
        style={{ left: `${pct}%`, background: toneColor(tone) }}
      />
    </div>
  );
}

function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
}) {
  return (
    <div className="flex flex-wrap rounded-md border border-[var(--border)] bg-[var(--panel-2)] p-0.5">
      {options.map((opt) => (
        <button
          key={opt.id}
          onClick={() => onChange(opt.id)}
          className="rounded px-2.5 py-1 font-sans text-[0.7rem] font-semibold transition-colors"
          style={
            value === opt.id
              ? { background: "color-mix(in srgb, var(--accent) 18%, transparent)", color: "var(--accent)" }
              : { color: "var(--text-faint)" }
          }
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function IndicatorRow({ indicator, weight }: { indicator: IndicatorRead; weight: number }) {
  return (
    <div className="flex items-center gap-3 px-3 py-2">
      <div className="min-w-0 flex-1">
        <div className="truncate font-sans text-[0.78rem]">
          {indicator.name}
          {weight !== 1 && (
            <span className="ml-1.5 font-mono text-[0.6rem] text-[var(--text-faint)]">{weight.toFixed(1)}x</span>
          )}
        </div>
        {indicator.label && (
          <div className="truncate font-mono text-[0.62rem] text-[var(--text-faint)]">{indicator.label}</div>
        )}
      </div>
      <div className="w-24 shrink-0">
        {indicator.directional !== null ? <Bar score={indicator.directional} tone={indicator.tone} /> : null}
      </div>
      <div className="w-12 shrink-0 text-right font-mono text-[0.72rem]" style={{ color: indicator.directional !== null ? toneColor(indicator.tone) : "var(--text-faint)" }}>
        {indicator.directional === null ? "-" : `${indicator.directional > 0 ? "+" : ""}${indicator.directional.toFixed(2)}`}
      </div>
    </div>
  );
}

function PillarCard({ pillar, weights }: { pillar: PillarResult; weights: Record<string, number> }) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--panel)]">
      <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] px-4 py-3">
        <div className="min-w-0">
          <div className="font-sans text-[0.88rem] font-semibold">{pillar.label}</div>
          <div className="mt-0.5 font-sans text-[0.7rem] leading-snug text-[var(--text-faint)]">{pillar.description}</div>
        </div>
        <div className="shrink-0 text-right">
          <div className="font-mono text-[1rem] font-bold" style={{ color: pillar.score !== null ? toneColor(pillar.tone) : "var(--text-faint)" }}>
            {pillar.score === null ? "-" : `${pillar.score > 0 ? "+" : ""}${pillar.score.toFixed(2)}`}
          </div>
          <div className="font-mono text-[0.6rem] uppercase tracking-wide text-[var(--text-faint)]">
            {pillar.score === null ? "no data" : verdictLabel(pillar.tone, pillar.strength)}
          </div>
        </div>
      </div>
      {pillar.score !== null && (
        <div className="px-4 pt-3">
          <Bar score={pillar.score} tone={pillar.tone} />
        </div>
      )}
      <div className="divide-y divide-[var(--border)] px-1 py-1">
        {pillar.indicators.map((indicator) => (
          <IndicatorRow key={indicator.seriesId} indicator={indicator} weight={weights[indicator.seriesId] ?? 1} />
        ))}
      </div>
    </div>
  );
}

export default function MacroBiasPage({ panels }: { panels: MacroPanel[] }) {
  const [timeframeId, setTimeframeId] = useState(DEFAULT_TIMEFRAME);
  const [assetScopeId, setAssetScopeId] = useState(DEFAULT_ASSET_SCOPE);

  const scope = ASSET_SCOPES.find((s) => s.id === assetScopeId) ?? ASSET_SCOPES[0];
  const timeframe = TIMEFRAMES.find((t) => t.id === timeframeId) ?? TIMEFRAMES[TIMEFRAMES.length - 1];

  const bias = useMemo(
    () => computeMacroBias(panels, { historyDays: timeframe.days, indicatorWeights: scope.indicatorWeights, horizon: timeframe.horizon }),
    [panels, timeframe.days, timeframe.horizon, scope.indicatorWeights]
  );
  const { overall, pillars } = bias;

  return (
    <div>
      <div className="mb-6 rounded-lg border border-[var(--border)] bg-[var(--panel)] p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="font-sans text-[0.68rem] uppercase tracking-wide text-[var(--text-faint)]">Overall macro bias</div>
            <div className="mt-1 font-sans text-[1rem] font-semibold">
              {overall.score === null ? "Insufficient data" : verdictLabel(overall.tone, overall.strength)}
            </div>
          </div>
          <span
            className="rounded-full border px-4 py-1.5 text-[0.9rem] font-bold"
            style={{
              color: toneColor(overall.tone),
              borderColor: `color-mix(in srgb, ${toneColor(overall.tone)} 40%, var(--border))`,
              background: `color-mix(in srgb, ${toneColor(overall.tone)} 12%, transparent)`,
            }}
          >
            {overall.score === null ? "-" : `${overall.score > 0 ? "+" : ""}${overall.score.toFixed(2)}`}
          </span>
        </div>
        {overall.score !== null && (
          <div className="mt-4">
            <Bar score={overall.score} tone={overall.tone} />
          </div>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-4 border-t border-[var(--border)] pt-4">
          <div className="flex items-center gap-2">
            <span className="font-sans text-[0.68rem] uppercase tracking-wide text-[var(--text-faint)]">Timeframe</span>
            <SegmentedControl options={TIMEFRAMES.map((t) => ({ id: t.id, label: t.label }))} value={timeframeId} onChange={setTimeframeId} />
          </div>
          <div className="flex items-center gap-2">
            <span className="font-sans text-[0.68rem] uppercase tracking-wide text-[var(--text-faint)]">Asset scope</span>
            <SegmentedControl options={ASSET_SCOPES.map((s) => ({ id: s.id, label: s.label }))} value={assetScopeId} onChange={setAssetScopeId} />
          </div>
        </div>

        <p className="mt-4 font-sans text-[0.72rem] leading-relaxed text-[var(--text-faint)]">
          Weighted average across every indicator&apos;s method-scored read over the selected lookback, grouped into
          seven pillars (growth, inflation, liquidity, rates, credit, positioning, volatility) for the breakdown
          below. Asset scope is a fixed preset, and deliberately polarized: indicators disconnected from that asset
          class (nat-gas positioning for an equities read, credit spreads for FX) are excluded outright at 0x, not
          softly diluted, while the ones that actually move it are weighted up sharply (e.g. Equities leans on net
          liquidity, credit spreads, and vol; Rates leans on the curve and inflation prints). Timeframe does the
          same to the pillar mix: short horizons (D/W/M) exclude growth and inflation entirely - a monthly print
          hasn&apos;t moved inside a week - and weight positioning/volatility up sharply; long horizons (6M/Y/2Y)
          exclude positioning and volatility - COT crowding has fully turned over many times inside a 2-year window
          - and weight growth, inflation, and credit up instead. None of this is user-adjustable. Positive =
          risk-on, negative = risk-off.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {pillars
          .filter((pillar) => pillar.indicators.length > 0)
          .map((pillar) => (
            <PillarCard key={pillar.id} pillar={pillar} weights={scope.indicatorWeights} />
          ))}
      </div>
    </div>
  );
}
