import Link from "next/link";
import { notFound } from "next/navigation";

import { Empty, Page, Prose, SectionLabel, Tag } from "@/components/ui";
import { ago, money, shortDate, STATUS_LABEL } from "@/lib/format";
import { asReview, isOpen } from "@/lib/collective";
import { isSteward, requireSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import type {
  ActivationStanding,
  Commitment,
  Decision,
  DeliberationComment,
  LawAssessment,
  LawStanding,
  NeedStanding,
  Proposal,
  ProposalFlag,
  ProposalReadiness,
  ResonanceSummary,
  ResonanceVote,
  ScopeRule,
} from "@/lib/types";

import { READINESS_THRESHOLD, SECTION_LABELS } from "@/lib/readiness";

import { AiLayer } from "./AiLayer";
import { CloseButton } from "./CloseButton";
import { Deliberation } from "./Deliberation";
import { Activation } from "./Activation";
import { LawLayer } from "./LawLayer";
import { FlagList } from "./FlagList";
import { Outcome } from "./Outcome";
import { RunReview } from "./RunReview";
import { Sharpening } from "./Sharpening";
import { ResonancePanel } from "./ResonancePanel";
import { WithdrawButton } from "./WithdrawButton";

/**
 * The Review page — one screen, five layers, in this order:
 *
 *   HEADER   what is being proposed, by whom, and where it has got to
 *   CONTEXT  the proposal itself
 *   AI LAYER what the reviewer found, and what it read to find it
 *   HUMAN    deliberation, flags to answer, and resonance
 *   OUTCOME  the decision, once there is one
 *
 * Everything about a proposal is here. There is no second page to click into,
 * because a member who has to navigate to understand something will not.
 */
export default async function ProposalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { userId, groups } = await requireSession();
  const supabase = await createClient();

  const { data: raw } = await supabase
    .from("proposals")
    .select("*, profiles(display_name), groups(name, threshold_alignment, threshold_participation, threshold_values_floor)")
    .eq("id", id)
    .maybeSingle();

  if (!raw) notFound();

  const proposal = raw as unknown as Proposal & {
    profiles: { display_name: string } | null;
    groups: {
      name: string;
      threshold_alignment: number;
      threshold_participation: number;
      threshold_values_floor: number;
    } | null;
  };

  // A proposal addressed to a place has no group and no steward. The rule it
  // is closed by comes from the scale instead, and the clock decides when.
  const { data: ruleRow } = proposal.group_id
    ? { data: null }
    : await supabase
        .from("scope_rules")
        .select("*")
        .eq("scope", proposal.scope)
        .maybeSingle();

  const rule = ruleRow as ScopeRule | null;

  // The thread, both ways. A second attempt says what it came from; a proposal
  // somebody has taken up again says so, so nobody reads a dead record as the
  // current state of the question.
  const [{ data: cameFrom }, { data: takenUp }] = await Promise.all([
    proposal.supersedes
      ? supabase
          .from("proposals")
          .select("id, title, status")
          .eq("id", proposal.supersedes)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("proposals")
      .select("id, title, status")
      .eq("supersedes", id)
      .order("submitted_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const thresholds = proposal.groups
    ? {
        alignment: Number(proposal.groups.threshold_alignment),
        participation: Number(proposal.groups.threshold_participation),
      }
    : { alignment: Number(rule?.threshold_alignment ?? 0.618), participation: 0 };

  const valuesFloor = proposal.groups
    ? Number(proposal.groups.threshold_values_floor)
    : 0.3;

  const myRole = groups.find((g) => g.id === proposal.group_id)?.role ?? null;

  // Who may close it. A group has stewards. A place does not, so the window
  // holds it open and then anyone it was addressed to can perform the closing
  // — the database refuses an early one either way.
  const windowOpen = Boolean(
    proposal.closes_at && new Date(proposal.closes_at) > new Date(),
  );
  const canClose = proposal.group_id
    ? Boolean(myRole && isSteward(myRole))
    : !windowOpen;

  const [
    { data: reviewRows },
    { data: flagRows },
    { data: commentRows },
    { data: readRow },
    { data: myVote },
    { data: summaryRows },
    { data: decisionRow },
    { data: voteRows },
    { data: lawRows },
    { data: standingRows },
    { data: needRows },
    { data: activationRows },
    { data: commitmentRows },
    { data: readinessRow },
  ] = await Promise.all([
    supabase
      .from("proposal_reviews")
      .select("*")
      .eq("proposal_id", id)
      .order("created_at", { ascending: false })
      .limit(1),
    supabase
      .from("proposal_flags")
      .select("*, profiles:resolved_by(display_name)")
      .eq("proposal_id", id)
      .order("created_at", { ascending: true }),
    supabase
      .from("deliberation_comments")
      .select("*, profiles(display_name)")
      .eq("proposal_id", id)
      .order("created_at", { ascending: true }),
    supabase
      .from("proposal_reads")
      .select("read_at")
      .eq("proposal_id", id)
      .eq("profile_id", userId)
      .maybeSingle(),
    supabase
      .from("resonance_votes")
      .select("*")
      .eq("proposal_id", id)
      .eq("profile_id", userId)
      .maybeSingle(),
    supabase.rpc("resonance_summary", { p_proposal_id: id }),
    supabase.from("decisions").select("*").eq("proposal_id", id).maybeSingle(),
    supabase
      .from("resonance_votes")
      .select("*, profiles(display_name)")
      .eq("proposal_id", id),
    supabase
      .from("law_assessments")
      .select("*, profiles:resolved_by(display_name)")
      .eq("proposal_id", id)
      .is("superseded_at", null),
    supabase.rpc("law_standing", { p_proposal_id: id }),
    supabase.rpc("need_standing", { p_proposal_id: id }),
    supabase.rpc("activation_standing", { p_proposal_id: id }),
    supabase
      .from("commitments")
      .select("*, profiles(display_name)")
      .eq("proposal_id", id)
      .in("status", ["pledged", "honoured"]),
    supabase
      .from("proposal_readiness")
      .select("*")
      .eq("proposal_id", id)
      .maybeSingle(),
  ]);

  const review = reviewRows?.[0] ? asReview(reviewRows[0]) : null;
  const flags = (flagRows ?? []) as unknown as (ProposalFlag & {
    profiles: { display_name: string } | null;
  })[];
  const comments = (commentRows ?? []) as unknown as (DeliberationComment & {
    profiles: { display_name: string } | null;
  })[];
  const summary = (Array.isArray(summaryRows) ? summaryRows[0] : summaryRows) as
    | ResonanceSummary
    | undefined;
  const decision = decisionRow as Decision | null;

  // Ordered by the constitution, not by when the model happened to emit them.
  const lawAssessments = ((lawRows ?? []) as unknown as (LawAssessment & {
    profiles: { display_name: string } | null;
  })[]);
  const standing = (Array.isArray(standingRows) ? standingRows[0] : standingRows) as
    | LawStanding
    | undefined;
  const unlawful = Boolean(standing && (standing.violations > 0 || !standing.audited));

  const needs = (needRows ?? []) as NeedStanding[];
  const activation = (Array.isArray(activationRows) ? activationRows[0] : activationRows) as
    | ActivationStanding
    | undefined;
  const commitments = (commitmentRows ?? []) as unknown as (Commitment & {
    profiles: { display_name: string } | null;
  })[];

  const readiness = readinessRow
    ? ({
        ...(readinessRow as unknown as ProposalReadiness),
        sections: ((readinessRow as { sections?: unknown }).sections ??
          []) as ProposalReadiness["sections"],
      } satisfies ProposalReadiness)
    : null;

  // Grouped for the panel: my own pledge per need, and everyone's per need.
  const myPledges: Record<string, { id: string; quantity: number }> = {};
  const pledgesByNeed: Record<
    string,
    { name: string; quantity: number; mine: boolean }[]
  > = {};
  for (const c of commitments) {
    const mine = c.profile_id === userId;
    if (mine) myPledges[c.need_id] = { id: c.id, quantity: Number(c.quantity) };
    (pledgesByNeed[c.need_id] ??= []).push({
      name: c.profiles?.display_name ?? "A member",
      quantity: Number(c.quantity),
      mine,
    });
  }

  const unanswered = flags.filter((f) => !f.resolved_at);
  const hasRead = Boolean(readRow);
  const open = isOpen(proposal.status);

  return (
    <Page>
      <Link
        href="/connection/proposals"
        className="smallcaps mb-6 inline-block text-[11px] text-paper-faint hover:text-gold"
      >
        ← Proposals
      </Link>

      {/* ---------------------------------------------------------- HEADER */}
      <header className="mb-8">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Tag
            tone={
              proposal.status === "voting"
                ? "gold"
                : ["passed", "executing", "completed"].includes(proposal.status)
                  ? "calm"
                  : proposal.status === "failed"
                    ? "alarm"
                    : "neutral"
            }
          >
            {STATUS_LABEL[proposal.status]}
          </Tag>
          {proposal.category ? <Tag>{proposal.category}</Tag> : null}
          <Tag tone="gold">
            {proposal.groups
              ? proposal.groups.name
              : proposal.scope === "global"
                ? "Global"
                : `${proposal.place} · ${proposal.scope}`}
          </Tag>
          {unanswered.length ? (
            <Tag tone="alarm">
              {unanswered.length} to answer
            </Tag>
          ) : null}
        </div>

        <h1 className="font-serif text-[1.75rem] leading-tight text-paper">
          {proposal.title}
        </h1>
        <p className="mt-2 text-[0.95rem] leading-relaxed text-paper-dim">
          {proposal.summary}
        </p>

        <p className="smallcaps mt-3 flex flex-wrap items-center gap-x-2 text-[10px] text-paper-faint">
          <span>{proposal.profiles?.display_name ?? "a member"}</span>
          <span>·</span>
          <span>{ago(proposal.submitted_at)}</span>
          {proposal.budget_amount ? (
            <>
              <span>·</span>
              <span>
                {money(Number(proposal.budget_amount), proposal.budget_currency)}
              </span>
            </>
          ) : null}
          {proposal.term_days ? (
            <>
              <span>·</span>
              <span>{proposal.term_days} days</span>
            </>
          ) : null}
        </p>
      </header>

      {cameFrom || takenUp ? (
        <div className="mb-8 rounded-card border border-line bg-surface-soft px-4 py-3">
          {cameFrom ? (
            <p className="text-sm leading-relaxed text-paper-dim">
              Written from{" "}
              <Link
                href={`/connection/proposals/${(cameFrom as { id: string }).id}`}
                className="text-gold hover:underline"
              >
                {(cameFrom as { title: string }).title}
              </Link>
              , which ran out of people rather than out of merit. It was
              sharpened and audited again from scratch.
            </p>
          ) : null}
          {takenUp ? (
            <p className={`text-sm leading-relaxed text-paper-dim${cameFrom ? " mt-2" : ""}`}>
              Taken up again as{" "}
              <Link
                href={`/connection/proposals/${(takenUp as { id: string }).id}`}
                className="text-gold hover:underline"
              >
                {(takenUp as { title: string }).title}
              </Link>
              . This record stands as it was.
            </p>
          ) : null}
        </div>
      ) : null}

      {/* --------------------------------------------------------- CONTEXT */}
      <section className="mb-10 space-y-7">
        {(
          [
            ["intent", proposal.intent],
            ["change", proposal.change],
            ["constraints", proposal.constraints],
            ["risks", proposal.risks],
            ["alternatives", proposal.alternatives],
            ["evidence", proposal.evidence],
          ] as const
        ).map(([key, text]) =>
          text && text.trim() ? (
            <div key={key}>
              <SectionLabel>{SECTION_LABELS[key]}</SectionLabel>
              <Prose>{text}</Prose>
            </div>
          ) : null,
        )}

        {/* Proposals written before the sections existed kept their prose. */}
        {!proposal.intent.trim() ? (
          <div>
            <SectionLabel>Context</SectionLabel>
            <Prose>{proposal.body}</Prose>
          </div>
        ) : null}
      </section>

      {/* ------------------------------------------------------- SHARPENING */}
      <section className="mb-10">
        <SectionLabel
          right={
            proposal.readiness !== null
              ? `${Number(proposal.readiness).toFixed(2)}`
              : undefined
          }
        >
          How it was sharpened
        </SectionLabel>
        <Sharpening readiness={readiness} threshold={READINESS_THRESHOLD} />
      </section>

      {/* ------------------------------------------------------ UNIVERSAL LAW */}
      {/* Above everything else on the page, because it is above everything
          else in the architecture: a violation ends the proposal regardless
          of what the review found or how the group resonated. */}
      <section className="mb-10">
        <SectionLabel
          right={
            standing?.audited
              ? `${standing.laws_assessed} of 10`
              : undefined
          }
        >
          Universal Law
        </SectionLabel>
        <LawLayer proposalId={id} assessments={lawAssessments} open={open} />
      </section>

      {/* -------------------------------------------------------- AI LAYER */}
      <section className="mb-10">
        <SectionLabel
          right={
            review ? (
              <span>
                {review.prompt_id} v{review.prompt_version}
              </span>
            ) : undefined
          }
        >
          What the review found
        </SectionLabel>

        {review ? (
          <AiLayer review={review} floor={valuesFloor} />
        ) : (
          <RunReview proposalId={id} />
        )}
      </section>

      {/* ----------------------------------------------------- HUMAN LAYER */}
      <section className="mb-10">
        <SectionLabel>Critical flags</SectionLabel>
        {flags.length ? (
          <FlagList flags={flags} canAnswer={open} />
        ) : (
          <Empty>
            {review
              ? "Nothing in the review crossed the group's critical threshold."
              : "Flags appear once the review has run."}
          </Empty>
        )}
      </section>

      <section className="mb-10">
        <SectionLabel right={comments.length ? `${comments.length}` : undefined}>
          Deliberation
        </SectionLabel>
        <Deliberation
          proposalId={id}
          comments={comments.map((c) => ({
            id: c.id,
            author: c.profiles?.display_name ?? "A member",
            body: c.body,
            when: ago(c.created_at),
            mine: c.author_id === userId,
          }))}
          canComment={open}
        />
      </section>

      <section className="mb-10">
        <SectionLabel>Resonance</SectionLabel>
        <ResonancePanel
          proposalId={id}
          unlawful={unlawful}
          hasReview={Boolean(review)}
          hasRead={hasRead}
          open={open}
          mine={(myVote as ResonanceVote | null) ?? null}
          summary={
            summary ?? {
              voter_count: 0,
              member_count: 0,
              avg_alignment: null,
              avg_confidence: null,
              avg_urgency: null,
              revealed: false,
            }
          }
        />
      </section>

      {/* --------------------------------------------------------- OUTCOME */}
      <section>
        <SectionLabel>Outcome</SectionLabel>
        <Outcome
          decision={decision}
          activated={["executing", "completed"].includes(proposal.status)}
          proposalId={id}
          thresholds={thresholds}
          minVoices={rule?.min_voices ?? null}
          votes={
            decision
              ? ((voteRows ?? []) as unknown as (ResonanceVote & {
                  profiles: { display_name: string } | null;
                })[]).map((v) => ({
                  name: v.profiles?.display_name ?? "A member",
                  alignment: Number(v.alignment),
                  confidence: Number(v.confidence),
                  urgency: Number(v.urgency),
                  note: v.note,
                }))
              : []
          }
        />

        {proposal.status === "passed" ? (
          <div className="mt-6">
            <SectionLabel
              right={
                activation?.needs_total
                  ? `${activation.needs_met} of ${activation.needs_total} covered`
                  : undefined
              }
            >
              Activate
            </SectionLabel>
            <Activation
              proposalId={id}
              needs={needs}
              ready={Boolean(activation?.ready)}
              isAuthorOrSteward={
                proposal.author_id === userId ||
                Boolean(myRole && isSteward(myRole))
              }
              myPledges={myPledges}
              pledgesByNeed={pledgesByNeed}
            />
          </div>
        ) : null}

        {open && canClose ? (
          <div className="mt-4">
            <CloseButton
              proposalId={id}
              lawViolations={standing?.violations ?? 0}
              lawTensions={standing?.unanswered_tensions ?? 0}
              unanswered={unanswered.length}
              voters={summary?.voter_count ?? 0}
              members={summary?.member_count ?? null}
              minVoices={rule?.min_voices ?? 1}
              thresholds={thresholds}
            />
          </div>
        ) : null}

        {open && !canClose && !proposal.group_id && windowOpen ? (
          <p className="mt-4 text-sm leading-relaxed text-paper-faint">
            Deliberation is open until {shortDate(proposal.closes_at!)}. Nobody
            can close it sooner — a place has no steward to pick the moment, so
            the window does it instead.
          </p>
        ) : null}

        {/* in_review counts too: a proposal whose review failed to run is
            exactly the one an author may want to pull. The RLS policy allows
            an author's update in in_review and in_deliberation, and a zero
            voter count guarantees the status is one of those two. */}
        {(open || proposal.status === "in_review") &&
        proposal.author_id === userId &&
        (summary?.voter_count ?? 0) === 0 ? (
          <div className="mt-6">
            <WithdrawButton proposalId={id} />
          </div>
        ) : null}

        {proposal.status === "withdrawn" ? (
          <p className="mt-4 text-sm leading-relaxed text-paper-faint">
            The author withdrew this before anyone responded. The review and the
            deliberation are left here on purpose — the group spent time on them.
          </p>
        ) : null}

        {proposal.closed_at ? (
          <p className="smallcaps mt-4 text-[10px] text-paper-faint">
            closed {shortDate(proposal.closed_at)}
          </p>
        ) : null}
      </section>
    </Page>
  );
}
