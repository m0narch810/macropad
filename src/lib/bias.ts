export interface BiasConfig {
  /** What this indicator actually measures and why a trader watches it. */
  context: string;
  /** Read when the trailing z-score is high (rising / elevated vs its own history). */
  high: { label: string; tone: "up" | "down" };
  /** Read when the trailing z-score is low (falling / depressed vs its own history). */
  low: { label: string; tone: "up" | "down" };
  /** Read near zero. */
  neutral: string;
}

const CONFIG: Record<string, BiasConfig> = {
  "us-macro:h41-balance-sheet": {
    context:
      "The Fed's balance sheet is the plumbing behind systemic dollar liquidity. Expansion (QE) pushes cash into the system and tends to support risk assets; contraction (QT) drains it and pressures valuations, especially long-duration and levered trades.",
    high: { label: "Liquidity expanding", tone: "up" },
    low: { label: "Liquidity draining (QT)", tone: "down" },
    neutral: "Balance sheet roughly flat — liquidity impulse neutral.",
  },
  "us-macro:sofr-effr-iorb": {
    context:
      "SOFR vs IORB spread is the cleanest read on repo/funding stress. SOFR printing meaningfully above IORB signals collateral or cash scarcity in the plumbing — historically a precursor to volatility (Sept 2019 repo spike, SVB week).",
    high: { label: "Funding costs elevated — watch repo stress", tone: "down" },
    low: { label: "Funding costs easing", tone: "up" },
    neutral: "Funding stack trading in line with recent norms.",
  },
  "us-macro:hy-credit-spread": {
    context:
      "High yield spreads are the market's own fear gauge for corporate default risk. Widening spreads front-run equity drawdowns; compressing spreads confirm a risk-on credit backdrop and cheap financing for leveraged names.",
    high: { label: "Credit stress rising — risk-off", tone: "down" },
    low: { label: "Spreads compressed — risk-on, easy credit", tone: "up" },
    neutral: "Credit spreads near their trailing average — no stress signal.",
  },
  "us-macro:cpi-yoy": {
    context:
      "Headline CPI YoY is the single number that moves the Fed reaction function most. Hot prints push out cut expectations and pressure duration; cooling prints open the door to easing and support risk assets, especially rate-sensitive sectors.",
    high: { label: "Inflation hot — hawkish Fed bias", tone: "down" },
    low: { label: "Inflation cooling — dovish Fed bias", tone: "up" },
    neutral: "Inflation tracking close to its recent trend.",
  },
  "us-macro:unemployment": {
    context:
      "The unemployment rate is the labor side of the Fed's dual mandate. A rising rate (Sahm-rule territory) is a classic recession tell; a falling rate signals a tight labor market — supportive for consumption but can keep the Fed cautious on cutting.",
    high: { label: "Labor market weakening — growth risk", tone: "down" },
    low: { label: "Labor market tight — resilient consumer", tone: "up" },
    neutral: "Unemployment steady near trend.",
  },
  "us-macro:payrolls": {
    context:
      "Nonfarm payrolls is the highest-visibility growth print each month. Strong prints confirm expansion and reduce recession odds (but can delay cuts); weak or negative revisions are often the first hard sign of a turning cycle.",
    high: { label: "Robust job growth — resilient economy", tone: "up" },
    low: { label: "Payroll growth slowing — recession watch", tone: "down" },
    neutral: "Payroll growth in line with trend pace.",
  },
  "us-macro:m2": {
    context:
      "M2 growth is the broad money-supply backdrop. Expansion is a multi-quarter liquidity tailwind for asset prices and eventually inflation; contraction (as seen in 2022-23) is a headwind that has historically preceded credit tightening.",
    high: { label: "Money supply expanding — liquidity tailwind", tone: "up" },
    low: { label: "Money supply contracting — liquidity headwind", tone: "down" },
    neutral: "M2 growth near its trailing trend.",
  },
  "us-macro:10y-yield": {
    context:
      "The 10y yield is the risk-free discount rate for every long-duration asset — equities, real estate, growth stocks. Rising yields tighten financial conditions and compress valuation multiples; falling yields ease conditions and support duration-sensitive assets.",
    high: { label: "Yields elevated — tightening financial conditions", tone: "down" },
    low: { label: "Yields low — easier financial conditions", tone: "up" },
    neutral: "10y yield near its trailing range.",
  },
  "us-macro:industrial-production": {
    context:
      "Industrial production is a real-economy, non-survey read on manufacturing output. It corroborates (or contradicts) sentiment-based PMI data and is a component of the NBER recession dating toolkit.",
    high: { label: "Manufacturing expanding", tone: "up" },
    low: { label: "Manufacturing contracting", tone: "down" },
    neutral: "Industrial output steady near trend.",
  },
  "us-macro:consumer-sentiment": {
    context:
      "U. Michigan sentiment is a leading indicator for consumer spending, which is ~68% of US GDP. Sharp drops often precede pullbacks in discretionary spending before it shows up in hard data.",
    high: { label: "Consumer optimism elevated — spending tailwind", tone: "up" },
    low: { label: "Sentiment depressed — spending risk", tone: "down" },
    neutral: "Consumer sentiment near its trailing average.",
  },
  "yield-rates:10y2y-spread": {
    context:
      "The 2s10s curve is the most-watched recession signal on the desk. Deep inversion means the market expects the Fed to cut aggressively; the re-steepening (un-inversion) that follows has historically been the sharper timing signal for the actual downturn.",
    high: { label: "Curve steepening — normalizing growth outlook", tone: "up" },
    low: { label: "Curve inverted/flattening — recession signal", tone: "down" },
    neutral: "Curve roughly flat, near its recent range.",
  },
  "yield-rates:10y-cot": {
    context:
      "Net speculative positioning in 10y futures shows how leveraged funds are leaning. Extreme net-short positioning has historically preceded short squeezes and sharp yield drops when the crowded trade unwinds.",
    high: { label: "Spec positioning net long — bullish duration bet", tone: "up" },
    low: { label: "Spec positioning net short — crowded, squeeze risk", tone: "down" },
    neutral: "Positioning roughly balanced.",
  },
  "yield-rates:breakeven": {
    context:
      "Breakeven inflation is the market's own inflation forecast, priced daily. Rising breakevens front-run CPI prints and directly move the Fed's real policy stance; falling breakevens support duration and rate-sensitive assets.",
    high: { label: "Inflation expectations rising — hawkish pressure", tone: "down" },
    low: { label: "Inflation expectations falling — dovish room", tone: "up" },
    neutral: "Inflation expectations anchored near trend.",
  },
  "yield-rates:10y3m-spread": {
    context:
      "The NY Fed's own recession probability model is built on this spread, not 2s10s — historically fewer false positives. Inversion means short-term bills yield more than the 10y, an unambiguous market signal the Fed will need to cut.",
    high: { label: "Curve steepening — normalizing outlook", tone: "up" },
    low: { label: "Curve inverted — NY Fed recession signal active", tone: "down" },
    neutral: "Spread near its recent range.",
  },
  "yield-rates:2y-yield": {
    context:
      "The 2y yield is almost pure Fed-path pricing — it moves on rate expectations more than growth or inflation news directly. Rising 2y = market pricing a more hawkish Fed; falling = pricing cuts.",
    high: { label: "Front end pricing hawkish Fed path", tone: "down" },
    low: { label: "Front end pricing dovish Fed path / cuts", tone: "up" },
    neutral: "2y yield near its recent range.",
  },
  "yield-rates:10y-yield": {
    context:
      "The 10y yield is the risk-free discount rate for every long-duration asset. Rising yields tighten financial conditions and compress valuation multiples; falling yields ease conditions and support duration-sensitive assets.",
    high: { label: "Yields elevated — tightening financial conditions", tone: "down" },
    low: { label: "Yields low — easier financial conditions", tone: "up" },
    neutral: "10y yield near its recent range.",
  },
  "yield-rates:30y-yield": {
    context:
      "The 30y is the most term-premium and fiscal-sensitive point on the curve — it reacts to deficit/issuance concerns independent of Fed policy. A rising 30y with a stable Fed path is a term-premium story, not a growth one.",
    high: { label: "Long-bond yields elevated — term premium/fiscal pressure", tone: "down" },
    low: { label: "Long-bond yields low — term premium compressed", tone: "up" },
    neutral: "30y yield near its recent range.",
  },
  "yield-rates:2y-cot": {
    context:
      "Front-end futures positioning shows how leveraged funds are betting on the near-term Fed path specifically, distinct from the 10y's growth/inflation mix. Crowded positioning here has driven some of the sharpest short-squeeze moves in rates.",
    high: { label: "Front-end spec positioning net long", tone: "up" },
    low: { label: "Front-end spec positioning net short — squeeze risk", tone: "down" },
    neutral: "Front-end positioning roughly balanced.",
  },
  "yield-rates:forward-inflation": {
    context:
      "5y5y forward inflation is the metric the Fed itself watches most for long-run inflation anchoring — it strips out near-term noise to show what the market believes inflation will average five years from now, for five years.",
    high: { label: "Long-run inflation expectations rising — anchor slipping", tone: "down" },
    low: { label: "Long-run inflation expectations well-anchored/falling", tone: "up" },
    neutral: "Long-run inflation expectations stable near target.",
  },
};

export interface Bias {
  context: string;
  label: string;
  tone: "up" | "down" | "flat";
  strength: "mild" | "strong" | null;
}

export function getBias(seriesId: string, zscore: number | null): Bias | null {
  const cfg = CONFIG[seriesId];
  if (!cfg) return null;
  if (zscore === null) return { context: cfg.context, label: "Insufficient history for a read", tone: "flat", strength: null };

  const abs = Math.abs(zscore);
  if (abs < 0.5) return { context: cfg.context, label: cfg.neutral, tone: "flat", strength: null };

  const strength = abs >= 1.5 ? "strong" : "mild";
  const side = zscore > 0 ? cfg.high : cfg.low;
  return { context: cfg.context, label: side.label, tone: side.tone, strength };
}

/**
 * The period-over-period status chip (up/down/flat/pending) is a literal
 * direction. Whether "up" is good or bad depends on the indicator — rising
 * credit spreads are bad, rising payrolls are good. This maps the literal
 * direction onto the same good/bad tone the bias box uses, so the chip
 * color and the bias box never disagree. Falls back to literal (up=up-tone)
 * for series with no bias config.
 */
export function getDirectionTone(
  seriesId: string,
  status: "up" | "down" | "flat" | "pending"
): "up" | "down" | "flat" | "pending" {
  if (status === "flat" || status === "pending") return status;
  const cfg = CONFIG[seriesId];
  if (!cfg) return status;
  return status === "up" ? cfg.high.tone : cfg.low.tone;
}

/**
 * Same good/bad remapping as getDirectionTone, but for any signed number
 * (z-score, momentum delta) rather than the literal status chip. Positive
 * numbers use the indicator's "high" tone, negative use "low" — falls back
 * to literal (positive=up) for series with no bias config.
 */
export function getSignTone(seriesId: string, value: number | null): "up" | "down" | "flat" {
  if (value === null || value === 0) return "flat";
  const cfg = CONFIG[seriesId];
  const literal = value > 0 ? "up" : "down";
  if (!cfg) return literal;
  return value > 0 ? cfg.high.tone : cfg.low.tone;
}
