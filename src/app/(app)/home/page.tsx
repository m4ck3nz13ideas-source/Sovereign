import Link from "next/link";

import { ScaleSelector } from "@/components/nav/ScaleSelector";
import {
  Empty,
  Gutter,
  LinkButton,
  Screen,
  SectionLabel,
  TopBar,
} from "@/components/ui";
import { addressOptions, currentAddress } from "@/lib/address";
import { ago } from "@/lib/format";
import { requireSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import type {
  AttentionItem,
  DormantProposal,
  Entry,
  SignalEvent,
  WitnessFeedItem,
} from "@/lib/types";

import { Attention, Dormant, Signal } from "./Discover";
import { Compose } from "./Compose";
import { Feed } from "./Feed";
import { TheRuleHere } from "./TheRuleHere";

export const metadata = { title: "Sovereign" };

/**
 * Home — the feed, and where you land.
 *
 *   "Users see three types of content: active proposals, important updates,
 *    verified knowledge. Purpose: help people discover important issues,
 *    prevent overload, show signal over noise."
 *
 * The scale selector sits at the top, as Rule 6 requires: local, regional,
 * national, continental, global should always be obvious.
 *
 * The ordering is the argument. What is waiting on you comes first, with the
 * reason attached, because a feed sorted by recency asks everyone to read
 * everything and that is how people stop reading anything. Then what deserves
 * another look. Then what actually happened. Then the people.
 *
 * Nothing here is ranked by attention, and there is no count on anything you
 * could compete over. Rule 1: calm over noise.
 */
export default async function HomePage() {
  const session = await requireSession();
  const { profile, group } = session;
  const address = await currentAddress(session);
  const supabase = await createClient();

  const scope = address?.kind === "place" ? address.scope : null;
  const groupId = address?.kind === "group" ? address.group.id : null;
  const args = { p_group_id: groupId, p_scope: scope };

  const [
    { data: ready },
    { data: feed },
    { data: attention },
    { data: dormant },
    { data: signal },
    { data: keeps },
  ] = await Promise.all([
    supabase
      .from("entries")
      .select("*")
      .eq("profile_id", profile.id)
      .eq("mode", "output")
      .eq("state", "unexamined")
      .order("created_at", { ascending: false })
      .limit(10),
    // One feed: what people wrote and what they did, in time order. There is
    // no second sort key and no field to make one out of — see Feed.tsx.
    supabase.rpc("witness_feed", { p_limit: 40 }),
    address ? supabase.rpc("attention_queue", args) : Promise.resolve({ data: [] }),
    address
      ? supabase.rpc("dormant_proposals", { ...args, p_limit: 6 })
      : Promise.resolve({ data: [] }),
    address
      ? supabase.rpc("signal_feed", { ...args, p_limit: 12 })
      : Promise.resolve({ data: [] }),
    // Your own keeps, so the card can show which ones are yours. Nobody
    // else's is readable and there is no count anywhere.
    supabase.from("post_reactions").select("post_id").eq("profile_id", profile.id),
  ]);

  const queue = (attention ?? []) as AttentionItem[];
  const sleeping = (dormant ?? []) as DormantProposal[];
  const events = (signal ?? []) as SignalEvent[];
  const items = (feed ?? []) as WitnessFeedItem[];
  const kept = new Set(((keeps ?? []) as { post_id: string }[]).map((k) => k.post_id));

  // The bar every decision at this address has to clear. Shown because it was
  // invisible: the numbers live in scope_rules, which is readable by everyone
  // and was read by nothing.
  const { data: ruleRow } =
    scope !== null
      ? await supabase
          .from("scope_rules")
          .select("min_voices, threshold_alignment, deliberation_days")
          .eq("scope", scope)
          .maybeSingle()
      : { data: null };

  const here =
    address?.kind === "group"
      ? address.group.name
      : address
        ? (address.place ?? address.label)
        : "Sovereign";

  return (
    <>
      <TopBar
        title={here}
        action={
          <div className="flex items-center">
            {/* Writing lives here rather than in the tab bar. A raised centre
                button is the shape of an app whose purpose is posting. */}
            <Link
              href="/write"
              aria-label="Write"
              className="press flex h-10 w-10 items-center justify-center rounded-full text-gold active:bg-surface"
            >
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden>
                <path
                  d="M12 5v14M5 12h14"
                  stroke="currentColor"
                  strokeWidth="2.25"
                  strokeLinecap="round"
                />
              </svg>
            </Link>
            <Link
              href="/settings"
              aria-label="Settings"
              className="press flex h-10 w-10 items-center justify-center rounded-full text-paper-dim active:bg-surface"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden>
                <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.75" />
                <path
                  d="M12 3.5v2M12 18.5v2M20.5 12h-2M5.5 12h-2M18 6l-1.4 1.4M7.4 16.6 6 18M18 18l-1.4-1.4M7.4 7.4 6 6"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                />
              </svg>
            </Link>
          </div>
        }
      >
        {address ? (
          <ScaleSelector
            options={addressOptions(session)}
            current={
              address.kind === "group"
                ? `group:${address.group.id}`
                : `scope:${address.scope}`
            }
          />
        ) : null}
      </TopBar>

      <Screen>
        {scope !== null && ruleRow ? (
          <TheRuleHere
            scope={scope}
            minVoices={ruleRow.min_voices as number}
            threshold={Number(ruleRow.threshold_alignment)}
            deliberationDays={ruleRow.deliberation_days as number}
          />
        ) : null}

        {ready?.length ? (
          <section className="pt-4">
            <Gutter>
              <SectionLabel>Ready to share</SectionLabel>
            </Gutter>
            <Gutter className="space-y-2">
              {(ready as Entry[]).map((e) => (
                <Compose
                  key={e.id}
                  entryId={e.id}
                  initialBody={e.body}
                  when={ago(e.created_at)}
                  hasGroup={Boolean(group)}
                />
              ))}
            </Gutter>
          </section>
        ) : null}

        {/* ------------------------------------------------- WAITING ON YOU */}
        <section className="pt-5">
          <Gutter>
            <SectionLabel
              right={
                <Link href="/collective/proposals" className="text-gold">
                  all
                </Link>
              }
            >
              Waiting on you
            </SectionLabel>
          </Gutter>

          <Gutter>
            <Attention items={queue} />
          </Gutter>

          {!queue.length ? (
            <Gutter className="mt-4">
              <LinkButton href="/collective/proposals/new" tone="gold">
                Write a proposal
              </LinkButton>
            </Gutter>
          ) : null}
        </section>

        <div className="pt-8">
          <Gutter>
            <Dormant items={sleeping} />
            <Signal events={events} />
          </Gutter>
        </div>

        {/* ------------------------------------------------------------ FEED */}
        {/* What people wrote and what they did, in one stream in time order.
            Nothing is ranked, nothing is counted, and resonance is absent on
            purpose — see Feed.tsx and rule 20. */}
        <section className="pt-2">
          <Gutter>
            <SectionLabel
              right={
                <Link href="/settings/feed" className="text-gold">
                  filter
                </Link>
              }
            >
              What people are doing
            </SectionLabel>
          </Gutter>

          <Gutter className="space-y-3">
            <Compose hasGroup={Boolean(group)} />
            <Feed items={items} kept={kept} />
          </Gutter>
        </section>

        {!profile.place_set_at ? (
          <Gutter className="mt-8">
            <Empty
              action={
                <LinkButton href="/settings/place" tone="gold">
                  Say where you are
                </LinkButton>
              }
            >
              Nobody has to invite you into anything. Write down where you are —
              a street, a city, a country — and the proposals addressed to those
              places become yours to read, answer and write. A group is the other
              way in, and entirely optional.
            </Empty>
          </Gutter>
        ) : null}
      </Screen>
    </>
  );
}

export const dynamic = "force-dynamic";
