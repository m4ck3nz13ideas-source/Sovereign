import Link from "next/link";

import {
  Empty,
  Gutter,
  PillLink,
  Rail,
  Readers,
  Screen,
  SectionLabel,
  Tag,
  TopBar,
} from "@/components/ui";
import { ago, firstLine } from "@/lib/format";
import {
  KIND_LABEL,
  KIND_PLURAL,
  STATE_LABEL,
  isListingKind,
  stateTone,
  whereLabel,
} from "@/lib/marketplace";
import { requireSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { LISTING_KINDS, type Listing, type ListingState, type MarketListing } from "@/lib/types";

export const metadata = { title: "Marketplace · Sovereign" };

/**
 * The marketplace (rule 37): products, services and businesses a group has
 * admitted by passing a proposal.
 *
 * WHY THERE IS NO APPROVE BUTTON ANYWHERE
 *
 * "Sovereign-approved" could have meant a queue and somebody with a role
 * ticking things — and whoever holds that tick holds the market. Here nobody
 * approves anything. A listing rides on a proposal, and is listed exactly when
 * the proposal passes: reviewed, audited against the ten laws, deliberated and
 * resonated with by the people it is addressed to. It comes down the same way.
 *
 * WHY THE ORDER IS WHAT IT IS
 *
 * Nearest scale first, then most recently admitted. Nothing else orders it:
 * there is no boost, no rating, no view count and nothing anybody can pay for,
 * because a marketplace that sorts sellers is a marketplace somebody will pay
 * to be sorted in. No money or SOV moves here — the terms are the seller's
 * own words and the trade happens between people.
 */
export default async function MarketplacePage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string }>;
}) {
  const { kind } = await searchParams;
  const filter = isListingKind(kind) ? kind : null;

  const { userId, groups } = await requireSession();
  const supabase = await createClient();

  const [{ data: listedRows, error }, { data: mineRows }] = await Promise.all([
    supabase.rpc("marketplace", { p_kind: filter }),
    supabase
      .from("listings")
      .select("*")
      .eq("offered_by", userId)
      .order("created_at", { ascending: false }),
  ]);

  // 0030 not applied yet: say so, rather than an empty market that looks real.
  const missing = Boolean(error && /marketplace|listing/i.test(error.message));

  const listed = (listedRows ?? []) as MarketListing[];
  const mine = (mineRows ?? []) as Listing[];

  const mineStates = new Map<string, ListingState>();
  await Promise.all(
    mine.map(async (l) => {
      const { data } = await supabase.rpc("listing_state", { p_listing_id: l.id });
      mineStates.set(l.id, (data as ListingState) ?? "pending");
    }),
  );

  const sellerIds = Array.from(new Set(listed.map((l) => l.offered_by)));
  const { data: sellerRows } = sellerIds.length
    ? await supabase.from("profiles").select("id, display_name").in("id", sellerIds)
    : { data: [] };
  const sellers = new Map(
    (sellerRows ?? []).map((p) => [p.id as string, p.display_name as string]),
  );
  const groupNames = new Map(groups.map((g) => [g.id, g.name]));

  return (
    <Screen>
      <TopBar
        title="Marketplace"
        action={
          <Link
            href="/marketplace/offer"
            className="press rounded-pill bg-surface px-3.5 py-1.5 text-[0.8125rem] font-medium text-paper active:bg-surface-lift"
          >
            Offer
          </Link>
        }
      >
        <Rail>
          <PillLink href="/marketplace" active={!filter}>
            Everything
          </PillLink>
          {LISTING_KINDS.map((k) => (
            <PillLink key={k} href={`/marketplace?kind=${k}`} active={filter === k}>
              {KIND_PLURAL[k]}
            </PillLink>
          ))}
        </Rail>
      </TopBar>

      <Gutter>
        <p className="mt-4 text-[0.9375rem] leading-relaxed text-paper-dim">
          What the groups and places you belong to have admitted. Nobody
          approves a listing here — it rides on a proposal and is listed when
          that proposal passes, and it comes down the same way.
        </p>
        <Readers className="mt-2 mb-5">
          Each listing: everyone the proposal that admitted it was addressed to,
          and nobody else.
        </Readers>
      </Gutter>

      {missing ? (
        <Gutter>
          <Empty>
            The marketplace is not in this database yet. Migration 0030 adds it.
          </Empty>
        </Gutter>
      ) : listed.length ? (
        <ul className="border-t border-line-soft">
          {listed.map((l) => (
            <li key={l.id}>
              <Link
                href={`/marketplace/${l.id}`}
                className="press block border-b border-line-soft px-5 py-4 active:bg-surface-soft"
              >
                <div className="mb-1.5 flex flex-wrap items-center gap-2">
                  <Tag>{KIND_LABEL[l.kind]}</Tag>
                  <span className="smallcaps text-[10px] text-paper-faint">
                    {whereLabel(l, groupNames)}
                  </span>
                </div>
                <p className="text-[1.0625rem] leading-snug text-paper">{l.name}</p>
                <p className="mt-1 text-sm leading-relaxed text-paper-dim">
                  {firstLine(l.description, 140)}
                </p>
                <p className="smallcaps mt-2 text-[10px] text-paper-faint">
                  {sellers.get(l.offered_by) ?? "A member"} · admitted {ago(l.listed_at)}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <Gutter>
          <Empty>
            {filter
              ? `No ${KIND_PLURAL[filter].toLowerCase()} have been admitted where you are yet.`
              : "Nothing has been admitted where you are yet. Something gets here when a proposal carrying it passes."}
          </Empty>
        </Gutter>
      )}

      {mine.length ? (
        <Gutter className="mt-10">
          <SectionLabel>What you have offered</SectionLabel>
          <ul>
            {mine.map((l) => {
              const state = mineStates.get(l.id) ?? "pending";
              return (
                <li key={l.id}>
                  <Link
                    href={`/marketplace/${l.id}`}
                    className="press flex items-baseline justify-between gap-3 border-b border-line-soft py-3"
                  >
                    <span className="min-w-0 truncate text-paper">{l.name}</span>
                    <Tag tone={stateTone(state)}>{STATE_LABEL[state]}</Tag>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Gutter>
      ) : null}

      <Gutter className="mt-10">
        <SectionLabel>How something gets here</SectionLabel>
        <div className="space-y-3 pb-4 text-sm leading-relaxed text-paper-faint">
          <p>
            Write a proposal to the people you want to trade with, then attach
            what you are offering to it before anybody has responded. They read
            it, the reviewer audits it against the ten laws, and they decide.
            If it passes, it is listed for exactly the people who decided.
          </p>
          <p>
            Anyone it reaches can propose taking it down, to the same people
            who admitted it. If that passes, it comes down; if it fails, it
            stays. Both stay on the record.
          </p>
          <p>
            Nothing here is paid for, ranked or promoted, and no SOV is spent.
            The terms are the seller&rsquo;s own words; the trade happens
            between you.
          </p>
        </div>
      </Gutter>
    </Screen>
  );
}
