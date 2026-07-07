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
  "us-macro:core-pce": {
    context:
      "Core PCE is the Fed's actual stated inflation target metric — not CPI. It weights spending categories differently (accounts for substitution) and tends to run cooler than CPI. This is the number FOMC statements reference directly.",
    high: { label: "Fed's own inflation gauge running hot — hawkish", tone: "down" },
    low: { label: "Fed's own inflation gauge cooling — dovish room", tone: "up" },
    neutral: "Core PCE tracking close to trend.",
  },
  "us-macro:core-cpi": {
    context:
      "Core CPI strips out volatile food & energy to show underlying price trend. The Fed and markets weight this more than headline CPI for policy signal, since headline gets whipsawed by gas prices.",
    high: { label: "Underlying inflation hot — hawkish pressure", tone: "down" },
    low: { label: "Underlying inflation cooling — dovish room", tone: "up" },
    neutral: "Core CPI tracking close to trend.",
  },
  "us-macro:jobless-claims": {
    context:
      "Initial claims is the highest-frequency real-time labor market read available — weekly, not monthly, and rarely revised. A sustained rise is one of the earliest hard-data recession tells, often visible weeks before payrolls or unemployment confirm it.",
    high: { label: "Claims rising — labor market cracking", tone: "down" },
    low: { label: "Claims low — labor market still tight", tone: "up" },
    neutral: "Claims tracking near their trailing range.",
  },
  "us-macro:gdp": {
    context:
      "Real GDP growth is the single headline growth number — everything else (payrolls, industrial production, retail sales) is effectively a higher-frequency proxy for this quarterly print.",
    high: { label: "Growth running hot", tone: "up" },
    low: { label: "Growth slowing or contracting", tone: "down" },
    neutral: "GDP growth near its trailing trend.",
  },
  "us-macro:reverse-repo": {
    context:
      "The ON RRP facility is where money market funds park cash directly with the Fed when nothing else offers a better rate. Elevated usage means liquidity is sitting idle rather than flowing into risk assets or bank reserves; a sustained drain (as in 2023-24) has coincided with that cash finding its way into other short-term instruments and markets.",
    high: { label: "Cash parked at Fed — liquidity sidelined", tone: "down" },
    low: { label: "RRP draining — liquidity finding its way elsewhere", tone: "up" },
    neutral: "RRP balance roughly stable.",
  },
  "us-macro:retail-sales": {
    context:
      "Retail sales is hard data on actual consumer spending, not just sentiment about it — the real-economy confirmation (or contradiction) of what consumer sentiment surveys are implying.",
    high: { label: "Consumer spending strong", tone: "up" },
    low: { label: "Consumer spending weakening", tone: "down" },
    neutral: "Retail sales growth near trend.",
  },
  "us-macro:housing-starts": {
    context:
      "Housing is one of the most rate-sensitive and cyclically-leading sectors in the economy — starts typically turn before the broader cycle does, in both directions, making this a genuine leading indicator rather than a coincident one.",
    high: { label: "Housing activity strong — cyclical tailwind", tone: "up" },
    low: { label: "Housing activity weak — cyclical warning", tone: "down" },
    neutral: "Housing starts near their trailing trend.",
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
  "cot:es": {
    context:
      "Net speculative positioning in S&P 500 futures. Extreme net-long crowding has historically preceded sharp pullbacks when longs are forced to unwind; extreme net-short has preceded squeezes.",
    high: { label: "Spec positioning net long — crowded, pullback risk", tone: "down" },
    low: { label: "Spec positioning net short — squeeze risk on rallies", tone: "up" },
    neutral: "Equity futures positioning roughly balanced.",
  },
  "cot:nq": {
    context:
      "Net speculative positioning in Nasdaq-100 futures — the higher-beta, more crowded-trade cousin of ES. Positioning extremes here tend to be sharper and unwind faster than the broader index.",
    high: { label: "Spec positioning net long — crowded, pullback risk", tone: "down" },
    low: { label: "Spec positioning net short — squeeze risk on rallies", tone: "up" },
    neutral: "Nasdaq futures positioning roughly balanced.",
  },
  "cot:treasury": {
    context:
      "Combined 10y+2y speculative positioning shows how leveraged funds are leaning across the belly of the curve. Crowded net-short duration bets have driven some of the sharpest rate rallies when forced to cover.",
    high: { label: "Duration positioning net long", tone: "up" },
    low: { label: "Duration positioning net short — squeeze risk", tone: "down" },
    neutral: "Treasury futures positioning roughly balanced.",
  },
  "cot:commodities-dxy": {
    context:
      "Net speculative positioning in the Dollar Index itself. Crowded net-long dollar positioning has historically preceded dollar corrections as the trade gets stretched; net-short has preceded squeezes.",
    high: { label: "Dollar positioning net long — crowded", tone: "down" },
    low: { label: "Dollar positioning net short — squeeze risk on dollar", tone: "up" },
    neutral: "Dollar futures positioning roughly balanced.",
  },
  "cot:gold": {
    context:
      "Net speculative positioning in gold futures. Extreme net-long crowding often precedes consolidation or pullbacks even in a structural bull market; positioning resets are healthy, extremes without resets are not.",
    high: { label: "Gold positioning net long — crowded", tone: "down" },
    low: { label: "Gold positioning net short — room to run higher", tone: "up" },
    neutral: "Gold futures positioning roughly balanced.",
  },
  "cot:crude": {
    context:
      "Net speculative positioning in WTI futures. Extreme net-long positioning has historically coincided with price tops (everyone already bought); extreme net-short with capitulation bottoms.",
    high: { label: "Crude positioning net long — crowded", tone: "down" },
    low: { label: "Crude positioning net short — capitulation zone", tone: "up" },
    neutral: "Crude futures positioning roughly balanced.",
  },
  "cot:silver": {
    context:
      "Net speculative positioning in silver futures. A much thinner market than gold — positioning extremes here have produced some of the sharpest squeezes and unwinds in commodities.",
    high: { label: "Silver positioning net long — crowded, thin market", tone: "down" },
    low: { label: "Silver positioning net short — squeeze risk", tone: "up" },
    neutral: "Silver futures positioning roughly balanced.",
  },
  "transmission:copper-crude": {
    context:
      "Copper tracks global industrial demand; crude tracks energy costs and often geopolitical risk. A rising ratio means growth is outrunning energy costs — genuine expansion. A falling ratio can mean either energy shock or growth slowdown.",
    high: { label: "Growth outrunning energy costs — expansionary", tone: "up" },
    low: { label: "Energy costs outrunning growth — stagflationary risk", tone: "down" },
    neutral: "Ratio near its trailing range.",
  },
  "transmission:copper-gold": {
    context:
      "One of the cleanest real-time growth vs. fear proxies — copper wants growth, gold wants safety. This ratio has a strong historical lead relationship with the 10y yield.",
    high: { label: "Risk-on — growth demand beating safe-haven demand", tone: "up" },
    low: { label: "Risk-off — safe-haven demand beating growth demand", tone: "down" },
    neutral: "Ratio near its trailing range.",
  },
  "transmission:gold-silver": {
    context:
      "Gold is pure monetary/safe-haven demand; silver has a real industrial-use component. A rising ratio (gold outperforming) signals fear-driven flows; a falling ratio signals industrial/reflationary demand picking up.",
    high: { label: "Fear-driven flows dominating — gold favored over silver", tone: "down" },
    low: { label: "Industrial/reflationary demand picking up", tone: "up" },
    neutral: "Ratio near its trailing range.",
  },
  "transmission:crude-natgas": {
    context:
      "The relative price of oil to gas shifts with substitution economics. A collapsing ratio (nat gas cheap vs. crude) has historically coincided with weak industrial/heating demand — a soft-demand tell independent of the CPI energy print.",
    high: { label: "Energy demand balanced — normal crude/gas relationship", tone: "up" },
    low: { label: "Nat gas weak vs. crude — soft energy demand signal", tone: "down" },
    neutral: "Ratio near its trailing range.",
  },
  "transmission:silver": {
    context:
      "Silver sits between a monetary hedge and an industrial input (solar, electronics). Its moves often lead or amplify gold's, making it a higher-beta read on the same macro forces.",
    high: { label: "Silver strength — reflation / hedge demand building", tone: "up" },
    low: { label: "Silver weakness — demand cooling", tone: "down" },
    neutral: "Silver near its trailing range.",
  },
  "transmission:natgas": {
    context:
      "Natural gas is a direct read on energy demand and, seasonally, weather — it's noisier than crude but a genuine industrial/heating demand gauge independent of OPEC supply decisions.",
    high: { label: "Nat gas strength — demand/weather-driven pressure", tone: "down" },
    low: { label: "Nat gas weakness — soft demand", tone: "up" },
    neutral: "Nat gas near its trailing range.",
  },
  "transmission:walcl": {
    context:
      "The Fed's balance sheet is the plumbing behind systemic dollar liquidity. Expansion (QE) supports risk assets; contraction (QT) drains liquidity and pressures valuations, especially long-duration and levered trades.",
    high: { label: "Liquidity expanding", tone: "up" },
    low: { label: "Liquidity draining (QT)", tone: "down" },
    neutral: "Balance sheet roughly flat — liquidity impulse neutral.",
  },
  "geo:vix": {
    context:
      "VIX is the market's own fear gauge, priced off S&P 500 option skew. Spikes mark acute stress and are often (not always) tactical buying opportunities; sustained elevation without a spike is a slower, structural risk-off regime.",
    high: { label: "Volatility elevated — fear/hedging demand up", tone: "down" },
    low: { label: "Volatility compressed — complacency or genuine calm", tone: "up" },
    neutral: "VIX near its trailing range.",
  },
  "geo:ovx": {
    context:
      "OVX prices expected volatility in crude — it spikes on supply shocks (OPEC surprises, Middle East escalation) independent of the direction of oil itself. A spike is a geopolitical-risk tell even if price hasn't moved much yet.",
    high: { label: "Oil vol elevated — supply-shock / geopolitical risk priced", tone: "down" },
    low: { label: "Oil vol compressed — calm supply backdrop", tone: "up" },
    neutral: "OVX near its trailing range.",
  },
  "geo:gvz": {
    context:
      "GVZ prices expected volatility in gold. Spikes alongside rising gold prices confirm genuine safe-haven demand; spikes without a price move can mark indecision at a turning point.",
    high: { label: "Gold vol elevated — safe-haven demand or turning point", tone: "down" },
    low: { label: "Gold vol compressed — calm, range-bound gold", tone: "up" },
    neutral: "GVZ near its trailing range.",
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
