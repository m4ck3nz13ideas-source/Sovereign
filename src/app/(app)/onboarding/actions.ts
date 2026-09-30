"use server";

import { revalidatePath } from "next/cache";

import { setActiveGroup } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { UNIVERSAL_LAWS } from "@/lib/universal-law";
import type { GroupScope } from "@/lib/types";

/**
 * Onboarding's own actions.
 *
 * None of these call requireSession(), and that is deliberate: requireSession
 * redirects anybody without `onboarded_at` back to /onboarding, so a shared
 * action would bounce the person filling this in. They read the user directly
 * and let row-level security do the rest, which is what protects the writes
 * anyway.
 *
 * Each step saves as it is finished rather than everything landing at the end.
 * Somebody who gives their name, reads the laws and then closes the tab has
 * agreed to the laws, and the record should say so.
 */

async function currentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

/** Step one. Who you are, and where — place decides which proposals reach you. */
export async function saveDetails(input: {
  displayName: string;
  handle: string;
  placeLocal: string;
  placeRegional: string;
  placeNational: string;
  placeContinental: string;
}) {
  const { supabase, user } = await currentUser();
  if (!user) return { ok: false as const, error: "You are not signed in." };

  const name = input.displayName.trim();
  if (!name) return { ok: false as const, error: "A name is needed." };

  const handle = input.handle.trim().toLowerCase();
  if (handle && !/^[a-z0-9][a-z0-9_.]{2,29}$/.test(handle)) {
    return {
      ok: false as const,
      error:
        "A handle is 3–30 characters, lowercase letters, numbers, dots and underscores, starting with a letter or number.",
    };
  }

  const clean = (s: string) => s.trim() || null;
  const places = {
    place_local: clean(input.placeLocal),
    place_regional: clean(input.placeRegional),
    place_national: clean(input.placeNational),
    place_continental: clean(input.placeContinental),
  };
  const anyPlace = Object.values(places).some(Boolean);

  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: name,
      handle: handle || null,
      ...places,
      ...(anyPlace ? { place_set_at: new Date().toISOString() } : {}),
    })
    .eq("id", user.id);

  if (error) {
    // The unique index on handle is the likely one, and the raw message is
    // not something to put in front of somebody.
    if (error.message.includes("profiles_handle_key")) {
      return { ok: false as const, error: "That handle is taken." };
    }
    return { ok: false as const, error: error.message };
  }

  return { ok: true as const };
}

/**
 * Step two. Agreeing to the ten.
 *
 * The law ids come from the build — the same constant the screen rendered —
 * and the database stamps which revision of each was current, so the record
 * says what was actually on the page rather than what a client claimed.
 */
export async function agreeToUniversalLaw() {
  const { supabase, user } = await currentUser();
  if (!user) return { ok: false as const, error: "You are not signed in." };

  const { error } = await supabase.rpc("accept_universal_law", {
    p_law_ids: UNIVERSAL_LAWS.map((l) => l.id),
  });

  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const };
}

/** Step three. What you value, what you keep returning to, what you believe. */
export async function saveBeliefs(input: {
  values: { name: string; definition: string }[];
  passions: { name: string; note: string }[];
  purpose: string;
  faith: string;
}) {
  const { supabase, user } = await currentUser();
  if (!user) return { ok: false as const, error: "You are not signed in." };

  const values = input.values.filter((v) => v.name.trim());
  if (!values.length) {
    return {
      ok: false as const,
      error: "At least one value — this is the rubric your proposals are read against.",
    };
  }

  const passions = input.passions.filter((p) => p.name.trim());
  const purpose = input.purpose.trim();
  const faith = input.faith.trim();
  const now = new Date().toISOString();

  const { error } = await supabase
    .from("profiles")
    .update({
      ...(purpose ? { purpose, purpose_updated_at: now } : {}),
      ...(faith ? { faith_statement: faith, faith_updated_at: now } : {}),
    })
    .eq("id", user.id);

  if (error) return { ok: false as const, error: error.message };

  // Re-runnable: somebody who goes back a step and changes an answer should not
  // end up with both versions on their profile.
  await supabase.from("profile_values").delete().eq("profile_id", user.id);
  const { error: vErr } = await supabase.from("profile_values").insert(
    values.map((v, i) => ({
      profile_id: user.id,
      name: v.name.trim(),
      definition: v.definition.trim() || null,
      position: i,
    })),
  );
  if (vErr) return { ok: false as const, error: vErr.message };

  await supabase.from("profile_passions").delete().eq("profile_id", user.id);
  if (passions.length) {
    await supabase.from("profile_passions").insert(
      passions.map((p, i) => ({
        profile_id: user.id,
        name: p.name.trim(),
        note: p.note.trim() || null,
        position: i,
      })),
    );
  }

  // Faith and purpose are revisable and never overwritten — the history is the
  // point, so each one that was given gets a revision of its own.
  const revisions = [
    ...(purpose ? [{ profile_id: user.id, kind: "purpose", statement: purpose }] : []),
    ...(faith ? [{ profile_id: user.id, kind: "faith", statement: faith }] : []),
  ];
  if (revisions.length) {
    await supabase.from("statement_revisions").insert(revisions);
  }

  return { ok: true as const };
}

/** Step four, at the end of the demo. This is what opens the rest of the app. */
export async function finishOnboarding() {
  const { supabase, user } = await currentUser();
  if (!user) return { ok: false as const, error: "You are not signed in." };

  const { error } = await supabase
    .from("profiles")
    .update({ onboarded_at: new Date().toISOString() })
    .eq("id", user.id);

  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true as const };
}

export async function createGroup(name: string, purpose: string, scope: GroupScope) {
  const supabase = await createClient();

  if (!name.trim()) return { ok: false as const, error: "A group needs a name." };

  const { data, error } = await supabase.rpc("create_group", {
    p_name: name.trim(),
    p_purpose: purpose.trim() || null,
    p_scope: scope,
  });

  if (error) return { ok: false as const, error: error.message };

  await setActiveGroup(data as string);
  revalidatePath("/", "layout");
  return { ok: true as const, groupId: data as string };
}

export async function joinGroup(code: string) {
  const supabase = await createClient();

  if (!code.trim()) return { ok: false as const, error: "Paste the invite code." };

  const { data, error } = await supabase.rpc("redeem_invite", {
    p_code: code.trim(),
  });

  if (error) return { ok: false as const, error: error.message };

  await setActiveGroup(data as string);
  revalidatePath("/", "layout");
  return { ok: true as const, groupId: data as string };
}
