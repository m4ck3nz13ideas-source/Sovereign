"use server";

import { revalidatePath } from "next/cache";

import { setAddress } from "@/lib/address";
import {
  auditAgainstLaw,
  draftBody,
  reviewProposal,
  setConditions,
  sharpenDraft,
  simulateImpact,
  surveyPositions,
  summariseDebate,
  writeRationale,
  readPost,
  POST_FLOOR,
  type Draft,
} from "@/lib/ai";
import { AiError } from "@/lib/ai/provider";
import { aiWrite } from "@/lib/ai/sign";
import { shortDate } from "@/lib/format";
import { READINESS_THRESHOLD, sha256 } from "@/lib/readiness";
import { POST_KINDS, type ContributionKind, type MediaKind, type PostKind } from "@/lib/types";
import { placeAt } from "@/lib/collective";
import { ledger } from "@/lib/ledger";
import { requireSession } from "@/lib/session";
import { UNIVERSAL_LAWS } from "@/lib/universal-law";
import { createClient } from "@/lib/supabase/server";
import type {
  CommitmentKind,
  GroupScope,
  RelatedDecision,
  ReviewRisk,
} from "@/lib/types";

/* ---------------------------------------------------------------------------
   The scale selector
--------------------------------------------------------------------------- */

/** Look at a different address. Persisted, so the five tabs stay in one circle. */
export async function chooseAddress(value: string) {
  await setAddress(value);
  revalidatePath("/home", "layout");
  return { ok: true as const };
}

/* ---------------------------------------------------------------------------
   Connection — posting
--------------------------------------------------------------------------- */

/**
 * Publish a post.
 *
 * The witness reads it first, and the database refuses a post without a reading
 * of these exact words at or above the floor (0025) — so this is a gate rather
 * than a suggestion, and the refusal comes back to the author with the line
 * that caused it rather than a closed door.
 *
 * Note the order: the reading is written, then the post. If the insert fails
 * the reading is simply never spent, which is the right way round — an unspent
 * reading costs nothing, and a post that slipped in unread would be the one
 * thing this cannot allow.
 */
export async function publishPost(input: {
  body: string;
  kind: PostKind;
  mediaUrl?: string;
  mediaKind?: MediaKind | null;
  entryId?: string;
  groupOnly?: boolean;
}) {
  const { userId, group } = await requireSession();
  const supabase = await createClient();

  const text = input.body.trim();
  if (!text) return { ok: false as const, error: "Nothing to post." };
  if (text.length > 2000) {
    return { ok: false as const, error: "That is longer than a post can be. Two thousand characters." };
  }

  const mediaUrl = input.mediaUrl?.trim() || null;
  if (mediaUrl && !/^https?:\/\/\S{3,}$/.test(mediaUrl)) {
    return { ok: false as const, error: "A link has to start with http:// or https://." };
  }
  if (mediaUrl && !input.mediaKind) {
    return { ok: false as const, error: "Say what the link is — an image, a video, audio, or a page." };
  }

  let reading;
  try {
    reading = await readPost({
      body: text,
      kind: input.kind,
      mediaUrl,
      mediaKind: input.mediaKind ?? null,
    });
  } catch (e) {
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : "The witness could not read this. Try again.",
    };
  }

  const { witness, model, prompt } = reading;

  const { error: wErr } = await aiWrite(supabase, "post.witness", {
    body_sha256: await sha256(text),
    first_hand: witness.first_hand,
    verdict: witness.verdict,
    concerns: witness.concerns,
    prompt_id: prompt.id,
    prompt_version: prompt.version,
    model,
  });
  if (wErr) return { ok: false as const, error: wErr.message };

  // Refused. The author gets the verdict and the concerns, not a number — the
  // score is a judgement about a draft and belongs nowhere near the screen once
  // the post is up, so it does not go on the screen before it is up either.
  if (witness.first_hand < POST_FLOOR) {
    return {
      ok: false as const,
      error: witness.verdict,
      concerns: witness.concerns,
      refused: true as const,
    };
  }

  const { error } = await supabase.from("posts").insert({
    author_id: userId,
    group_id: input.groupOnly && group ? group.id : null,
    entry_id: input.entryId || null,
    body: text,
    kind: input.kind,
    media_url: mediaUrl,
    media_kind: mediaUrl ? (input.mediaKind ?? null) : null,
  });

  if (error) return { ok: false as const, error: error.message };

  if (input.entryId) {
    await supabase
      .from("entries")
      .update({ state: "examined", examined_at: new Date().toISOString() })
      .eq("id", input.entryId);
  }

  revalidatePath("/home");
  revalidatePath("/individual/profile");
  return { ok: true as const };
}

/** Kept, not liked. Private to the person who kept it — see 0025. */
export async function toggleKeep(postId: string) {
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
    const { error } = await supabase
      .from("post_reactions")
      .insert({ post_id: postId, profile_id: user.id });
    if (error) return { ok: false as const, error: error.message };
  }

  revalidatePath("/home");
  return { ok: true as const };
}

/* ---------------------------------------------------------------------------
   The reader's own filter

   None of this touches what anybody else sees. It is stored per person, read
   by `witness_feed()` for that person only, and there is no policy by which
   somebody learns they were muted.
--------------------------------------------------------------------------- */

export async function saveFeedSettings(input: {
  shows: string[];
  minutes: number | null;
  quietDays: number[];
}) {
  const { userId } = await requireSession();
  const supabase = await createClient();

  const shows = input.shows.filter((k) => (POST_KINDS as readonly string[]).includes(k));
  const minutes =
    input.minutes && input.minutes > 0 ? Math.min(600, Math.round(input.minutes)) : null;
  const quiet = input.quietDays.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);

  const { error } = await supabase.from("feed_settings").upsert({
    profile_id: userId,
    shows,
    minutes,
    quiet_days: quiet,
    updated_at: new Date().toISOString(),
  });

  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/home");
  revalidatePath("/settings/feed");
  return { ok: true as const };
}

/** Quieter, not gone. They are still reachable; they are just not arriving. */
export async function toggleMute(profileId: string) {
  const { userId } = await requireSession();
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("feed_mutes")
    .select("muted_id")
    .eq("profile_id", userId)
    .eq("muted_id", profileId)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("feed_mutes")
      .delete()
      .eq("profile_id", userId)
      .eq("muted_id", profileId);
  } else {
    const { error } = await supabase
      .from("feed_mutes")
      .insert({ profile_id: userId, muted_id: profileId });
    if (error) return { ok: false as const, error: error.message };
  }

  revalidatePath("/home");
  revalidatePath("/settings/feed");
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
  /**
   * What this attempt does differently. Mandatory whenever `supersedes` is
   * set — 0024 enforces it as a check constraint, and it exists because a
   * second attempt that cannot say what changed leaves a reader to diff two
   * near-identical proposals by hand.
   */
  supersedesReason?: string | null;
  /**
   * The Universal Law this rewrites, and the new wording.
   *
   * An amendment is an ordinary proposal in every other respect — same
   * sections, same sharpening, same audit, same sliders. The constitution is
   * not amended by a special ceremony in a side room. What differs is that it
   * must be global, and that enacting it needs a bar nothing else has to
   * clear. See 0015_amendment.sql.
   */
  amendsLaw?: string | null;
  amendmentText?: string;
  amendmentViolation?: string;
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

  // A second attempt says what it changed. The database refuses without it, so
  // the message here is the useful one rather than a constraint name.
  const changed = (input.supersedesReason ?? "").trim();
  if (input.supersedes && changed.length < 20) {
    return {
      ok: false as const,
      error:
        "Say what this attempt does differently from the first one — twenty characters at least. Whoever read the first one needs to know what to look for.",
    };
  }
  if (changed.length > 280) {
    return { ok: false as const, error: "Shorter. What changed, not the argument for it." };
  }

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
      supersedes_reason: input.supersedes ? changed : null,
      amends_law: input.amendsLaw ?? null,
      amendment_text: input.amendsLaw ? (input.amendmentText ?? "").trim() : null,
      amendment_violation: input.amendsLaw
        ? (input.amendmentViolation ?? "").trim()
        : null,
      budget_amount: budget,
      term_days: term,
      status: "in_review",
    })
    .select("id")
    .single();

  if (error) return { ok: false as const, error: error.message };

  // The submission is recorded by a trigger on `proposals`, not from here.
  // Every other decisive act is written by the function that performs it, and
  // this was the last one that depended on the application remembering — which
  // is not what a tamper-evident record is. See 0012_people.sql.

  revalidatePath("/collective/proposals");

  // Law first, then the review. A proposal the constitution forbids should not
  // be scored against a group's values as though the question were open.
  // Neither failure may lose the proposal: it stays in_review and any member
  // can run either step from its page.
  await runLawAudit(proposal.id).catch(() => undefined);
  await runReview(proposal.id).catch(() => undefined);
  // Then its own conditions: voices, window and what must be answered (0039).
  await runConditions(proposal.id).catch(() => undefined);

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

    // Critical flags: any value below the group's floor, and any high-severity
    // risk. Each needs a written answer before the proposal can pass.
    // A place has no group to set a floor, so the protocol default stands.
    // Written in the same signed call as the review (0040), so a review can
    // never land without the flags it raises.
    const floor = group ? Number(group.threshold_values_floor) : 0.3;
    const flags: { kind: "values" | "risk"; label: string; severity: string; detail: string }[] = [];

    for (const [name, score] of Object.entries(review.values_alignment)) {
      if (score < floor) {
        flags.push({
          kind: "values",
          label: `Scores ${score.toFixed(2)} against ${name}`,
          severity: "high",
          detail: `The group's floor is ${floor.toFixed(2)}. This has to be answered — what changed, or why is it acceptable here?`,
        });
      }
    }

    for (const risk of review.risks) {
      if (risk.severity === "high") {
        flags.push({ kind: "risk", label: risk.title, severity: "high", detail: risk.note });
      }
    }

    const { error } = await aiWrite(supabase, "proposal.review", {
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
      flags,
    });

    if (error) return { ok: false as const, error: error.message };

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

    revalidatePath(`/collective/proposals/${proposalId}`);
    revalidatePath("/collective/proposals");
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

  revalidatePath(`/collective/proposals/${proposalId}`);
  revalidatePath("/collective/proposals");
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
/**
 * The ten laws as they currently read.
 *
 * Revision 1 is the shipped text in `src/lib/universal-law.ts`; anything a
 * group has amended since is a row in `law_revisions`. The audit must run
 * against the current wording or an amendment changes nothing in practice,
 * which would make the whole of 0015 decorative.
 */
async function currentLaws() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("law_revisions")
    .select("law_id, revision, text, violation_looks_like")
    .order("revision", { ascending: true });

  const latest = new Map<string, { revision: number; text: string; violation: string }>();
  for (const r of data ?? []) {
    latest.set(r.law_id as string, {
      revision: r.revision as number,
      text: r.text as string,
      violation: r.violation_looks_like as string,
    });
  }

  return UNIVERSAL_LAWS.map((l) => {
    const amended = latest.get(l.id);
    return amended
      ? {
          ...l,
          text: amended.text,
          violationLooksLike: amended.violation,
          revision: amended.revision,
        }
      : { ...l, revision: 1 };
  });
}

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

  // Against the wording in force, not the wording as shipped.
  const laws = await currentLaws();
  const revisionOf = new Map(laws.map((l) => [l.id as string, l.revision]));

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
      laws,
    });

    if (challengeId) {
      // One transaction: check the challenge, supersede the readings in force,
      // record these ten, mark the challenge answered (0034). Done in the
      // database because the old readings must never be superseded without
      // new ones taking their place.
      const { error } = await aiWrite(supabase, "law.challenge", {
        challenge_id: challengeId,
        readings: readings.map((r) => ({
          law_id: r.law_id,
          verdict: r.verdict,
          reasoning: r.reasoning,
        })),
        prompt_id: prompt.id,
        prompt_version: prompt.version,
        model,
      });
      if (error) return { ok: false as const, error: error.message };
    } else {
      // The first audit of a proposal: nothing to supersede.
      const { error } = await aiWrite(supabase, "law.audit", {
        proposal_id: proposalId,
        readings: readings.map((r) => ({
          law_id: r.law_id,
          verdict: r.verdict,
          reasoning: r.reasoning,
          law_revision: revisionOf.get(r.law_id) ?? 1,
        })),
        prompt_id: prompt.id,
        prompt_version: prompt.version,
        model,
      });
      if (error) return { ok: false as const, error: error.message };
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

    revalidatePath(`/collective/proposals/${proposalId}`);
    revalidatePath("/collective/proposals");
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
  revalidatePath("/collective/proposals", "layout");
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
  revalidatePath(`/collective/proposals/${proposalId}`);
  return { ok: true as const };
}

/**
 * Add something to the deliberation.
 *
 * A top-level contribution says what kind of thing it is — a question, an
 * amendment, an alternative, a concern. That is not taxonomy for its own sake:
 * a question can be answered and counted, and a thread where everything looks
 * the same is one where nothing has to be answered.
 */
export async function contribute(
  proposalId: string,
  kind: ContributionKind,
  body: string,
  parentId?: string,
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "You are not signed in." };

  const text = body.trim();
  if (!text) return { ok: false as const, error: "Nothing to say." };

  const { error } = await supabase.from("deliberation_comments").insert({
    proposal_id: proposalId,
    author_id: user.id,
    parent_id: parentId ?? null,
    kind: parentId ? "reply" : kind,
    body: text,
  });

  if (error) return { ok: false as const, error: error.message };
  revalidatePath(`/collective/proposals/${proposalId}`);
  return { ok: true as const };
}

/** Answer a question or a concern. Attributed, permanent, twenty characters. */
export async function answerContribution(
  commentId: string,
  proposalId: string,
  answer: string,
) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("answer_contribution", {
    p_comment_id: commentId,
    p_answer: answer,
  });
  if (error) return { ok: false as const, error: error.message };
  revalidatePath(`/collective/proposals/${proposalId}`);
  return { ok: true as const };
}

/**
 * Say you will carry an amendment into a rewrite.
 *
 * It changes nothing about this proposal — the text is fixed at submission and
 * stays fixed. It puts a marker on the record so the amendment does not have
 * to be argued twice.
 */
export async function adoptAmendment(commentId: string, proposalId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("adopt_amendment", { p_comment_id: commentId });
  if (error) return { ok: false as const, error: error.message };
  revalidatePath(`/collective/proposals/${proposalId}`);
  return { ok: true as const };
}

/**
 * Summarise the thread.
 *
 * Run by a member when the thread has got long enough to need it, not on a
 * timer — a summary is an artefact with a version on it, and one written at
 * 3am by a cron job is one nobody asked for and nobody can date to a moment in
 * the argument.
 */
export async function summariseThread(proposalId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "You are not signed in." };

  const [{ data: proposal }, { data: rows }] = await Promise.all([
    supabase
      .from("proposals")
      .select("title, summary, intent, change")
      .eq("id", proposalId)
      .maybeSingle(),
    supabase
      .from("deliberation_comments")
      .select("kind, body, answer, created_at, profiles(display_name), answered:answered_by(display_name)")
      .eq("proposal_id", proposalId)
      .order("created_at", { ascending: true }),
  ]);

  if (!proposal) return { ok: false as const, error: "No such proposal." };

  const contributions = (rows ?? []).map((c) => ({
    kind: String((c as { kind: string }).kind),
    author:
      (c.profiles as unknown as { display_name: string } | null)?.display_name ??
      "A member",
    body: String((c as { body: string }).body),
    answer: (c as { answer: string | null }).answer,
    answeredBy:
      (c.answered as unknown as { display_name: string } | null)?.display_name ?? null,
    when: shortDate(String((c as { created_at: string }).created_at)),
  }));

  if (contributions.length < 2) {
    return {
      ok: false as const,
      error: "There is not enough here to summarise. Two contributions is the floor.",
    };
  }

  try {
    const { debate, model, prompt } = await summariseDebate({
      proposal: {
        title: proposal.title,
        summary: proposal.summary,
        intent: proposal.intent,
        change: proposal.change,
      },
      contributions,
    });

    const { error } = await supabase.from("debate_summaries").insert({
      proposal_id: proposalId,
      covers: contributions.length,
      arguments_for: debate.arguments_for,
      arguments_against: debate.arguments_against,
      unresolved: debate.unresolved,
      shifted: debate.shifted || null,
      polarization: debate.polarization,
      reading: debate.reading,
      prompt_id: prompt.id,
      prompt_version: prompt.version,
      model,
      created_by: user.id,
    });

    if (error) return { ok: false as const, error: error.message };

    revalidatePath(`/collective/proposals/${proposalId}`);
    return { ok: true as const };
  } catch (e) {
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : "The thread could not be summarised.",
    };
  }
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
  revalidatePath(`/collective/proposals/${proposalId}`);
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
  revalidatePath("/collective/proposals", "layout");
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

  revalidatePath(`/collective/proposals/${proposalId}`);
  revalidatePath("/collective/proposals");
  revalidatePath("/collective/decisions");
  revalidatePath("/collective/projects");

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
  revalidatePath(`/collective/proposals/${proposalId}`);
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
  revalidatePath(`/collective/proposals/${proposalId}`);
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
  revalidatePath(`/collective/proposals/${proposalId}`);
  return { ok: true as const };
}

/** Turn a fully-resourced, ratified proposal into a project. */
export async function activateProposal(proposalId: string) {
  const supabase = await createClient();

  const { error } = await supabase.rpc("activate_proposal", {
    p_proposal_id: proposalId,
  });

  if (error) return { ok: false as const, error: error.message };

  revalidatePath(`/collective/proposals/${proposalId}`);
  revalidatePath("/collective/projects");
  revalidatePath("/collective/proposals");
  return { ok: true as const };
}

/* ---------------------------------------------------------------------------
   IMPACT SIMULATION

   Three actions and a hard line between them. `runSimulation` returns
   candidates and stores nothing. `putOnRecord` is what makes a claim a fact,
   and only a person presses it. `markProjection` is what happens when the
   horizon passes.

   The split matters: a prediction the group never chose to make is not one the
   group owns, and a panel that silently saved whatever the model produced
   would make everyone accountable to sentences nobody read.
--------------------------------------------------------------------------- */

/** Propose candidates. Nothing is written — see putOnRecord. */
export async function runSimulation(proposalId: string) {
  const supabase = await createClient();

  const { data: proposal } = await supabase
    .from("proposals")
    .select("title, summary, body, scope, place, budget_amount, budget_currency, term_days")
    .eq("id", proposalId)
    .maybeSingle();

  if (!proposal) return { ok: false as const, error: "No such proposal." };

  const [{ data: review }, { data: related }] = await Promise.all([
    supabase
      .from("proposal_reviews")
      .select("summary, risks, values_alignment")
      .eq("proposal_id", proposalId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.rpc("related_decisions_for", {
      p_proposal_id: proposalId,
      p_values: [] as string[],
      p_limit: 4,
    }),
  ]);

  try {
    const { result, model, prompt } = await simulateImpact({
      proposal: {
        title: proposal.title,
        summary: proposal.summary,
        body: proposal.body,
        scope: proposal.scope,
        place: proposal.place,
        budget: proposal.budget_amount
          ? `${proposal.budget_amount} ${proposal.budget_currency}`
          : null,
        termDays: proposal.term_days,
      },
      reviewSummary: review?.summary ?? null,
      risks: ((review?.risks ?? []) as ReviewRisk[]).map((r) => ({
        title: r.title,
        severity: r.severity,
        note: r.note,
      })),
      past: ((related ?? []) as RelatedDecision[]).map((d) => ({
        title: d.title,
        expected: d.expected_outcome,
        actual: d.actual_outcome,
        lesson: d.lesson,
      })),
    });

    return {
      ok: true as const,
      projections: result.projections,
      note: result.note,
      prompt: { id: prompt.id, version: prompt.version },
      model,
    };
  } catch (e) {
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : "The simulation could not be run.",
    };
  }
}


/**
 * Look a question up.
 *
 * Runs the survey and records it in one go, because an unrecorded survey is a
 * member's private browsing and the point is the group's understanding. It is
 * readable by anybody the proposal is addressed to, and the asker can withdraw
 * their own.
 *
 * Note what this action cannot do: there is no path here that writes a single
 * position, and no field anywhere that says which one is right.
 */
export async function askQuestion(input: { proposalId: string; question: string }) {
  const question = input.question.trim();
  if (question.length < 12) {
    return { ok: false as const, error: "A question needs to be a question — twelve characters at least." };
  }
  if (question.length > 240) {
    return { ok: false as const, error: "Shorter. One question, not a paragraph of them." };
  }

  const supabase = await createClient();

  const { data: proposal } = await supabase
    .from("proposals")
    .select("title, summary, scope, place")
    .eq("id", input.proposalId)
    .maybeSingle();

  if (!proposal) return { ok: false as const, error: "No such proposal." };

  try {
    const { result, model, prompt } = await surveyPositions({
      question,
      proposal: {
        title: proposal.title,
        summary: proposal.summary,
        scope: proposal.scope,
        place: proposal.place,
      },
    });

    const { error } = await supabase.rpc("record_inquiry", {
      p_proposal_id: input.proposalId,
      p_question: question,
      p_note: result.note,
      p_prompt_id: prompt.id,
      p_prompt_version: prompt.version,
      p_model: model,
      p_positions: result.positions,
    });

    if (error) return { ok: false as const, error: error.message };

    revalidatePath(`/collective/proposals/${input.proposalId}`);
    return { ok: true as const };
  } catch (e) {
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : "The question could not be looked up.",
    };
  }
}

/** Withdraw your own. An inquiry reaches no decision, so it can be taken back. */
export async function withdrawInquiry(inquiryId: string, proposalId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("inquiries").delete().eq("id", inquiryId);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath(`/collective/proposals/${proposalId}`);
  return { ok: true as const };
}

/**
 * Put one claim on the record.
 *
 * `source` is whose WORDS these are, and the rule is simple: if the person
 * changed the sentence, the sentence is theirs. A model does not get credit
 * for a projection somebody rewrote, and a person does not get to hide behind
 * one they did not touch.
 */
export async function putOnRecord(input: {
  proposalId: string;
  direction: "effect" | "risk";
  statement: string;
  horizonDays: number;
  confidence: number | null;
  source: "ai" | "human";
  promptId?: string | null;
  promptVersion?: string | null;
  model?: string | null;
}) {
  const supabase = await createClient();

  const ai = input.source === "ai";
  const { error } = await supabase.rpc("record_projection", {
    p_proposal_id: input.proposalId,
    p_direction: input.direction,
    p_statement: input.statement,
    p_horizon_days: input.horizonDays,
    p_confidence: input.confidence,
    p_source: input.source,
    p_prompt_id: ai ? (input.promptId ?? null) : null,
    p_prompt_version: ai ? (input.promptVersion ?? null) : null,
    p_model: ai ? (input.model ?? null) : null,
  });

  if (error) return { ok: false as const, error: error.message };

  revalidatePath(`/collective/proposals/${input.proposalId}`);
  return { ok: true as const };
}

/** Mark one against what happened. Once, with a reason, permanently. */
export async function markProjection(
  projectionId: string,
  verdict: "held" | "missed" | "unclear",
  note: string,
) {
  const supabase = await createClient();

  const { error } = await supabase.rpc("resolve_projection", {
    p_projection_id: projectionId,
    p_verdict: verdict,
    p_note: note,
  });

  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/collective/impact");
  revalidatePath("/collective/proposals", "page");
  return { ok: true as const };
}

/* ---------------------------------------------------------------------------
   CONTENTION

   A preference orders, it never passes. Nothing in here consults a preference
   to decide an outcome — `close_proposal()` settled that on each proposal's
   own terms. All of this decides is which of the survivors goes first.
--------------------------------------------------------------------------- */

/** Declare that two open proposals are two answers to one question. */
export async function openContention(input: {
  question: string;
  a: string;
  b: string;
  note?: string;
}) {
  const supabase = await createClient();

  const { error } = await supabase.rpc("open_contention", {
    p_question: input.question,
    p_proposal_a: input.a,
    p_proposal_b: input.b,
    p_note: input.note ?? null,
  });

  if (error) return { ok: false as const, error: error.message };

  revalidatePath(`/collective/proposals/${input.a}`);
  revalidatePath(`/collective/proposals/${input.b}`);
  return { ok: true as const };
}

/** Name your first choice among them. Separate from how you resonated on each. */
export async function preferProposal(contentionId: string, proposalId: string) {
  const supabase = await createClient();

  const { error } = await supabase.rpc("set_preference", {
    p_contention_id: contentionId,
    p_proposal_id: proposalId,
  });

  if (error) return { ok: false as const, error: error.message };

  revalidatePath(`/collective/proposals/${proposalId}`);
  return { ok: true as const };
}

export async function clearPreference(contentionId: string, proposalId: string) {
  const supabase = await createClient();

  const { error } = await supabase.rpc("clear_preference", {
    p_contention_id: contentionId,
  });

  if (error) return { ok: false as const, error: error.message };

  revalidatePath(`/collective/proposals/${proposalId}`);
  return { ok: true as const };
}

/**
 * Say a passed proposal is not going ahead after all.
 *
 * Not a failure and not a deletion — the record keeps saying it passed. What
 * changes is that it stops waiting, which is the signal the next answer to the
 * same question needs before it can take its turn.
 */
export async function standDown(proposalId: string, reason: string) {
  const supabase = await createClient();

  const { error } = await supabase.rpc("stand_down_proposal", {
    p_proposal_id: proposalId,
    p_reason: reason,
  });

  if (error) return { ok: false as const, error: error.message };

  revalidatePath(`/collective/proposals/${proposalId}`);
  revalidatePath("/collective/proposals");
  return { ok: true as const };
}

/**
 * Enact an amendment that has passed and cleared the bar.
 *
 * Ratification is not enactment, the same way ratification is not activation.
 * The database checks the higher threshold itself rather than trusting that
 * whoever closed it applied one.
 */
export async function enactAmendment(proposalId: string) {
  const supabase = await createClient();

  const { error } = await supabase.rpc("enact_amendment", {
    p_proposal_id: proposalId,
  });

  if (error) return { ok: false as const, error: error.message };

  revalidatePath(`/collective/proposals/${proposalId}`);
  revalidatePath("/settings/law");
  return { ok: true as const };
}

/**
 * Set a proposal's conditions (0039): how many people must respond, how long
 * it stays open, and what must be answered first. Once, before anybody
 * responds; the database refuses a second set or a late one. Any member can
 * run it from the proposal page if it did not run at submission.
 */
export async function runConditions(proposalId: string) {
  const supabase = await createClient();
  const { data: proposal } = await supabase
    .from("proposals")
    .select("*, groups(*)")
    .eq("id", proposalId)
    .maybeSingle();
  if (!proposal) return { ok: false as const, error: "No such proposal." };

  const group = proposal.groups as unknown as { id: string; name: string } | null;
  let members: number | null = null;
  if (group) {
    const { count } = await supabase
      .from("group_members")
      .select("profile_id", { count: "exact", head: true })
      .eq("group_id", group.id);
    members = count ?? null;
  }

  try {
    const { conditions, model, prompt } = await setConditions({
      title: proposal.title,
      summary: proposal.summary,
      body: proposal.body,
      scale: group ? "group" : proposal.scope,
      where: group?.name ?? placeName(proposal),
      members,
      budget: proposal.budget_amount ? `${proposal.budget_currency} ${proposal.budget_amount}` : null,
    });
    const minVoices = members ? Math.min(conditions.min_voices, members) : conditions.min_voices;
    const { error } = await aiWrite(supabase, "proposal.conditions", {
      proposal_id: proposalId,
      min_voices: minVoices,
      window_hours: conditions.window_hours,
      requirements: conditions.requirements,
      affected: conditions.affected,
      rationale: conditions.rationale,
      prompt_id: prompt.id,
      prompt_version: prompt.version,
      model,
    });
    if (error) return { ok: false as const, error: error.message };
    revalidatePath(`/collective/proposals/${proposalId}`);
    return { ok: true as const };
  } catch (e) {
    return {
      ok: false as const,
      error: e instanceof AiError ? e.message : "The conditions could not be set. Try again in a moment.",
    };
  }
}

export async function answerRequirement(proposalId: string, idx: number, answer: string) {
  if (answer.trim().length < 20) return { ok: false as const, error: "Answer in at least twenty characters." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("answer_requirement", {
    p_proposal_id: proposalId,
    p_idx: idx,
    p_answer: answer,
  });
  if (error) return { ok: false as const, error: error.message };
  revalidatePath(`/collective/proposals/${proposalId}`);
  return { ok: true as const };
}

/** Record how an affected group was given the chance to take part (0042). */
export async function markAffectedReached(proposalId: string, idx: number, note: string) {
  if (note.trim().length < 20) return { ok: false as const, error: "Say how they were reached, in at least twenty characters." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("answer_condition", {
    p_proposal_id: proposalId,
    p_kind: "affected",
    p_idx: idx,
    p_text: note,
  });
  if (error) return { ok: false as const, error: error.message };
  revalidatePath(`/collective/proposals/${proposalId}`);
  return { ok: true as const };
}

/**
 * Challenge a proposal's conditions as not enough (0042). The argument goes to
 * the AI, which may only add; the database enforces that, records the old
 * conditions as a public revision, and nothing is decided while it is open.
 */
export async function challengeConditions(proposalId: string, argument: string) {
  if (argument.trim().length < 20) return { ok: false as const, error: "Say what is missing, in at least twenty characters." };
  const supabase = await createClient();
  const { error: cErr } = await supabase.rpc("raise_condition_challenge", {
    p_proposal_id: proposalId,
    p_argument: argument,
  });
  if (cErr) return { ok: false as const, error: cErr.message };

  // Before anybody responds, the challenge can update the conditions. After,
  // it is an argument on the record and nothing more (0042).
  const { count } = await supabase
    .from("resonance_votes")
    .select("profile_id", { count: "exact", head: true })
    .eq("proposal_id", proposalId);
  if ((count ?? 0) > 0) {
    revalidatePath(`/collective/proposals/${proposalId}`);
    return { ok: true as const };
  }
  return answerMyChallenge(proposalId);
}

export async function replyToChallenge(proposalId: string, challengeId: string, body: string) {
  if (!body.trim()) return { ok: false as const, error: "Say something first." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("reply_to_condition_challenge", {
    p_challenge_id: challengeId,
    p_body: body,
  });
  if (error) return { ok: false as const, error: error.message };
  revalidatePath(`/collective/proposals/${proposalId}`);
  return { ok: true as const };
}

/** Have the AI re-read the conditions for your open challenge. Retryable. */
export async function answerMyChallenge(proposalId: string) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false as const, error: "Sign in again." };
  const { data: mine } = await supabase
    .from("condition_challenges")
    .select("id, argument")
    .eq("proposal_id", proposalId)
    .eq("challenger_id", auth.user.id)
    .is("answered_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!mine) return { ok: false as const, error: "You have no open challenge on this proposal." };
  const challengeId = mine.id as string;
  const argument = mine.argument as string;

  const [{ data: proposal }, { data: current }] = await Promise.all([
    supabase.from("proposals").select("*, groups(*)").eq("id", proposalId).maybeSingle(),
    supabase
      .from("proposal_conditions")
      .select("min_voices, window_hours, requirements, affected, rationale")
      .eq("proposal_id", proposalId)
      .maybeSingle(),
  ]);
  if (!proposal || !current) return { ok: false as const, error: "No such proposal." };

  const group = proposal.groups as unknown as { id: string; name: string } | null;
  let members: number | null = null;
  if (group) {
    const { count } = await supabase
      .from("group_members")
      .select("profile_id", { count: "exact", head: true })
      .eq("group_id", group.id);
    members = count ?? null;
  }

  try {
    const { conditions, model, prompt } = await setConditions({
      title: proposal.title,
      summary: proposal.summary,
      body: proposal.body,
      scale: group ? "group" : proposal.scope,
      where: group?.name ?? placeName(proposal),
      members,
      budget: proposal.budget_amount ? `${proposal.budget_currency} ${proposal.budget_amount}` : null,
      challenge: { argument, current: current as Record<string, unknown> },
    });
    const { error } = await aiWrite(supabase, "proposal.conditions.challenge", {
      challenge_id: challengeId,
      min_voices: members ? Math.min(conditions.min_voices, members) : conditions.min_voices,
      window_hours: conditions.window_hours,
      requirements: conditions.requirements,
      affected: conditions.affected,
      rationale: conditions.rationale,
      prompt_id: prompt.id,
      prompt_version: prompt.version,
      model,
    });
    if (error) return { ok: false as const, error: error.message };
  } catch (e) {
    revalidatePath(`/collective/proposals/${proposalId}`);
    return {
      ok: false as const,
      error:
        (e instanceof AiError ? e.message : "The conditions could not be re-read.") +
        " Your challenge is recorded; you can try the re-read again from the proposal page.",
    };
  }
  revalidatePath(`/collective/proposals/${proposalId}`);
  return { ok: true as const };
}
