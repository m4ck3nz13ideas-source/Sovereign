"use server";

import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import type { Person } from "@/lib/types";

/**
 * The two relationships.
 *
 * Follow is one-way and needs nobody's permission. Friendship is asked for and
 * answered. Neither changes what anybody may decide — that is settled by where
 * you are, and nothing in this file goes anywhere near it.
 */

/** Exact handle only. There is no directory and no prefix search — see 0012. */
export async function findPerson(handle: string) {
  await requireSession();
  const supabase = await createClient();

  const clean = handle.trim().replace(/^@/, "").toLowerCase();
  if (!clean) return { ok: true as const, person: null };

  const { data, error } = await supabase.rpc("find_person", { p_handle: clean });
  if (error) return { ok: false as const, error: error.message };

  const row = (Array.isArray(data) ? data[0] : data) as
    | { id: string; handle: string; display_name: string }
    | undefined;

  return {
    ok: true as const,
    person: row
      ? ({
          profile_id: row.id,
          handle: row.handle,
          display_name: row.display_name,
        } satisfies Person)
      : null,
  };
}

async function call(fn: string, profileId: string, paths: string[]) {
  await requireSession();
  const supabase = await createClient();

  const { error } = await supabase.rpc(fn, { p_profile_id: profileId });
  if (error) return { ok: false as const, error: error.message };

  for (const path of paths) revalidatePath(path);
  return { ok: true as const };
}

const PATHS = ["/collective/people", "/home"];

export async function follow(profileId: string) {
  return call("follow_person", profileId, [...PATHS, `/collective/people/${profileId}`]);
}

export async function unfollow(profileId: string) {
  return call("unfollow_person", profileId, [...PATHS, `/collective/people/${profileId}`]);
}

export async function askToBeFriends(profileId: string) {
  return call("request_friendship", profileId, [...PATHS, `/collective/people/${profileId}`]);
}

export async function acceptFriend(profileId: string) {
  return call("accept_friendship", profileId, [...PATHS, `/collective/people/${profileId}`]);
}

/** Withdraw, refuse, or end. One verb, because from the other side they are the same event. */
export async function endFriendship(profileId: string) {
  return call("end_friendship", profileId, [...PATHS, `/collective/people/${profileId}`]);
}

/** A handle is how somebody finds you. Lowercase, and yours alone. */
export async function setHandle(handle: string) {
  const { userId } = await requireSession();
  const supabase = await createClient();

  const clean = handle.trim().replace(/^@/, "").toLowerCase();

  const { error } = await supabase
    .from("profiles")
    .update({ handle: clean === "" ? null : clean })
    .eq("id", userId);

  if (error) {
    return {
      ok: false as const,
      error: error.message.includes("duplicate")
        ? "Somebody already has that one."
        : error.message.includes("profiles_handle_shape")
          ? "Three to thirty characters: lowercase letters, numbers, dots and underscores."
          : error.message,
    };
  }

  revalidatePath("/individual/profile");
  return { ok: true as const };
}
