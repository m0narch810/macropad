import type { MacroPanel, MacroSeries } from "@/lib/macroData";
import { getBias } from "@/lib/bias";
import { MARKET_LINKS } from "@/lib/markets";
import { computeDistStats, inferCadence, type Cadence } from "@/lib/stats";

export type Horizon = "daily" | "weekly" | "monthly";

export interface BiasContributor {
  seriesId: string;
  name: string;
  panelTitle: string;
  tone: "up" | "down" | "flat";
  zscore: number | null;
  label: string;
  contribution: number; // -1..1, pre-weight
  cadence: Cadence;
  weight: number; // 0..1, how much this horizon cares about this cadence
}

export interface NetBiasResult {
  symbol: string;
  score: number; // -1..1, cadence-weighted average contribution
  verdict: "Net Bullish" | "Net Bearish" | "Mixed / Neutral";
  tone: "up" | "down" | "flat";
  contributors: BiasContributor[];
}

export interface HorizonBias {
  score: number;
  verdict: NetBiasResult["verdict"];
  tone: "up" | "down" | "flat";
  daysUsed: number;
}

/**
 * How much a horizon cares about an indicator with a given release cadence.
 * A monthly print (CPI, payrolls) is what actually moves the monthly picture;
 * on a daily horizon it's stale information sitting there until the next
 * print, so it counts for less. Same logic in reverse for daily series
 * (SOFR, credit spreads) on a monthly horizon — still informative, just not
 * the thing driving this week's read.
 */
const CADENCE_WEIGHT: Record<Horizon, Record<Cadence, number>> = {
  daily: { daily: 1, weekly: 0.55, monthly: 0.25, quarterly: 0.15 },
  weekly: { daily: 0.7, weekly: 1, monthly: 0.5, quarterly: 0.3 },
  monthly: { daily: 0.4, weekly: 0.65, monthly: 1, quarterly: 0.6 },
};

function contributionFor(tone: "up" | "down" | "flat", zscore: number | null): number {
  if (tone === "flat" || zscore === null) return 0;
  const strength = Math.min(Math.abs(zscore) / 2, 1); // saturate at 2 sigma
  return tone === "up" ? strength : -strength;
}

function verdictFor(score: number): { verdict: NetBiasResult["verdict"]; tone: "up" | "down" | "flat" } {
  if (score > 0.2) return { verdict: "Net Bullish", tone: "up" };
  if (score < -0.2) return { verdict: "Net Bearish", tone: "down" };
  return { verdict: "Mixed / Neutral", tone: "flat" };
}

function weightedScore(contributors: BiasContributor[]): number {
  const totalWeight = contributors.reduce((a, c) => a + c.weight, 0);
  if (totalWeight === 0) return 0;
  return contributors.reduce((a, c) => a + c.contribution * c.weight, 0) / totalWeight;
}

/** Live read using each series' already-computed current z-score (today, full history), weighted by cadence fit to `horizon`. */
export function computeNetBias(panels: MacroPanel[], symbol: string, horizon: Horizon = "weekly"): NetBiasResult {
  const contributors: BiasContributor[] = [];

  for (const panel of panels) {
    for (const s of panel.series) {
      const link = MARKET_LINKS[s.id];
      if (!link || link.symbol !== symbol) continue;
      const bias = getBias(s.id, s.zscore);
      if (!bias) continue;
      const cadence = s.history && s.history.length >= 3 ? inferCadence(s.history).cadence : "weekly";
      contributors.push({
        seriesId: s.id,
        name: s.name,
        panelTitle: panel.title,
        tone: bias.tone,
        zscore: s.zscore,
        label: bias.label,
        contribution: contributionFor(bias.tone, s.zscore),
        cadence,
        weight: CADENCE_WEIGHT[horizon][cadence],
      });
    }
  }

  const score = weightedScore(contributors);
  const { verdict, tone } = verdictFor(score);
  contributors.sort((a, b) => Math.abs(b.contribution * b.weight) - Math.abs(a.contribution * a.weight));

  return { symbol, score, verdict, tone, contributors };
}

/**
 * Point-in-time read: truncates every linked series to observations dated
 * on or before `asOfDate` and recomputes z-score from that truncated window
 * only. No value dated after asOfDate is ever read — this is what makes the
 * replay honest (no lookahead). Weighted by cadence fit to `horizon`.
 */
export function computeNetBiasAsOf(
  panels: MacroPanel[],
  symbol: string,
  asOfDate: string,
  horizon: Horizon = "weekly"
): NetBiasResult {
  const cutoff = new Date(asOfDate).getTime();
  const contributors: BiasContributor[] = [];

  for (const panel of panels) {
    for (const s of panel.series) {
      const link = MARKET_LINKS[s.id];
      if (!link || link.symbol !== symbol || !s.history) continue;

      const truncated = s.history.filter((p) => new Date(p.date).getTime() <= cutoff);
      if (truncated.length < 5) continue;

      const dist = computeDistStats(truncated.map((p) => p.value));
      if (!dist) continue;

      const bias = getBias(s.id, dist.zscore);
      if (!bias) continue;

      const cadence = inferCadence(truncated).cadence;

      contributors.push({
        seriesId: s.id,
        name: s.name,
        panelTitle: panel.title,
        tone: bias.tone,
        zscore: dist.zscore,
        label: bias.label,
        contribution: contributionFor(bias.tone, dist.zscore),
        cadence,
        weight: CADENCE_WEIGHT[horizon][cadence],
      });
    }
  }

  const score = weightedScore(contributors);
  const { verdict, tone } = verdictFor(score);
  contributors.sort((a, b) => Math.abs(b.contribution * b.weight) - Math.abs(a.contribution * a.weight));

  return { symbol, score, verdict, tone, contributors };
}

function addDays(dateStr: string, delta: number): string {
  const d = new Date(dateStr);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

/**
 * Trailing-window smoothing at the given horizon: averages the cadence-weighted
 * point-in-time score over 1 / 7 / 30 calendar days ending at asOfDate — shows
 * whether the backdrop has been consistently leaning one way, not just what
 * today happens to say.
 */
export function computeHorizonBias(
  panels: MacroPanel[],
  symbol: string,
  asOfDate: string,
  horizon: Horizon = "weekly"
): { daily: HorizonBias; weekly: HorizonBias; monthly: HorizonBias } {
  const windowScores: number[] = [];
  for (let i = 0; i < 30; i++) {
    const d = addDays(asOfDate, -i);
    const result = computeNetBiasAsOf(panels, symbol, d, horizon);
    windowScores.push(result.contributors.length > 0 ? result.score : NaN);
  }

  const avg = (n: number): HorizonBias => {
    const slice = windowScores.slice(0, n).filter((v) => !Number.isNaN(v));
    const score = slice.length ? slice.reduce((a, b) => a + b, 0) / slice.length : 0;
    const { verdict, tone } = verdictFor(score);
    return { score, verdict, tone, daysUsed: slice.length };
  };

  return { daily: avg(1), weekly: avg(7), monthly: avg(30) };
}

export function seriesLinkedToSymbol(series: MacroSeries, symbol: string): boolean {
  return MARKET_LINKS[series.id]?.symbol === symbol;
}
