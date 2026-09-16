import Link from "next/link";
import { notFound } from "next/navigation";

import { Empty, Page, Prose, SectionLabel, Tag } from "@/components/ui";
import { ago, money, shortDate, STATUS_LABEL } from "@/lib/format";
import { asReview, isOpen } from "@/lib/collective";
import { isSteward, requireGroup } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import type {
  Decision,
  DeliberationComment,
  Proposal,
  ProposalFlag,
  ResonanceSummary,
  ResonanceVote,
} from "@/lib/types";

import { AiLayer } from "./AiLayer";
import { CloseButton } from "./CloseButton";
import { Deliberation } from "./Deliberation";
import { FlagList } from "./FlagList";
import { Outcome } from "./Outcome";
import { RunReview } from "./RunReview";
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
  const { userId, group } = await requireGroup();
  const supabase = await createClient();

  const { data: raw } = await supabase
    .from("proposals")
    .select("*, profiles(display_name)")
    .eq("id", id)
    .maybeSingle();

  if (!raw) notFound();

  const proposal = raw as unknown as Proposal & {
    profiles: { display_name: string } | null;
  };

  const [
    { data: reviewRows },
    { data: flagRows },
    { data: commentRows },
    { data: readRow },
    { data: myVote },
    { data: summaryRows },
    { data: decisionRow },
    { data: voteRows },
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
          <Tag>{proposal.scope}</Tag>
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

      {/* --------------------------------------------------------- CONTEXT */}
      <section className="mb-10">
        <SectionLabel>Context</SectionLabel>
        <Prose>{proposal.body}</Prose>
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
          <AiLayer review={review} floor={Number(group.threshold_values_floor)} />
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
          proposalId={id}
          thresholds={{
            alignment: Number(group.threshold_alignment),
            participation: Number(group.threshold_participation),
          }}
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

        {open && isSteward(group.role) ? (
          <div className="mt-4">
            <CloseButton
              proposalId={id}
              unanswered={unanswered.length}
              voters={summary?.voter_count ?? 0}
              members={summary?.member_count ?? 0}
              thresholds={{
                alignment: Number(group.threshold_alignment),
                participation: Number(group.threshold_participation),
              }}
            />
          </div>
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
