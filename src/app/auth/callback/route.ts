import { NextResponse, type NextRequest } from "next/server";

import { env } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

/**
 * Exchanges the magic-link code for a session, then sends the person on.
 *
 * Where "on" is matters more than it looks. Every redirect below is built from
 * NEXT_PUBLIC_SITE_URL when that is set, and only falls back to the origin the
 * request arrived on. Behind a proxy that origin can resolve to the
 * per-deployment host, and on a project with deployment protection enabled
 * that host is behind Vercel's own login — so a person who clicked a valid
 * link would land on a sign-in page belonging to somebody else, with a working
 * session they could not see.
 *
 * A first-time user has no profile worth speaking of yet, so they land on
 * onboarding rather than an empty app. A returning one goes where they were
 * headed. If the profile row is missing entirely — an account that outlived a
 * schema reset — /onboarding is still the right destination, because
 * requireSession() writes the row when it finds none.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin: requestOrigin } = new URL(request.url);
  const origin = env.publicSiteUrl ?? requestOrigin;
  const code = searchParams.get("code");
  const next = searchParams.get("next");

  if (!code) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent("That sign-in link was incomplete. Ask for a new one.")}`,
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent("That sign-in link has expired. Ask for a new one.")}`,
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarded_at")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile?.onboarded_at) {
      return NextResponse.redirect(`${origin}/onboarding`);
    }
  }

  return NextResponse.redirect(`${origin}${next && next.startsWith("/") ? next : "/home"}`);
}
