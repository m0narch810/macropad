import esDaily from "../../ml/results/es_daily.json";
import esWeekly from "../../ml/results/es_weekly.json";
import nqDaily from "../../ml/results/nq_daily.json";
import nqWeekly from "../../ml/results/nq_weekly.json";

/**
 * Feature-importance evidence from the ml/ RandomForest walk-forward backtests.
 *
 * This is deliberately surfaced as EVIDENCE, not as a signal or a weight:
 * the models' directional edge is modest (mid-50s hit rate, near-zero
 * pred/actual correlation), so nothing here should auto-drive a bias. What
 * the importances are good for is telling the user which inputs have
 * historically carried information about ES/NQ forward returns, so they can
 * decide what to lean on when forming their own view.
 */

interface RunFeature {
  feature: string;
  importance: number;
}

interface BacktestRun {
  n_predictions: number;
  hit_rate_all: number;
  top_features: RunFeature[];
  dates_backtested: string[];
  asset: string;
  horizon: string;
}

export interface BacktestEvidence {
  /** Share of model feature importance (level + change + staleness columns combined), per run. */
  esWeekly: number | null;
  nqWeekly: number | null;
  esDaily: number | null;
  nqDaily: number | null;
  /** Best weekly share across ES/NQ — the ranking key (the dashboard's read is weekly). */
  weeklyShare: number;
  /** 1-based rank among all indicators that appear in either weekly run. */
  rank: number;
  /** How many indicators appear in the weekly runs at all. */
  rankedCount: number;
}

/** Saved results only keep each run's top features; ids look like "us-macro:gdp__chg". */
function baseId(feature: string): string {
  return feature.replace(/__(chg|stale_days)$/, "");
}

function sharesByIndicator(run: BacktestRun): Map<string, number> {
  const shares = new Map<string, number>();
  for (const f of run.top_features) {
    const id = baseId(f.feature);
    shares.set(id, (shares.get(id) ?? 0) + f.importance);
  }
  return shares;
}

const ES_WEEKLY = sharesByIndicator(esWeekly as BacktestRun);
const NQ_WEEKLY = sharesByIndicator(nqWeekly as BacktestRun);
const ES_DAILY = sharesByIndicator(esDaily as BacktestRun);
const NQ_DAILY = sharesByIndicator(nqDaily as BacktestRun);

const EVIDENCE: Map<string, BacktestEvidence> = (() => {
  const weeklyIds = new Set([...ES_WEEKLY.keys(), ...NQ_WEEKLY.keys()]);
  const ranked = [...weeklyIds]
    .map((id) => ({ id, weeklyShare: Math.max(ES_WEEKLY.get(id) ?? 0, NQ_WEEKLY.get(id) ?? 0) }))
    .sort((a, b) => b.weeklyShare - a.weeklyShare);

  const map = new Map<string, BacktestEvidence>();
  ranked.forEach(({ id, weeklyShare }, i) => {
    map.set(id, {
      esWeekly: ES_WEEKLY.get(id) ?? null,
      nqWeekly: NQ_WEEKLY.get(id) ?? null,
      esDaily: ES_DAILY.get(id) ?? null,
      nqDaily: NQ_DAILY.get(id) ?? null,
      weeklyShare,
      rank: i + 1,
      rankedCount: ranked.length,
    });
  });
  return map;
})();

export function getBacktestEvidence(seriesId: string): BacktestEvidence | null {
  return EVIDENCE.get(seriesId) ?? null;
}

const pct = (x: number | null) => (x === null ? "—" : `${(x * 100).toFixed(1)}%`);

export function backtestTooltip(ev: BacktestEvidence): string {
  const es = esWeekly as BacktestRun;
  const nq = nqWeekly as BacktestRun;
  const [from, to] = es.dates_backtested;
  return (
    `Walk-forward RandomForest backtest (${from} → ${to}): this indicator (level + change) carried ` +
    `${pct(ev.esWeekly)} of ES / ${pct(ev.nqWeekly)} of NQ weekly-model feature importance ` +
    `(rank ${ev.rank} of ${ev.rankedCount}). Model hit rate: ES ${pct(es.hit_rate_all)}, NQ ${pct(nq.hit_rate_all)} ` +
    `over ~${es.n_predictions} predictions. Historical relevance evidence — not a directional signal.`
  );
}
