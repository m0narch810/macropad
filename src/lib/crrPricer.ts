/**
 * Cox-Ross-Rubinstein American binomial option pricer.
 *
 * The plain CRR tree, deliberately kept separate from the Leisen-Reimer tree
 * in americanPricer.ts. CRR's u/d/p come directly from a sqrt(dt)-scaled
 * random walk (u = exp(vol*sqrt(dt)), d = 1/u) rather than Leisen-Reimer's
 * Peizer-Pratt inversion - it oscillates more as step count grows (a real
 * cost for Greeks, see americanPricer.ts's docstring), but it's the
 * textbook binomial-inversion method this third engine option is named
 * for, offered as a distinct, simpler alternative rather than a strictly
 * better one.
 *
 * Paired with buildArbitrageControlledSmile (arbitrageSmile.ts) rather than
 * either the SVI-smoothed surface (bs engine) or raw untouched per-contract
 * IV (american engine): each strike keeps its own live quote unless that
 * quote would put a butterfly-arbitrage kink in the smile, in which case
 * only that point is nudged onto the nearest arbitrage-consistent curve.
 */

export interface PricerInputs {
  spot: number;
  strike: number;
  /** Years to expiry - fractional, from dte_hours where available. */
  T: number;
  vol: number;
  /** Continuously-compounded risk-free rate. */
  r: number;
  /** Continuous dividend yield (approximation for discrete cash dividends). */
  q: number;
  isCall: boolean;
  /** Tree depth. CRR (unlike Leisen-Reimer) has no odd-step requirement. */
  steps?: number;
}

/** Backward-induction American CRR price for one set of inputs. */
export function crrPrice(inputs: PricerInputs): number {
  const { spot, strike, T, vol, r, q, isCall } = inputs;
  const n = Math.max(11, inputs.steps ?? 31);

  if (T <= 0 || vol <= 0) {
    return isCall ? Math.max(spot - strike, 0) : Math.max(strike - spot, 0);
  }

  const dt = T / n;
  const u = Math.exp(vol * Math.sqrt(dt));
  const d = 1 / u;
  const growth = Math.exp((r - q) * dt);
  const p = (growth - d) / (u - d);
  const disc = Math.exp(-r * dt);

  if (p <= 0 || p >= 1) {
    // Degenerate parameter combination (extreme vol/T/rate ratio) - fall back to intrinsic.
    return isCall ? Math.max(spot - strike, 0) : Math.max(strike - spot, 0);
  }

  const prices = new Array<number>(n + 1);
  for (let i = 0; i <= n; i++) {
    const s = spot * Math.pow(u, n - i) * Math.pow(d, i);
    prices[i] = isCall ? Math.max(s - strike, 0) : Math.max(strike - s, 0);
  }

  for (let step = n - 1; step >= 0; step--) {
    for (let i = 0; i <= step; i++) {
      const continuation = disc * (p * prices[i] + (1 - p) * prices[i + 1]);
      const s = spot * Math.pow(u, step - i) * Math.pow(d, i);
      const exercise = isCall ? s - strike : strike - s;
      prices[i] = Math.max(continuation, exercise);
    }
  }

  return prices[0];
}

export interface Greeks {
  price: number;
  delta: number;
  gamma: number;
  theta: number; // per calendar day
  vega: number; // per 1 vol point (0.01)
  vanna: number; // d(delta)/d(vol), per 1 vol point
  charm: number; // d(delta)/dT, per calendar day
}

/** Bump-and-reprice Greeks under frozen IV - see module docstring for exactly what this does and doesn't model. */
export function crrGreeks(inputs: PricerInputs): Greeks {
  const steps = inputs.steps ?? 31;
  const hS = inputs.spot * 0.005;
  const hVol = 0.01;
  const hT = Math.min(inputs.T * 0.1, 1 / 365);

  const at = (over: Partial<PricerInputs>) => crrPrice({ ...inputs, steps, ...over });

  const v0 = at({});
  const vUp = at({ spot: inputs.spot + hS });
  const vDown = at({ spot: inputs.spot - hS });
  const delta = (vUp - vDown) / (2 * hS);
  const gamma = (vUp - 2 * v0 + vDown) / (hS * hS);

  const vVolUp = at({ vol: inputs.vol + hVol });
  const vVolDown = at({ vol: Math.max(1e-4, inputs.vol - hVol) });
  const vega = (vVolUp - vVolDown) / 2; // per 1 vol point (hVol=0.01 cancels the /0.01 scale)

  const vTUp = at({ T: Math.max(1e-6, inputs.T - hT) });
  const theta = ((vTUp - v0) / hT) * (1 / 365); // per calendar day, decay is negative of d/dT

  // vanna: d(delta)/d(vol) via bumped-vol delta
  const deltaVolUp = (at({ spot: inputs.spot + hS, vol: inputs.vol + hVol }) - at({ spot: inputs.spot - hS, vol: inputs.vol + hVol })) / (2 * hS);
  const deltaVolDown =
    (at({ spot: inputs.spot + hS, vol: Math.max(1e-4, inputs.vol - hVol) }) - at({ spot: inputs.spot - hS, vol: Math.max(1e-4, inputs.vol - hVol) })) /
    (2 * hS);
  const vanna = (deltaVolUp - deltaVolDown) / 2;

  // charm: d(delta)/dT via bumped-time delta
  const tBumped = Math.max(1e-6, inputs.T - hT);
  const deltaTBumped = (at({ spot: inputs.spot + hS, T: tBumped }) - at({ spot: inputs.spot - hS, T: tBumped })) / (2 * hS);
  const charm = ((deltaTBumped - delta) / hT) * (1 / 365);

  return { price: v0, delta, gamma, theta, vega, vanna, charm };
}
