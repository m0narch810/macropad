import type { MacroPanel, MacroSeries } from "@/lib/macroData";
import type { MarketRow } from "@/lib/getMarkets";
import { getBias } from "@/lib/bias";
import { MARKET_LINKS } from "@/lib/markets";
import { inferCadence, alignByDate, pearson, type Cadence } from "@/lib/stats";
import { computeIndicatorSignal, type SignalMethod } from "@/lib/indicatorSignal";

export type Horizon = "daily" | "weekly" | "monthly";

export interface BiasContributor {
  seriesId: string;
  name: string;
  panelTitle: string;
  tone: "up" | "down" | "flat";
  score: number | null; // -1..1, native units of whatever method applies (not a z-score for most indicators)
  method: SignalMethod;
  methodRationale: string;
  label: string;
  contribution: number; // -1..1, pre-weight
  cadence: Cadence;
  cadenceWeight: number; // 0..1, how much this horizon cares about this cadence
  correlationWeight: number; // 0..1, how empirically related this indicator actually is to the asset
  weight: number; // cadenceWeight * correlationWeight, what actually gets used
  correlation: number | null; // raw signed r, for display
}

export interface NetBiasResult {
  symbol: string;
  score: number; // -1..1, weighted average contribution
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

/**
 * How empirically related an indicator actually is to the asset, not just
 * "someone linked them in markets.ts". Computed fresh from the truncated
 * (no-lookahead) histories every time — an indicator with a weak measured
 * correlation counts for less than one that's historically moved in lockstep,
 * regardless of how intuitive the link sounded when it was written. Floored
 * at 0.15 so a real link never gets fully zeroed out by a noisy short sample.
 */
function correlationWeightFor(seriesHistory: { date: string; value: number }[], marketHistory: { date: string; value: number }[]): { weight: number; r: number | null } {
  const aligned = alignByDate(seriesHistory, marketHistory, 6);
  if (aligned.a.length < 8) return { weight: 0.5, r: null }; // not enough overlap to judge — neutral, not penalized
  const r = pearson(aligned.a, aligned.b);
  if (r === null) return { weight: 0.5, r: null };
  return { weight: 0.15 + 0.85 * Math.min(1, Math.abs(r)), r };
}

/**
 * Builds one contributor from a series' history, truncated to `asOfDate`
 * (or the full series for the live read). The bias score itself comes from
 * computeIndicatorSignal, which picks a method (positioning / momentum /
 * anchor / threshold) suited to how that specific indicator actually
 * behaves — see indicatorSignal.ts. No value dated after asOfDate is ever
 * read, which is what makes the replay path honest (no lookahead).
 */
function buildContributor(
  s: MacroSeries,
  panelTitle: string,
  marketHistory: { date: string; value: number }[] | null,
  asOfDate: string | null,
  horizon: Horizon
): BiasContributor | null {
  if (!s.history) return null;
  const cutoff = asOfDate ? new Date(asOfDate).getTime() : null;
  const truncated = cutoff ? s.history.filter((p) => new Date(p.date).getTime() <= cutoff) : s.history;
  if (truncated.length < 5) return null;

  const cadence = inferCadence(truncated).cadence;
  const signal = computeIndicatorSignal(s.id, truncated.map((p) => p.value), cadence);
  if (!signal) return null;

  // getBias's high/low thresholds are calibrated for a z-like -3..3 scale;
  // signal.score is bounded -1..1 in native units, so rescale just for that lookup.
  const bias = getBias(s.id, signal.score * 3);
  if (!bias) return null;

  const strength = Math.min(Math.abs(signal.score), 1);
  const contribution = bias.tone === "flat" ? 0 : bias.tone === "up" ? strength : -strength;

  const truncatedMarket = marketHistory
    ? cutoff
      ? marketHistory.filter((p) => new Date(p.date).getTime() <= cutoff)
      : marketHistory
    : [];
  const { weight: correlationWeight, r } = marketHistory ? correlationWeightFor(truncated, truncatedMarket) : { weight: 0.5, r: null };

  const cadenceWeight = CADENCE_WEIGHT[horizon][cadence];

  return {
    seriesId: s.id,
    name: s.name,
    panelTitle,
    tone: bias.tone,
    score: signal.score,
    method: signal.method,
    methodRationale: signal.rationale,
    label: bias.label,
    contribution,
    cadence,
    cadenceWeight,
    correlationWeight,
    weight: cadenceWeight * correlationWeight,
    correlation: r,
  };
}

function computeNetBiasCore(
  panels: MacroPanel[],
  markets: MarketRow[],
  symbol: string,
  asOfDate: string | null,
  horizon: Horizon
): NetBiasResult {
  const market = markets.find((m) => m.symbol === symbol);
  const marketHistory = market?.history ?? null;

  const contributors: BiasContributor[] = [];
  for (const panel of panels) {
    for (const s of panel.series) {
      const links = MARKET_LINKS[s.id];
      if (!links || !links.some((l) => l.symbol === symbol)) continue;
      const contributor = buildContributor(s, panel.title, marketHistory, asOfDate, horizon);
      if (contributor) contributors.push(contributor);
    }
  }

  const score = weightedScore(contributors);
  const { verdict, tone } = verdictFor(score);
  contributors.sort((a, b) => Math.abs(b.contribution * b.weight) - Math.abs(a.contribution * a.weight));

  return { symbol, score, verdict, tone, contributors };
}

/** Live read using each series' full available history, weighted by cadence fit AND measured correlation to the asset. */
export function computeNetBias(panels: MacroPanel[], markets: MarketRow[], symbol: string, horizon: Horizon = "weekly"): NetBiasResult {
  return computeNetBiasCore(panels, markets, symbol, null, horizon);
}

/**
 * Point-in-time read: truncates every linked series (and the market's own
 * price history used for correlation weighting) to observations dated on or
 * before `asOfDate` before computing anything — this is what makes the
 * replay, and the backtest built on it, honest (no lookahead).
 */
export function computeNetBiasAsOf(
  panels: MacroPanel[],
  markets: MarketRow[],
  symbol: string,
  asOfDate: string,
  horizon: Horizon = "weekly"
): NetBiasResult {
  return computeNetBiasCore(panels, markets, symbol, asOfDate, horizon);
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
  markets: MarketRow[],
  symbol: string,
  asOfDate: string,
  horizon: Horizon = "weekly"
): { daily: HorizonBias; weekly: HorizonBias; monthly: HorizonBias } {
  const windowScores: number[] = [];
  for (let i = 0; i < 30; i++) {
    const d = addDays(asOfDate, -i);
    const result = computeNetBiasAsOf(panels, markets, symbol, d, horizon);
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

export interface BacktestPoint {
  date: string;
  score: number;
  forwardReturnPct: number | null;
}

export interface BacktestResult {
  points: BacktestPoint[];
  n: number; // points with a forward return available
  correlation: number | null; // score vs forward return
  hitRate: number | null; // 0-100, % where sign(score) matched sign(forward return), score magnitude > 0.1
  avgForwardReturnWhenBullish: number | null;
  avgForwardReturnWhenBearish: number | null;
  horizonDays: number;
}

/**
 * Forward-return window the backtest checks against — literally what each
 * horizon claims to predict: daily = next day, weekly = next week, monthly =
 * next month. Measured in calendar days against daily price bars (see
 * `dailyHistory` below), not the weekly bars used for indicator cadence —
 * weekly bars can't resolve a 1-day-ahead return at all.
 */
const HORIZON_TEST_DAYS: Record<Horizon, number> = { daily: 1, weekly: 7, monthly: 30 };

/** How far off a bar can be from the target date and still count as "that date", in days. Tight — this is what makes daily vs. weekly vs. monthly actually mean something different. */
const HORIZON_TOLERANCE_DAYS: Record<Horizon, number> = { daily: 2, weekly: 3, monthly: 6 };

function nearestBar(
  history: { date: string; value: number }[],
  targetTime: number,
  maxDiffMs: number,
  after: number | null = null
): { date: string; value: number } | null {
  let best: { date: string; value: number } | null = null;
  let bestDiff = Infinity;
  for (const p of history) {
    const t = new Date(p.date).getTime();
    if (after !== null && t <= after) continue;
    const diff = Math.abs(t - targetTime);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = p;
    }
  }
  return best && bestDiff <= maxDiffMs ? best : null;
}

/**
 * Walks the asset's own weekly price history as the set of test dates (macro
 * indicators mostly print weekly/monthly at best, so testing daily asOf-dates
 * would just repeat the same indicator reads), and at every one computes what
 * Net Bias would have said using ONLY data available as of that date (same
 * no-lookahead machinery as the replay). Then, using DAILY price bars,
 * measures what the asset actually did over the literal forward window for
 * the selected horizon (see HORIZON_TEST_DAYS) — falls back to the weekly
 * bars with a looser tolerance if no daily history is available for this
 * symbol. This is the only way to know whether the score means anything — a
 * plausible-sounding methodology that doesn't predict forward returns isn't
 * a useful signal, and this is how you'd catch that.
 */
export function backtestNetBias(
  panels: MacroPanel[],
  markets: MarketRow[],
  symbol: string,
  horizon: Horizon = "weekly",
  horizonDaysOverride?: number
): BacktestResult {
  const horizonDays = horizonDaysOverride ?? HORIZON_TEST_DAYS[horizon];
  const toleranceDays = HORIZON_TOLERANCE_DAYS[horizon];
  const market = markets.find((m) => m.symbol === symbol);
  const points: BacktestPoint[] = [];

  if (!market?.history || market.history.length < 20) {
    return { points, n: 0, correlation: null, hitRate: null, avgForwardReturnWhenBullish: null, avgForwardReturnWhenBearish: null, horizonDays };
  }

  const priceHistory = market.dailyHistory && market.dailyHistory.length >= 20 ? market.dailyHistory : market.history;
  const testDates = market.history.slice(0, -1); // walk weekly grain for asOf dates; need at least one point ahead
  const dayMs = 86_400_000;

  for (const testPoint of testDates) {
    const asOfDate = testPoint.date;
    const result = computeNetBiasAsOf(panels, markets, symbol, asOfDate, horizon);
    if (result.contributors.length === 0) continue;

    const asOfTime = new Date(asOfDate).getTime();
    const startBar = nearestBar(priceHistory, asOfTime, toleranceDays * dayMs) ?? testPoint;
    const targetTime = asOfTime + horizonDays * dayMs;
    const forwardBar = nearestBar(priceHistory, targetTime, toleranceDays * dayMs, asOfTime);

    const forwardReturnPct = forwardBar ? ((forwardBar.value - startBar.value) / startBar.value) * 100 : null;

    points.push({ date: asOfDate, score: result.score, forwardReturnPct });
  }

  const withForward = points.filter((p) => p.forwardReturnPct !== null) as { date: string; score: number; forwardReturnPct: number }[];
  const n = withForward.length;
  const correlation = n >= 8 ? pearson(withForward.map((p) => p.score), withForward.map((p) => p.forwardReturnPct)) : null;

  const meaningful = withForward.filter((p) => Math.abs(p.score) > 0.1);
  const hits = meaningful.filter((p) => Math.sign(p.score) === Math.sign(p.forwardReturnPct));
  const hitRate = meaningful.length >= 5 ? (hits.length / meaningful.length) * 100 : null;

  const bullish = withForward.filter((p) => p.score > 0.2);
  const bearish = withForward.filter((p) => p.score < -0.2);
  const avgForwardReturnWhenBullish = bullish.length ? bullish.reduce((a, p) => a + p.forwardReturnPct, 0) / bullish.length : null;
  const avgForwardReturnWhenBearish = bearish.length ? bearish.reduce((a, p) => a + p.forwardReturnPct, 0) / bearish.length : null;

  return { points, n, correlation, hitRate, avgForwardReturnWhenBullish, avgForwardReturnWhenBearish, horizonDays };
}

export function seriesLinkedToSymbol(series: MacroSeries, symbol: string): boolean {
  return MARKET_LINKS[series.id]?.some((l) => l.symbol === symbol) ?? false;
}
