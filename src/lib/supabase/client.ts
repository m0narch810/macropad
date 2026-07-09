import { createBrowserClient } from "@supabase/ssr";

/** Browser-side Supabase client for auth (sign in/up/out from client components). */
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
