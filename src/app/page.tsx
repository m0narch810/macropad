import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-5 text-center">
      <h1 className="display-hero m-0 text-[2.4rem] font-bold tracking-[0.15em] sm:text-[3rem]">
        YYY<span className="blink-cursor text-[var(--text-faint)]">_</span>
      </h1>
      <p className="mt-3 max-w-sm font-sans text-[0.92rem] leading-relaxed text-[var(--text-dim)]">
        Internal macro terminal.
      </p>
      <Link href="/signin" className="btn btn-primary mt-8">
        Sign in
      </Link>
    </div>
  );
}
