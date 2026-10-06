"use server";

import { revalidatePath } from "next/cache";

import { readFocus } from "@/lib/ai";
import { NEED_LABEL, NEEDS, topNeeds, type Belief, type Goal, type NeedScores } from "@/lib/know";
import { createClient } from "@/lib/supabase/server";

/**
 * Save Know yourself and read the focus from it. Private: only the person can
 * read it back (0041), and nothing collective ever reads it.
 */
export async function saveAssessment(input: {
  needs: NeedScores;
  toward: string[];
  away: string[];
  beliefs: Belief[];
  goals: Goal[];
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!NEEDS.every((n) => typeof input.needs[n] === "number")) return { ok: false, error: "Answer every statement." };
  if (!input.toward.length) return { ok: false, error: "Choose at least one value you move toward." };

  const clean = (s: string) => s.trim().slice(0, 300);
  const beliefs = input.beliefs
    .filter((b) => b.limiting.trim() || b.empowering.trim())
    .slice(0, 5)
    .map((b) => ({ area: clean(b.area), limiting: clean(b.limiting), empowering: clean(b.empowering) }));
  const goals = input.goals
    .filter((g) => g.result.trim())
    .slice(0, 5)
    .map((g) => ({
      result: clean(g.result),
      purpose: clean(g.purpose),
      actions: g.actions.map(clean).filter(Boolean).slice(0, 5),
    }));

  const supabase = await createClient();
  const { data: saved, error } = await supabase
    .from("self_assessments")
    .insert({
      needs: input.needs,
      values_toward: input.toward.slice(0, 10),
      values_away: input.away.slice(0, 6),
      beliefs,
      goals,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };

  try {
    const { focus, model } = await readFocus({
      needs: input.needs,
      topNeeds: topNeeds(input.needs).map((n) => NEED_LABEL[n]),
      toward: input.toward,
      away: input.away,
      beliefs,
      goals,
    });
    await supabase.from("self_assessments").update({ focus, focus_model: model }).eq("id", saved.id);
  } catch {
    /* saved without a focus; the Self page offers to read it again */
  }

  revalidatePath("/individual/self");
  return { ok: true };
}
