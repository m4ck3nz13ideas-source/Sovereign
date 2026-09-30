"use server";

import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

/**
 * Sending, and putting something behind a project.
 *
 * Both go through 0026's functions rather than touching `sov_entries`, which
 * has no insert policy at all. The balance check, the reason floor and the
 * paired entries are the database's job, not this file's — so the error
 * messages below are the ones it raises, passed through rather than restated.
 */

export async function sendSov(input: { to: string; amount: number; reason: string }) {
  await requireSession();
  const supabase = await createClient();

  if (!input.to) return { ok: false as const, error: "Say who it is going to." };
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    return { ok: false as const, error: "An amount has to be more than nothing." };
  }
  if (input.reason.trim().length < 20) {
    return {
      ok: false as const,
      error: "Say what it is for — twenty characters at least. It goes on the record for both of you.",
    };
  }

  const { error } = await supabase.rpc("send_sov", {
    p_to: input.to,
    p_amount: input.amount,
    p_reason: input.reason.trim(),
  });

  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/individual/sov");
  return { ok: true as const };
}

export async function backProject(input: {
  projectId: string;
  amount: number;
  reason: string;
}) {
  await requireSession();
  const supabase = await createClient();

  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    return { ok: false as const, error: "An amount has to be more than nothing." };
  }
  if (input.reason.trim().length < 20) {
    return { ok: false as const, error: "Say what it is for — twenty characters at least." };
  }

  const { error } = await supabase.rpc("back_project", {
    p_project_id: input.projectId,
    p_amount: input.amount,
    p_reason: input.reason.trim(),
  });

  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/individual/sov");
  revalidatePath(`/collective/projects/${input.projectId}`);
  return { ok: true as const };
}
