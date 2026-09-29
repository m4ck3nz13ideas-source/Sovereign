import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import type { Group, GroupRole, Profile } from "@/lib/types";

const ACTIVE_GROUP_COOKIE = "sovereign.group";

export interface Session {
  userId: string;
  profile: Profile;
  /** Every group this person belongs to, for the switcher. */
  groups: (Group & { role: GroupRole })[];
  /** The group currently in view, or null when they belong to none. */
  group: (Group & { role: GroupRole }) | null;
}

export interface SessionOptions {
  /**
   * Let somebody through who has not finished onboarding.
   *
   * Only the onboarding screens pass this. Everywhere else an unfinished
   * profile is sent back to finish, because the values it collects are the
   * rubric every proposal is read against — a person who has named nothing
   * gets scored on nothing, and the screens would not say why.
   */
  allowUnonboarded?: boolean;
}

/**
 * The signed-in person, their profile and their collective context.
 *
 * Redirects rather than throwing when there is no session — every page in the
 * app shell calls this first, and an unauthenticated request belongs at /login.
 */
export async function requireSession(
  options: SessionOptions = {},
): Promise<Session> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  let { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  // The database writes a profile on sign-up — handle_new_user, migration
  // 0001. The row can still be absent: an account created before that trigger
  // existed, or a database rebuilt underneath an auth user who survived it,
  // which is what a reset does. Redirecting to /onboarding in that state sends
  // somebody to a screen that needs the row it is missing, and the loop has no
  // exit. So write it here instead. profiles_insert permits exactly this and
  // nothing wider: you may insert yourself.
  if (!profile) {
    const { data: created } = await supabase
      .from("profiles")
      .insert({
        id: user.id,
        display_name: user.email?.split("@")[0] || "Unnamed",
      })
      .select("*")
      .maybeSingle();
    profile = created ?? null;
  }

  if (!profile) {
    // Signed in, no row, and none could be written. Something is wrong with
    // the database rather than with this request, and a redirect would only
    // hide it — the person would bounce between two screens forever.
    throw new Error(
      "Signed in, but there is no profile row and one could not be created. " +
        "Check that migration 0001 has been applied to this database.",
    );
  }

  // Onboarding is not decoration and it is not optional. Until it is done
  // there is no name, no values, and so nothing for a review to score.
  if (!options.allowUnonboarded && !(profile as Profile).onboarded_at) {
    redirect("/onboarding");
  }

  const { data: memberships } = await supabase
    .from("group_members")
    .select("role, groups(*)")
    .eq("profile_id", user.id)
    .order("joined_at", { ascending: true });

  const groups = (memberships ?? [])
    .map((m) => {
      const g = m.groups as unknown as Group | null;
      return g ? { ...g, role: m.role as GroupRole } : null;
    })
    .filter((g): g is Group & { role: GroupRole } => Boolean(g));

  const cookieStore = await cookies();
  const preferred = cookieStore.get(ACTIVE_GROUP_COOKIE)?.value;
  const group = groups.find((g) => g.id === preferred) ?? groups[0] ?? null;

  return {
    userId: user.id,
    profile: profile as Profile,
    groups,
    group,
  };
}

/** Like requireSession, but also insists the person has somewhere to deliberate. */
export async function requireGroup(): Promise<Session & { group: Group & { role: GroupRole } }> {
  const session = await requireSession();
  if (!session.group) redirect("/onboarding/group");
  return session as Session & { group: Group & { role: GroupRole } };
}

export async function setActiveGroup(groupId: string) {
  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_GROUP_COOKIE, groupId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

export function isSteward(role: GroupRole): boolean {
  return role === "owner" || role === "steward";
}
