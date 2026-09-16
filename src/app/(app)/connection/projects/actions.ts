"use server";

import { revalidatePath } from "next/cache";

import { ledger, treasury } from "@/lib/ledger";
import { createClient } from "@/lib/supabase/server";
import type { TaskStatus } from "@/lib/types";

export async function addTask(projectId: string, title: string, dueOn: string) {
  const supabase = await createClient();
  if (!title.trim()) return { ok: false as const, error: "A task needs a name." };

  const { error } = await supabase.from("project_tasks").insert({
    project_id: projectId,
    title: title.trim(),
    due_on: dueOn || null,
  });

  if (error) return { ok: false as const, error: error.message };
  revalidatePath(`/connection/projects/${projectId}`);
  return { ok: true as const };
}

export async function setTaskStatus(taskId: string, status: TaskStatus, projectId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("project_tasks")
    .update({ status })
    .eq("id", taskId);

  if (error) return { ok: false as const, error: error.message };
  revalidatePath(`/connection/projects/${projectId}`);
  return { ok: true as const };
}

export async function claimTask(taskId: string, projectId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "You are not signed in." };

  const { error } = await supabase
    .from("project_tasks")
    .update({ assignee_id: user.id })
    .eq("id", taskId);

  if (error) return { ok: false as const, error: error.message };
  revalidatePath(`/connection/projects/${projectId}`);
  return { ok: true as const };
}

/** A progress note, with an optional amount of money recorded against it. */
export async function postUpdate(projectId: string, body: string, spend: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "You are not signed in." };
  if (!body.trim()) return { ok: false as const, error: "Nothing to record." };

  const amount = spend.trim() ? Number(spend) : 0;
  if (Number.isNaN(amount)) {
    return { ok: false as const, error: "The amount should be a number, or blank." };
  }

  if (amount !== 0) {
    // Goes through the treasury interface rather than straight to the table,
    // so a chain adapter would pick this up without the page changing.
    await treasury().recordSpend(projectId, amount, body.trim());
  } else {
    const { error } = await supabase.from("project_updates").insert({
      project_id: projectId,
      author_id: user.id,
      body: body.trim(),
    });
    if (error) return { ok: false as const, error: error.message };
  }

  revalidatePath(`/connection/projects/${projectId}`);
  return { ok: true as const };
}

export async function startProject(projectId: string) {
  const supabase = await createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("group_id")
    .eq("id", projectId)
    .single();

  const { error } = await supabase
    .from("projects")
    .update({ status: "executing", started_at: new Date().toISOString() })
    .eq("id", projectId);

  if (error) return { ok: false as const, error: error.message };

  if (project) {
    await ledger().record({
      groupId: project.group_id,
      kind: "project.started",
      subjectType: "project",
      subjectId: projectId,
    });
  }

  revalidatePath(`/connection/projects/${projectId}`);
  return { ok: true as const };
}

/**
 * Write the reflection, then complete the project.
 *
 * The order matters and the database enforces it: complete_project() refuses
 * to run without a reflection on file, and the reflection itself requires a
 * real account of what happened. A group can abandon a project, but it cannot
 * quietly declare one finished.
 */
export async function writeReflection(
  projectId: string,
  actual: string,
  lesson: string,
  assumptionWrong: string,
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "You are not signed in." };

  if (actual.trim().length < 80) {
    return {
      ok: false as const,
      error:
        "Say what actually happened, in enough detail that someone reading this in a year would learn something. At least eighty characters.",
    };
  }

  const { error } = await supabase.from("reflections").insert({
    project_id: projectId,
    actual_outcome: actual.trim(),
    lesson: lesson.trim() || null,
    assumption_wrong: assumptionWrong.trim() || null,
    created_by: user.id,
  });

  if (error) {
    return {
      ok: false as const,
      error:
        error.code === "23505"
          ? "A reflection has already been written for this project."
          : error.message,
    };
  }

  const { error: completeError } = await supabase.rpc("complete_project", {
    p_project_id: projectId,
  });

  if (completeError) return { ok: false as const, error: completeError.message };

  revalidatePath(`/connection/projects/${projectId}`);
  revalidatePath("/connection/projects");
  revalidatePath("/connection/impact");
  return { ok: true as const };
}
