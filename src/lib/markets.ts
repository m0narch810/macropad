export interface MarketDef {
  symbol: string;
  label: string;
}

export const MARKET_SYMBOLS: MarketDef[] = [
  { symbol: "^GSPC", label: "S&P 500" },
  { symbol: "^IXIC", label: "Nasdaq Composite" },
  { symbol: "CL=F", label: "Crude Oil (WTI)" },
  { symbol: "GC=F", label: "Gold" },
  { symbol: "HG=F", label: "Copper" },
  { symbol: "DX-Y.NYB", label: "Dollar Index (DXY)" },
  { symbol: "HYG", label: "High Yield Bond ETF" },
  { symbol: "TLT", label: "20y+ Treasury ETF" },
  { symbol: "SI=F", label: "Silver" },
  { symbol: "NG=F", label: "Natural Gas" },
];

export interface MarketLink {
  symbol: string;
  rationale: string;
}

/**
 * Which tradable markets each macro indicator connects to, and why. One-to-many:
 * most indicators legitimately move more than one asset (CPI moves gold, the
 * dollar, and bond yields at once), and forcing a single link starved niche
 * assets (silver, nat gas, DXY, crude) of nearly everything while dumping
 * everything else onto the S&P/TLT/gold defaults. netBias.ts weights each
 * link by measured correlation anyway, so an extra plausible-but-weak link
 * just gets down-weighted rather than distorting anything.
 */
export const MARKET_LINKS: Record<string, MarketLink[]> = {
  "us-macro:h41-balance-sheet": [
    { symbol: "^GSPC", rationale: "Fed liquidity is a primary tailwind/headwind for risk-asset valuations." },
    { symbol: "^IXIC", rationale: "Duration-heavy growth/tech names are the most liquidity-sensitive corner of equities." },
    { symbol: "GC=F", rationale: "Balance sheet expansion (QE) debases the currency unit gold is priced against." },
  ],
  "us-macro:sofr-effr-iorb": [
    { symbol: "HYG", rationale: "Funding stress shows up first in credit-sensitive, levered names." },
    { symbol: "DX-Y.NYB", rationale: "Dollar funding stress (SOFR spiking above IORB) is a direct dollar-scarcity signal." },
  ],
  "us-macro:hy-credit-spread": [
    { symbol: "HYG", rationale: "This spread is priced directly into HYG — they move inversely." },
    { symbol: "^GSPC", rationale: "Credit stress leads equity drawdowns; spreads widen before stocks fully price risk." },
  ],
  "us-macro:cpi-yoy": [
    { symbol: "GC=F", rationale: "Gold is the classic hedge against inflation surprises." },
    { symbol: "DX-Y.NYB", rationale: "Inflation surprises move real-rate expectations, a primary dollar driver." },
    { symbol: "TLT", rationale: "CPI prints are the single biggest scheduled mover of nominal yields." },
  ],
  "us-macro:unemployment": [
    { symbol: "^GSPC", rationale: "Labor deterioration is a leading recession signal equities price in." },
    { symbol: "TLT", rationale: "Rising unemployment is the Fed's clearest cutting trigger — duration rallies on it." },
    { symbol: "HYG", rationale: "Labor weakness is the earliest read on rising default risk in credit." },
  ],
  "us-macro:payrolls": [
    { symbol: "^GSPC", rationale: "The single most market-moving data release each month." },
    { symbol: "DX-Y.NYB", rationale: "NFP surprises are among the sharpest scheduled dollar movers." },
    { symbol: "TLT", rationale: "Payrolls strength/weakness directly repriced the Fed's rate path." },
  ],
  "us-macro:m2": [
    { symbol: "GC=F", rationale: "Broad money growth is a multi-quarter tailwind for hard assets." },
    { symbol: "^GSPC", rationale: "Excess liquidity has historically flowed into risk-asset valuations." },
  ],
  "us-macro:10y-yield": [
    { symbol: "TLT", rationale: "TLT is priced almost exactly inverse to the 10y yield." },
    { symbol: "DX-Y.NYB", rationale: "The 10y is the core input to the US rate differential that drives the dollar." },
    { symbol: "^IXIC", rationale: "Long-duration growth stocks are the most discount-rate-sensitive equity segment." },
  ],
  "us-macro:industrial-production": [
    { symbol: "HG=F", rationale: "\"Dr. Copper\" tracks industrial demand in real time." },
    { symbol: "CL=F", rationale: "Industrial output is a direct driver of energy demand." },
    { symbol: "NG=F", rationale: "Industrial and power-sector demand is a core natural gas consumption driver." },
  ],
  "us-macro:consumer-sentiment": [
    { symbol: "^GSPC", rationale: "Consumer spending is ~68% of GDP; sentiment leads spending." },
    { symbol: "HYG", rationale: "Sentiment is a leading read on consumer-credit performance." },
  ],
  "us-macro:core-pce": [
    { symbol: "GC=F", rationale: "The Fed's own inflation target metric — gold is the classic hedge against it running hot." },
    { symbol: "TLT", rationale: "This is the exact metric the Fed's reaction function targets — it moves the rate path directly." },
  ],
  "us-macro:core-cpi": [
    { symbol: "GC=F", rationale: "Underlying inflation surprises are gold's core demand driver." },
    { symbol: "DX-Y.NYB", rationale: "Core inflation surprises move real-rate expectations and the dollar with them." },
    { symbol: "SI=F", rationale: "Silver trades as a secondary inflation hedge alongside gold, with more volatility." },
  ],
  "us-macro:jobless-claims": [
    { symbol: "^GSPC", rationale: "The earliest hard-data labor signal — equities react fast to claims surprises." },
    { symbol: "HYG", rationale: "Claims are the highest-frequency read on labor-market (and default-risk) deterioration." },
  ],
  "us-macro:gdp": [
    { symbol: "^GSPC", rationale: "The headline growth number equities are ultimately pricing." },
    { symbol: "CL=F", rationale: "Growth surprises move expected energy demand directly." },
    { symbol: "HG=F", rationale: "Copper is priced as a real-time growth proxy — GDP is the number it's tracking." },
  ],
  "us-macro:reverse-repo": [
    { symbol: "^GSPC", rationale: "RRP balance changes are a direct read on liquidity available to flow into risk assets." },
    { symbol: "GC=F", rationale: "Draining RRP has historically coincided with easier system-wide liquidity, a gold tailwind." },
  ],
  "us-macro:retail-sales": [
    { symbol: "^GSPC", rationale: "Consumer spending is ~68% of GDP — this is the hard-data confirmation." },
    { symbol: "HYG", rationale: "Retail strength/weakness is a direct read on consumer-credit health." },
  ],
  "us-macro:housing-starts": [
    { symbol: "TLT", rationale: "Housing is the most rate-sensitive sector — starts move directly with mortgage rates and duration." },
    { symbol: "HYG", rationale: "Housing-linked credit is a meaningful chunk of high-yield issuance." },
  ],

  "yield-rates:10y2y-spread": [
    { symbol: "^GSPC", rationale: "Curve inversion is a leading recession signal equities eventually price in." },
    { symbol: "TLT", rationale: "The spread is literally the difference between two points TLT's duration sits on." },
    { symbol: "DX-Y.NYB", rationale: "Curve shape shifts change the rate-differential story that drives the dollar." },
  ],
  "yield-rates:10y3m-spread": [
    { symbol: "^GSPC", rationale: "The NY Fed's preferred recession spread — equities eventually price this signal in." },
    { symbol: "TLT", rationale: "Directly reflects the long-vs-policy-rate gap TLT is exposed to." },
  ],
  "yield-rates:2y-yield": [
    { symbol: "HYG", rationale: "Front-end rate expectations drive the cost of leverage for credit-sensitive names." },
    { symbol: "DX-Y.NYB", rationale: "The 2y is the cleanest proxy for near-term Fed expectations, a core dollar driver." },
  ],
  "yield-rates:10y-yield": [
    { symbol: "TLT", rationale: "TLT is priced almost exactly inverse to the 10y yield." },
    { symbol: "DX-Y.NYB", rationale: "The 10y anchors the US side of every major rate-differential trade." },
    { symbol: "^GSPC", rationale: "The 10y is the standard discount rate used to value equity cash flows." },
  ],
  "yield-rates:30y-yield": [
    { symbol: "TLT", rationale: "Long-bond yields are the direct duration risk TLT holders are underwriting." },
  ],
  "yield-rates:10y-cot": [
    { symbol: "TLT", rationale: "Crowded spec positioning in 10y futures is the same trade as TLT, levered." },
  ],
  "yield-rates:2y-cot": [
    { symbol: "TLT", rationale: "Front-end positioning extremes have historically spilled into broader duration trades." },
    { symbol: "HYG", rationale: "Crowded front-end positioning reflects the same rate-path bets embedded in credit." },
  ],
  "yield-rates:breakeven": [
    { symbol: "GC=F", rationale: "Rising inflation expectations are one of gold's core demand drivers." },
    { symbol: "TLT", rationale: "Breakevens are the inflation half of the nominal yield TLT is exposed to." },
  ],
  "yield-rates:forward-inflation": [
    { symbol: "GC=F", rationale: "Long-run inflation anchoring is the same demand driver as near-term breakevens for gold." },
    { symbol: "DX-Y.NYB", rationale: "A de-anchoring of long-run inflation expectations is a structural dollar risk." },
  ],

  "cot:es": [{ symbol: "^GSPC", rationale: "This is the exact futures positioning behind the index itself." }],
  "cot:nq": [{ symbol: "^IXIC", rationale: "This is the exact futures positioning behind the index itself." }],
  "cot:treasury": [{ symbol: "TLT", rationale: "Combined 10y+2y spec positioning is the same duration bet as TLT." }],
  "cot:commodities-dxy": [{ symbol: "DX-Y.NYB", rationale: "Direct futures positioning behind the dollar index itself." }],
  "cot:gold": [{ symbol: "GC=F", rationale: "Direct futures positioning behind gold itself — extremes have preceded sharp reversals." }],
  "cot:crude": [{ symbol: "CL=F", rationale: "Direct futures positioning behind WTI itself." }],
  "cot:silver": [{ symbol: "SI=F", rationale: "Direct futures positioning behind silver itself — thinner market, sharper squeezes." }],

  "transmission:copper-crude": [
    { symbol: "HG=F", rationale: "This ratio is copper's own growth-vs-energy read." },
    { symbol: "CL=F", rationale: "The other half of the ratio — energy-vs-industrial-demand balance." },
  ],
  "transmission:copper-gold": [
    { symbol: "HG=F", rationale: "Growth (copper) vs. safety (gold) — copper's side of the ratio." },
    { symbol: "GC=F", rationale: "Growth (copper) vs. safety (gold) — gold's side of the ratio." },
  ],
  "transmission:gold-silver": [
    { symbol: "GC=F", rationale: "The gold/silver ratio is a classic precious-metals risk gauge — gold's side." },
    { symbol: "SI=F", rationale: "Silver's higher beta to the ratio makes it the more sensitive side to trade." },
  ],
  "transmission:crude-natgas": [
    { symbol: "CL=F", rationale: "The energy substitution ratio — crude's side." },
    { symbol: "NG=F", rationale: "The energy substitution ratio — nat gas's side, where it matters most." },
  ],
  "transmission:silver": [{ symbol: "SI=F", rationale: "This card tracks the exact instrument." }],
  "transmission:natgas": [{ symbol: "NG=F", rationale: "This card tracks the exact instrument." }],
  "transmission:walcl": [
    { symbol: "^GSPC", rationale: "Fed liquidity is a primary tailwind/headwind for risk-asset valuations." },
    { symbol: "GC=F", rationale: "Balance sheet pace is a direct currency-debasement read gold trades on." },
  ],

  "geo:vix": [{ symbol: "^GSPC", rationale: "VIX is priced directly off S&P 500 options — the two move inversely by construction." }],
  "geo:ovx": [{ symbol: "CL=F", rationale: "OVX is crude's own implied-vol gauge, priced off WTI options." }],
  "geo:gvz": [{ symbol: "GC=F", rationale: "GVZ is gold's own implied-vol gauge, priced off gold options." }],
};

export function marketRowId(symbol: string): string {
  return `market:${symbol}`;
}
