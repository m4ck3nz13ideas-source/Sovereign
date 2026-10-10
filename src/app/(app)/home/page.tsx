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

import { PriorityTally, type TallyRow } from "@/components/spheres/PriorityTally";
import { SphereRatings } from "@/components/spheres/SphereRatings";
import { forYouFeed, topSpheres, type Rating } from "@/lib/foryou";
import { sphereName } from "@/lib/spheres";

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
type FeedTab = "foryou" | "following" | "discover";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ feed?: string }>;
}) {
  const { feed: rawTab } = await searchParams;
  const session = await requireSession();
  const { profile, group } = session;
  const address = await currentAddress(session);
  const supabase = await createClient();

  const scope = address?.kind === "place" ? address.scope : null;
  const groupId = address?.kind === "group" ? address.group.id : null;
  const args = { p_group_id: groupId, p_scope: scope };

  // Three feeds (0047). Following is the people you follow, as it always was.
  // For you and Discover are about the address chosen at the top.
  const { data: ratingRows } = await supabase
    .from("sphere_priorities")
    .select("sphere_id, rating")
    .eq("profile_id", profile.id);
  const ratings = (ratingRows ?? []) as Rating[];
  const top = topSpheres(ratings);
  const tab: FeedTab =
    rawTab === "following" || rawTab === "discover" || rawTab === "foryou"
      ? rawTab
      : top.length
        ? "foryou"
        : "following";

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
    tab === "discover"
      ? address
        ? supabase.rpc("discover_feed", { ...args, p_limit: 40 })
        : Promise.resolve({ data: [] })
      : supabase.rpc("witness_feed", { p_limit: tab === "foryou" ? 80 : 40 }),
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
  let items = (feed ?? []) as WitnessFeedItem[];
  let reasons: Record<string, string> = {};
  let tally: TallyRow[] = [];

  if (tab === "foryou" && address) {
    // Everything readable here — the people you follow and everyone else at
    // this address — then only what touches the Spheres you rated 4 or 5.
    const [{ data: wider }, { data: tallyRows }] = await Promise.all([
      supabase.rpc("discover_feed", { ...args, p_limit: 80 }),
      supabase.rpc("sphere_priority_tally", args),
    ]);
    tally = (tallyRows ?? []) as TallyRow[];
    const all = [...items, ...((wider ?? []) as WitnessFeedItem[])];

    const proposalIds = new Set<string>();
    const projectIds = new Set<string>();
    for (const i of all) {
      if (i.source !== "act" || !i.subject_id) continue;
      if (i.subject_type === "proposal") proposalIds.add(i.subject_id);
      if (i.subject_type === "project") projectIds.add(i.subject_id);
    }
    const { data: projectRows } = projectIds.size
      ? await supabase.from("projects").select("id, proposal_id").in("id", [...projectIds])
      : { data: [] };
    const projectToProposal = new Map(
      ((projectRows ?? []) as { id: string; proposal_id: string }[]).map((p) => [p.id, p.proposal_id]),
    );
    for (const pid of projectToProposal.values()) proposalIds.add(pid);
    const { data: tagRows } = proposalIds.size
      ? await supabase.from("proposals").select("id, sphere, spheres_also").in("id", [...proposalIds])
      : { data: [] };
    const tags = new Map(
      ((tagRows ?? []) as { id: string; sphere: string | null; spheres_also: string[] | null }[]).map((p) => [
        p.id,
        [p.sphere, ...(p.spheres_also ?? [])].filter(Boolean) as string[],
      ]),
    );
    const tagged = new Map<string, string[]>();
    for (const i of all) {
      if (i.source !== "act" || !i.subject_id) continue;
      const pid = i.subject_type === "project" ? projectToProposal.get(i.subject_id) : i.subject_id;
      if (pid) tagged.set(i.item_id, tags.get(pid) ?? []);
    }
    ({ items, reasons } = forYouFeed(all, tagged, top));
    items = items.slice(0, 40);
  }
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
            <TabActions plus="/home?feed=following#compose" plusLabel="New post" />
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
            <nav className="flex gap-1.5" aria-label="Feeds">
              {(
                [
                  ["foryou", "For you"],
                  ["following", "Following"],
                  ["discover", "Discover"],
                ] as const
              ).map(([id, label]) => (
                <Link
                  key={id}
                  href={`/home?feed=${id}`}
                  aria-current={tab === id ? "page" : undefined}
                  className={`press rounded-pill px-3.5 py-1.5 text-sm font-semibold ${
                    tab === id ? "bg-gold text-ink" : "bg-surface text-paper-dim"
                  }`}
                >
                  {label}
                </Link>
              ))}
            </nav>

            {tab === "foryou" ? (
              <div className="rounded-card border border-line bg-surface-soft p-4">
                {top.length ? (
                  <>
                    <div className="mb-3 flex items-baseline justify-between gap-3">
                      <p className="smallcaps text-[11px] text-paper-faint">What matters in {here}</p>
                      <Link href="/individual/self#matters" className="text-xs text-gold">
                        your ratings
                      </Link>
                    </div>
                    <PriorityTally rows={tally} here={here} />
                    <p className="mt-3 text-[0.8125rem] text-paper-faint">
                      Showing what touches {top.map((t) => sphereName(t)).join(", ")}, newest first.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="font-serif text-lg text-paper">What matters most to you?</p>
                    <p className="mt-1 mb-2 text-[0.9rem] text-paper-dim">
                      Rate the Spheres and For you shows what&apos;s happening in them. Your ratings are yours; {here} sees
                      only the total.
                    </p>
                    <SphereRatings initial={Object.fromEntries(ratings.map((r) => [r.sphere_id, r.rating]))} compact />
                  </>
                )}
              </div>
            ) : null}

            {tab === "following" ? (
              <div id="compose" className="scroll-mt-16">
                <Compose
                  hasGroup={Boolean(group)}
                  places={{
                    regional: profile.place_regional ?? null,
                    national: profile.place_national ?? null,
                    continental: profile.place_continental ?? null,
                  }}
                />
              </div>
            ) : null}

            {tab === "discover" && !address ? (
              <Empty>Say where you are, or join a group, to discover what&apos;s happening around you.</Empty>
            ) : tab === "foryou" && !top.length ? null : (
              <Feed
                items={items}
                kept={kept}
                counts={counts}
                ad={ad}
                reasons={reasons}
                empty={
                  tab === "foryou"
                    ? `Nothing in your Spheres in ${here} yet.`
                    : tab === "discover"
                      ? `Nothing new from people you don't follow in ${here} yet.`
                      : undefined
                }
              />
            )}
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
