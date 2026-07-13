/**
 * Raw SVI (Gatheral) single-expiry implied-volatility slice fit.
 *
 * We only ever price one expiry slice at a time (the 0DTE book), so this is
 * single-slice SVI, not a full multi-expiry SSVI surface - stated
 * explicitly, not implied. Raw per-contract IV is noisy (bid/ask spread,
 * stale quotes, thin strikes); SVI fits a smooth, standard 5-parameter
 * curve through it in total-variance/log-moneyness space before any IV
 * reaches the pricer, so a single noisy quote can't swing that strike's
 * Greeks on its own.
 *
 * w(k) = a + b*(rho*(k-m) + sqrt((k-m)^2 + sigma^2))
 * where k = ln(K/F) (log-moneyness vs forward) and w = IV^2 * T (total variance).
 */

export interface SviParams {
  a: number;
  b: number;
  rho: number;
  m: number;
  sigma: number;
}

export function sviTotalVariance(p: SviParams, k: number): number {
  const dk = k - p.m;
  return p.a + p.b * (p.rho * dk + Math.sqrt(dk * dk + p.sigma * p.sigma));
}

export interface SviPoint {
  k: number; // log-moneyness
  w: number; // observed total variance (iv^2 * T)
  weight: number; // e.g. OI-based, so liquid strikes pull the fit harder
}

function sse(params: SviParams, points: SviPoint[]): number {
  let sum = 0;
  for (const pt of points) {
    const model = sviTotalVariance(params, pt.k);
    const residual = model - pt.w;
    sum += pt.weight * residual * residual;
  }
  return sum;
}

/** Nelder-Mead simplex minimization - no external optimization library needed for a 5-parameter fit. */
function nelderMead(objective: (x: number[]) => number, x0: number[], iterations = 400): number[] {
  const n = x0.length;
  const alpha = 1,
    gamma = 2,
    rho = 0.5,
    sigma = 0.5;

  let simplex: number[][] = [x0.slice()];
  for (let i = 0; i < n; i++) {
    const point = x0.slice();
    point[i] += point[i] !== 0 ? point[i] * 0.1 : 0.1;
    simplex.push(point);
  }

  for (let iter = 0; iter < iterations; iter++) {
    simplex.sort((a, b) => objective(a) - objective(b));
    const best = simplex[0];
    const worst = simplex[n];
    const secondWorst = simplex[n - 1];

    const centroid = new Array(n).fill(0);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) centroid[j] += simplex[i][j] / n;
    }

    const reflected = centroid.map((c, j) => c + alpha * (c - worst[j]));
    const reflectedScore = objective(reflected);

    if (reflectedScore < objective(best)) {
      const expanded = centroid.map((c, j) => c + gamma * (reflected[j] - c));
      simplex[n] = objective(expanded) < reflectedScore ? expanded : reflected;
    } else if (reflectedScore < objective(secondWorst)) {
      simplex[n] = reflected;
    } else {
      const contracted = centroid.map((c, j) => c + rho * (worst[j] - c));
      if (objective(contracted) < objective(worst)) {
        simplex[n] = contracted;
      } else {
        simplex = simplex.map((point, i) => (i === 0 ? point : best.map((b, j) => b + sigma * (point[j] - b))));
      }
    }
  }

  simplex.sort((a, b) => objective(a) - objective(b));
  return simplex[0];
}

/** Fits raw SVI to a set of (log-moneyness, total-variance) points. Falls back to the flat-variance average if fewer than 5 points (can't identify 5 params from less data). */
export function fitSvi(points: SviPoint[]): SviParams {
  const validPoints = points.filter((p) => Number.isFinite(p.w) && p.w > 0);
  if (validPoints.length < 5) {
    const avgW = validPoints.reduce((s, p) => s + p.w, 0) / Math.max(1, validPoints.length);
    return { a: avgW || 0.01, b: 0, rho: 0, m: 0, sigma: 0.1 };
  }

  const avgW = validPoints.reduce((s, p) => s + p.w, 0) / validPoints.length;
  const x0 = [avgW * 0.5, avgW * 0.5, -0.3, 0, 0.1]; // [a, b, rho, m, sigma] - reasonable equity-skew starting guess

  const objective = (x: number[]) => {
    const [a, b, rho, m, sigma] = x;
    if (b < 0 || Math.abs(rho) >= 1 || sigma <= 0) return Number.POSITIVE_INFINITY; // keep the fit in the parameter region that defines a valid variance curve
    return sse({ a, b, rho, m, sigma }, validPoints);
  };

  const [a, b, rho, m, sigma] = nelderMead(objective, x0);
  return {
    a,
    b: Math.max(0, b),
    rho: Math.max(-0.999, Math.min(0.999, rho)),
    m,
    sigma: Math.max(1e-4, sigma),
  };
}

/** Smoothed IV at a given strike, from a fitted SVI slice. */
export function sviImpliedVol(params: SviParams, strike: number, forward: number, T: number): number {
  const k = Math.log(strike / forward);
  const w = Math.max(1e-8, sviTotalVariance(params, k));
  return Math.sqrt(w / T);
}
