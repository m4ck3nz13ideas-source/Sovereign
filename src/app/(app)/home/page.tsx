import Link from "next/link";

import { ScaleSelector } from "@/components/nav/ScaleSelector";
import { ChatsLink, TabActions } from "@/components/nav/TabActions";
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
import type { Ad } from "@/lib/marketplace";
import type {
  AttentionItem,
  DormantProposal,
  Entry,
  SignalEvent,
  WitnessFeedItem,
} from "@/lib/types";

import { Attention, Dormant, Signal } from "./Discover";
import { Compose } from "./Compose";
import { Feed, type Counts } from "./Feed";

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

  // Likes and comments for what is on screen (public counts; the order above
  // never reads them), and one ad chosen by fit with this viewer.
  const postIds = items.filter((i) => i.source === "post").map((i) => i.item_id);
  const [{ data: countRows }, { data: adRows }] = await Promise.all([
    postIds.length
      ? supabase.rpc("post_counts", { p_ids: postIds })
      : Promise.resolve({ data: [] }),
    supabase.rpc("pick_ad"),
  ]);
  const counts: Counts = {};
  for (const c of (countRows ?? []) as { post_id: string; likes: number; comments: number; i_liked: boolean }[]) {
    counts[c.post_id] = { likes: c.likes, comments: c.comments, i_liked: c.i_liked };
  }
  const ad = ((adRows ?? []) as Ad[])[0] ?? null;

  // The bar every decision at this address has to clear. Shown because it was
  // invisible: the numbers live in scope_rules, which is readable by everyone
  // and was read by nothing.

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
            <ChatsLink />
            <TabActions plus="/home#compose" plusLabel="New post" />
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

        {/* ------------------------------------------------------------ FEED */}
        {/* What people wrote and what they did, in one stream in time order.
            Likes are counted and shown but never order it, and resonance is absent on
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
              Feed
            </SectionLabel>
          </Gutter>

          <Gutter className="space-y-3">
            <div id="compose" className="scroll-mt-16">
              <Compose hasGroup={Boolean(group)} />
            </div>
            <Feed items={items} kept={kept} counts={counts} ad={ad} />
          </Gutter>
        </section>

        {/* ------------------------------------------------- WAITING ON YOU */}
        {queue.length ? (
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

        </section>
        ) : null}

        <div className="pt-8">
          <Gutter>
            <Dormant items={sleeping} />
            <Signal events={events} />
          </Gutter>
        </div>

        {!profile.place_set_at ? (
          <Gutter className="mt-8">
            <Empty
              action={
                <LinkButton href="/settings/place" tone="gold">
                  Say where you are
                </LinkButton>
              }
            >
              Where are you?
            </Empty>
          </Gutter>
        ) : null}
      </Screen>
    </>
  );
}

export const dynamic = "force-dynamic";
