/**
 * Blind Spots engine. Different question from reversalEngine.ts:
 *
 *   Reversal Levels: where does the target's OWN options structure
 *   support a reversal?
 *   Blind Spots: where could the target react because of positioning
 *   hidden in correlated markets?
 *
 * Upstream reality check (this constrains the whole design): this app's
 * source API only carries genuinely distinct data for four tickers - QQQ,
 * SPY, SPX, NDX (every other ticker silently falls back to SPX's own data,
 * confirmed directly against live traffic - see route.ts's ALLOWED_SYMBOLS
 * comment). There is no real per-constituent (NVDA/MSFT/AAPL/...) options
 * data available. So "related markets" here means the other three of
 * those four real tickers, not individual mega-cap names or synthetic
 * baskets - QQQ/NDX are the same index two ways, SPY/SPX are the same
 * index two ways, and QQQ-vs-SPY/SPX is a genuine distinct cross-market
 * relationship. That's still real, useful cross-asset information (a
 * QQQ page blind to what NDX's or SPY's own dealer structure implies),
 * just not the full mega-cap-constituent version the spec describes -
 * documented here rather than faked with placeholder tickers.
 *
 * Each source's own already-computed engines (gamma/delta/vanna/charm)
 * supply candidate structural levels. Each is translated into target-price
 * space via an empirically-fit beta (log-return regression over the same
 * recent 5-minute candles already fetched for each symbol's exposure
 * pages - no stored history, no options-history snapshot). Translated
 * levels are clustered; a cluster only publishes if at least two
 * independent source markets and at least three total structural
 * contributions land in it (spec's compressed filter list). Internally
 * every cluster is scored and classified, but only price + a coarse
 * strength/confidence pair are exposed - never the source assets, the
 * Greek mechanism, or a numeric score, per the "deliberately vague"
 * interface requirement.
 *
 * Compressions vs. the full spec (documented, not hidden, same posture as
 * every other engine in this app):
 *  - Constituent Pressure Projection / Hidden Basket Levels: not
 *    implemented as separate mechanisms (no per-constituent data exists
 *    upstream) - the general cross-asset clustering below is the honest
 *    substitute.
 *  - Synchronized Trigger / Residual Reconnection / Correlation-Break are
 *    not three separate algorithms - their spirit (multiple independent
 *    structural events converging near one price; the target trading away
 *    from where its correlated peers imply it should be) is folded into
 *    the general clustering + resonance scoring rather than kept as
 *    distinct named mechanisms.
 *  - Arrival-adjusted survival uses each source's own remaining 0DTE hours
 *    as a decay proxy, not a full re-repricing of every source's chain at
 *    a future contact time (that would require shipping full option
 *    chains cross-symbol, which none of the other five pages do either).
 *  - Beta is fit from whatever 5-minute candles are already on hand for
 *    each symbol (matched by array position, not merged by timestamp) -
 *    a short-window empirical relationship, not a multi-window/vol-
 *    adjusted/residual composite.
 */

import type { CrossExpiryRow, GexSymbol } from "@/lib/gex";
import type { GammaEngineResult } from "@/lib/gammaEngine";
import type { DeltaEngineResult } from "@/lib/deltaEngine";
import type { VannaEngineResult } from "@/lib/vannaEngine";
import type { CharmEngineResult } from "@/lib/charmEngine";

export interface BlindSpotCandle {
  close: number;
}

export interface BlindSpotAssetInput {
  symbol: GexSymbol;
  spot: number;
  dteHours: number;
  candles: BlindSpotCandle[];
  crossExpiry: CrossExpiryRow[];
  gammaEngine?: GammaEngineResult;
  deltaEngine?: DeltaEngineResult;
  vannaEngine?: VannaEngineResult;
  charmEngine?: CharmEngineResult;
}

// ---------------------------------------------------------------------------
// Beta: empirical log-return regression over whatever candles both symbols
// have on hand right now (matched by array position - both were fetched at
// the same interval around the same time, close enough for an intraday
// directional-response estimate).
// ---------------------------------------------------------------------------

/** Quantizes a price to a scale-appropriate increment so sub-cent floating-point noise between requests doesn't visibly flicker a level that hasn't actually moved. */
function stableRound(price: number, spot: number): number {
  const increment = spot >= 2000 ? 0.5 : 0.02;
  return Math.round(price / increment) * increment;
}

function computeBeta(sourceCandles: BlindSpotCandle[], targetCandles: BlindSpotCandle[]): number {
  const n = Math.min(sourceCandles.length, targetCandles.length);
  if (n < 4) return 1;
  const s = sourceCandles.slice(-n);
  const t = targetCandles.slice(-n);

  const sReturns: number[] = [];
  const tReturns: number[] = [];
  for (let i = 1; i < n; i++) {
    const sPrev = s[i - 1].close;
    const sCur = s[i].close;
    const tPrev = t[i - 1].close;
    const tCur = t[i].close;
    if (!sPrev || !sCur || !tPrev || !tCur || sPrev <= 0 || tPrev <= 0) continue;
    sReturns.push(Math.log(sCur / sPrev));
    tReturns.push(Math.log(tCur / tPrev));
  }
  if (sReturns.length < 3) return 1;
  const meanS = sReturns.reduce((a, b) => a + b, 0) / sReturns.length;
  const meanT = tReturns.reduce((a, b) => a + b, 0) / tReturns.length;
  let cov = 0;
  let varS = 0;
  for (let i = 0; i < sReturns.length; i++) {
    cov += (sReturns[i] - meanS) * (tReturns[i] - meanT);
    varS += (sReturns[i] - meanS) ** 2;
  }
  if (varS < 1e-12) return 1;
  const beta = cov / varS;
  return Math.max(-3, Math.min(3, beta));
}

/** Same-index-family pairs (QQQ<->NDX, SPY<->SPX) carry a structurally tighter relationship than cross-family pairs (QQQ<->SPY/SPX) - this is a fixed, documented approximation standing in for the spec's full index-weight/factor-exposure mapping, which needs constituent data this upstream doesn't have. */
function influenceWeight(target: GexSymbol, source: GexSymbol): number {
  const sameFamily = (a: GexSymbol, b: GexSymbol) => (a === "QQQ" || a === "NDX") === (b === "QQQ" || b === "NDX");
  return sameFamily(target, source) ? 1 : 0.6;
}

// ---------------------------------------------------------------------------
// Candidate structural levels pulled from each source's already-computed
// engines - the same typed levels/pivots the other five pages already show,
// just relocated here instead of re-derived.
// ---------------------------------------------------------------------------

type Mechanism = "gamma" | "dex" | "vanna" | "charm";

interface RawCandidate {
  sourceSymbol: GexSymbol;
  mechanism: Mechanism;
  price: number;
}

function extractCandidates(asset: BlindSpotAssetInput): RawCandidate[] {
  const out: RawCandidate[] = [];
  for (const lvl of asset.gammaEngine?.typedLevels ?? []) {
    if (lvl.type === "pin_basin" || lvl.type === "friction_wall") out.push({ sourceSymbol: asset.symbol, mechanism: "gamma", price: lvl.center });
  }
  if (asset.deltaEngine?.inventoryPivot !== null && asset.deltaEngine?.inventoryPivot !== undefined) {
    out.push({ sourceSymbol: asset.symbol, mechanism: "dex", price: asset.deltaEngine.inventoryPivot });
  }
  if (asset.vannaEngine) {
    if (asset.vannaEngine.flipBand.center !== null) out.push({ sourceSymbol: asset.symbol, mechanism: "vanna", price: asset.vannaEngine.flipBand.center });
    if (asset.vannaEngine.compressionPivot !== null) out.push({ sourceSymbol: asset.symbol, mechanism: "vanna", price: asset.vannaEngine.compressionPivot });
    if (asset.vannaEngine.expansionPivot !== null) out.push({ sourceSymbol: asset.symbol, mechanism: "vanna", price: asset.vannaEngine.expansionPivot });
  }
  const charmPivot30 = asset.charmEngine?.pivots.find((p) => p.horizonLabel === "Next 30 minutes")?.price;
  if (charmPivot30 !== null && charmPivot30 !== undefined) out.push({ sourceSymbol: asset.symbol, mechanism: "charm", price: charmPivot30 });
  return out;
}

/** Remaining 0DTE hours stands in for full arrival-time repricing (unavailable without shipping the source's full chain cross-symbol): a source with very little time left is unlikely to still matter by the time the target could plausibly arrive. */
function survivalProxy(sourceDteHours: number): number {
  return Math.max(0.15, Math.min(1, sourceDteHours / 2));
}

// ---------------------------------------------------------------------------
// Translate + cluster
// ---------------------------------------------------------------------------

interface TranslatedCandidate {
  price: number;
  sourceSymbol: GexSymbol;
  mechanism: Mechanism;
  survival: number;
}

function translateCandidates(target: BlindSpotAssetInput, source: BlindSpotAssetInput): TranslatedCandidate[] {
  const beta = computeBeta(source.candles, target.candles);
  const weight = influenceWeight(target.symbol, source.symbol);
  const survival = survivalProxy(source.dteHours);

  return extractCandidates(source).map((c) => {
    const sourceMovePct = c.price / source.spot - 1;
    const expectedTargetMovePct = sourceMovePct * beta * weight;
    return { price: target.spot * (1 + expectedTargetMovePct), sourceSymbol: c.sourceSymbol, mechanism: c.mechanism, survival };
  });
}

export type BlindSpotStrength = "high" | "standard" | "low";
export type BlindSpotDirection = "upper" | "lower";

export interface BlindSpot {
  price: number;
  direction: BlindSpotDirection;
  strength: BlindSpotStrength;
  active: boolean;
}

export interface BlindSpotsResult {
  levels: BlindSpot[];
  diagnostics: {
    pricingModel: string;
    sourcesUsed: GexSymbol[];
    levelsFound: number;
    lastCalculatedAt: number;
  };
}

function clusterSide(candidates: TranslatedCandidate[], spot: number, target: BlindSpotAssetInput, direction: BlindSpotDirection): BlindSpot[] {
  if (!candidates.length) return [];
  const sorted = [...candidates].sort((a, b) => a.price - b.price);
  const tolerance = Math.max(0.05, spot * 0.0015);

  const clusters: TranslatedCandidate[][] = [];
  let current: TranslatedCandidate[] = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].price - sorted[i - 1].price <= tolerance) current.push(sorted[i]);
    else {
      clusters.push(current);
      current = [sorted[i]];
    }
  }
  clusters.push(current);

  const nextDominant = [...target.crossExpiry].filter((r) => r.dte > 0).sort((a, b) => Math.abs(b.netGex) - Math.abs(a.netGex))[0];
  const crossExpirySupport = nextDominant ? Math.sign(nextDominant.netGex) === (direction === "lower" ? 1 : -1) : false;

  const results: { price: number; score: number; independentSources: number }[] = [];
  for (const cluster of clusters) {
    const independentSources = new Set(cluster.map((c) => c.sourceSymbol)).size;
    const mechanisms = new Set(cluster.map((c) => c.mechanism)).size;
    const contributions = cluster.length;
    if (independentSources < 2 || contributions < 3) continue;

    const avgSurvival = cluster.reduce((s, c) => s + c.survival, 0) / cluster.length;
    const price = cluster.reduce((s, c) => s + c.price, 0) / cluster.length;

    const score = Math.min(
      100,
      independentSources * 20 + contributions * 8 + (mechanisms >= 2 ? 15 : 0) + (crossExpirySupport ? 15 : 0) + avgSurvival * 20
    );
    results.push({ price, score, independentSources });
  }

  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, 2)
    .map((r) => ({
      price: stableRound(r.price, spot),
      direction,
      strength: r.score >= 70 ? "high" : r.score >= 40 ? "standard" : "low",
      active: r.independentSources >= 3,
    }));
}

/** Fallback (compressed from the spec's 7-tier hierarchy to one honest tier): the target's own next-dominant cross-expiry gamma resistance/support, used only when no cross-asset cluster survives on that side. Still cross-expiry structure, not today's own obvious GEX wall. */
function fallbackLevel(target: BlindSpotAssetInput, direction: BlindSpotDirection): BlindSpot | null {
  const nextDominant = [...target.crossExpiry].filter((r) => r.dte > 0).sort((a, b) => Math.abs(b.netGex) - Math.abs(a.netGex))[0];
  if (!nextDominant) return null;
  const price = direction === "upper" ? nextDominant.callResistance : nextDominant.putSupport;
  if (price === null || price === undefined) return null;
  return { price: stableRound(price, target.spot), direction, strength: "low", active: false };
}

export function computeBlindSpots(target: BlindSpotAssetInput, sources: BlindSpotAssetInput[]): BlindSpotsResult {
  const allTranslated = sources.flatMap((source) => translateCandidates(target, source));
  const upperCandidates = allTranslated.filter((c) => c.price > target.spot);
  const lowerCandidates = allTranslated.filter((c) => c.price < target.spot);

  let upperLevels = clusterSide(upperCandidates, target.spot, target, "upper");
  let lowerLevels = clusterSide(lowerCandidates, target.spot, target, "lower");

  if (!upperLevels.length) {
    const fb = fallbackLevel(target, "upper");
    if (fb) upperLevels = [fb];
  }
  if (!lowerLevels.length) {
    const fb = fallbackLevel(target, "lower");
    if (fb) lowerLevels = [fb];
  }

  const levels = [...upperLevels, ...lowerLevels];

  return {
    levels,
    diagnostics: {
      pricingModel: "Cross-asset translation (empirical beta from recent 5-minute candles) of each related market's own gamma/delta/vanna/charm structural levels, clustered and filtered for independent-source agreement",
      sourcesUsed: sources.map((s) => s.symbol),
      levelsFound: levels.length,
      lastCalculatedAt: Date.now(),
    },
  };
}
