"use server";

import { revalidatePath } from "next/cache";

import { surveyPositions } from "@/lib/ai";
import { requireSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import type { MineHit, SearchHit } from "@/lib/types";

/**
 * The Ask tab's own actions.
 *
 * Two different things share one field here, and the difference matters: FIND
 * looks through what this group has already said, and ASK goes and reads what
 * several bodies of thought hold. The first stays inside the address you
 * belong to. The second is private to you unless you asked it while reading a
 * proposal, in which case 0019's rules apply instead.
 */

/**
 * Both halves, returned apart.
 *
 * Two functions rather than one, and two lists on the screen rather than one
 * with a column. `search_collective()` returns things other people can also
 * see; `search_mine()` returns things nobody else can see, ever. If that
 * difference were a field in a merged result set, a screen that got the field
 * wrong would break the product's central promise quietly, which is the worst
 * way for a promise to break.
 */
export type SearchAd = {
  campaign_id: string;
  vendor_name: string;
  headline: string;
  body: string;
  matched: string[];
};

export async function find(query: string): Promise<
  | { ok: true; shared: SearchHit[]; mine: MineHit[]; ad?: SearchAd | null }
  | { ok: false; error: string }
> {
  const q = query.trim();
  if (q.length < 2) return { ok: true as const, shared: [], mine: [] };

  await requireSession();
  const supabase = await createClient();

  const [collective, own, adRow] = await Promise.all([
    supabase.rpc("search_collective", { p_query: q, p_limit: 20 }),
    supabase.rpc("search_mine", { p_query: q, p_limit: 20 }),
    // One labelled ad, only if a vetted advertiser is relevant to this search.
    supabase.rpc("search_ad", { p_q: q }),
  ]);

  if (collective.error) return { ok: false as const, error: collective.error.message };
  if (own.error) return { ok: false as const, error: own.error.message };

  return {
    ok: true as const,
    shared: (collective.data ?? []) as SearchHit[],
    mine: (own.data ?? []) as MineHit[],
    ad: ((adRow.data ?? []) as SearchAd[])[0] ?? null,
  };
}

/**
 * A question asked on its own.
 *
 * `proposal_id` is null, which the database reads as owner-only and keeps that
 * way — there is no function anywhere that attaches one to a proposal
 * afterwards, deliberately. To put a question in front of a group, ask it on
 * the proposal, where everyone it is addressed to can read the answer.
 */
export async function askStandingQuestion(question: string) {
  const q = question.trim();
  if (q.length < 12) {
    return { ok: false as const, error: "A question needs to be a question — twelve characters at least." };
  }
  if (q.length > 240) {
    return { ok: false as const, error: "Shorter. One question, not a paragraph of them." };
  }

  await requireSession();
  const supabase = await createClient();

  try {
    const { result, model, prompt } = await surveyPositions({
      question: q,
      // No proposal in view. The lenses answer the question on its own terms,
      // which is the point of asking it here rather than there.
      proposal: { title: "—", summary: "Asked on its own, with no proposal in view.", scope: "local", place: null },
    });

    const { error } = await supabase.rpc("record_inquiry", {
      p_proposal_id: null,
      p_question: q,
      p_note: result.note,
      p_prompt_id: prompt.id,
      p_prompt_version: prompt.version,
      p_model: model,
      p_positions: result.positions,
    });

    if (error) return { ok: false as const, error: error.message };

    revalidatePath("/ask");
    return { ok: true as const };
  } catch (e) {
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : "The question could not be looked up.",
    };
  }
}

export async function forgetInquiry(inquiryId: string) {
  await requireSession();
  const supabase = await createClient();
  const { error } = await supabase.from("inquiries").delete().eq("id", inquiryId);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/ask");
  return { ok: true as const };
}
