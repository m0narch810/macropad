import DashboardShell from "@/components/DashboardShell";
import { getPanels } from "@/lib/getPanels";
import { getMarkets } from "@/lib/getMarkets";

export const revalidate = 300;

export default async function Home() {
  const [{ panels, lastUpdated }, markets] = await Promise.all([getPanels(), getMarkets()]);
  return <DashboardShell panels={panels} lastUpdated={lastUpdated} markets={markets} />;
}
