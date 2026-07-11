import { cache } from "react";
import { unstable_cache } from "next/cache";
import { getPanels } from "@/lib/getPanels";

/*
 * One shared, cached read of the live board for the marketing pages. The
 * regime strip, board preview, signal bars, and news vignette all render
 * from this single fetch. The React cache() wrapper dedupes within a single
 * render: the payload is too large for the Next data cache (>2MB), so
 * without it every section would hit the database separately per request.
 */
const cached = unstable_cache(async () => getPanels(), ["landing-regime-strip"], {
  revalidate: 1800,
});

export const getLandingPanels = cache(() => cached());
