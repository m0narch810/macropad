export async function fetchYahooPrice(symbol: string): Promise<{ price: number | null; prevClose: number | null }> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`;
  const res = await fetch(url, {
    cache: "no-store",
    headers: { "User-Agent": "Mozilla/5.0" },
  });
  if (!res.ok) return { price: null, prevClose: null };
  const data = await res.json();
  const meta = data?.chart?.result?.[0]?.meta;
  if (!meta) return { price: null, prevClose: null };
  return {
    price: meta.regularMarketPrice ?? null,
    prevClose: meta.chartPreviousClose ?? meta.previousClose ?? null,
  };
}

export interface YahooSeries {
  timestamps: number[];
  closes: (number | null)[];
}

/** Closes over `range` (e.g. "2y") at the given `interval` (default weekly), chronological (oldest -> newest). */
export async function fetchYahooHistory(symbol: string, range = "2y", interval = "1wk"): Promise<YahooSeries> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}`;
  const res = await fetch(url, {
    cache: "no-store",
    headers: { "User-Agent": "Mozilla/5.0" },
  });
  if (!res.ok) return { timestamps: [], closes: [] };
  const data = await res.json();
  const result = data?.chart?.result?.[0];
  if (!result) return { timestamps: [], closes: [] };
  return {
    timestamps: result.timestamp ?? [],
    closes: result.indicators?.quote?.[0]?.close ?? [],
  };
}

/** Align two weekly series by nearest timestamp and divide a/b, chronological. */
export function ratioSeries(a: YahooSeries, b: YahooSeries): number[] {
  return ratioSeriesDated(a, b).map((p) => p.value);
}

/** Same as ratioSeries but keeps ISO dates, for full-depth quant cards. */
export function ratioSeriesDated(a: YahooSeries, b: YahooSeries): { date: string; value: number }[] {
  const bByWeek = new Map<number, number>();
  b.timestamps.forEach((t, i) => {
    const close = b.closes[i];
    if (close !== null) bByWeek.set(Math.round(t / 86400), close);
  });
  const out: { date: string; value: number }[] = [];
  a.timestamps.forEach((t, i) => {
    const aClose = a.closes[i];
    const bClose = bByWeek.get(Math.round(t / 86400));
    if (aClose !== null && bClose) {
      out.push({ date: new Date(t * 1000).toISOString().slice(0, 10), value: aClose / bClose });
    }
  });
  return out;
}

/** Yahoo history as dated {date,value}[], for full-depth quant cards. */
export function toDatedSeries(series: YahooSeries): { date: string; value: number }[] {
  const out: { date: string; value: number }[] = [];
  series.timestamps.forEach((t, i) => {
    const close = series.closes[i];
    if (close !== null) out.push({ date: new Date(t * 1000).toISOString().slice(0, 10), value: close });
  });
  return out;
}

export async function fetchYahooHeadline(symbol: string): Promise<string | null> {
  const items = await fetchYahooHeadlines(symbol);
  return items[0]?.title ?? null;
}

export interface YahooHeadline {
  title: string;
  link: string | null;
  pubDate: string | null; // ISO, if parseable
}

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function extractTag(block: string, tag: string): string | null {
  const m = block.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`));
  if (!m) return null;
  return decodeXmlEntities(m[1].replace(/^<!\[CDATA\[(.*)\]\]>$/, "$1")).trim();
}

/** All items from a Yahoo Finance headline RSS feed (typically ~15-20 per symbol). */
export async function fetchYahooHeadlines(symbol: string): Promise<YahooHeadline[]> {
  const url = `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${encodeURIComponent(symbol)}&region=US&lang=en-US`;
  const res = await fetch(url, {
    cache: "no-store",
    headers: { "User-Agent": "Mozilla/5.0" },
  });
  if (!res.ok) return [];
  const xml = await res.text();
  const items = xml.match(/<item>[\s\S]*?<\/item>/g) ?? [];
  return items
    .map((block) => {
      const title = extractTag(block, "title");
      if (!title) return null;
      const link = extractTag(block, "link");
      const pubDateRaw = extractTag(block, "pubDate");
      const pubDate = pubDateRaw ? new Date(pubDateRaw).toISOString() : null;
      return { title, link, pubDate };
    })
    .filter((h): h is YahooHeadline => h !== null);
}
