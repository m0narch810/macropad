import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { fetchFredHistory, statusFromDelta, fmt } from "@/lib/fred";
import { fetchCftcNet, fetchCftcHistory, fetchCftcHistoryDated, fmtNet } from "@/lib/cftc";
import { fetchYahooHistory, fetchYahooHeadline, ratioSeries } from "@/lib/yahoo";
import {
  computeStats,
  lastValidPair,
  annualizedChange,
  avgChange,
  sahmRule,
  sahmRuleHistory,
  annualizedChangeHistory,
  avgChangeHistory,
  subtractHistory,
} from "@/lib/stats";
import type { ExtraStat } from "@/lib/macroData";
import { MARKET_SYMBOLS, marketRowId } from "@/lib/markets";

export const dynamic = "force-dynamic";

interface UpsertRow {
  id: string;
  panel_id: string;
  name: string;
  note: string;
  value: string;
  status: "up" | "down" | "flat" | "pending";
  source: string;
  zscore: number | null;
  sparkline: number[] | null;
  window_label: string | null;
  history?: { date: string; value: number }[] | null;
  extra_stats?: ExtraStat[] | null;
}

function toHistory(dates: string[], values: (number | null)[]): { date: string; value: number }[] {
  const out: { date: string; value: number }[] = [];
  dates.forEach((d, i) => {
    const v = values[i];
    if (v !== null && !Number.isNaN(v)) out.push({ date: d, value: v });
  });
  return out;
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const fredKey = process.env.FRED_API_KEY;
  if (!fredKey) {
    return NextResponse.json({ error: "FRED_API_KEY not set" }, { status: 500 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase service role not configured" }, { status: 500 });
  }

  const rows: UpsertRow[] = [];

  try {
    // ---- H.4.1 Fed Balance Sheet (WALCL, weekly, $ millions -> $T) ----
    const walclHist = await fetchFredHistory("WALCL", fredKey, 520);
    const walclNums = walclHist.map((p) => (p.value === null ? null : p.value / 1_000_000));
    const walclStats = computeStats(walclNums);
    const [walclLatest, walclPrev] = lastValidPair(walclNums);
    const walclHistory = toHistory(
      walclHist.map((p) => p.date),
      walclNums
    );
    const walcl4wAnn = annualizedChange(walclNums, 4);
    const walcl13wAnn = annualizedChange(walclNums, 13);
    const walcl13wHist = annualizedChangeHistory(walclHistory, 13);
    const walcl13wStats = computeStats(walcl13wHist.map((p) => p.value));
    const walclExtra: ExtraStat[] = [
      { label: "4w pace (annualized)", value: walcl4wAnn === null ? "—" : `${walcl4wAnn > 0 ? "+" : ""}${walcl4wAnn.toFixed(1)}%` },
      {
        label: "13w pace (annualized)",
        value: walcl13wAnn === null ? "—" : `${walcl13wAnn > 0 ? "+" : ""}${walcl13wAnn.toFixed(1)}%`,
        flag: walcl13wAnn !== null && walcl13wAnn <= -5,
        caption: "Annualized 13-week pace of balance sheet change — the cleanest read on whether QT or QE is actively running.",
        history: walcl13wHist,
        zscore: walcl13wStats.zscore,
        threshold: -5,
        windowLabel: "10y weekly",
      },
    ];
    const walclRow = (id: string, panel_id: string, name: string, note: string, withHistory: boolean): UpsertRow => ({
      id,
      panel_id,
      name,
      note,
      value: fmt(walclLatest, { decimals: 3, suffix: "T" }),
      status: statusFromDelta(walclLatest, walclPrev),
      source: "FRED WALCL",
      zscore: walclStats.zscore,
      sparkline: walclStats.sparkline,
      window_label: "10y weekly",
      history: withHistory ? walclHistory : null,
      extra_stats: withHistory ? walclExtra : null,
    });
    rows.push(walclRow("us-macro:h41-balance-sheet", "us-macro", "H.4.1 Fed Balance Sheet", "Weekly, Fed H.4.1 release", true));
    rows.push(walclRow("transmission:walcl", "transmission", "WALCL", "Fed balance sheet level", false));

    // ---- Funding rate stack (SOFR / EFFR / IORB) ----
    const [sofrHist, effrHist, iorbHist] = await Promise.all([
      fetchFredHistory("SOFR", fredKey, 750),
      fetchFredHistory("EFFR", fredKey, 750),
      fetchFredHistory("IORB", fredKey, 750),
    ]);
    const sofrNums = sofrHist.map((p) => p.value);
    const effrNums = effrHist.map((p) => p.value);
    const iorbNums = iorbHist.map((p) => p.value);
    const sofrStats = computeStats(sofrNums);
    const [sofrV, sofrPrev] = lastValidPair(sofrNums);
    const [effrV] = lastValidPair(effrNums);
    const [iorbV] = lastValidPair(iorbNums);
    const sofrIorbBps = sofrV !== null && iorbV !== null ? (sofrV - iorbV) * 100 : null;
    const effrIorbBps = effrV !== null && iorbV !== null ? (effrV - iorbV) * 100 : null;
    const sofrHistoryPts = toHistory(sofrHist.map((p) => p.date), sofrNums);
    const iorbHistoryPts = toHistory(iorbHist.map((p) => p.date), iorbNums);
    const sofrIorbSpreadHist = subtractHistory(sofrHistoryPts, iorbHistoryPts).map((p) => ({ date: p.date, value: p.value * 100 }));
    const sofrIorbStats = computeStats(sofrIorbSpreadHist.map((p) => p.value));
    const effrHistoryPts = toHistory(effrHist.map((p) => p.date), effrNums);
    const effrIorbSpreadHist = subtractHistory(effrHistoryPts, iorbHistoryPts).map((p) => ({ date: p.date, value: p.value * 100 }));
    const effrIorbStats = computeStats(effrIorbSpreadHist.map((p) => p.value));
    rows.push({
      id: "us-macro:sofr-effr-iorb",
      panel_id: "us-macro",
      name: "SOFR / EFFR / IORB",
      note: "Funding rate spread stack",
      value: `${fmt(sofrV, { suffix: "%" })} / ${fmt(effrV, { suffix: "%" })} / ${fmt(iorbV, { suffix: "%" })}`,
      status: statusFromDelta(sofrV, sofrPrev),
      source: "FRED SOFR/EFFR/IORB",
      zscore: sofrStats.zscore,
      sparkline: sofrStats.sparkline,
      window_label: "3y daily (SOFR)",
      history: sofrHistoryPts,
      extra_stats: [
        {
          label: "SOFR − IORB (bps)",
          value: sofrIorbBps === null ? "—" : `${sofrIorbBps > 0 ? "+" : ""}${sofrIorbBps.toFixed(0)}bp`,
          flag: sofrIorbBps !== null && sofrIorbBps >= 10,
          caption: "Repo/funding stress gauge — SOFR printing meaningfully above IORB signals collateral or cash scarcity.",
          history: sofrIorbSpreadHist,
          zscore: sofrIorbStats.zscore,
          threshold: 10,
          windowLabel: "3y daily",
        },
        {
          label: "EFFR − IORB (bps)",
          value: effrIorbBps === null ? "—" : `${effrIorbBps > 0 ? "+" : ""}${effrIorbBps.toFixed(0)}bp`,
          caption: "Effective fed funds vs IORB — a second read on funding conditions alongside SOFR.",
          history: effrIorbSpreadHist,
          zscore: effrIorbStats.zscore,
          windowLabel: "3y daily",
        },
      ],
    });

    // ---- HY credit spread ----
    const hyHist = await fetchFredHistory("BAMLH0A0HYM2", fredKey, 750);
    const hyNums = hyHist.map((p) => p.value);
    const hyStats = computeStats(hyNums);
    const [hyLatest, hyPrev] = lastValidPair(hyNums);
    // Rough market-implied 5y cumulative default rate: spread compensates for
    // expected loss = default prob * (1 - recovery). Assumes ~40% recovery,
    // the standard high-yield convention.
    const impliedDefault = (spreadPct: number) => (1 - Math.pow(1 - spreadPct / 100 / (1 - 0.4), 5)) * 100;
    const impliedDefault5y = hyLatest === null ? null : impliedDefault(hyLatest);
    const hyHistoryPts = toHistory(hyHist.map((p) => p.date), hyNums);
    const impliedDefaultHist = hyHistoryPts.map((p) => ({ date: p.date, value: impliedDefault(p.value) }));
    const impliedDefaultStats = computeStats(impliedDefaultHist.map((p) => p.value));
    rows.push({
      id: "us-macro:hy-credit-spread",
      panel_id: "us-macro",
      name: "High Yield Credit Spread",
      note: "ICE BofA HY OAS",
      value: fmt(hyLatest, { suffix: "%" }),
      status: statusFromDelta(hyLatest, hyPrev),
      history: hyHistoryPts,
      source: "FRED BAMLH0A0HYM2",
      zscore: hyStats.zscore,
      sparkline: hyStats.sparkline,
      window_label: "3y daily",
      extra_stats: [
        {
          label: "Implied 5y default rate",
          value: impliedDefault5y === null ? "—" : `≈${impliedDefault5y.toFixed(1)}%`,
          caption: "Back-solved from the spread assuming 40% recovery — the standard HY convention. Rises well before actual defaults do.",
          history: impliedDefaultHist,
          zscore: impliedDefaultStats.zscore,
          windowLabel: "3y daily",
        },
        { label: "Recovery assumption", value: "40% (HY convention)" },
      ],
    });

    // ---- CPI inflation, YoY (derived from CPIAUCSL index) ----
    const cpiHist = await fetchFredHistory("CPIAUCSL", fredKey, 240);
    const cpiYoy: { date: string; value: number }[] = [];
    for (let i = 12; i < cpiHist.length; i++) {
      const cur = cpiHist[i].value;
      const prior = cpiHist[i - 12].value;
      if (cur !== null && prior !== null && prior !== 0) {
        cpiYoy.push({ date: cpiHist[i].date, value: ((cur / prior) - 1) * 100 });
      }
    }
    const cpiYoyNums = cpiYoy.map((p): number | null => p.value);
    const cpiStats = computeStats(cpiYoyNums);
    const [cpiLatest, cpiPrev] = lastValidPair(cpiYoyNums);
    const cpiIndexNums = cpiHist.map((p) => p.value);
    const cpi3mAnn = annualizedChange(cpiIndexNums, 3);
    const cpi6mAnn = annualizedChange(cpiIndexNums, 6);
    const cpiIndexHistoryPts = toHistory(cpiHist.map((p) => p.date), cpiIndexNums);
    const cpi3mHist = annualizedChangeHistory(cpiIndexHistoryPts, 3);
    const cpi6mHist = annualizedChangeHistory(cpiIndexHistoryPts, 6);
    const cpi3mStats = computeStats(cpi3mHist.map((p) => p.value));
    const cpi6mStats = computeStats(cpi6mHist.map((p) => p.value));
    rows.push({
      id: "us-macro:cpi-yoy",
      panel_id: "us-macro",
      name: "CPI Inflation (YoY)",
      note: "Headline CPI, year-over-year",
      value: fmt(cpiLatest, { suffix: "%" }),
      status: statusFromDelta(cpiLatest, cpiPrev),
      source: "FRED CPIAUCSL (derived YoY)",
      zscore: cpiStats.zscore,
      sparkline: cpiStats.sparkline,
      window_label: "15y monthly",
      history: cpiYoy,
      extra_stats: [
        {
          label: "3m annualized",
          value: cpi3mAnn === null ? "—" : `${cpi3mAnn > 0 ? "+" : ""}${cpi3mAnn.toFixed(1)}%`,
          flag: cpi3mAnn !== null && cpiLatest !== null && cpi3mAnn > cpiLatest + 1,
          caption: "3-month annualized rate — the most forward-looking read on where inflation momentum is heading, vs YoY which is backward-looking.",
          history: cpi3mHist,
          zscore: cpi3mStats.zscore,
          windowLabel: "15y monthly",
        },
        {
          label: "6m annualized",
          value: cpi6mAnn === null ? "—" : `${cpi6mAnn > 0 ? "+" : ""}${cpi6mAnn.toFixed(1)}%`,
          history: cpi6mHist,
          zscore: cpi6mStats.zscore,
          windowLabel: "15y monthly",
        },
      ],
    });

    // ---- Unemployment rate ----
    const unrateHist = await fetchFredHistory("UNRATE", fredKey, 240);
    const unrateNums = unrateHist.map((p) => p.value);
    const unrateStats = computeStats(unrateNums);
    const [unrateLatest, unratePrev] = lastValidPair(unrateNums);
    const sahm = sahmRule(unrateNums);
    const unrateHistoryPts = toHistory(unrateHist.map((p) => p.date), unrateNums);
    const sahmHist = sahmRuleHistory(unrateHistoryPts);
    const sahmStats = computeStats(sahmHist.map((p) => p.value));
    rows.push({
      id: "us-macro:unemployment",
      panel_id: "us-macro",
      name: "Unemployment Rate",
      note: "U-3 headline unemployment",
      value: fmt(unrateLatest, { suffix: "%" }),
      status: statusFromDelta(unrateLatest, unratePrev),
      source: "FRED UNRATE",
      zscore: unrateStats.zscore,
      sparkline: unrateStats.sparkline,
      window_label: "20y monthly",
      history: unrateHistoryPts,
      extra_stats: [
        {
          label: "Sahm Rule indicator",
          value: sahm.value === null ? "—" : `${sahm.value.toFixed(2)}pp`,
          flag: sahm.triggered,
          caption: "3-month avg unemployment minus its own 12-month low. ≥0.50pp has historically meant a recession is already underway.",
          history: sahmHist,
          zscore: sahmStats.zscore,
          threshold: 0.5,
          windowLabel: "20y monthly",
        },
        { label: "Recession trigger at", value: "≥0.50pp" },
      ],
    });

    // ---- Nonfarm payrolls ----
    const payemsHist = await fetchFredHistory("PAYEMS", fredKey, 240);
    const payemsNums = payemsHist.map((p) => p.value);
    const payemsStats = computeStats(payemsNums);
    const [payemsLatest, payemsPrev] = lastValidPair(payemsNums);
    const payems3mAvg = avgChange(payemsNums, 3);
    const payems6mAvg = avgChange(payemsNums, 6);
    const payemsHistoryPts = toHistory(payemsHist.map((p) => p.date), payemsNums);
    const payems3mHist = avgChangeHistory(payemsHistoryPts, 3);
    const payems6mHist = avgChangeHistory(payemsHistoryPts, 6);
    const payems3mStats = computeStats(payems3mHist.map((p) => p.value));
    const payems6mStats = computeStats(payems6mHist.map((p) => p.value));
    rows.push({
      id: "us-macro:payrolls",
      panel_id: "us-macro",
      name: "Nonfarm Payrolls",
      note: "Total nonfarm employment, thousands",
      value: fmt(payemsLatest, { decimals: 0 }),
      status: statusFromDelta(payemsLatest, payemsPrev),
      source: "FRED PAYEMS",
      zscore: payemsStats.zscore,
      sparkline: payemsStats.sparkline,
      window_label: "20y monthly",
      history: payemsHistoryPts,
      extra_stats: [
        {
          label: "3m avg monthly gain",
          value: payems3mAvg === null ? "—" : `${payems3mAvg > 0 ? "+" : ""}${payems3mAvg.toFixed(0)}k`,
          flag: payems3mAvg !== null && payems3mAvg < 50,
          caption: "Smooths the noisy single-month print — the standard way traders actually read the labor market's trend.",
          history: payems3mHist,
          zscore: payems3mStats.zscore,
          threshold: 50,
          windowLabel: "20y monthly",
        },
        {
          label: "6m avg monthly gain",
          value: payems6mAvg === null ? "—" : `${payems6mAvg > 0 ? "+" : ""}${payems6mAvg.toFixed(0)}k`,
          history: payems6mHist,
          zscore: payems6mStats.zscore,
          windowLabel: "20y monthly",
        },
      ],
    });

    // ---- M2 money supply ----
    const m2Hist = await fetchFredHistory("M2SL", fredKey, 240);
    const m2Nums = m2Hist.map((p) => (p.value === null ? null : p.value / 1000));
    const m2Stats = computeStats(m2Nums);
    const [m2Latest, m2Prev] = lastValidPair(m2Nums);
    const m2YoyAnn = annualizedChange(m2Nums, 12);
    const m2HistoryPts = toHistory(m2Hist.map((p) => p.date), m2Nums);
    const m2YoyHist = annualizedChangeHistory(m2HistoryPts, 12);
    const m2YoyStats = computeStats(m2YoyHist.map((p) => p.value));
    rows.push({
      id: "us-macro:m2",
      panel_id: "us-macro",
      name: "M2 Money Supply",
      note: "Broad money supply, $ trillions",
      value: fmt(m2Latest, { decimals: 3, suffix: "T" }),
      status: statusFromDelta(m2Latest, m2Prev),
      source: "FRED M2SL",
      zscore: m2Stats.zscore,
      sparkline: m2Stats.sparkline,
      window_label: "20y monthly",
      history: m2HistoryPts,
      extra_stats: [
        {
          label: "YoY growth",
          value: m2YoyAnn === null ? "—" : `${m2YoyAnn > 0 ? "+" : ""}${m2YoyAnn.toFixed(1)}%`,
          flag: m2YoyAnn !== null && m2YoyAnn < 0,
          caption: "Negative YoY M2 growth (2022-23) has historically coincided with tightening credit conditions.",
          history: m2YoyHist,
          zscore: m2YoyStats.zscore,
          threshold: 0,
          windowLabel: "20y monthly",
        },
      ],
    });

    // ---- 10y Treasury yield (level, not spread) ----
    const [dgs10Hist, t10yieForRealHist] = await Promise.all([
      fetchFredHistory("DGS10", fredKey, 750),
      fetchFredHistory("T10YIE", fredKey, 750),
    ]);
    const dgs10Nums = dgs10Hist.map((p) => p.value);
    const dgs10Stats = computeStats(dgs10Nums);
    const [dgs10Latest, dgs10Prev] = lastValidPair(dgs10Nums);
    const [breakevenForReal] = lastValidPair(t10yieForRealHist.map((p) => p.value));
    const realYield = dgs10Latest !== null && breakevenForReal !== null ? dgs10Latest - breakevenForReal : null;
    const dgs10HistoryPts = toHistory(dgs10Hist.map((p) => p.date), dgs10Nums);
    const t10yieHistoryForReal = toHistory(t10yieForRealHist.map((p) => p.date), t10yieForRealHist.map((p) => p.value));
    const realYieldHist = subtractHistory(dgs10HistoryPts, t10yieHistoryForReal);
    const realYieldStats = computeStats(realYieldHist.map((p) => p.value));
    rows.push({
      id: "us-macro:10y-yield",
      panel_id: "us-macro",
      name: "10y Treasury Yield",
      note: "Benchmark long rate",
      value: fmt(dgs10Latest, { suffix: "%" }),
      status: statusFromDelta(dgs10Latest, dgs10Prev),
      source: "FRED DGS10",
      zscore: dgs10Stats.zscore,
      sparkline: dgs10Stats.sparkline,
      window_label: "3y daily",
      history: dgs10HistoryPts,
      extra_stats: [
        {
          label: "Real yield (less 10y breakeven)",
          value: realYield === null ? "—" : `${realYield.toFixed(2)}%`,
          flag: realYield !== null && realYield >= 2,
          caption: "Nominal 10y minus market-implied inflation (breakeven) — the rate that actually matters for real economic activity and valuations.",
          history: realYieldHist,
          zscore: realYieldStats.zscore,
          threshold: 2,
          windowLabel: "3y daily",
        },
      ],
    });

    // ---- Industrial production ----
    const indproHist = await fetchFredHistory("INDPRO", fredKey, 240);
    const indproNums = indproHist.map((p) => p.value);
    const indproStats = computeStats(indproNums);
    const [indproLatest, indproPrev] = lastValidPair(indproNums);
    const indproYoy = annualizedChange(indproNums, 12);
    const indproHistoryPts = toHistory(indproHist.map((p) => p.date), indproNums);
    const indproYoyHist = annualizedChangeHistory(indproHistoryPts, 12);
    const indproYoyStats = computeStats(indproYoyHist.map((p) => p.value));
    rows.push({
      id: "us-macro:industrial-production",
      panel_id: "us-macro",
      name: "Industrial Production",
      note: "Index, 2017=100",
      value: fmt(indproLatest, { decimals: 1 }),
      status: statusFromDelta(indproLatest, indproPrev),
      source: "FRED INDPRO",
      zscore: indproStats.zscore,
      sparkline: indproStats.sparkline,
      window_label: "20y monthly",
      history: indproHistoryPts,
      extra_stats: [
        {
          label: "YoY change",
          value: indproYoy === null ? "—" : `${indproYoy > 0 ? "+" : ""}${indproYoy.toFixed(1)}%`,
          flag: indproYoy !== null && indproYoy < 0,
          caption: "Standard quoting convention for this series — the level index alone doesn't tell you the growth rate.",
          history: indproYoyHist,
          zscore: indproYoyStats.zscore,
          threshold: 0,
          windowLabel: "20y monthly",
        },
      ],
    });

    // ---- Consumer sentiment ----
    const umcsentHist = await fetchFredHistory("UMCSENT", fredKey, 240);
    const umcsentNums = umcsentHist.map((p) => p.value);
    const umcsentStats = computeStats(umcsentNums);
    const [umcsentLatest, umcsentPrev] = lastValidPair(umcsentNums);
    const umcsentHistoryPts = toHistory(umcsentHist.map((p) => p.date), umcsentNums);
    const umcsent3mLevelHist: { date: string; value: number }[] = [];
    for (let i = 2; i < umcsentHistoryPts.length; i++) {
      const slice = umcsentHistoryPts.slice(i - 2, i + 1);
      umcsent3mLevelHist.push({
        date: umcsentHistoryPts[i].date,
        value: slice.reduce((a, b) => a + b.value, 0) / slice.length,
      });
    }
    const umcsent3mAvg = umcsent3mLevelHist.length ? umcsent3mLevelHist[umcsent3mLevelHist.length - 1].value : null;
    const umcsent3mLevelStats = computeStats(umcsent3mLevelHist.map((p) => p.value));
    rows.push({
      id: "us-macro:consumer-sentiment",
      panel_id: "us-macro",
      name: "Consumer Sentiment",
      note: "U. Michigan index",
      value: fmt(umcsentLatest, { decimals: 1 }),
      status: statusFromDelta(umcsentLatest, umcsentPrev),
      source: "FRED UMCSENT",
      zscore: umcsentStats.zscore,
      sparkline: umcsentStats.sparkline,
      window_label: "20y monthly",
      history: umcsentHistoryPts,
      extra_stats: [
        {
          label: "3m average",
          value: umcsent3mAvg === null ? "—" : umcsent3mAvg.toFixed(1),
          caption: "Smooths month-to-month survey noise in a series that's historically volatile.",
          history: umcsent3mLevelHist,
          zscore: umcsent3mLevelStats.zscore,
          windowLabel: "20y monthly",
        },
      ],
    });

    // ---- 10y-2y spread ----
    const t10y2yHist = await fetchFredHistory("T10Y2Y", fredKey, 750);
    const t10y2yNums = t10y2yHist.map((p) => p.value);
    const t10y2yStats = computeStats(t10y2yNums);
    const [t10y2yLatest, t10y2yPrev] = lastValidPair(t10y2yNums);
    const t10y2yHistoryPts = toHistory(t10y2yHist.map((p) => p.date), t10y2yNums);
    // Days-inverted streak: count back from the most recent point while spread stays negative.
    let inversionStreak = 0;
    for (let i = t10y2yHistoryPts.length - 1; i >= 0; i--) {
      if (t10y2yHistoryPts[i].value < 0) inversionStreak++;
      else break;
    }
    rows.push({
      id: "yield-rates:10y2y-spread",
      panel_id: "yield-rates",
      name: "US 10y-2y Yield Spread",
      note: "Curve inversion watch",
      value: fmt(t10y2yLatest, { suffix: "%" }),
      status: statusFromDelta(t10y2yLatest, t10y2yPrev),
      source: "FRED T10Y2Y",
      zscore: t10y2yStats.zscore,
      sparkline: t10y2yStats.sparkline,
      window_label: "3y daily",
      history: t10y2yHistoryPts,
      extra_stats: [
        {
          label: "Days inverted (current streak)",
          value: inversionStreak === 0 ? "Not inverted" : `${inversionStreak}d`,
          flag: inversionStreak > 0,
          caption: "Inversions have historically preceded recessions by 6-24 months — the un-inversion (crossing back positive) is often the sharper signal.",
        },
      ],
    });

    // ---- Breakevens ----
    const [t5yieHist, t10yieHist] = await Promise.all([
      fetchFredHistory("T5YIE", fredKey, 750),
      fetchFredHistory("T10YIE", fredKey, 750),
    ]);
    const t5yieNums = t5yieHist.map((p) => p.value);
    const t10yieNums = t10yieHist.map((p) => p.value);
    const t10yieStats = computeStats(t10yieNums);
    const [t5yieV] = lastValidPair(t5yieNums);
    const [t10yieV, t10yiePrev] = lastValidPair(t10yieNums);
    const t5yieHistoryPts = toHistory(t5yieHist.map((p) => p.date), t5yieNums);
    const t10yieHistoryPts = toHistory(t10yieHist.map((p) => p.date), t10yieNums);
    // 5s10s breakeven spread: how much extra inflation is priced in further out the curve.
    const breakeven5s10sHist = subtractHistory(t10yieHistoryPts, t5yieHistoryPts);
    const breakeven5s10sStats = computeStats(breakeven5s10sHist.map((p) => p.value));
    const [breakeven5s10sLatest] = lastValidPair(breakeven5s10sHist.map((p) => p.value));
    rows.push({
      id: "yield-rates:breakeven",
      panel_id: "yield-rates",
      name: "5y/10y Breakeven Inflation",
      note: "Market inflation expectation",
      value: `${fmt(t5yieV, { suffix: "%" })} / ${fmt(t10yieV, { suffix: "%" })}`,
      status: statusFromDelta(t10yieV, t10yiePrev),
      source: "FRED T5YIE/T10YIE",
      zscore: t10yieStats.zscore,
      sparkline: t10yieStats.sparkline,
      window_label: "3y daily (10y BE)",
      history: t10yieHistoryPts,
      extra_stats: [
        {
          label: "5s10s breakeven spread",
          value: breakeven5s10sLatest === null ? "—" : `${breakeven5s10sLatest > 0 ? "+" : ""}${breakeven5s10sLatest.toFixed(2)}%`,
          caption: "10y breakeven minus 5y — positive means the market expects inflation further out to run hotter than the near term.",
          history: breakeven5s10sHist,
          zscore: breakeven5s10sStats.zscore,
          windowLabel: "3y daily",
        },
      ],
    });

    // ---- 10y-3m spread (NY Fed's preferred recession spread) ----
    const t10y3mHist = await fetchFredHistory("T10Y3M", fredKey, 750);
    const t10y3mNums = t10y3mHist.map((p) => p.value);
    const t10y3mStats = computeStats(t10y3mNums);
    const [t10y3mLatest, t10y3mPrev] = lastValidPair(t10y3mNums);
    const t10y3mHistoryPts = toHistory(t10y3mHist.map((p) => p.date), t10y3mNums);
    let inversionStreak3m = 0;
    for (let i = t10y3mHistoryPts.length - 1; i >= 0; i--) {
      if (t10y3mHistoryPts[i].value < 0) inversionStreak3m++;
      else break;
    }
    rows.push({
      id: "yield-rates:10y3m-spread",
      panel_id: "yield-rates",
      name: "US 10y-3m Yield Spread",
      note: "NY Fed's preferred recession spread",
      value: fmt(t10y3mLatest, { suffix: "%" }),
      status: statusFromDelta(t10y3mLatest, t10y3mPrev),
      source: "FRED T10Y3M",
      zscore: t10y3mStats.zscore,
      sparkline: t10y3mStats.sparkline,
      window_label: "3y daily",
      history: t10y3mHistoryPts,
      extra_stats: [
        {
          label: "Days inverted (current streak)",
          value: inversionStreak3m === 0 ? "Not inverted" : `${inversionStreak3m}d`,
          flag: inversionStreak3m > 0,
          caption: "The NY Fed's own recession model is built on this spread, not 2s10s — it has the better historical hit rate with fewer false positives.",
        },
      ],
    });

    // ---- 2y Treasury yield ----
    const dgs2Hist = await fetchFredHistory("DGS2", fredKey, 750);
    const dgs2Nums = dgs2Hist.map((p) => p.value);
    const dgs2Stats = computeStats(dgs2Nums);
    const [dgs2Latest, dgs2Prev] = lastValidPair(dgs2Nums);
    rows.push({
      id: "yield-rates:2y-yield",
      panel_id: "yield-rates",
      name: "2y Treasury Yield",
      note: "Front-end rate, prices Fed path",
      value: fmt(dgs2Latest, { suffix: "%" }),
      status: statusFromDelta(dgs2Latest, dgs2Prev),
      source: "FRED DGS2",
      zscore: dgs2Stats.zscore,
      sparkline: dgs2Stats.sparkline,
      window_label: "3y daily",
      history: toHistory(dgs2Hist.map((p) => p.date), dgs2Nums),
    });

    // ---- 10y Treasury yield (dedicated card in this panel) ----
    const dgs10YrHist = await fetchFredHistory("DGS10", fredKey, 750);
    const dgs10YrNums = dgs10YrHist.map((p) => p.value);
    const dgs10YrStats = computeStats(dgs10YrNums);
    const [dgs10YrLatest, dgs10YrPrev] = lastValidPair(dgs10YrNums);
    rows.push({
      id: "yield-rates:10y-yield",
      panel_id: "yield-rates",
      name: "10y Treasury Yield",
      note: "Benchmark long rate",
      value: fmt(dgs10YrLatest, { suffix: "%" }),
      status: statusFromDelta(dgs10YrLatest, dgs10YrPrev),
      source: "FRED DGS10",
      zscore: dgs10YrStats.zscore,
      sparkline: dgs10YrStats.sparkline,
      window_label: "3y daily",
      history: toHistory(dgs10YrHist.map((p) => p.date), dgs10YrNums),
    });

    // ---- 30y Treasury yield ----
    const dgs30Hist = await fetchFredHistory("DGS30", fredKey, 750);
    const dgs30Nums = dgs30Hist.map((p) => p.value);
    const dgs30Stats = computeStats(dgs30Nums);
    const [dgs30Latest, dgs30Prev] = lastValidPair(dgs30Nums);
    rows.push({
      id: "yield-rates:30y-yield",
      panel_id: "yield-rates",
      name: "30y Treasury Yield",
      note: "Long-bond, fiscal/term-premium sensitive",
      value: fmt(dgs30Latest, { suffix: "%" }),
      status: statusFromDelta(dgs30Latest, dgs30Prev),
      source: "FRED DGS30",
      zscore: dgs30Stats.zscore,
      sparkline: dgs30Stats.sparkline,
      window_label: "3y daily",
      history: toHistory(dgs30Hist.map((p) => p.date), dgs30Nums),
    });

    // ---- 5y5y forward inflation ----
    const t5yifrHist = await fetchFredHistory("T5YIFR", fredKey, 750);
    const t5yifrNums = t5yifrHist.map((p) => p.value);
    const t5yifrStats = computeStats(t5yifrNums);
    const [t5yifrLatest, t5yifrPrev] = lastValidPair(t5yifrNums);
    const t5yifrHistoryPts = toHistory(t5yifrHist.map((p) => p.date), t5yifrNums);
    const vsBreakevenHist = subtractHistory(t5yifrHistoryPts, t10yieHistoryPts);
    const vsBreakevenStats = computeStats(vsBreakevenHist.map((p) => p.value));
    const [vsBreakevenLatest] = lastValidPair(vsBreakevenHist.map((p) => p.value));
    rows.push({
      id: "yield-rates:forward-inflation",
      panel_id: "yield-rates",
      name: "5y5y Forward Inflation",
      note: "Long-run Fed-relevant inflation gauge",
      value: fmt(t5yifrLatest, { suffix: "%" }),
      status: statusFromDelta(t5yifrLatest, t5yifrPrev),
      source: "FRED T5YIFR",
      zscore: t5yifrStats.zscore,
      sparkline: t5yifrStats.sparkline,
      window_label: "3y daily",
      history: t5yifrHistoryPts,
      extra_stats: [
        {
          label: "vs. 10y breakeven",
          value: vsBreakevenLatest === null ? "—" : `${vsBreakevenLatest > 0 ? "+" : ""}${vsBreakevenLatest.toFixed(2)}%`,
          caption: "This is the metric the Fed itself watches most for long-run inflation anchoring — divergence from the 10y breakeven signals near-term vs. long-run views decoupling.",
          history: vsBreakevenHist,
          zscore: vsBreakevenStats.zscore,
          windowLabel: "3y daily",
        },
      ],
    });

    // ---- CFTC COT: equities (ES + NQ combined) ----
    const [esNet, nqNet, esHist, nqHist] = await Promise.all([
      fetchCftcNet("E-MINI S&P 500 - CHICAGO MERCANTILE EXCHANGE"),
      fetchCftcNet("NASDAQ-100 STOCK INDEX (MINI) - CHICAGO MERCANTILE EXCHANGE"),
      fetchCftcHistory("E-MINI S&P 500 - CHICAGO MERCANTILE EXCHANGE"),
      fetchCftcHistory("NASDAQ-100 STOCK INDEX (MINI) - CHICAGO MERCANTILE EXCHANGE"),
    ]);
    if (esNet.net !== null || nqNet.net !== null) {
      const netNow = (esNet.net ?? 0) + (nqNet.net ?? 0);
      const netPrev = (esNet.prevNet ?? 0) + (nqNet.prevNet ?? 0);
      const len = Math.min(esHist.length, nqHist.length);
      const combined = Array.from({ length: len }, (_, i) => esHist[esHist.length - len + i] + nqHist[nqHist.length - len + i]);
      const stats = computeStats(combined);
      rows.push({
        id: "cot:equities",
        panel_id: "cot-positioning",
        name: "Equities (NQ / ES Futures)",
        note: "Net non-commercial position",
        value: fmtNet(netNow),
        status: statusFromDelta(netNow, netPrev),
        source: "CFTC Legacy COT",
        zscore: stats.zscore,
        sparkline: stats.sparkline,
        window_label: "2y weekly",
      });
    }

    // ---- CFTC COT: treasury (10y + 2y combined), 10y and 2y alone for yield-rates ----
    const [t10yNet, t2yNet, t10yHist, t2yHist, t10yHistDated, t2yHistDated] = await Promise.all([
      fetchCftcNet("10-YEAR U.S. TREASURY NOTES - CHICAGO BOARD OF TRADE"),
      fetchCftcNet("2-YEAR U.S. TREASURY NOTES - CHICAGO BOARD OF TRADE"),
      fetchCftcHistory("10-YEAR U.S. TREASURY NOTES - CHICAGO BOARD OF TRADE"),
      fetchCftcHistory("2-YEAR U.S. TREASURY NOTES - CHICAGO BOARD OF TRADE"),
      fetchCftcHistoryDated("10-YEAR U.S. TREASURY NOTES - CHICAGO BOARD OF TRADE", 208),
      fetchCftcHistoryDated("2-YEAR U.S. TREASURY NOTES - CHICAGO BOARD OF TRADE", 208),
    ]);
    if (t10yNet.net !== null) {
      const t10yStats = computeStats(t10yHist);
      rows.push({
        id: "yield-rates:10y-cot",
        panel_id: "yield-rates",
        name: "10y Treasury Futures COT",
        note: "Net spec positioning, ZN",
        value: fmtNet(t10yNet.net),
        status: statusFromDelta(t10yNet.net, t10yNet.prevNet),
        source: "CFTC Legacy COT",
        zscore: t10yStats.zscore,
        sparkline: t10yStats.sparkline,
        window_label: "4y weekly",
        history: t10yHistDated,
      });
    }
    if (t2yNet.net !== null) {
      const t2yStats = computeStats(t2yHist);
      rows.push({
        id: "yield-rates:2y-cot",
        panel_id: "yield-rates",
        name: "2y Treasury Futures COT",
        note: "Net spec positioning, front end",
        value: fmtNet(t2yNet.net),
        status: statusFromDelta(t2yNet.net, t2yNet.prevNet),
        source: "CFTC Legacy COT",
        zscore: t2yStats.zscore,
        sparkline: t2yStats.sparkline,
        window_label: "4y weekly",
        history: t2yHistDated,
      });
    }
    if (t10yNet.net !== null || t2yNet.net !== null) {
      const netNow = (t10yNet.net ?? 0) + (t2yNet.net ?? 0);
      const netPrev = (t10yNet.prevNet ?? 0) + (t2yNet.prevNet ?? 0);
      const len = Math.min(t10yHist.length, t2yHist.length);
      const combined = Array.from({ length: len }, (_, i) => t10yHist[t10yHist.length - len + i] + t2yHist[t2yHist.length - len + i]);
      const stats = computeStats(combined);
      rows.push({
        id: "cot:treasury",
        panel_id: "cot-positioning",
        name: "Treasury (10y, 2y)",
        note: "Net non-commercial position",
        value: fmtNet(netNow),
        status: statusFromDelta(netNow, netPrev),
        source: "CFTC Legacy COT",
        zscore: stats.zscore,
        sparkline: stats.sparkline,
        window_label: "2y weekly",
      });
    }

    // ---- CFTC COT: DXY ----
    const [dxyNet, dxyHist] = await Promise.all([
      fetchCftcNet("U.S. DOLLAR INDEX - ICE FUTURES U.S."),
      fetchCftcHistory("U.S. DOLLAR INDEX - ICE FUTURES U.S."),
    ]);
    if (dxyNet.net !== null) {
      const stats = computeStats(dxyHist);
      rows.push({
        id: "cot:commodities-dxy",
        panel_id: "cot-positioning",
        name: "Dollar Index (DXY)",
        note: "Net non-commercial position",
        value: fmtNet(dxyNet.net),
        status: statusFromDelta(dxyNet.net, dxyNet.prevNet),
        source: "CFTC Legacy COT",
        zscore: stats.zscore,
        sparkline: stats.sparkline,
        window_label: "2y weekly",
      });
    }

    // ---- CBOE vol indices via FRED ----
    const ovxHist = await fetchFredHistory("OVXCLS", fredKey, 260);
    const ovxNums = ovxHist.map((p) => p.value);
    const ovxStats = computeStats(ovxNums);
    const [ovxLatest, ovxPrev] = lastValidPair(ovxNums);
    rows.push({
      id: "geo:ovx",
      panel_id: "geopolitics",
      name: "OVX",
      note: "Crude oil volatility index",
      value: fmt(ovxLatest),
      status: statusFromDelta(ovxLatest, ovxPrev),
      source: "FRED OVXCLS",
      zscore: ovxStats.zscore,
      sparkline: ovxStats.sparkline,
      window_label: "1y daily",
    });

    const gvzHist = await fetchFredHistory("GVZCLS", fredKey, 260);
    const gvzNums = gvzHist.map((p) => p.value);
    const gvzStats = computeStats(gvzNums);
    const [gvzLatest, gvzPrev] = lastValidPair(gvzNums);
    rows.push({
      id: "geo:gvz",
      panel_id: "geopolitics",
      name: "GVZ",
      note: "Gold volatility index",
      value: fmt(gvzLatest),
      status: statusFromDelta(gvzLatest, gvzPrev),
      source: "FRED GVZCLS",
      zscore: gvzStats.zscore,
      sparkline: gvzStats.sparkline,
      window_label: "1y daily",
    });

    // ---- Commodity ratios via Yahoo Finance ----
    const [copperHist, crudeHist, goldHist] = await Promise.all([
      fetchYahooHistory("HG=F", "2y"),
      fetchYahooHistory("CL=F", "2y"),
      fetchYahooHistory("GC=F", "2y"),
    ]);
    const copperCrude = ratioSeries(copperHist, crudeHist);
    if (copperCrude.length > 0) {
      const stats = computeStats(copperCrude);
      rows.push({
        id: "transmission:copper-crude",
        panel_id: "transmission",
        name: "Copper/Crude Ratio",
        note: "Growth vs. inflation proxy",
        value: fmt(copperCrude[copperCrude.length - 1], { decimals: 3 }),
        status: statusFromDelta(copperCrude[copperCrude.length - 1], copperCrude[copperCrude.length - 2] ?? null),
        source: "Yahoo Finance HG=F / CL=F",
        zscore: stats.zscore,
        sparkline: stats.sparkline,
        window_label: "2y weekly",
      });
    }
    const copperGold = ratioSeries(copperHist, goldHist);
    if (copperGold.length > 0) {
      const stats = computeStats(copperGold);
      rows.push({
        id: "transmission:copper-gold",
        panel_id: "transmission",
        name: "Copper/Gold Ratio",
        note: "Risk appetite proxy, tracks 10y",
        value: fmt(copperGold[copperGold.length - 1], { decimals: 4 }),
        status: statusFromDelta(copperGold[copperGold.length - 1], copperGold[copperGold.length - 2] ?? null),
        source: "Yahoo Finance HG=F / GC=F",
        zscore: stats.zscore,
        sparkline: stats.sparkline,
        window_label: "2y weekly",
      });
    }

    // ---- Market tickers (indices, commodities, rate-sensitive ETFs) ----
    await Promise.all(
      MARKET_SYMBOLS.map(async ({ symbol, label }) => {
        const series = await fetchYahooHistory(symbol, "2y");
        const closes = series.closes.filter((v): v is number => v !== null);
        if (closes.length < 10) return;
        const dates = series.timestamps.map((t) => new Date(t * 1000).toISOString().slice(0, 10));
        const history = toHistory(dates, series.closes);
        const stats = computeStats(series.closes);
        const [latest, prev] = lastValidPair(series.closes);
        rows.push({
          id: marketRowId(symbol),
          panel_id: "market",
          name: label,
          note: symbol,
          value: fmt(latest, { decimals: latest && latest < 20 ? 3 : 2 }),
          status: statusFromDelta(latest, prev),
          source: `Yahoo Finance ${symbol}`,
          zscore: stats.zscore,
          sparkline: stats.sparkline,
          window_label: "2y weekly",
          history,
        });
      })
    );

    // ---- News headline ----
    const headline = await fetchYahooHeadline("^GSPC");
    if (headline) {
      rows.push({
        id: "geo:news",
        panel_id: "geopolitics",
        name: "News Flow",
        note: headline.length > 90 ? headline.slice(0, 87) + "…" : headline,
        value: "Latest",
        status: "flat",
        source: "Yahoo Finance headlines",
        zscore: null,
        sparkline: null,
        window_label: null,
      });
    }

    const { error } = await supabaseAdmin
      .from("macro_series")
      .upsert(rows, { onConflict: "id" });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, updated: rows.length, at: new Date().toISOString() });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
