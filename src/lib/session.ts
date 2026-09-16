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

/**
 * The signed-in person, their profile and their collective context.
 *
 * Redirects rather than throwing when there is no session — every page in the
 * app shell calls this first, and an unauthenticated request belongs at /login.
 */
export async function requireSession(): Promise<Session> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) redirect("/onboarding");

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
