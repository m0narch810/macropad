import { NextResponse } from "next/server";

// CBOE's own published volatility/tail indices, fetched via Yahoo Finance's
// public chart endpoint - no key needed, no fabrication: these are the real,
// published numbers, not a derived proxy.
const TICKERS = [
  { symbol: "VIX1D", yahoo: "%5EVIX1D", label: "VIX1D", note: "1-day SPX implied vol" },
  { symbol: "VIX", yahoo: "%5EVIX", label: "VIX", note: "30-day SPX implied vol" },
  { symbol: "VXN", yahoo: "%5EVXN", label: "VXN", note: "30-day NDX implied vol" },
  { symbol: "VVIX", yahoo: "%5EVVIX", label: "VVIX", note: "Vol of VIX (vol-of-vol)" },
  { symbol: "SKEW", yahoo: "%5ESKEW", label: "SKEW", note: "SPX tail-risk skew" },
] as const;

const CACHE_TTL_MS = 30_000;
let cache: { data: unknown; expiresAt: number } | null = null;

interface YahooChart {
  chart?: {
    result?: {
      meta: { regularMarketPrice: number };
      timestamp?: number[];
      indicators: { quote: { close: (number | null)[] }[] };
    }[];
    error?: unknown;
  };
}

async function fetchOne(ticker: (typeof TICKERS)[number]) {
  const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${ticker.yahoo}?interval=1d&range=5d`, {
    headers: { "User-Agent": "Mozilla/5.0" },
    cache: "no-store",
  });
  const json: YahooChart = await res.json().catch(() => ({}));
  const result = json.chart?.result?.[0];
  if (!result) return { ...ticker, price: null, history: [] as number[] };

  const closes = (result.indicators.quote[0]?.close ?? []).filter((c): c is number => c !== null);
  const price = result.meta.regularMarketPrice;
  return { ...ticker, price, history: closes };
}

export async function GET() {
  if (cache && cache.expiresAt > Date.now()) {
    return NextResponse.json(cache.data);
  }

  const results = await Promise.all(TICKERS.map(fetchOne));
  const data = { ok: true, asOf: Date.now(), indices: results };

  cache = { data, expiresAt: Date.now() + CACHE_TTL_MS };
  return NextResponse.json(data);
}
