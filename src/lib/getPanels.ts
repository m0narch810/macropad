import { supabase } from "@/lib/supabase";
import { macroPanels, type MacroPanel, type SeriesStatus, type HistoryPoint, type ExtraStat } from "@/lib/macroData";

interface DbRow {
  id: string;
  value: string;
  status: SeriesStatus;
  note: string;
  zscore: number | null;
  sparkline: number[] | null;
  window_label: string | null;
  history: HistoryPoint[] | null;
  extra_stats: ExtraStat[] | null;
  updated_at: string;
}

export async function getPanels(): Promise<{ panels: MacroPanel[]; lastUpdated: string | null }> {
  if (!supabase) {
    return { panels: macroPanels, lastUpdated: null };
  }

  const { data, error } = await supabase
    .from("macro_series")
    .select("id, value, status, note, zscore, sparkline, window_label, history, extra_stats, updated_at");

  if (error || !data) {
    return { panels: macroPanels, lastUpdated: null };
  }

  const byId = new Map<string, DbRow>(data.map((row: DbRow) => [row.id, row]));
  let lastUpdated: string | null = null;

  const panels = macroPanels.map((panel) => ({
    ...panel,
    series: panel.series.map((s) => {
      const row = byId.get(s.id);
      if (!row) return s;
      if (!lastUpdated || row.updated_at > lastUpdated) lastUpdated = row.updated_at;
      return {
        ...s,
        value: row.value,
        status: row.status,
        note: row.note,
        zscore: row.zscore,
        sparkline: row.sparkline,
        windowLabel: row.window_label,
        history: row.history,
        extraStats: row.extra_stats,
      };
    }),
  }));

  return { panels, lastUpdated };
}
