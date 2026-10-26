import Link from "next/link";
import { TabIntro } from "@/components/TabIntro";

import { ScaleSelector } from "@/components/nav/ScaleSelector";
import { TabActions } from "@/components/nav/TabActions";
import {
  Empty,
  Gutter,
  LinkButton,
  Readers,
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
  MyInquiry,
  DormantProposal,
  Entry,
  SignalEvent,
  WitnessFeedItem,
} from "@/lib/types";

import { PriorityTally, type TallyRow } from "@/components/spheres/PriorityTally";
import { SphereRatings } from "@/components/spheres/SphereRatings";
import { forYouFeed, topSpheres, type Rating } from "@/lib/foryou";
import { sphereName } from "@/lib/spheres";

import { AskPanel } from "../ask/AskPanel";
import { Attention, Dormant, Signal } from "./Discover";
import { Compose } from "./Compose";
import { Feed, type Counts } from "./Feed";

export const metadata = { title: "Search · Sovereign" };

/**
 * Search — the centre tab, and where you land (Mackenzie, 12 October).
 *
 * Three things, top to bottom: look something up, say something, see what
 * people are saying. Search and the feed share a tab because they are both
 * the outward-looking part of the app — what is out there — while Connection
 * holds who you are joined to. The route stays /home so every link and
 * revalidation that already points here keeps working; /ask sends here too.
 *
 * What the feed is for:
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
    { data: inquiries },
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
    // Your own past searches. Owner-only for a question not asked on a
    // proposal (rule 29), so this is nobody's but yours.
    supabase.rpc("my_inquiries", { p_limit: 30 }),
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

  const here =
    address?.kind === "group"
      ? address.group.name
      : address
        ? (address.place ?? address.label)
        : "Sovereign";

  return (
    <>
      <TopBar
        title="Search"
        action={<TabActions space="search" plus="/home#compose" plusLabel="New post" />}
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
        <TabIntro space="search" />
        {/* --------------------------------------------------------- SEARCH */}
        <section className="pt-2">
          <Gutter>
            <AskPanel mine={(inquiries ?? []) as MyInquiry[]} />
            <Readers className="mt-2">
              A search here: only you. One asked on a proposal: everyone it is addressed to.
            </Readers>
            <nav aria-label="Explore by" className="mt-4">
              <p className="smallcaps text-[11px] text-paper-faint">Explore by</p>
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {(
                  [
                    ["Proposals", "/collective/proposals"],
                    ["Decisions", "/collective/decisions"],
                    ["Your groups", "/connection#groups"],
                    ["Businesses", "/market?view=businesses"],
                    ["Words", "/home/words"],
                    ["A person, by handle", "/connection?show=people"],
                  ] as const
                ).map(([label, href]) => (
                  <li key={href}>
                    <Link
                      href={href}
                      className="press inline-block rounded-pill border border-line px-3 py-1.5 text-sm text-paper-dim hover:text-paper"
                    >
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[0.8125rem] text-paper-faint">
                People can only be found by their exact handle. There is no directory, on purpose.
              </p>
            </nav>
          </Gutter>
        </section>

        {/* -------------------------------------------------------- COMPOSE */}
        <section id="compose" className="scroll-mt-16 pt-5">
          <Gutter>
            <Compose
              hasGroup={Boolean(group)}
              places={{
                regional: profile.place_regional ?? null,
                national: profile.place_national ?? null,
                continental: profile.place_continental ?? null,
              }}
            />
          </Gutter>
        </section>

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
        <section className="pt-5">
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

            <p className="text-[0.8125rem] leading-relaxed text-paper-faint">
              <span className="font-semibold text-paper-dim">Why you see these: </span>
              {tab === "foryou"
                ? `what touches the Spheres you rated 4 or 5, in ${here}, newest first. Each item says why.`
                : tab === "following"
                  ? "posts and finished acts by people you follow, newest first. Nothing is ranked by likes."
                  : `everything you can read that was posted or decided in ${here}, newest first.`}
            </p>

            {tab === "foryou" ? (
              <div className="rounded-card border border-line bg-surface-soft p-4">
                {top.length ? (
                  <>
                    <div className="mb-3 flex items-baseline justify-between gap-3">
                      <p className="smallcaps text-[11px] text-paper-faint">What matters in {here}</p>
                      <Link href="/individual/self/matters" className="text-xs text-gold">
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
                      Rate the Spheres. For you fills with what touches them. {here} sees only the total.
                    </p>
                    <SphereRatings initial={Object.fromEntries(ratings.map((r) => [r.sphere_id, r.rating]))} compact />
                  </>
                )}
              </div>
            ) : null}

            {tab === "discover" && !address ? (
              <Empty
                action={
                  <LinkButton href="/settings/place" tone="gold">
                    Say where you are
                  </LinkButton>
                }
              >
                Discover shows what is happening where you are, or in your group. Tell Sovereign where you are to fill it.
              </Empty>
            ) : tab === "foryou" && !top.length ? null : (
              <Feed
                items={items}
                kept={kept}
                counts={counts}
                ad={ad}
                reasons={reasons}
                empty={
                  tab === "foryou"
                    ? `Nothing in your Spheres in ${here} yet. Be the first to propose.`
                    : tab === "discover"
                      ? `Nothing has been posted or decided in ${here} yet.`
                      : "You aren't following anyone yet, or they haven't posted. Discover shows everyone near you."
                }
                emptyAction={
                  tab === "foryou" ? (
                    <LinkButton href="/collective/proposals/new" tone="gold">
                      Write a proposal
                    </LinkButton>
                  ) : tab === "discover" ? (
                    <LinkButton href="#compose" tone="gold">
                      Post the first thing
                    </LinkButton>
                  ) : (
                    <LinkButton href="/home?feed=discover" tone="gold">
                      Open Discover
                    </LinkButton>
                  )
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
