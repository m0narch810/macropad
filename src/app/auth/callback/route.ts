import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Landing spot for the Discord OAuth PKCE redirect. Exchanges the code for a
 * session, then checks the user is actually in the required Discord server -
 * Supabase's OAuth only proves "this is a real Discord account," membership
 * in a specific guild has to be checked separately against Discord's API
 * using the provider token from the `guilds` scope.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // Only ever redirect to a local path: `next` comes from the query string,
  // so without this check ?next=@evil.com or ?next=//evil.com becomes an
  // open redirect on a link users inherently trust (it arrives via our own
  // Discord sign-in flow).
  const rawNext = searchParams.get("next") ?? "/app";
  const isSafe = rawNext.startsWith("/") && !rawNext.startsWith("//") && !rawNext.startsWith("/\\");
  const next = isSafe ? rawNext : "/app";

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const requiredGuild = process.env.DISCORD_GUILD_ID;
      const providerToken = data.session?.provider_token;

      if (requiredGuild) {
        const inGuild = providerToken ? await isMemberOfGuild(providerToken, requiredGuild) : false;
        if (!inGuild) {
          await supabase.auth.signOut();
          return NextResponse.redirect(`${origin}/signin?error=not_in_server`);
        }
      }

      return NextResponse.redirect(new URL(next, origin));
    }
  }

  return NextResponse.redirect(`${origin}/signin?error=auth_callback_failed`);
}

/** Checks the Discord user's guild list (via the `guilds` scope token) for a specific server id. */
async function isMemberOfGuild(providerToken: string, guildId: string): Promise<boolean> {
  try {
    const res = await fetch("https://discord.com/api/users/@me/guilds", {
      headers: { Authorization: `Bearer ${providerToken}` },
    });
    if (!res.ok) return false;
    const guilds: { id: string }[] = await res.json();
    return guilds.some((g) => g.id === guildId);
  } catch {
    return false;
  }
}
