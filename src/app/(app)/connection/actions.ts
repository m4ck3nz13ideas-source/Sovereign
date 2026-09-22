"use server";

import { revalidatePath } from "next/cache";

import { auditAgainstLaw, reviewProposal, writeRationale } from "@/lib/ai";
import { ledger } from "@/lib/ledger";
import { requireGroup } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import type { GroupScope } from "@/lib/types";

/* ---------------------------------------------------------------------------
   Connection — posting
--------------------------------------------------------------------------- */

/** Post an Output entry to the feed. The entry is marked examined. */
export async function publishEntry(entryId: string, body: string, groupOnly = true) {
  const { userId, group } = await requireGroup();
  const supabase = await createClient();

  const text = body.trim();
  if (!text) return { ok: false as const, error: "Nothing to post." };

  const { error } = await supabase.from("posts").insert({
    author_id: userId,
    group_id: groupOnly ? group.id : null,
    entry_id: entryId || null,
    body: text,
  });

  if (error) return { ok: false as const, error: error.message };

  if (entryId) {
    await supabase
      .from("entries")
      .update({ state: "examined", examined_at: new Date().toISOString() })
      .eq("id", entryId);
  }

  revalidatePath("/connection");
  revalidatePath("/profile");
  return { ok: true as const };
}

export async function toggleReaction(postId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "You are not signed in." };

  const { data: existing } = await supabase
    .from("post_reactions")
    .select("post_id")
    .eq("post_id", postId)
    .eq("profile_id", user.id)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("post_reactions")
      .delete()
      .eq("post_id", postId)
      .eq("profile_id", user.id);
  } else {
    await supabase
      .from("post_reactions")
      .insert({ post_id: postId, profile_id: user.id });
  }

  revalidatePath("/connection");
  return { ok: true as const };
}

/* ---------------------------------------------------------------------------
   Proposals
--------------------------------------------------------------------------- */

export interface ProposalInput {
  title: string;
  summary: string;
  body: string;
  category: string;
  scope: GroupScope;
  budget: string;
  termDays: string;
}

/**
 * Submit a proposal, then review it.
 *
 * Drafts never reach the shared store — the compose screen keeps them in the
 * author's own browser until this is called. What lands here is submitted, and
 * submitted proposals are not editable: amendments go in the deliberation
 * thread, and a failed proposal is rewritten as a new one.
 */
export async function submitProposal(input: ProposalInput) {
  const { userId, group } = await requireGroup();
  const supabase = await createClient();

  if (!input.title.trim()) return { ok: false as const, error: "A proposal needs a title." };
  if (!input.summary.trim()) return { ok: false as const, error: "A proposal needs a one-line summary." };
  if (input.body.trim().length < 80) {
    return {
      ok: false as const,
      error: "Say more. A proposal the group cannot evaluate is not ready to submit.",
    };
  }

  const budget = input.budget.trim() ? Number(input.budget) : null;
  if (budget !== null && Number.isNaN(budget)) {
    return { ok: false as const, error: "The budget should be a number, or blank." };
  }

  const term = input.termDays.trim() ? Number(input.termDays) : null;

  const { data: proposal, error } = await supabase
    .from("proposals")
    .insert({
      group_id: group.id,
      author_id: userId,
      title: input.title.trim(),
      summary: input.summary.trim(),
      body: input.body.trim(),
      category: input.category.trim() || null,
      scope: input.scope,
      budget_amount: budget,
      term_days: term,
      status: "in_review",
    })
    .select("id")
    .single();

  if (error) return { ok: false as const, error: error.message };

  await ledger().record({
    groupId: group.id,
    kind: "proposal.submitted",
    subjectType: "proposal",
    subjectId: proposal.id,
    payload: { title: input.title.trim() },
  });

  revalidatePath("/connection/proposals");

  // Law first, then the review. A proposal the constitution forbids should not
  // be scored against a group's values as though the question were open.
  // Neither failure may lose the proposal: it stays in_review and any member
  // can run either step from its page.
  await runLawAudit(proposal.id).catch(() => undefined);
  await runReview(proposal.id).catch(() => undefined);

  return { ok: true as const, id: proposal.id };
}

/**
 * Run the AI review of a proposal.
 *
 * Three things happen: past decisions are retrieved by value overlap and given
 * to the reviewer, the review is stored with the prompt version that made it,
 * and anything critical becomes a flag that must be answered in writing before
 * the proposal can pass.
 */
export async function runReview(proposalId: string) {
  const supabase = await createClient();

  const { data: proposal } = await supabase
    .from("proposals")
    .select("*, groups(*)")
    .eq("id", proposalId)
    .maybeSingle();

  if (!proposal) return { ok: false as const, error: "No such proposal." };

  const group = proposal.groups as unknown as {
    id: string;
    name: string;
    purpose: string | null;
    threshold_values_floor: number;
  };

  // The rubric is the group's own values — the union of what its members have
  // named and chosen to share. A group that has named nothing gets scored on
  // nothing, which is the honest outcome.
  const { data: members } = await supabase
    .from("group_members")
    .select("profile_id")
    .eq("group_id", group.id);

  const memberIds = (members ?? []).map((m) => m.profile_id);

  const { data: valueRows } = await supabase
    .from("profile_values")
    .select("name, definition, profile_id")
    .in("profile_id", memberIds.length ? memberIds : ["00000000-0000-0000-0000-000000000000"]);

  const values = dedupeValues(valueRows ?? []);

  const { data: memory } = await supabase.rpc("related_decisions", {
    p_group_id: group.id,
    p_values: values.map((v) => v.name),
    p_limit: 6,
  });

  try {
    const { review, model, prompt } = await reviewProposal({
      proposal: {
        title: proposal.title,
        summary: proposal.summary,
        body: proposal.body,
        category: proposal.category,
        budget: proposal.budget_amount
          ? `${proposal.budget_currency} ${proposal.budget_amount}`
          : null,
        termDays: proposal.term_days,
      },
      groupName: group.name,
      groupPurpose: group.purpose,
      values,
      memory: (memory ?? []).map(
        (m: {
          decision_id: string;
          title: string;
          outcome: string;
          decided_at: string;
          expected_outcome: string | null;
          actual_outcome: string | null;
          lesson: string | null;
        }) => ({
          id: m.decision_id,
          title: m.title,
          outcome: m.outcome,
          decided_at: m.decided_at,
          expected: m.expected_outcome,
          actual: m.actual_outcome,
          lesson: m.lesson,
        }),
      ),
    });

    const memoryUsed = (memory ?? [])
      .filter((m: { decision_id: string }) => review.memory_used.includes(m.decision_id))
      .map((m: { decision_id: string; title: string; outcome: string; lesson: string | null }) => ({
        decision_id: m.decision_id,
        title: m.title,
        outcome: m.outcome,
        lesson: m.lesson,
      }));

    const { data: saved, error } = await supabase
      .from("proposal_reviews")
      .insert({
        proposal_id: proposalId,
        prompt_id: prompt.id,
        prompt_version: prompt.version,
        model,
        clarity: review.clarity,
        evidence: review.evidence,
        feasibility: review.feasibility,
        reversibility: review.reversibility,
        values_alignment: review.values_alignment,
        risks: review.risks,
        questions: review.questions,
        memory_used: memoryUsed,
        summary: review.summary,
      })
      .select("id")
      .single();

    if (error) return { ok: false as const, error: error.message };

    // Critical flags: any value below the group's floor, and any high-severity
    // risk. Each needs a written answer before the proposal can pass.
    const floor = Number(group.threshold_values_floor);
    const flags: {
      proposal_id: string;
      review_id: string;
      kind: "values" | "risk";
      label: string;
      severity: string;
      detail: string;
    }[] = [];

    for (const [name, score] of Object.entries(review.values_alignment)) {
      if (score < floor) {
        flags.push({
          proposal_id: proposalId,
          review_id: saved.id,
          kind: "values",
          label: `Scores ${score.toFixed(2)} against ${name}`,
          severity: "high",
          detail: `The group's floor is ${floor.toFixed(2)}. This has to be answered — what changed, or why is it acceptable here?`,
        });
      }
    }

    for (const risk of review.risks) {
      if (risk.severity === "high") {
        flags.push({
          proposal_id: proposalId,
          review_id: saved.id,
          kind: "risk",
          label: risk.title,
          severity: "high",
          detail: risk.note,
        });
      }
    }

    if (flags.length) await supabase.from("proposal_flags").insert(flags);

    await supabase
      .from("proposals")
      .update({ status: "in_deliberation" })
      .eq("id", proposalId)
      .eq("status", "in_review");

    await ledger().record({
      groupId: group.id,
      kind: "proposal.reviewed",
      subjectType: "proposal",
      subjectId: proposalId,
      payload: { prompt_version: prompt.version, model, flags: flags.length },
    });

    revalidatePath(`/connection/proposals/${proposalId}`);
    revalidatePath("/connection/proposals");
    return { ok: true as const };
  } catch (e) {
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : "The review could not be produced.",
    };
  }
}

/**
 * Withdraw your own proposal.
 *
 * The author's escape hatch, and the only edit they get: a proposal cannot be
 * changed after submission, so the honest move when it was wrong is to pull it
 * and write a better one. It stays on the record as withdrawn rather than
 * disappearing — the review, the deliberation and any answered flags remain
 * readable, because the group spent time on them.
 *
 * Only available while nobody has recorded resonance yet. Once people have
 * responded, pulling it would discard their answers, and the proposal should
 * be closed properly instead.
 */
export async function withdrawProposal(proposalId: string) {
  const { userId, group } = await requireGroup();
  const supabase = await createClient();

  const { count } = await supabase
    .from("resonance_votes")
    .select("profile_id", { count: "exact", head: true })
    .eq("proposal_id", proposalId);

  if (count && count > 0) {
    return {
      ok: false as const,
      error:
        "People have already responded. Close it instead, so their answers stay on the record.",
    };
  }

  const { error } = await supabase
    .from("proposals")
    .update({ status: "withdrawn", closed_at: new Date().toISOString() })
    .eq("id", proposalId)
    .eq("author_id", userId);

  if (error) return { ok: false as const, error: error.message };

  await ledger().record({
    groupId: group.id,
    kind: "proposal.decided",
    subjectType: "proposal",
    subjectId: proposalId,
    payload: { outcome: "withdrawn", by: "author" },
  });

  revalidatePath(`/connection/proposals/${proposalId}`);
  revalidatePath("/connection/proposals");
  return { ok: true as const };
}

/**
 * Run the Universal Law audit.
 *
 * Runs on submission, before the review, because there is no point reading a
 * proposal against a group's values if the constitution forbids it outright.
 * A violation is not a low score — it ends the proposal, and nothing in this
 * file offers a way to set it aside.
 *
 * `challengeId` re-runs the audit with a member's argument in front of the
 * Truth Engine. The earlier readings are superseded rather than deleted: an
 * audit that changed its mind should show that it did.
 */
export async function runLawAudit(proposalId: string, challengeId?: string) {
  const supabase = await createClient();

  const { data: proposal } = await supabase
    .from("proposals")
    .select("*, groups(id, name)")
    .eq("id", proposalId)
    .maybeSingle();

  if (!proposal) return { ok: false as const, error: "No such proposal." };
  const group = proposal.groups as unknown as { id: string; name: string };

  let challenge: { law: string; previousVerdict: string; argument: string } | null = null;

  if (challengeId) {
    const { data: row } = await supabase
      .from("law_challenges")
      .select("argument, law_assessments(law_id, verdict)")
      .eq("id", challengeId)
      .maybeSingle();

    const prior = row?.law_assessments as unknown as
      | { law_id: string; verdict: string }
      | null;

    if (row && prior) {
      challenge = {
        law: prior.law_id,
        previousVerdict: prior.verdict,
        argument: row.argument,
      };
    }
  }

  try {
    const { readings, model, prompt } = await auditAgainstLaw({
      proposal: {
        title: proposal.title,
        summary: proposal.summary,
        body: proposal.body,
        scope: proposal.scope,
        budget: proposal.budget_amount
          ? `${proposal.budget_currency} ${proposal.budget_amount}`
          : null,
      },
      groupName: group.name,
      challenge,
    });

    // Supersede rather than delete, so a changed verdict leaves a trail.
    await supabase
      .from("law_assessments")
      .update({ superseded_at: new Date().toISOString() })
      .eq("proposal_id", proposalId)
      .is("superseded_at", null);

    const { error } = await supabase.from("law_assessments").insert(
      readings.map((r) => ({
        proposal_id: proposalId,
        law_id: r.law_id,
        verdict: r.verdict,
        reasoning: r.reasoning,
        prompt_id: prompt.id,
        prompt_version: prompt.version,
        model,
      })),
    );

    if (error) return { ok: false as const, error: error.message };

    if (challengeId) {
      await supabase
        .from("law_challenges")
        .update({ answered_at: new Date().toISOString() })
        .eq("id", challengeId);
    }

    const violations = readings.filter((r) => r.verdict === "violation").length;

    await ledger().record({
      groupId: group.id,
      kind: "proposal.reviewed",
      subjectType: "proposal",
      subjectId: proposalId,
      payload: {
        stage: "law_audit",
        prompt_version: prompt.version,
        model,
        violations,
        challenged: Boolean(challengeId),
      },
    });

    revalidatePath(`/connection/proposals/${proposalId}`);
    revalidatePath("/connection/proposals");
    return { ok: true as const, violations };
  } catch (e) {
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : "The law audit could not be produced.",
    };
  }
}

/** Answer a tension. A violation cannot be answered — only challenged. */
export async function answerLawTension(assessmentId: string, resolution: string) {
  const supabase = await createClient();

  const { error } = await supabase.rpc("resolve_law_tension", {
    p_assessment_id: assessmentId,
    p_resolution: resolution,
  });

  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/connection/proposals", "layout");
  return { ok: true as const };
}

/**
 * Challenge a reading.
 *
 * The Truth Engine's verdicts cannot be overridden, which means a wrong one
 * would kill a proposal with no recourse. §6.4 of the paper gives citizens a
 * challenge mechanism, and this is it: the argument goes back to the audit,
 * which must address it. It may well not change its mind.
 */
export async function challengeLawReading(
  assessmentId: string,
  proposalId: string,
  argument: string,
) {
  const { userId } = await requireGroup();
  const supabase = await createClient();

  if (argument.trim().length < 40) {
    return {
      ok: false as const,
      error:
        "Make the argument properly — what the audit got wrong, and why the law does not reach this proposal.",
    };
  }

  const { data: challenge, error } = await supabase
    .from("law_challenges")
    .insert({
      assessment_id: assessmentId,
      proposal_id: proposalId,
      challenger_id: userId,
      argument: argument.trim(),
    })
    .select("id")
    .single();

  if (error) return { ok: false as const, error: error.message };

  return runLawAudit(proposalId, challenge.id);
}

/** Mark the review read. The resonance sliders stay inert until this happens. */
export async function markRead(proposalId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "You are not signed in." };

  const { error } = await supabase
    .from("proposal_reads")
    .upsert({ proposal_id: proposalId, profile_id: user.id });

  if (error) return { ok: false as const, error: error.message };
  revalidatePath(`/connection/proposals/${proposalId}`);
  return { ok: true as const };
}

export async function comment(proposalId: string, body: string, parentId?: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "You are not signed in." };

  if (!body.trim()) return { ok: false as const, error: "Nothing to say." };

  const { error } = await supabase.from("deliberation_comments").insert({
    proposal_id: proposalId,
    author_id: user.id,
    parent_id: parentId ?? null,
    body: body.trim(),
  });

  if (error) return { ok: false as const, error: error.message };
  revalidatePath(`/connection/proposals/${proposalId}`);
  return { ok: true as const };
}

export async function castResonance(
  proposalId: string,
  alignment: number,
  confidence: number,
  urgency: number,
  note: string,
) {
  const supabase = await createClient();

  const { error } = await supabase.rpc("cast_resonance", {
    p_proposal_id: proposalId,
    p_alignment: alignment,
    p_confidence: confidence,
    p_urgency: urgency,
    p_note: note.trim() || null,
  });

  if (error) return { ok: false as const, error: error.message };
  revalidatePath(`/connection/proposals/${proposalId}`);
  return { ok: true as const };
}

/** Answer a critical flag. It cannot be dismissed, only answered. */
export async function answerFlag(flagId: string, resolution: string) {
  const supabase = await createClient();

  const { error } = await supabase.rpc("resolve_flag", {
    p_flag_id: flagId,
    p_resolution: resolution,
  });

  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/connection/proposals", "layout");
  return { ok: true as const };
}

/**
 * Close a proposal and write the rationale.
 *
 * The decision rule is applied in the database, not here — this function
 * cannot make a proposal pass that the rule says failed.
 */
export async function closeProposal(proposalId: string) {
  const { group } = await requireGroup();
  const supabase = await createClient();

  const { data: outcome, error } = await supabase.rpc("close_proposal", {
    p_proposal_id: proposalId,
  });

  if (error) return { ok: false as const, error: error.message };

  // Now that it is closed, the numbers are readable and the rationale can
  // engage with them.
  const [{ data: proposal }, { data: reviews }, { data: comments }, { data: flags }, { data: decision }] =
    await Promise.all([
      supabase.from("proposals").select("*").eq("id", proposalId).single(),
      supabase
        .from("proposal_reviews")
        .select("summary")
        .eq("proposal_id", proposalId)
        .order("created_at", { ascending: false })
        .limit(1),
      supabase
        .from("deliberation_comments")
        .select("body, profiles(display_name)")
        .eq("proposal_id", proposalId)
        .order("created_at", { ascending: true })
        .limit(40),
      supabase.from("proposal_flags").select("label, resolution").eq("proposal_id", proposalId),
      supabase.from("decisions").select("*").eq("proposal_id", proposalId).single(),
    ]);

  try {
    const { rationale, prompt } = await writeRationale({
      title: proposal!.title,
      summary: proposal!.summary,
      outcome: outcome as "passed" | "failed",
      alignment: decision?.avg_alignment ?? null,
      confidence: decision?.avg_confidence ?? null,
      urgency: decision?.avg_urgency ?? null,
      participation: decision?.participation ?? null,
      voters: decision?.voter_count ?? 0,
      members: decision?.member_count ?? 0,
      thresholds: {
        alignment: Number(group.threshold_alignment),
        participation: Number(group.threshold_participation),
      },
      reviewSummary: reviews?.[0]?.summary ?? null,
      comments: (comments ?? []).map((c) => ({
        author:
          (c.profiles as unknown as { display_name: string } | null)?.display_name ??
          "A member",
        body: c.body,
      })),
      flags: flags ?? [],
    });

    await supabase
      .from("decisions")
      .update({ rationale_summary: rationale, prompt_version: prompt.version })
      .eq("proposal_id", proposalId);
  } catch {
    // A missing rationale is a gap in the record, not a failed decision.
    // The decision stands; the page offers to write the rationale again.
  }

  revalidatePath(`/connection/proposals/${proposalId}`);
  revalidatePath("/connection/proposals");
  revalidatePath("/connection/decisions");
  revalidatePath("/connection/projects");

  return { ok: true as const, outcome: outcome as "passed" | "failed" };
}

/* ---------------------------------------------------------------------------
   Helpers
--------------------------------------------------------------------------- */

/**
 * The group's rubric: each distinct value name once, with the fullest
 * definition any member gave it. Two members who both named "Honesty" score
 * the proposal against one entry, not two.
 */
function dedupeValues(
  rows: { name: string; definition: string | null }[],
): { name: string; definition: string | null }[] {
  const map = new Map<string, string | null>();
  for (const row of rows) {
    const key = row.name.trim();
    const existing = map.get(key);
    if (existing === undefined || (row.definition?.length ?? 0) > (existing?.length ?? 0)) {
      map.set(key, row.definition);
    }
  }
  return [...map.entries()].map(([name, definition]) => ({ name, definition }));
}

