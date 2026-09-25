"use server";

import { revalidatePath } from "next/cache";

import { setAddress } from "@/lib/address";
import {
  auditAgainstLaw,
  draftBody,
  reviewProposal,
  sharpenDraft,
  writeRationale,
  type Draft,
} from "@/lib/ai";
import { READINESS_THRESHOLD, sha256 } from "@/lib/readiness";
import { placeAt } from "@/lib/collective";
import { ledger } from "@/lib/ledger";
import { requireSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import type { CommitmentKind, GroupScope } from "@/lib/types";

/* ---------------------------------------------------------------------------
   The scale selector
--------------------------------------------------------------------------- */

/** Look at a different address. Persisted, so the five tabs stay in one circle. */
export async function chooseAddress(value: string) {
  await setAddress(value);
  revalidatePath("/connection", "layout");
  return { ok: true as const };
}

/* ---------------------------------------------------------------------------
   Connection — posting
--------------------------------------------------------------------------- */

/** Post an Output entry to the feed. The entry is marked examined. */
export async function publishEntry(entryId: string, body: string, groupOnly = true) {
  const { userId, group } = await requireSession();
  const supabase = await createClient();

  const text = body.trim();
  if (!text) return { ok: false as const, error: "Nothing to post." };

  const { error } = await supabase.from("posts").insert({
    author_id: userId,
    group_id: groupOnly && group ? group.id : null,
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
  /** The six sections. `body` is derived from them, never typed separately. */
  intent: string;
  change: string;
  constraints: string;
  risks: string;
  alternatives: string;
  evidence: string;
  category: string;
  budget: string;
  termDays: string;
  /** "group:<id>" or "scope:<scale>" — where this proposal is addressed. */
  address: string;
  /** The dormant proposal this was written from, if it is a second attempt. */
  supersedes?: string | null;
}

/** Where a draft is addressed, resolved once and used by both actions below. */
function resolveAddress(
  address: string,
  profile: Parameters<typeof placeAt>[0],
  groups: { id: string }[],
):
  | { ok: true; groupId: string | null; scope: GroupScope; place: string | null }
  | { ok: false; error: string } {
  if (address.startsWith("group:")) {
    const g = groups.find((x) => x.id === address.slice(6));
    if (!g) return { ok: false, error: "You are not in that group." };
    return { ok: true, groupId: g.id, scope: "local", place: null };
  }

  const scope = address.slice(6) as GroupScope;
  const place = scope === "global" ? null : placeAt(profile, scope);
  if (scope !== "global" && !place?.trim()) {
    return {
      ok: false,
      error: "Say where you are at that scale before proposing to it.",
    };
  }
  return { ok: true, groupId: null, scope, place };
}

/**
 * Sharpen a draft.
 *
 * Runs on text that exists only in the author's browser — nothing of the draft
 * is written here. What is written is the reading: a score, a verdict, what is
 * still unanswered, and a hash of the exact words it was made about. That row
 * is private to its author until a proposal attaches it, and the database will
 * not accept a proposal without one.
 *
 * The reading is produced outside Postgres, so this is attributable rather
 * than unforgeable — see docs/architecture.md. What it is not is advisory: the
 * trigger refuses the insert.
 */
export async function assessDraft(input: ProposalInput) {
  const { userId, profile, groups } = await requireSession();
  const supabase = await createClient();

  const where = resolveAddress(input.address, profile, groups);
  if (!where.ok) return { ok: false as const, error: where.error };

  if (!input.title.trim()) return { ok: false as const, error: "A proposal needs a title." };
  if (!input.summary.trim()) {
    return { ok: false as const, error: "A proposal needs a one-line summary." };
  }

  const draft: Draft = {
    title: input.title.trim(),
    summary: input.summary.trim(),
    intent: input.intent,
    change: input.change,
    constraints: input.constraints,
    risks: input.risks,
    alternatives: input.alternatives,
    evidence: input.evidence,
    scope: where.scope,
    place: where.place,
    budget: input.budget.trim() || null,
    termDays: input.termDays.trim() || null,
  };

  try {
    const { sharpen, model, prompt } = await sharpenDraft(draft);

    const { error } = await supabase.from("proposal_readiness").insert({
      author_id: userId,
      body_sha256: await sha256(draftBody(draft)),
      readiness: sharpen.readiness,
      verdict: sharpen.verdict,
      sections: sharpen.sections,
      prompt_id: prompt.id,
      prompt_version: prompt.version,
      model,
    });

    if (error) return { ok: false as const, error: error.message };

    return {
      ok: true as const,
      sharpen,
      model,
      version: prompt.version,
      threshold: READINESS_THRESHOLD,
    };
  } catch (e) {
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : "The draft could not be read.",
    };
  }
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
  const { userId, profile, groups } = await requireSession();
  const supabase = await createClient();

  const where = resolveAddress(input.address, profile, groups);
  if (!where.ok) return { ok: false as const, error: where.error };
  const { groupId, scope, place } = where;

  if (!input.title.trim()) return { ok: false as const, error: "A proposal needs a title." };
  if (!input.summary.trim()) return { ok: false as const, error: "A proposal needs a one-line summary." };

  const budget = input.budget.trim() ? Number(input.budget) : null;
  if (budget !== null && Number.isNaN(budget)) {
    return { ok: false as const, error: "The budget should be a number, or blank." };
  }

  const term = input.termDays.trim() ? Number(input.termDays) : null;

  // The body is derived from the sections, which is what was sharpened and
  // what the readiness row is bound to. Composing it anywhere else would let
  // the two drift apart and the gate would stop meaning anything.
  const draft: Draft = {
    title: input.title.trim(),
    summary: input.summary.trim(),
    intent: input.intent,
    change: input.change,
    constraints: input.constraints,
    risks: input.risks,
    alternatives: input.alternatives,
    evidence: input.evidence,
    scope,
    place,
    budget: input.budget.trim() || null,
    termDays: input.termDays.trim() || null,
  };

  const { data: proposal, error } = await supabase
    .from("proposals")
    .insert({
      group_id: groupId,
      author_id: userId,
      title: draft.title,
      summary: draft.summary,
      body: draftBody(draft),
      intent: draft.intent.trim(),
      change: draft.change.trim(),
      constraints: draft.constraints.trim(),
      risks: draft.risks.trim(),
      alternatives: draft.alternatives.trim(),
      evidence: draft.evidence.trim() || null,
      category: input.category.trim() || null,
      scope,
      place,
      supersedes: input.supersedes ?? null,
      budget_amount: budget,
      term_days: term,
      status: "in_review",
    })
    .select("id")
    .single();

  if (error) return { ok: false as const, error: error.message };

  await ledger().record({
    groupId,
    kind: "proposal.submitted",
    subjectType: "proposal",
    subjectId: proposal.id,
    payload: {
      title: input.title.trim(),
      scope,
      place,
      ...(input.supersedes ? { supersedes: input.supersedes } : {}),
    },
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
  } | null;

  // The rubric.
  //
  // A group has one: the union of what its members have named and chosen to
  // share. A place does not — there is no agreed set of values for a street,
  // and inventing one would be the system telling people what they hold. So at
  // place scale the rubric is built from whoever has actually turned up: the
  // author, and anyone who has written in the deliberation. It starts thin and
  // thickens, which is the honest shape of it.
  let rubricIds: string[];

  if (group) {
    const { data: members } = await supabase
      .from("group_members")
      .select("profile_id")
      .eq("group_id", group.id);
    rubricIds = (members ?? []).map((m) => m.profile_id);
  } else {
    const { data: voices } = await supabase
      .from("deliberation_comments")
      .select("author_id")
      .eq("proposal_id", proposalId);
    rubricIds = Array.from(
      new Set([proposal.author_id, ...(voices ?? []).map((v) => v.author_id)]),
    );
  }

  const { data: valueRows } = await supabase
    .from("profile_values")
    .select("name, definition, profile_id")
    .in("profile_id", rubricIds.length ? rubricIds : ["00000000-0000-0000-0000-000000000000"]);

  const values = dedupeValues(valueRows ?? []);

  const { data: memory } = await supabase.rpc("related_decisions_for", {
    p_proposal_id: proposalId,
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
      groupName: group?.name ?? placeName(proposal),
      groupPurpose: group?.purpose ?? null,
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
    // A place has no group to set a floor, so the protocol default stands.
    const floor = group ? Number(group.threshold_values_floor) : 0.3;
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
      groupId: proposal.group_id,
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
  const { userId } = await requireSession();
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

  const { data: withdrawn } = await supabase
    .from("proposals")
    .select("group_id")
    .eq("id", proposalId)
    .maybeSingle();

  await ledger().record({
    groupId: withdrawn?.group_id ?? null,
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
      groupId: proposal.group_id,
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
  const { userId } = await requireSession();
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
  await requireSession();
  const supabase = await createClient();

  const { data: outcome, error } = await supabase.rpc("close_proposal", {
    p_proposal_id: proposalId,
  });

  if (error) return { ok: false as const, error: error.message };

  // Now that it is closed, the numbers are readable and the rationale can
  // engage with them.
  const [{ data: proposal }, { data: reviews }, { data: comments }, { data: flags }, { data: decision }] =
    await Promise.all([
      supabase.from("proposals").select("*, groups(threshold_alignment, threshold_participation)").eq("id", proposalId).single(),
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

  const { data: rule } = proposal!.group_id
    ? { data: null }
    : await supabase
        .from("scope_rules")
        .select("*")
        .eq("scope", proposal!.scope)
        .maybeSingle();

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
      thresholds: closingThresholds(proposal, rule),
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
/** What to call a proposal's address when it has no group. */
function placeName(proposal: { scope: string; place: string | null }): string {
  if (proposal.scope === "global") return "Everyone";
  return proposal.place ?? "here";
}

/**
 * The numbers the rule was applied with, for the rationale.
 *
 * A place has no register, so there is no participation share to meet and the
 * threshold is zero — the floor it actually had to clear was a count of
 * voices, which the decision row carries.
 */
function closingThresholds(
  proposal: { group_id: string | null; groups?: unknown } | null,
  rule: { threshold_alignment: number } | null,
): { alignment: number; participation: number } {
  const g = proposal?.groups as
    | { threshold_alignment: number; threshold_participation: number }
    | null
    | undefined;

  if (proposal?.group_id && g) {
    return {
      alignment: Number(g.threshold_alignment),
      participation: Number(g.threshold_participation),
    };
  }

  return { alignment: Number(rule?.threshold_alignment ?? 0.618), participation: 0 };
}

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


/* ---------------------------------------------------------------------------
   Activate

   "If supported, resources and people flow to make it real."

   A ratified proposal waits here until named people have committed what it
   needs. Nothing in this file lets one person commit another, and nothing
   lets a proposal activate short of its stated needs — both are enforced in
   the database as well.
--------------------------------------------------------------------------- */

export async function addNeed(
  proposalId: string,
  kind: CommitmentKind,
  description: string,
  quantity: string,
  unit: string,
) {
  const { userId } = await requireSession();
  const supabase = await createClient();

  const n = Number(quantity);
  if (!Number.isFinite(n) || n <= 0) {
    return { ok: false as const, error: "How much? A number greater than zero." };
  }
  if (!description.trim()) {
    return { ok: false as const, error: "Say what is needed." };
  }

  const { error } = await supabase.from("proposal_needs").insert({
    proposal_id: proposalId,
    kind,
    description: description.trim(),
    quantity: n,
    unit: unit.trim() || "units",
    created_by: userId,
  });

  if (error) return { ok: false as const, error: error.message };
  revalidatePath(`/connection/proposals/${proposalId}`);
  return { ok: true as const };
}

export async function pledge(
  needId: string,
  proposalId: string,
  quantity: string,
  note: string,
) {
  const { userId } = await requireSession();
  const supabase = await createClient();

  const n = Number(quantity);
  if (!Number.isFinite(n) || n <= 0) {
    return { ok: false as const, error: "How much can you cover?" };
  }

  const { error } = await supabase.from("commitments").insert({
    need_id: needId,
    proposal_id: proposalId,
    profile_id: userId,
    quantity: n,
    note: note.trim() || null,
  });

  if (error) return { ok: false as const, error: error.message };
  revalidatePath(`/connection/proposals/${proposalId}`);
  return { ok: true as const };
}

/**
 * Withdraw your own pledge.
 *
 * Deliberately possible while the proposal is still waiting. A commitment
 * somebody cannot honour is worse than one they never made, and a system that
 * traps people into pledges will get fewer of them.
 */
export async function withdrawPledge(commitmentId: string, proposalId: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("commitments")
    .update({ status: "withdrawn", withdrawn_at: new Date().toISOString() })
    .eq("id", commitmentId);

  if (error) return { ok: false as const, error: error.message };
  revalidatePath(`/connection/proposals/${proposalId}`);
  return { ok: true as const };
}

/** Turn a fully-resourced, ratified proposal into a project. */
export async function activateProposal(proposalId: string) {
  const supabase = await createClient();

  const { error } = await supabase.rpc("activate_proposal", {
    p_proposal_id: proposalId,
  });

  if (error) return { ok: false as const, error: error.message };

  revalidatePath(`/connection/proposals/${proposalId}`);
  revalidatePath("/connection/projects");
  revalidatePath("/connection/proposals");
  return { ok: true as const };
}
