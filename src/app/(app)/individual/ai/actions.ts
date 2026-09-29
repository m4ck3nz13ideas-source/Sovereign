"use server";

import { revalidatePath } from "next/cache";

import { askGuardian } from "@/lib/ai";
import { requireSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

/**
 * Your guardian, on a proposal you can already read.
 *
 * It runs as you, so it can see nothing you cannot see. What it is given is
 * the proposal and the values you wrote down — and the context function in
 * 0016 is where that limit is written, rather than here, so widening it is a
 * change somebody has to make visibly.
 *
 * Nothing it returns is attached to the proposal or visible to anybody.
 */
export async function askAboutProposal(proposalId: string) {
  const { userId } = await requireSession();
  const supabase = await createClient();

  const [{ data: proposal }, { data: values }] = await Promise.all([
    supabase
      .from("proposals")
      .select("title, summary, body, scope, place, author_id")
      .eq("id", proposalId)
      .maybeSingle(),
    supabase.rpc("guardian_context"),
  ]);

  if (!proposal) {
    return { ok: false as const, error: "That is not addressed to you." };
  }

  try {
    const { result, model, prompt } = await askGuardian({
      proposal: {
        title: proposal.title,
        summary: proposal.summary,
        body: proposal.body,
        scope: proposal.scope,
        place: proposal.place,
      },
      values: (values ?? []).map((v: { value_name: string; definition: string | null }) => ({
        name: v.value_name,
        definition: v.definition,
      })),
      ownDraft: proposal.author_id === userId,
    });

    const { error } = await supabase.from("guardian_notes").insert({
      profile_id: userId,
      kind: proposal.author_id === userId ? "draft" : "prepare",
      proposal_id: proposalId,
      questions: result.questions,
      gaps: result.gaps,
      reading: result.reading || null,
      prompt_id: prompt.id,
      prompt_version: prompt.version,
      model,
    });

    if (error) return { ok: false as const, error: error.message };

    revalidatePath("/individual/ai");
    revalidatePath(`/collective/proposals/${proposalId}`);
    return { ok: true as const };
  } catch (e) {
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : "The guardian could not be reached.",
    };
  }
}

/**
 * Forget all of it.
 *
 * A real verb here, unlike anywhere else in this app. A governance record is
 * kept because other people are entitled to it. Nobody is entitled to this.
 */
export async function forgetGuardian() {
  await requireSession();
  const supabase = await createClient();

  const { error } = await supabase.rpc("forget_guardian_notes");
  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/individual/ai");
  return { ok: true as const };
}
