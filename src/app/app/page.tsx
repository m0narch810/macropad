import { after } from "next/server";
import DashboardShell from "@/components/DashboardShell";
import { getPanels } from "@/lib/getPanels";
import { getMarkets } from "@/lib/getMarkets";

export const revalidate = 3600;

const STALE_MS = 55 * 60 * 1000; // guard against duplicate fires from concurrent regen requests

function refreshUrl(): string {
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}/api/refresh`;
  return `http://localhost:${process.env.PORT ?? 3000}/api/refresh`;
}

/**
 * ISR only regenerates this page (and thus runs this function body) when a
 * real request lands after the revalidate window expires — so this fires on
 * actual traffic, at most once per revalidate window, never per-request.
 * That's what caps it against the upstream rate limits (FRED/CFTC/Yahoo):
 * no matter how many users hit /app, the refresh pipeline itself only ever
 * runs on the same ~hourly cadence as the cron, which is the actual backstop.
 */
export default async function AppPage() {
  const [{ panels, lastUpdated }, markets] = await Promise.all([getPanels(), getMarkets()]);

  const isStale = !lastUpdated || Date.now() - new Date(lastUpdated).getTime() > STALE_MS;
  if (isStale && process.env.CRON_SECRET) {
    after(async () => {
      try {
        await fetch(refreshUrl(), {
          headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
          cache: "no-store",
        });
      } catch {
        // best-effort — the Vercel cron remains the source of truth
      }
    });
  }

  return <DashboardShell panels={panels} lastUpdated={lastUpdated} markets={markets} />;
}
