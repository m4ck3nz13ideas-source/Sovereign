"use server";

import { revalidatePath } from "next/cache";

import { askGuardian, chatTurn, describeSelf, type SelfAssessmentInput } from "@/lib/ai";
import { NEED_LABEL, topNeeds, type NeedScores } from "@/lib/know";
import { AiError } from "@/lib/ai/provider";
import { requireSession } from "@/lib/session";
import { sphereName } from "@/lib/spheres";
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

/**
 * One turn of the private chat. The history lives in the browser and is sent
 * with each turn; nothing is written to the database, so there is nothing to
 * forget and nothing anybody else could ever read.
 */
export async function chatWithAi(
  history: { role: "you" | "ai"; text: string }[],
): Promise<{ ok: true; reply: string } | { ok: false; error: string }> {
  const last = history[history.length - 1];
  if (!last || last.role !== "you" || !last.text.trim()) return { ok: false, error: "Say something first." };
  if (last.text.length > 4000) return { ok: false, error: "That is too long for one message." };

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "Sign in again." };

  const [{ data: values }, { data: latest }, { data: rated }] = await Promise.all([
    supabase.rpc("guardian_context"),
    supabase
      .from("self_assessments")
      .select("needs, values_toward, values_away, beliefs, goals, focus")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from("sphere_priorities").select("sphere_id, rating").order("rating", { ascending: false }),
  ]);

  const matters = (rated ?? []).length
    ? ((rated ?? []) as { sphere_id: string; rating: number }[])
        .map((r) => `- ${sphereName(r.sphere_id) ?? r.sphere_id}: ${r.rating}/5`)
        .join("\n")
    : null;

  // Know yourself (0041) is the centre of what this AI understands.
  const self = latest
    ? {
        description: describeSelf({
          needs: latest.needs as Record<string, number>,
          topNeeds: topNeeds(latest.needs as NeedScores).map((n) => NEED_LABEL[n]),
          toward: latest.values_toward as string[],
          away: latest.values_away as string[],
          beliefs: latest.beliefs as SelfAssessmentInput["beliefs"],
          goals: latest.goals as SelfAssessmentInput["goals"],
        }),
        focus: (latest.focus as string | null) ?? null,
      }
    : null;

  try {
    const reply = await chatTurn(
      history,
      ((values ?? []) as { value_name: string; definition: string | null }[]).map((v) => ({
        name: v.value_name,
        definition: v.definition,
      })),
      self,
      matters,
    );
    return { ok: true, reply };
  } catch (e) {
    return { ok: false, error: e instanceof AiError ? e.message : "No reply this time. Try again." };
  }
}
