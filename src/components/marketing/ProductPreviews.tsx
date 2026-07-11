import type { MacroPanel, MacroSeries } from "@/lib/macroData";
import { getSignTone } from "@/lib/bias";
import { computeMacroBias } from "@/lib/macroBias";
import { getLandingPanels } from "@/lib/landingData";
import ZScoreBar from "@/components/ZScoreBar";

/*
 * Live vignettes for the landing page. Each one renders a real slice of the
 * terminal from the same cached feed as the regime strip: real values, real
 * scores, real headlines. Nothing here is a mockup, so the marketing page
 * can never drift out of sync with what the product actually shows.
 */

function toneColor(tone: "up" | "down" | "flat"): string {
  return tone === "up" ? "var(--up)" : tone === "down" ? "var(--down)" : "var(--text-faint)";
}

function findSeries(panels: MacroPanel[], id: string): MacroSeries | null {
  for (const p of panels) {
    const hit = p.series.find((s) => s.id === id);
    if (hit) return hit;
  }
  return null;
}

function Frame({ label, note, children }: { label: string; note?: string; children: React.ReactNode }) {
  return (
    <div className="hud border border-[var(--border)] bg-[var(--panel)]">
      <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-2.5">
        <span className="partno">{label}</span>
        {note && <span className="font-mono text-[0.62rem] text-[var(--text-faint)]">{note}</span>}
      </div>
      {children}
    </div>
  );
}

function Pending() {
  return (
    <div className="px-4 py-8 text-center font-mono text-[0.68rem] text-[var(--text-faint)]">
      AWAITING FIRST SYNC
    </div>
  );
}

/** One board tile, exactly as it renders inside the app. */
function Tile({ s }: { s: MacroSeries }) {
  const tone = getSignTone(s.id, s.zscore);
  const color = toneColor(tone);
  const strong = s.zscore !== null && Math.abs(s.zscore) >= 0.5;
  return (
    <div
      className="flex min-w-0 items-center justify-between gap-2 bg-[var(--bg)] px-3 py-2"
      style={strong ? { boxShadow: `inset 2px 0 0 ${color}` } : undefined}
    >
      <span className="min-w-0 truncate font-sans text-[0.74rem] text-[var(--text-dim)]">{s.name}</span>
      <span className="shrink-0 whitespace-nowrap font-mono text-[0.76rem]">
        <span className="font-semibold" style={{ color }}>{s.value}</span>
        {s.zscore !== null && (
          <span className="ml-1.5 text-[0.64rem]" style={{ color }}>
            {s.zscore > 0 ? "+" : ""}
            {s.zscore.toFixed(2)}
          </span>
        )}
      </span>
    </div>
  );
}

/** Real board tiles from the positioning panel (the hero already shows macro and rates). */
export function BoardPreview({ panels }: { panels: MacroPanel[] }) {
  const panel = panels.find((p) => p.id === "cot-positioning");
  const series = (panel?.series ?? []).slice(0, 8);

  return (
    <Frame label="BOARD / POSITIONING" note="8 of many">
      {series.length === 0 ? (
        <Pending />
      ) : (
        <div className="grid grid-cols-1 gap-px bg-[var(--border)] p-px sm:grid-cols-2">
          {series.map((s) => (
            <Tile key={s.id} s={s} />
          ))}
        </div>
      )}
    </Frame>
  );
}

/*
 * Hero visual: a live miniature of the terminal itself. Sidebar mirrors the
 * app's real nav (including the locked Options Flow tab), the work area is
 * real board tiles. Same feed, same conventions, nothing invented.
 */
const NAV_PREVIEW: ({ label: string; state?: "active" | "locked" } | "divider")[] = [
  { label: "BOARD", state: "active" },
  "divider",
  { label: "NEWS" },
  { label: "US MACRO" },
  { label: "RATES" },
  { label: "COT" },
  { label: "TRANSMISSION" },
  { label: "GEOPOLITICS" },
  { label: "VOLATILITY" },
  "divider",
  { label: "MACRO BIAS" },
  { label: "REPLAY" },
  { label: "FINGERPRINT" },
  { label: "CALENDAR" },
  { label: "OPTIONS FLOW", state: "locked" },
  "divider",
  { label: "DOCS" },
];

function MiniLock() {
  return (
    <svg width="9" height="9" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
      <rect x="3.5" y="7" width="9" height="6.5" rx="1" />
      <path d="M5.5 7V5A2.5 2.5 0 0 1 10.5 5V7" />
    </svg>
  );
}

export async function TerminalPreview() {
  const { panels, lastUpdated } = await getLandingPanels();
  const sections = [
    { code: "TF-01", title: "US MACRO", series: (panels.find((p) => p.id === "us-macro")?.series ?? []).slice(0, 8) },
    { code: "TF-02", title: "RATES", series: (panels.find((p) => p.id === "yield-rates")?.series ?? []).slice(0, 6) },
  ].filter((s) => s.series.length > 0);

  let navIndex = -1;

  return (
    <div className="hud border border-[var(--border)] bg-[var(--panel)]">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-[var(--border)] px-4 py-2.5">
        <span className="eyebrow flex items-center gap-2" style={{ color: "var(--text-dim)" }}>
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--up)] opacity-60" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--up)]" />
          </span>
          Trifekta / Terminal
        </span>
        <span className="partno">
          {lastUpdated
            ? `SYNCED ${new Date(lastUpdated).toISOString().slice(0, 16).replace("T", " ")}Z`
            : "AWAITING FIRST SYNC"}
        </span>
      </div>

      <div className="flex">
        <aside className="hidden w-[10.5rem] shrink-0 flex-col border-r border-[var(--border)] py-2 sm:flex">
          {NAV_PREVIEW.map((item, i) =>
            item === "divider" ? (
              <div key={`div-${i}`} className="mx-3 my-1.5 border-t border-[var(--border)]" />
            ) : (
              <div
                key={item.label}
                className={`flex items-center gap-2 px-3 py-[5px] font-mono text-[0.6rem] tracking-wide ${
                  item.state === "active"
                    ? "bg-[var(--panel-2)] text-[var(--text)]"
                    : item.state === "locked"
                      ? "text-[var(--text-faint)] opacity-40"
                      : "text-[var(--text-faint)]"
                }`}
              >
                <span className="w-3.5 shrink-0 text-[0.5rem]">{String(++navIndex).padStart(2, "0")}</span>
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                {item.state === "locked" && <MiniLock />}
              </div>
            )
          )}
        </aside>

        <div className="min-w-0 flex-1 p-3">
          {sections.length === 0 ? (
            <Pending />
          ) : (
            <div className="flex flex-col gap-3">
              {sections.map((sec) => (
                <section key={sec.code}>
                  <div className="partno mb-1.5">
                    {sec.code} {sec.title}
                  </div>
                  <div className="grid grid-cols-1 gap-px border border-[var(--border)] bg-[var(--border)] md:grid-cols-2">
                    {sec.series.map((s) => (
                      <Tile key={s.id} s={s} />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Real signal scores across the four scoring methods. */
const SIGNAL_IDS = ["us-macro:cpi-yoy", "yield-rates:10y2y-spread", "us-macro:payrolls", "cot:es"];

export function SignalPreview({ panels }: { panels: MacroPanel[] }) {
  const rows = SIGNAL_IDS.map((id) => findSeries(panels, id)).filter(
    (s): s is MacroSeries => s !== null && s.zscore !== null
  );

  return (
    <Frame label="SIGNALS" note="scored -1 to +1">
      {rows.length === 0 ? (
        <Pending />
      ) : (
        <div className="flex flex-col gap-px bg-[var(--border)] p-px">
          {rows.map((s) => (
            <div key={s.id} className="bg-[var(--bg)] px-4 py-3">
              <div className="mb-1.5 flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate font-sans text-[0.78rem] text-[var(--text)]">{s.name}</span>
                <span className="shrink-0 font-mono text-[0.72rem] text-[var(--text-dim)]">{s.value}</span>
              </div>
              <ZScoreBar z={s.zscore as number} tone={getSignTone(s.id, s.zscore)} />
            </div>
          ))}
        </div>
      )}
    </Frame>
  );
}

/** The real composite bias, computed from the same live panels. */
function verdict(tone: "up" | "down" | "flat", strength: "mild" | "strong" | "extreme" | null): string {
  if (tone === "flat") return "Neutral";
  const lean = tone === "up" ? "risk on" : "risk off";
  return strength ? `${strength[0].toUpperCase()}${strength.slice(1)} ${lean}` : `Leaning ${lean}`;
}

export function BiasPreview({ panels }: { panels: MacroPanel[] }) {
  const bias = computeMacroBias(panels, { historyDays: 7, horizon: "short" });
  const { overall, pillars } = bias;
  const scored = pillars.filter((p) => p.score !== null);

  return (
    <Frame label="MACRO BIAS" note="1 week lookback">
      {overall.score === null || scored.length === 0 ? (
        <Pending />
      ) : (
        <div className="px-4 py-3">
          <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
            <span className="font-sans text-[0.78rem] text-[var(--text-dim)]">Overall</span>
            <span className="font-mono text-[0.8rem] font-semibold" style={{ color: toneColor(overall.tone) }}>
              {verdict(overall.tone, overall.strength)} {overall.score > 0 ? "+" : ""}
              {overall.score.toFixed(2)}
            </span>
          </div>
          <div className="mt-3 flex flex-col gap-2.5">
            {scored.map((p) => (
              <div key={p.id} className="grid grid-cols-[6.5rem_1fr] items-center gap-3">
                <span className="truncate font-mono text-[0.64rem] uppercase tracking-[0.08em] text-[var(--text-faint)]">
                  {p.label}
                </span>
                <ZScoreBar z={p.score as number} tone={p.tone} />
              </div>
            ))}
          </div>
        </div>
      )}
    </Frame>
  );
}

/** Real scored headlines from the live news feed. Outlet names stay off the marketing page. */
function fmtDay(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

const TONE_LABEL = { bullish: "BULL", bearish: "BEAR", neutral: "NEUT" } as const;

export function NewsPreview({ panels }: { panels: MacroPanel[] }) {
  const feed = findSeries(panels, "geo:news-feed");
  const headlines = (feed?.payload?.headlines ?? []).slice(0, 4);

  return (
    <Frame label="NEWS SENTIMENT" note={feed && feed.value !== "-" ? `pooled read ${feed.value}` : undefined}>
      {headlines.length === 0 ? (
        <Pending />
      ) : (
        <div className="flex flex-col gap-px bg-[var(--border)] p-px">
          {headlines.map((h, i) => {
            const color =
              h.sentimentLabel === "bullish" ? "var(--up)" : h.sentimentLabel === "bearish" ? "var(--down)" : "var(--text-faint)";
            return (
              <div key={`${h.title}-${i}`} className="flex items-center gap-3 bg-[var(--bg)] px-4 py-2.5">
                <span className="w-9 shrink-0 font-mono text-[0.6rem] font-semibold" style={{ color }}>
                  {TONE_LABEL[h.sentimentLabel]}
                </span>
                <span className="min-w-0 flex-1 truncate font-sans text-[0.76rem] text-[var(--text-dim)]">{h.title}</span>
                <span className="shrink-0 font-mono text-[0.6rem] text-[var(--text-faint)]">
                  {h.kind && h.kind !== "headline" ? "DATA" : fmtDay(h.pubDate)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </Frame>
  );
}
