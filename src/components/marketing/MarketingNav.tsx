import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import SignOutButton from "@/components/marketing/SignOutButton";
import Wordmark from "@/components/marketing/Wordmark";
import MobileMenu from "@/components/marketing/MobileMenu";

export default async function MarketingNav() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--bg)_88%,transparent)] backdrop-blur">
      <div className="mx-auto flex h-14 max-w-[1120px] items-center justify-between px-5 sm:px-8">
        <Link href="/" className="flex items-center">
          <Wordmark />
        </Link>

        {user ? (
          <div className="flex items-center gap-3 sm:gap-4">
            <Link
              href="/app"
              className="font-sans text-[0.82rem] text-[var(--text-dim)] transition-colors duration-150 hover:text-[var(--text)]"
            >
              Open the desk
            </Link>
            <SignOutButton className="btn btn-ghost !px-4 !py-2 !text-[0.66rem] disabled:opacity-50" />
            <MobileMenu signedIn />
          </div>
        ) : (
          <div className="flex items-center gap-3 sm:gap-4">
            <Link
              href="/signin"
              className="hidden font-sans text-[0.82rem] text-[var(--text-dim)] transition-colors duration-150 hover:text-[var(--text)] md:block"
            >
              Sign in
            </Link>
            <Link href="/signin" className="btn btn-primary !px-4 !py-2 !text-[0.66rem]">
              Launch the desk
            </Link>
            <MobileMenu signedIn={false} />
          </div>
        )}
      </div>
    </header>
  );
}
