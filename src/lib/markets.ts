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
];

/** Which tradable market each macro indicator connects to, and why. */
export const MARKET_LINKS: Record<string, { symbol: string; rationale: string }> = {
  "us-macro:h41-balance-sheet": {
    symbol: "^GSPC",
    rationale: "Fed liquidity is a primary tailwind/headwind for risk-asset valuations.",
  },
  "us-macro:sofr-effr-iorb": {
    symbol: "HYG",
    rationale: "Funding stress shows up first in credit-sensitive, levered names.",
  },
  "us-macro:hy-credit-spread": {
    symbol: "HYG",
    rationale: "This spread is priced directly into HYG — they move inversely.",
  },
  "us-macro:cpi-yoy": {
    symbol: "GC=F",
    rationale: "Gold is the classic hedge against inflation surprises.",
  },
  "us-macro:unemployment": {
    symbol: "^GSPC",
    rationale: "Labor deterioration is a leading recession signal equities price in.",
  },
  "us-macro:payrolls": {
    symbol: "^GSPC",
    rationale: "The single most market-moving data release each month.",
  },
  "us-macro:m2": {
    symbol: "GC=F",
    rationale: "Broad money growth is a multi-quarter tailwind for hard assets.",
  },
  "us-macro:10y-yield": {
    symbol: "TLT",
    rationale: "TLT is priced almost exactly inverse to the 10y yield.",
  },
  "us-macro:industrial-production": {
    symbol: "HG=F",
    rationale: "\"Dr. Copper\" tracks industrial demand in real time.",
  },
  "us-macro:consumer-sentiment": {
    symbol: "^GSPC",
    rationale: "Consumer spending is ~68% of GDP; sentiment leads spending.",
  },
  "yield-rates:10y2y-spread": {
    symbol: "^GSPC",
    rationale: "Curve inversion is a leading recession signal equities eventually price in.",
  },
  "yield-rates:10y-cot": {
    symbol: "TLT",
    rationale: "Crowded spec positioning in 10y futures is the same trade as TLT, levered.",
  },
  "yield-rates:breakeven": {
    symbol: "GC=F",
    rationale: "Rising inflation expectations are one of gold's core demand drivers.",
  },
  "yield-rates:10y3m-spread": {
    symbol: "^GSPC",
    rationale: "The NY Fed's preferred recession spread — equities eventually price this signal in.",
  },
  "yield-rates:2y-yield": {
    symbol: "HYG",
    rationale: "Front-end rate expectations drive the cost of leverage for credit-sensitive names.",
  },
  "yield-rates:10y-yield": {
    symbol: "TLT",
    rationale: "TLT is priced almost exactly inverse to the 10y yield.",
  },
  "yield-rates:30y-yield": {
    symbol: "TLT",
    rationale: "Long-bond yields are the direct duration risk TLT holders are underwriting.",
  },
  "yield-rates:2y-cot": {
    symbol: "TLT",
    rationale: "Front-end positioning extremes have historically spilled into broader duration trades.",
  },
  "yield-rates:forward-inflation": {
    symbol: "GC=F",
    rationale: "Long-run inflation anchoring is the same demand driver as near-term breakevens for gold.",
  },
};

export function marketRowId(symbol: string): string {
  return `market:${symbol}`;
}
