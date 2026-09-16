import Link from "next/link";

import { CollectiveTabs } from "@/components/nav/CollectiveTabs";
import { Empty, LinkButton, Page, PageTitle, SectionLabel, Tag } from "@/components/ui";
import { ago, money, STATUS_LABEL } from "@/lib/format";
import { requireGroup } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import type { Proposal } from "@/lib/types";

export const metadata = { title: "Proposals · Sovereign" };

export default async function ProposalsPage() {
  const { group } = await requireGroup();
  const supabase = await createClient();

  const { data } = await supabase
    .from("proposals")
    .select("*, profiles(display_name), proposal_flags(resolved_at)")
    .eq("group_id", group.id)
    .order("submitted_at", { ascending: false })
    .limit(60);

  const proposals = (data ?? []) as unknown as (Proposal & {
    profiles: { display_name: string } | null;
    proposal_flags: { resolved_at: string | null }[];
  })[];

  const open = proposals.filter((p) =>
    ["in_review", "in_deliberation", "voting"].includes(p.status),
  );
  const rest = proposals.filter((p) => !open.includes(p));

  return (
    <Page>
      <PageTitle sub={group.name}>Proposals</PageTitle>
      <CollectiveTabs />

      <div className="mb-8">
        <LinkButton href="/connection/proposals/new" tone="gold">
          Write a proposal
        </LinkButton>
      </div>

      <section className="mb-10">
        <SectionLabel right={open.length ? `${open.length}` : undefined}>
          Open
        </SectionLabel>

        {open.length ? (
          <ul className="space-y-2">
            {open.map((p) => (
              <li key={p.id}>
                <ProposalRow proposal={p} />
              </li>
            ))}
          </ul>
        ) : (
          <Empty>
            Nothing open. A proposal here is a specific thing you want the group
            to do, not a topic for discussion.
          </Empty>
        )}
      </section>

      {rest.length ? (
        <section>
          <SectionLabel>Closed</SectionLabel>
          <ul className="space-y-2">
            {rest.map((p) => (
              <li key={p.id}>
                <ProposalRow proposal={p} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </Page>
  );
}

function ProposalRow({
  proposal,
}: {
  proposal: Proposal & {
    profiles: { display_name: string } | null;
    proposal_flags: { resolved_at: string | null }[];
  };
}) {
  const unanswered = proposal.proposal_flags.filter((f) => !f.resolved_at).length;

  return (
    <Link
      href={`/connection/proposals/${proposal.id}`}
      className="block rounded-card border border-line bg-surface-soft p-4 transition-colors hover:border-gold-dim"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-serif text-lg leading-snug text-paper">
          {proposal.title}
        </h3>
        <Tag
          tone={
            proposal.status === "voting"
              ? "gold"
              : proposal.status === "passed" || proposal.status === "executing" || proposal.status === "completed"
                ? "calm"
                : proposal.status === "failed"
                  ? "alarm"
                  : "neutral"
          }
        >
          {STATUS_LABEL[proposal.status]}
        </Tag>
      </div>

      <p className="mt-1.5 text-sm leading-relaxed text-paper-dim">
        {proposal.summary}
      </p>

      <p className="smallcaps mt-2.5 flex flex-wrap items-center gap-x-2 text-[10px] text-paper-faint">
        <span>{proposal.profiles?.display_name ?? "a member"}</span>
        <span>·</span>
        <span>{ago(proposal.submitted_at)}</span>
        {proposal.budget_amount ? (
          <>
            <span>·</span>
            <span>{money(Number(proposal.budget_amount), proposal.budget_currency)}</span>
          </>
        ) : null}
        {unanswered ? (
          <>
            <span>·</span>
            <span className="text-alarm">
              {unanswered} unanswered {unanswered === 1 ? "flag" : "flags"}
            </span>
          </>
        ) : null}
      </p>
    </Link>
  );
}
