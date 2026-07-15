/**
 * Black-Scholes (European, continuous dividend yield) option pricer.
 *
 * Replaces the former Leisen-Reimer American binomial pricer. Every
 * exposure page (GEX/DEX/Vanna/Charm/Vega/Theta, Hedge Activation, Hedge
 * Terrain, Surface Strain, Gamma Flip Band) now prices off this closed-form
 * model. Early exercise is not modeled - ITM American puts on SPY/QQQ/SPX/
 * NDX are worth marginally more than their European value here, a known,
 * accepted simplification of this rewrite (not a hidden one).
 *
 * Greeks are still bump-and-reprice (not the closed-form derivative
 * formulas) so every downstream sign/scale convention - per-1-vol-point
 * vega/vanna, per-calendar-day theta/charm - stays identical to what the
 * rest of the app already expects.
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
}

function normPdf(z: number): number {
  return Math.exp((-z * z) / 2) / Math.sqrt(2 * Math.PI);
}

function normCdf(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  let p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  if (z > 0) p = 1 - p;
  return p;
}

/** European Black-Scholes price. */
export function bsPrice(inputs: PricerInputs): number {
  const { spot, strike, T, vol, r, q, isCall } = inputs;

  if (T <= 0 || vol <= 0) {
    return isCall ? Math.max(spot - strike, 0) : Math.max(strike - spot, 0);
  }

  const sqrtT = Math.sqrt(T);
  const d1 = (Math.log(spot / strike) + (r - q + (vol * vol) / 2) * T) / (vol * sqrtT);
  const d2 = d1 - vol * sqrtT;

  if (isCall) {
    return spot * Math.exp(-q * T) * normCdf(d1) - strike * Math.exp(-r * T) * normCdf(d2);
  }
  return strike * Math.exp(-r * T) * normCdf(-d2) - spot * Math.exp(-q * T) * normCdf(-d1);
}

/**
 * Minimum T fed to the gamma formula only (price/delta/theta/vega/vanna/
 * charm all keep using the option's real, unfloored T). Confirmed directly:
 * with the real T on a 0DTE contract in its final 30-60 minutes, raw BS
 * gamma is mathematically exact but converges toward a near-Dirac spike at
 * the money (peak width scales with spot*vol*sqrt(T), which shrinks toward
 * zero as T does) - a single strike absorbs almost the entire book's
 * gamma while its $1-2 neighbors collapse toward zero. Real desks don't
 * chart raw instantaneous gamma that close to expiry for exactly this
 * reason: dealers can't rebalance with infinite precision in the literal
 * final minutes, so the practical/tradeable gamma profile is wider than
 * the instant math implies. Flooring T at 4 trading hours for gamma only
 * widens that peak back to a realistic multi-strike spread without
 * touching any other Greek's real time-to-expiry.
 */
const GAMMA_MIN_T_YEARS = 4 / 24 / 365;

/** Closed-form gamma - exact at any T, no finite-difference bump size to get wrong - with the stated minimum-T floor above applied only here. */
export function bsGamma(inputs: PricerInputs): number {
  if (inputs.T <= 0 || inputs.vol <= 0) return 0;
  const T = Math.max(inputs.T, GAMMA_MIN_T_YEARS);
  const sqrtT = Math.sqrt(T);
  const d1 = (Math.log(inputs.spot / inputs.strike) + (inputs.r - inputs.q + (inputs.vol * inputs.vol) / 2) * T) / (inputs.vol * sqrtT);
  return (Math.exp(-inputs.q * T) * normPdf(d1)) / (inputs.spot * inputs.vol * sqrtT);
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

/** Bump-and-reprice Greeks under frozen IV, except gamma (see below). */
export function bsGreeks(inputs: PricerInputs): Greeks {
  const hS = inputs.spot * 0.005;
  const hVol = 0.01;
  const hT = Math.min(inputs.T * 0.1, 1 / 365);

  const at = (over: Partial<PricerInputs>) => bsPrice({ ...inputs, ...over });

  const v0 = at({});
  const vUp = at({ spot: inputs.spot + hS });
  const vDown = at({ spot: inputs.spot - hS });
  const delta = (vUp - vDown) / (2 * hS);

  // Gamma uses the closed-form formula, not finite difference: a 0DTE
  // gamma peak can be just $1-2 wide (width scales with S*sigma*sqrt(T)),
  // narrower than the fixed ~0.5%-of-spot bump above - finite-differencing
  // across a window wider than the true peak systematically distorts the
  // per-strike shape (confirmed directly: it was concentrating gamma onto
  // whichever single strike the bump window happened to straddle, instead
  // of the smooth, gradually-declining profile a real 0DTE book shows).
  const gamma = bsGamma(inputs);

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

/** Delta only, via 2 reprices instead of bsGreeks' ~11 - for scanning a grid of hypothetical spot/time/vol scenarios where only delta (to sum into total hedge shares) is needed, not the full Greek set. */
export function bsDelta(inputs: PricerInputs): number {
  const hS = inputs.spot * 0.005;
  const vUp = bsPrice({ ...inputs, spot: inputs.spot + hS });
  const vDown = bsPrice({ ...inputs, spot: inputs.spot - hS });
  return (vUp - vDown) / (2 * hS);
}

/** Standard dollar-exposure convention: Greek x OI x contract multiplier x scale. Matches the industry GEX/DEX convention (Γ·OI·M·S²·0.01, Δ·OI·M·S). */
export function dollarGex(gamma: number, oi: number, spot: number, multiplier = 100): number {
  return gamma * oi * multiplier * spot * spot * 0.01;
}

export function dollarDex(delta: number, oi: number, spot: number, multiplier = 100): number {
  return delta * oi * multiplier * spot;
}

export function dollarVanna(vanna: number, oi: number, spot: number, multiplier = 100): number {
  return vanna * oi * multiplier * spot;
}

export function dollarCharm(charm: number, oi: number, spot: number, multiplier = 100): number {
  return charm * oi * multiplier * spot;
}

export function dollarVega(vega: number, oi: number, multiplier = 100): number {
  return vega * oi * multiplier;
}

export function dollarTheta(theta: number, oi: number, multiplier = 100): number {
  return theta * oi * multiplier;
}
