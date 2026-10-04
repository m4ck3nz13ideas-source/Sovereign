import Link from "next/link";
import { notFound } from "next/navigation";

import { Gutter, Prose, Readers, Screen, SectionLabel, Tag, TopBar } from "@/components/ui";
import { ago, shortDate, STATUS_LABEL } from "@/lib/format";
import { KIND_LABEL, STATE_LABEL, STATE_LINE, stateTone } from "@/lib/marketplace";
import { requireSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import type {
  AttachableProposal,
  Listing,
  ListingRevocation,
  ListingState,
  ProposalStatus,
} from "@/lib/types";

import { ListingControls } from "./ListingControls";

export const metadata = { title: "Listing · Marketplace · Sovereign" };

/**
 * One listing, with the proposals that admitted it and that would take it down.
 *
 * The admitting proposal is shown as the listing's whole standing — "approved"
 * here means a decision with a date on the ledger, and the link goes to it.
 * Revocations are listed with their own proposals whatever happened to them:
 * one that failed is as much a part of the record as one that passed.
 */
export default async function ListingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { userId } = await requireSession();
  const supabase = await createClient();

  const { data: raw } = await supabase.from("listings").select("*").eq("id", id).maybeSingle();
  if (!raw) notFound();
  const listing = raw as Listing;

  const [{ data: stateRow }, { data: admitRow }, { data: revRows }, { data: sellerRow }] =
    await Promise.all([
      supabase.rpc("listing_state", { p_listing_id: id }),
      supabase
        .from("proposals")
        .select("id, title, status, group_id, scope, place, groups(name), decisions(decided_at, outcome)")
        .eq("id", listing.proposal_id)
        .maybeSingle(),
      supabase
        .from("listing_revocations")
        .select("*, proposals(id, title, status), profiles:raised_by(display_name)")
        .eq("listing_id", id)
        .order("created_at", { ascending: true }),
      supabase.from("profiles").select("display_name").eq("id", listing.offered_by).maybeSingle(),
    ]);

  const state = (stateRow as ListingState) ?? "pending";
  const admit = admitRow as unknown as {
    id: string;
    title: string;
    status: ProposalStatus;
    group_id: string | null;
    scope: string;
    place: string | null;
    groups: { name: string } | null;
    decisions: { decided_at: string; outcome: string } | { decided_at: string; outcome: string }[] | null;
  } | null;
  const decision = Array.isArray(admit?.decisions) ? admit?.decisions[0] : admit?.decisions;

  const revocations = (revRows ?? []) as unknown as (ListingRevocation & {
    proposals: { id: string; title: string; status: ProposalStatus } | null;
    profiles: { display_name: string } | null;
  })[];

  const mine = listing.offered_by === userId;

  // Where a revocation could go: your own proposals to the same people.
  const { data: attachRows } =
    state === "listed" && !mine
      ? await supabase.rpc("my_attachable_proposals", { p_listing_id: id })
      : { data: [] };
  const attachable = (attachRows ?? []) as AttachableProposal[];

  const audience = admit?.groups
    ? `Everyone in ${admit.groups.name}, and nobody outside it.`
    : admit?.scope === "global"
      ? "Everyone on Sovereign."
      : admit
        ? `Everyone whose ${admit.scope} place is ${admit.place}.`
        : "Everyone the proposal that carries it is addressed to.";

  return (
    <Screen>
      <TopBar title={listing.name} back="/marketplace" />
      <Gutter className="pt-5">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Tag tone={stateTone(state)}>{STATE_LABEL[state]}</Tag>
          <Tag>{KIND_LABEL[listing.kind]}</Tag>
        </div>
        <h2 className="display text-[1.5rem] leading-tight text-paper">{listing.name}</h2>
        <p className="smallcaps mt-2 text-[10px] text-paper-faint">
          Offered by {mine ? "you" : (sellerRow?.display_name ?? "a member")} ·{" "}
          {ago(listing.created_at)}
        </p>
        <Readers className="mt-3">{audience}</Readers>

        <section className="mt-7">
          <Prose>{listing.description}</Prose>
        </section>

        <section className="mt-7">
          <SectionLabel>Terms</SectionLabel>
          <p className="whitespace-pre-wrap text-[0.95rem] leading-relaxed text-paper">
            {listing.terms}
          </p>
          <p className="mt-2 text-[0.8125rem] text-paper-faint">
            The seller&rsquo;s own words. Nothing is paid through Sovereign and
            no SOV is spent here.
          </p>
        </section>

        {listing.contact ? (
          <section className="mt-7">
            <SectionLabel>How to reach them</SectionLabel>
            <p className="text-[0.95rem] text-paper">{listing.contact}</p>
          </section>
        ) : null}

        <section className="mt-9">
          <SectionLabel>Where it stands</SectionLabel>
          <p className="text-[0.9375rem] leading-relaxed text-paper-dim">{STATE_LINE[state]}</p>
          {admit ? (
            <p className="mt-3 text-sm leading-relaxed text-paper-dim">
              Carried by{" "}
              <Link href={`/collective/proposals/${admit.id}`} className="text-gold hover:underline">
                {admit.title}
              </Link>
              <span className="text-paper-faint">
                {" — "}
                {decision
                  ? `${decision.outcome}, ${shortDate(decision.decided_at)}`
                  : (STATUS_LABEL[admit.status] ?? admit.status).toLowerCase()}
              </span>
            </p>
          ) : null}
          {listing.withdrawn_reason ? (
            <p className="mt-3 text-sm leading-relaxed text-paper-dim">
              Withdrawn {listing.withdrawn_at ? shortDate(listing.withdrawn_at) : ""}:{" "}
              {listing.withdrawn_reason}
            </p>
          ) : null}
        </section>

        {revocations.length ? (
          <section className="mt-9">
            <SectionLabel>Proposals to take it down</SectionLabel>
            <ul className="space-y-4">
              {revocations.map((r) => (
                <li key={r.id} className="text-sm leading-relaxed text-paper-dim">
                  {r.proposals ? (
                    <Link
                      href={`/collective/proposals/${r.proposals.id}`}
                      className="text-gold hover:underline"
                    >
                      {r.proposals.title}
                    </Link>
                  ) : (
                    "A proposal"
                  )}
                  <span className="text-paper-faint">
                    {" — "}
                    {r.proposals
                      ? (STATUS_LABEL[r.proposals.status] ?? r.proposals.status).toLowerCase()
                      : ""}
                    {", raised by "}
                    {r.profiles?.display_name ?? "a member"}
                  </span>
                  <span className="mt-1 block">{r.reason}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <ListingControls
          listingId={listing.id}
          mine={mine}
          state={state}
          contact={listing.contact ?? ""}
          attachable={attachable}
        />
      </Gutter>
    </Screen>
  );
}
