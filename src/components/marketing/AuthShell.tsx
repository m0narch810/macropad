import MarketingNav from "@/components/marketing/MarketingNav";
import MarketingFooter from "@/components/marketing/MarketingFooter";
import AsciiContour from "@/components/fx/AsciiContour";

/*
 * Shared chrome for /signin and /signup: the contour field does the
 * branding so the form itself stays plain — one centered card, no art
 * panel, no testimonial column.
 */
export default function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <MarketingNav />
      <main className="relative flex flex-1 items-center justify-center overflow-hidden px-5 py-20 sm:px-8">
        <AsciiContour className="pointer-events-none absolute inset-0 h-full w-full" maxAlpha={0.22} />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ background: "radial-gradient(ellipse 60% 55% at 50% 45%, var(--bg) 30%, transparent 100%)" }}
        />
        <div className="hud relative w-full max-w-sm border border-[var(--border)] bg-[color-mix(in_srgb,var(--panel)_92%,transparent)] p-8 backdrop-blur-[2px]">
          {children}
        </div>
      </main>
      <MarketingFooter />
    </div>
  );
}
