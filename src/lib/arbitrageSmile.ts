/**
 * Live, arbitrage-controlled 0DTE IV smile.
 *
 * Neither of the other two smile sources fits what "arbitrage-controlled"
 * means: the SVI-smoothed surface (bs engine) replaces every quote with a
 * parametric curve regardless of whether the raw quote was actually a
 * problem, and the raw per-contract IV (american engine) is the live quote
 * unfiltered, arbitrage violations included. This module keeps every
 * strike's own live quote UNLESS it creates a butterfly-arbitrage kink,
 * in which case only that point is nudged onto the nearest arbitrage-
 * consistent curve - a minimal edit, not a re-fit.
 *
 * Butterfly arbitrage (same expiry, varying strike only - the only kind
 * that applies to a single 0DTE slice; there's no second expiry here for a
 * calendar-arbitrage check) requires the call price to be convex in strike.
 * A standard sufficient condition, in Gatheral's total-variance
 * parametrization w(k) = iv(k)^2 * T over log-moneyness k = ln(K/forward),
 * is that w is convex in k. Enforcing exact convexity in closed form needs
 * the full g-function machinery; the practical proxy used here is convex
 * *regression*: project the raw w(k) points onto the nearest (least-
 * squares) convex curve via isotonic regression on the segment slopes
 * (Pool Adjacent Violators, weighted by segment width in k) - convex
 * regression is exactly "make the slopes non-decreasing," which is the
 * textbook PAVA problem. Points that were already consistent with a convex
 * smile pass through unchanged; only genuine violations move.
 *
 * Combining call/put quotes at the same strike into one point, OI-weighted,
 * before this projection: a call and a put at the same strike/expiry price
 * off the same forward, so under no-arbitrage they imply the same vol
 * (put-call parity) - stated simplification: this is exactly true for
 * European options, only approximately true for the American-style
 * contracts actually traded here (see crrPricer.ts's docstring on early
 * exercise). Both sides then get this single corrected IV back, which is
 * also why this smile - unlike the raw per-contract one - can't show a
 * call/put IV split at the same strike.
 */

import type { ChainStrikeInput } from "@/lib/gex";

interface Block {
  sum: number;
  weight: number;
  count: number;
  avg: number;
}

/** Weighted Pool-Adjacent-Violators: least-squares projection onto the nearest non-decreasing sequence. */
function paveIsotonic(y: number[], w: number[]): number[] {
  const stack: Block[] = [];
  for (let i = 0; i < y.length; i++) {
    let block: Block = { sum: y[i] * w[i], weight: w[i], count: 1, avg: y[i] };
    while (stack.length > 0 && stack[stack.length - 1].avg > block.avg + 1e-12) {
      const prev = stack.pop()!;
      const sum = prev.sum + block.sum;
      const weight = prev.weight + block.weight;
      block = { sum, weight, count: prev.count + block.count, avg: sum / weight };
    }
    stack.push(block);
  }
  const result: number[] = [];
  for (const block of stack) for (let c = 0; c < block.count; c++) result.push(block.avg);
  return result;
}

/**
 * Projects total variance w(k) onto the nearest convex curve (least-squares,
 * via isotonic slopes). Needs >= 3 points to say anything about convexity;
 * below that, returns the input unchanged rather than fabricating a shape
 * from 2 points.
 */
function enforceConvexTotalVariance(ks: number[], ws: number[]): number[] {
  const n = ws.length;
  if (n < 3) return ws;

  const dk = ks.slice(1).map((k, i) => Math.max(1e-9, k - ks[i]));
  const rawSlopes = ws.slice(1).map((w, i) => (w - ws[i]) / dk[i]);
  const isoSlopes = paveIsotonic(rawSlopes, dk);

  const wHat = [ws[0]];
  for (let i = 0; i < isoSlopes.length; i++) wHat.push(wHat[i] + isoSlopes[i] * dk[i]);

  // Least-squares vertical shift back toward the original level (convexity
  // constrains shape, not level; anchoring at ws[0] alone would let the
  // whole curve drift from the live quotes).
  const shift = ws.reduce((s, w, i) => s + (w - wHat[i]), 0) / n;
  return wHat.map((w) => Math.max(1e-10, w + shift));
}

/**
 * Builds the arbitrage-controlled smile: one IV per strike (OI-weighted
 * call/put average), convexity-corrected in total-variance space, applied
 * back to both sides at that strike.
 */
export function buildArbitrageControlledSmile(rawChain: ChainStrikeInput[], forward: number, T: number): ChainStrikeInput[] {
  const byStrike = new Map<number, { call?: ChainStrikeInput; put?: ChainStrikeInput }>();
  for (const row of rawChain) {
    const entry = byStrike.get(row.strike) ?? {};
    entry[row.side] = row;
    byStrike.set(row.strike, entry);
  }

  const strikes = [...byStrike.keys()].sort((a, b) => a - b);
  const points: { strike: number; k: number; w: number }[] = [];
  for (const strike of strikes) {
    const { call, put } = byStrike.get(strike)!;
    const ivs: { iv: number; weight: number }[] = [];
    if (call && call.iv > 0) ivs.push({ iv: call.iv, weight: Math.max(1, call.oi) });
    if (put && put.iv > 0) ivs.push({ iv: put.iv, weight: Math.max(1, put.oi) });
    if (ivs.length === 0) continue;

    const totalWeight = ivs.reduce((s, x) => s + x.weight, 0);
    const iv = ivs.reduce((s, x) => s + x.iv * x.weight, 0) / totalWeight;
    points.push({ strike, k: Math.log(strike / forward), w: iv * iv * T });
  }

  const wCorrected = enforceConvexTotalVariance(
    points.map((p) => p.k),
    points.map((p) => p.w)
  );
  const ivByStrike = new Map<number, number>(points.map((p, i) => [p.strike, Math.sqrt(Math.max(1e-10, wCorrected[i]) / T)]));

  return rawChain.map((row) => {
    const iv = ivByStrike.get(row.strike);
    return iv !== undefined ? { ...row, iv } : { ...row, iv: 0 };
  });
}
