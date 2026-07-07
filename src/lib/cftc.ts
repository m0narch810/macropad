const BASE = "https://publicreporting.cftc.gov/resource/6dca-aqww.json";

interface CftcRow {
  report_date_as_yyyy_mm_dd: string;
  noncomm_positions_long_all: string;
  noncomm_positions_short_all: string;
}

async function fetchRows(marketName: string, limit: number): Promise<CftcRow[]> {
  const url = new URL(BASE);
  url.searchParams.set("$where", `market_and_exchange_names = '${marketName.replace(/'/g, "''")}'`);
  url.searchParams.set("$order", "report_date_as_yyyy_mm_dd DESC");
  url.searchParams.set("$select", "report_date_as_yyyy_mm_dd,noncomm_positions_long_all,noncomm_positions_short_all");
  url.searchParams.set("$limit", String(limit));

  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) return [];
  return res.json();
}

/** Latest + previous report net position. */
export async function fetchCftcNet(marketName: string): Promise<{ net: number | null; prevNet: number | null }> {
  const rows = await fetchRows(marketName, 2);
  if (rows.length === 0) return { net: null, prevNet: null };
  const net = Number(rows[0].noncomm_positions_long_all) - Number(rows[0].noncomm_positions_short_all);
  const prevNet =
    rows.length > 1
      ? Number(rows[1].noncomm_positions_long_all) - Number(rows[1].noncomm_positions_short_all)
      : null;
  return { net, prevNet };
}

/** Chronological (oldest -> newest) net-position history, for z-score / sparkline. */
export async function fetchCftcHistory(marketName: string, limit = 104): Promise<number[]> {
  const rows = await fetchRows(marketName, limit);
  return rows
    .slice()
    .reverse()
    .map((r) => Number(r.noncomm_positions_long_all) - Number(r.noncomm_positions_short_all));
}

/** Same as fetchCftcHistory but keeps report dates, for full-depth quant cards. */
export async function fetchCftcHistoryDated(marketName: string, limit = 104): Promise<{ date: string; value: number }[]> {
  const rows = await fetchRows(marketName, limit);
  return rows
    .slice()
    .reverse()
    .map((r) => ({
      date: r.report_date_as_yyyy_mm_dd.slice(0, 10),
      value: Number(r.noncomm_positions_long_all) - Number(r.noncomm_positions_short_all),
    }));
}

export function fmtNet(n: number | null): string {
  if (n === null) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toLocaleString("en-US")}`;
}
