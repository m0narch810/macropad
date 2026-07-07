import { computeWindowedBias, momentumSignal, distanceSignal, type Cadence } from "@/lib/stats";

export type SignalMethod = "positioning" | "momentum" | "anchor" | "threshold";

export interface SignalConfig {
  method: SignalMethod;
  /** momentum: how many trailing periods to compare against the prior equal window. */
  momentumWindow?: number;
  /** anchor/threshold: the reference value the series is judged against. */
  reference?: number;
  /** anchor/threshold: distance from reference that reads as a "full" ±1 signal. */
  band?: number;
  /** One-line, human explanation of why this method fits this indicator — shown in the UI. */
  rationale: string;
}

/**
 * Every indicator's bias is computed with the method that actually fits how
 * it behaves economically, not one generic z-score for everything:
 *
 * - positioning: genuinely mean-reverting / self-referential (COT crowding,
 *   consumer sentiment, commodity ratios with no fixed fair value). A
 *   robust (median/MAD) z-score + percentile IS the right tool here.
 * - momentum: the level is arbitrary or structurally drifting, but the
 *   trend is the signal (payroll growth, WALCL pace, claims, M2, rate
 *   direction as a financial-conditions read).
 * - anchor: there's a real economic reference point the series is judged
 *   against (2% inflation target, ~2% trend GDP growth, NAIRU-ish
 *   unemployment).
 * - threshold: a sign flip is the meaningful event (curve inversion), not
 *   the magnitude on either side of it.
 */
const SIGNAL_CONFIG: Record<string, SignalConfig> = {
  "us-macro:h41-balance-sheet": {
    method: "momentum",
    momentumWindow: 13,
    rationale: "The level is meaningless on its own (it's grown 10x since 2008) — what matters is whether it's expanding (QE) or contracting (QT) right now.",
  },
  "us-macro:sofr-effr-iorb": {
    method: "momentum",
    momentumWindow: 10,
    rationale: "Funding rate direction (tightening vs. easing) is the signal, not the absolute level, which just tracks Fed policy rate changes.",
  },
  "us-macro:hy-credit-spread": {
    method: "anchor",
    reference: 4,
    band: 1.5,
    rationale: "Credit spreads have a real fair-value range: sub-3% is complacent, 3-5% is normal, 6%+ is stress. Judged against that range, not its own multi-year history.",
  },
  "us-macro:cpi-yoy": { method: "anchor", reference: 2, band: 1, rationale: "Judged against the Fed's actual 2% inflation target." },
  "us-macro:unemployment": {
    method: "anchor",
    reference: 4.2,
    band: 1.2,
    rationale: "Judged against a rough NAIRU (non-accelerating-inflation rate of unemployment) estimate, not its own historical range which spans both 3.5% and 14%.",
  },
  "us-macro:payrolls": {
    method: "momentum",
    momentumWindow: 6,
    rationale: "The level (160M+ jobs) is meaningless — job growth trend is the signal.",
  },
  "us-macro:m2": { method: "momentum", momentumWindow: 12, rationale: "Money supply growth rate, not the level, is what drives the liquidity story." },
  "us-macro:10y-yield": {
    method: "momentum",
    momentumWindow: 20,
    rationale: "Financial conditions tighten or ease based on the recent move in yields, not the absolute level, which has structurally shifted across cycles.",
  },
  "us-macro:industrial-production": { method: "momentum", momentumWindow: 12, rationale: "An index level (2017=100) is arbitrary — production growth trend is the signal." },
  "us-macro:consumer-sentiment": { method: "positioning", rationale: "A survey index with no fixed fair value — judged against its own historical range." },
  "us-macro:core-pce": { method: "anchor", reference: 2, band: 1, rationale: "The Fed's actual target metric, judged directly against 2%." },
  "us-macro:core-cpi": { method: "anchor", reference: 2, band: 1, rationale: "Judged against the same 2% target core inflation is meant to approach." },
  "us-macro:jobless-claims": { method: "momentum", momentumWindow: 8, rationale: "The \"normal\" claims level drifts with labor force size — the trend (rising vs. falling) is what signals labor market turns." },
  "us-macro:gdp": { method: "anchor", reference: 2, band: 1.5, rationale: "Judged against ~2% trend/potential US growth." },
  "us-macro:reverse-repo": { method: "momentum", momentumWindow: 20, rationale: "RRP facility size has shifted structurally (near-zero to $2.5T to near-zero again) — the direction of change is the liquidity signal." },
  "us-macro:retail-sales": { method: "anchor", reference: 3, band: 3, rationale: "Judged against a rough ~3% nominal trend growth rate (real growth + inflation)." },
  "us-macro:housing-starts": { method: "anchor", reference: 0, band: 10, rationale: "YoY growth judged against flat (0%) — housing YoY swings ±15-20% are normal, so the band is wide." },

  "yield-rates:10y2y-spread": { method: "threshold", reference: 0, band: 0.3, rationale: "Inversion (crossing zero) is the meaningful event — a textbook threshold signal, not a magnitude one." },
  "yield-rates:10y3m-spread": { method: "threshold", reference: 0, band: 0.3, rationale: "Same logic as 2s10s — the NY Fed's own model treats this as a sign flip, not a continuous z-score." },
  "yield-rates:2y-yield": { method: "momentum", momentumWindow: 20, rationale: "Front-end rate direction (pricing hikes vs. cuts) is the signal." },
  "yield-rates:10y-yield": { method: "momentum", momentumWindow: 20, rationale: "Same financial-conditions framing as the us-macro 10y card." },
  "yield-rates:30y-yield": { method: "momentum", momentumWindow: 20, rationale: "Long-bond yield direction, independent of the structurally-shifting absolute level." },
  "yield-rates:10y-cot": { method: "positioning", rationale: "Speculative positioning is genuinely a crowding/mean-reversion signal." },
  "yield-rates:2y-cot": { method: "positioning", rationale: "Same — front-end positioning extremes are a crowding signal." },
  "yield-rates:breakeven": { method: "anchor", reference: 2.2, band: 0.5, rationale: "Judged against a target-consistent ~2.2% breakeven (2% CPI target plus typical risk premium)." },
  "yield-rates:forward-inflation": { method: "anchor", reference: 2.2, band: 0.3, rationale: "The Fed's own long-run anchoring gauge — tight band since this is supposed to stay very stable." },

  "cot:es": { method: "positioning", rationale: "Speculative positioning extremes are a crowding/mean-reversion signal by nature." },
  "cot:nq": { method: "positioning", rationale: "Same — crowding signal." },
  "cot:treasury": { method: "positioning", rationale: "Same — crowding signal." },
  "cot:commodities-dxy": { method: "positioning", rationale: "Same — crowding signal." },
  "cot:gold": { method: "positioning", rationale: "Same — crowding signal." },
  "cot:crude": { method: "positioning", rationale: "Same — crowding signal." },
  "cot:silver": { method: "positioning", rationale: "Same — crowding signal, amplified by silver's thinner market." },

  "transmission:copper-crude": { method: "positioning", rationale: "No fixed fair value for this ratio — judged against its own range." },
  "transmission:copper-gold": { method: "positioning", rationale: "No fixed fair value — judged against its own range." },
  "transmission:gold-silver": { method: "positioning", rationale: "No fixed fair value — judged against its own range." },
  "transmission:crude-natgas": { method: "positioning", rationale: "No fixed fair value — judged against its own range." },
  "transmission:silver": { method: "positioning", rationale: "Commodity price with no fixed fair value — judged against its own range." },
  "transmission:natgas": { method: "positioning", rationale: "Commodity price with no fixed fair value — judged against its own range." },
  "transmission:walcl": { method: "momentum", momentumWindow: 13, rationale: "Same as the us-macro balance sheet card — pace, not level." },

  "geo:vix": { method: "anchor", reference: 17, band: 7, rationale: "VIX has a well-known long-run average (~17) and regime bands (<15 calm, 15-20 normal, 20-30 elevated, 30+ crisis)." },
  "geo:ovx": { method: "anchor", reference: 35, band: 15, rationale: "Crude vol runs structurally higher than equity vol — judged against its own typical ~30-40 range." },
  "geo:gvz": { method: "anchor", reference: 17, band: 7, rationale: "Gold vol's typical range is close to VIX's — judged the same way." },
};

export interface IndicatorSignal {
  score: number; // -1..1
  method: SignalMethod;
  rationale: string;
}

/** Read-only lookup of an indicator's method + params, for the UI to pick a matching chart layout. */
export function getSignalConfig(seriesId: string): SignalConfig | null {
  return SIGNAL_CONFIG[seriesId] ?? null;
}

/**
 * Computes the bias score for a series using whichever method actually fits
 * it (see SIGNAL_CONFIG above), from a chronological value array truncated
 * to whatever "as of" point the caller wants — same array shape works for
 * both the live read and the no-lookahead replay/backtest. `cadence` is
 * only used by the positioning method (to size its lookback window) — the
 * caller already knows it from inferCadence() on the dated history.
 */
export function computeIndicatorSignal(seriesId: string, values: number[], cadence: Cadence): IndicatorSignal | null {
  const config = SIGNAL_CONFIG[seriesId];
  if (!config) return null;

  if (config.method === "positioning") {
    const { blended } = computeWindowedBias(values, cadence);
    if (blended === null) return null;
    return { score: blended, method: "positioning", rationale: config.rationale };
  }

  if (config.method === "momentum") {
    const score = momentumSignal(values, config.momentumWindow ?? 10);
    if (score === null) return null;
    return { score, method: "momentum", rationale: config.rationale };
  }

  // anchor and threshold both reduce to the same distance-from-reference math
  const latest = values[values.length - 1];
  const score = distanceSignal(latest, config.reference ?? 0, config.band ?? 1);
  return { score, method: config.method, rationale: config.rationale };
}
