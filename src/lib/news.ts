import { fetchRssHeadlines } from "@/lib/rss";
import { scoreSentiment } from "@/lib/sentiment";

/**
 * Real macro/policy news desks, not per-ticker stock headlines — this is
 * what actually moves the macro picture (Fed action, employment, rates,
 * geopolitics), not "Apple shares rise." Every URL below is live-verified
 * (curl'd, 200, real headlines) before being wired in.
 */
const NEWS_SOURCES = [
  { label: "CNBC Economy", url: "https://www.cnbc.com/id/20910258/device/rss/rss.html" },
  { label: "Federal Reserve", url: "https://www.federalreserve.gov/feeds/press_all.xml" },
  { label: "WSJ Markets", url: "https://feeds.a.dj.com/rss/RSSMarketsMain.xml" },
  { label: "Yahoo Finance", url: "https://finance.yahoo.com/news/rssindex" },
  { label: "FXStreet", url: "https://www.fxstreet.com/rss/news" },
];

export interface NewsItem {
  title: string;
  link: string | null;
  pubDate: string; // ISO
  source: string; // which desk it came from
  sentimentScore: number; // -1..1
  sentimentLabel: "bullish" | "bearish" | "neutral";
}

/** Fetches headlines across macro news desks, dedupes by title, scores each, sorts newest first. */
export async function fetchNewsFeed(maxItems = 120): Promise<NewsItem[]> {
  const results = await Promise.all(
    NEWS_SOURCES.map(async (src) => {
      const items = await fetchRssHeadlines(src.url);
      return items.map((h) => ({ ...h, source: src.label }));
    })
  );

  const seen = new Set<string>();
  const merged: NewsItem[] = [];

  for (const items of results) {
    for (const h of items) {
      const key = h.title.toLowerCase().trim();
      if (seen.has(key)) continue;
      seen.add(key);
      const sentiment = scoreSentiment(h.title);
      merged.push({
        title: h.title,
        link: h.link,
        pubDate: h.pubDate ?? new Date().toISOString(),
        source: h.source,
        sentimentScore: sentiment.score,
        sentimentLabel: sentiment.label,
      });
    }
  }

  merged.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());
  return merged.slice(0, maxItems);
}
