export type SeriesStatus = "up" | "down" | "flat" | "pending";

export interface HistoryPoint {
  date: string;
  value: number;
}

export interface ExtraStat {
  label: string;
  value: string;
  flag?: boolean;
  caption?: string;
  history?: HistoryPoint[];
  zscore?: number | null;
  threshold?: number;
  windowLabel?: string;
}

export interface NewsHeadlinePayload {
  title: string;
  link: string | null;
  pubDate: string;
  source: string;
  sentimentScore: number;
  sentimentLabel: "bullish" | "bearish" | "neutral";
}

export interface MacroSeries {
  id: string;
  name: string;
  note: string;
  value: string;
  status: SeriesStatus;
  zscore: number | null;
  sparkline: number[] | null;
  windowLabel: string | null;
  history: HistoryPoint[] | null;
  extraStats: ExtraStat[] | null;
  /** Arbitrary structured payload for non-timeseries content — currently just the news feed's headline list. */
  payload: { headlines: NewsHeadlinePayload[] } | null;
  source: string;
}

export interface MacroPanel {
  id: string;
  title: string;
  description: string;
  series: MacroSeries[];
}

const blank = (
  id: string,
  name: string,
  note: string,
  source: string
): MacroSeries => ({
  id,
  name,
  note,
  value: "—",
  status: "pending",
  zscore: null,
  sparkline: null,
  windowLabel: null,
  history: null,
  extraStats: null,
  payload: null,
  source,
});

export const macroPanels: MacroPanel[] = [
  {
    id: "us-macro",
    title: "US Macroeconomics",
    description: "Liquidity, rates, inflation, labor, growth, and consumer — full macro stack.",
    series: [
      blank("us-macro:h41-balance-sheet", "H.4.1 Fed Balance Sheet", "Weekly, Fed H.4.1 release", "FRED WALCL"),
      blank("us-macro:sofr-effr-iorb", "SOFR / EFFR / IORB", "Funding rate spread stack", "FRED SOFR/EFFR/IORB"),
      blank("us-macro:hy-credit-spread", "High Yield Credit Spread", "ICE BofA HY OAS", "FRED BAMLH0A0HYM2"),
      blank("us-macro:cpi-yoy", "CPI Inflation (YoY)", "Headline CPI, year-over-year", "FRED CPIAUCSL"),
      blank("us-macro:unemployment", "Unemployment Rate", "U-3 headline unemployment", "FRED UNRATE"),
      blank("us-macro:payrolls", "Nonfarm Payrolls", "Total nonfarm employment, thousands", "FRED PAYEMS"),
      blank("us-macro:m2", "M2 Money Supply", "Broad money supply, $ trillions", "FRED M2SL"),
      blank("us-macro:10y-yield", "10y Treasury Yield", "Benchmark long rate", "FRED DGS10"),
      blank("us-macro:industrial-production", "Industrial Production", "Index, 2017=100", "FRED INDPRO"),
      blank("us-macro:consumer-sentiment", "Consumer Sentiment", "U. Michigan index", "FRED UMCSENT"),
      blank("us-macro:core-pce", "Core PCE Inflation (YoY)", "The Fed's actual preferred inflation gauge", "FRED PCEPILFE"),
      blank("us-macro:core-cpi", "Core CPI Inflation (YoY)", "CPI ex food & energy", "FRED CPILFESL"),
      blank("us-macro:jobless-claims", "Initial Jobless Claims", "Weekly layoffs, real-time labor read", "FRED ICSA"),
      blank("us-macro:gdp", "Real GDP Growth", "QoQ annualized, headline growth", "FRED GDPC1"),
      blank("us-macro:reverse-repo", "Reverse Repo (ON RRP)", "Fed liquidity-absorption facility", "FRED RRPONTSYD"),
      blank("us-macro:retail-sales", "Retail Sales (YoY)", "Consumer spending, hard data", "FRED RSAFS"),
      blank("us-macro:housing-starts", "Housing Starts (YoY)", "Residential construction, cyclical leader", "FRED HOUST"),
    ],
  },
  {
    id: "yield-rates",
    title: "Yield Rates",
    description: "Curve shape, levels, positioning, and inflation expectations across the Treasury complex.",
    series: [
      blank("yield-rates:10y2y-spread", "US 10y-2y Yield Spread", "Curve inversion watch", "FRED T10Y2Y"),
      blank("yield-rates:10y3m-spread", "US 10y-3m Yield Spread", "NY Fed's preferred recession spread", "FRED T10Y3M"),
      blank("yield-rates:2y-yield", "2y Treasury Yield", "Front-end rate, prices Fed path", "FRED DGS2"),
      blank("yield-rates:10y-yield", "10y Treasury Yield", "Benchmark long rate", "FRED DGS10"),
      blank("yield-rates:30y-yield", "30y Treasury Yield", "Long-bond, fiscal/term-premium sensitive", "FRED DGS30"),
      blank("yield-rates:10y-cot", "10y Treasury Futures COT", "Net spec positioning, ZN", "CFTC Legacy COT"),
      blank("yield-rates:2y-cot", "2y Treasury Futures COT", "Net spec positioning, front end", "CFTC Legacy COT"),
      blank("yield-rates:breakeven", "5y/10y Breakeven Inflation", "Market inflation expectation", "FRED T5YIE/T10YIE"),
      blank("yield-rates:forward-inflation", "5y5y Forward Inflation", "Long-run Fed-relevant inflation gauge", "FRED T5YIFR"),
    ],
  },
  {
    id: "cot-positioning",
    title: "COT Positioning",
    description: "Net non-commercial (speculative) positioning across equities, rates, and commodities.",
    series: [
      blank("cot:es", "S&P 500 Futures COT", "Net non-commercial position, ES", "CFTC Legacy COT"),
      blank("cot:nq", "Nasdaq-100 Futures COT", "Net non-commercial position, NQ", "CFTC Legacy COT"),
      blank("cot:treasury", "Treasury (10y, 2y)", "Net non-commercial position", "CFTC Legacy COT"),
      blank("cot:commodities-dxy", "Dollar Index (DXY)", "Net non-commercial position", "CFTC Legacy COT"),
      blank("cot:gold", "Gold Futures COT", "Net non-commercial position", "CFTC Legacy COT"),
      blank("cot:crude", "Crude Oil Futures COT", "Net non-commercial position", "CFTC Legacy COT"),
      blank("cot:silver", "Silver Futures COT", "Net non-commercial position", "CFTC Legacy COT"),
    ],
  },
  {
    id: "transmission",
    title: "Transmission Check",
    description: "How growth, inflation, and liquidity impulses show up across commodity markets.",
    series: [
      blank("transmission:copper-crude", "Copper/Crude Ratio", "Growth vs. inflation proxy", "Yahoo Finance HG=F / CL=F"),
      blank("transmission:copper-gold", "Copper/Gold Ratio", "Risk appetite proxy, tracks 10y", "Yahoo Finance HG=F / GC=F"),
      blank("transmission:gold-silver", "Gold/Silver Ratio", "Safe-haven vs. industrial demand mix", "Yahoo Finance GC=F / SI=F"),
      blank("transmission:crude-natgas", "Crude/Natural Gas Ratio", "Energy substitution, demand destruction signal", "Yahoo Finance CL=F / NG=F"),
      blank("transmission:silver", "Silver", "Industrial + monetary metal", "Yahoo Finance SI=F"),
      blank("transmission:natgas", "Natural Gas", "Energy demand, heating/cooling cycles", "Yahoo Finance NG=F"),
      blank("transmission:walcl", "WALCL", "Fed balance sheet level", "FRED WALCL"),
    ],
  },
  {
    id: "geopolitics",
    title: "Geopolitics",
    description: "Volatility complex and headline risk across equities, oil, and gold.",
    series: [
      blank("geo:vix", "VIX", "Equity volatility / fear gauge", "FRED VIXCLS"),
      blank("geo:ovx", "OVX", "Crude oil volatility index", "FRED OVXCLS"),
      blank("geo:gvz", "GVZ", "Gold volatility index", "FRED GVZCLS"),
      blank("geo:news-feed", "News Sentiment Flow", "Recent market headlines, scored", "Yahoo Finance headlines, keyword sentiment"),
    ],
  },
];
