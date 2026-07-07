import { supabase } from "@/lib/supabase";
import type { HistoryPoint, SeriesStatus } from "@/lib/macroData";

export interface MarketRow {
  id: string;
  symbol: string;
  name: string;
  value: string;
  status: SeriesStatus;
  zscore: number | null;
  sparkline: number[] | null;
  history: HistoryPoint[] | null;
  dailyHistory: HistoryPoint[] | null;
}

export async function getMarkets(): Promise<MarketRow[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("macro_series")
    .select("id, name, note, value, status, zscore, sparkline, history, payload")
    .eq("panel_id", "market");

  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id,
    symbol: row.note,
    name: row.name,
    value: row.value,
    status: row.status,
    zscore: row.zscore,
    sparkline: row.sparkline,
    history: row.history,
    dailyHistory: (row.payload as { dailyHistory?: HistoryPoint[] } | null)?.dailyHistory ?? null,
  }));
}
