import Link from "next/link";

import { CollectiveTabs } from "@/components/nav/CollectiveTabs";
import { ScaleSelector } from "@/components/nav/ScaleSelector";
import { Empty, LinkButton, Page, PageTitle, SectionLabel } from "@/components/ui";
import { addressOptions, currentAddress } from "@/lib/address";
import { ago } from "@/lib/format";
import { requireSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import type {
  AttentionItem,
  DormantProposal,
  Entry,
  Post,
  SignalEvent,
} from "@/lib/types";

import { Attention, Dormant, Signal } from "./Discover";
import { FeedItem } from "./FeedItem";
import { ReadyToShare } from "./ReadyToShare";

export const metadata = { title: "Connection · Sovereign" };

/**
 * Connection — the discovery layer, and then the people.
 *
 *   "Users see three types of content: active proposals, important updates,
 *    verified knowledge. Purpose: help people discover important issues,
 *    prevent overload, show signal over noise."
 *
 * The ordering is the argument. What is waiting on you comes first, with the
 * reason attached, because a feed sorted by recency asks everyone to read
 * everything and that is how people stop reading anything. Then what deserves
 * another look. Then what actually happened, read off the ledger. Then the
 * posts, which are the only part of this page that is social.
 *
 * Nothing is ranked by engagement. There is no engagement.
 */
export default async function ConnectionPage() {
  const session = await requireSession();
  const { profile, group } = session;
  const address = await currentAddress(session);
  const supabase = await createClient();

  const scope = address?.kind === "place" ? address.scope : null;
  const groupId = address?.kind === "group" ? address.group.id : null;
  const args = { p_group_id: groupId, p_scope: scope };

  const [
    { data: ready },
    { data: posts },
    { data: attention },
    { data: dormant },
    { data: signal },
  ] = await Promise.all([
    supabase
      .from("entries")
      .select("*")
      .eq("profile_id", profile.id)
      .eq("mode", "output")
      .eq("state", "unexamined")
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("posts")
      .select("*, profiles(display_name), post_reactions(profile_id)")
      .order("created_at", { ascending: false })
      .limit(40),
    address
      ? supabase.rpc("attention_queue", args)
      : Promise.resolve({ data: [] }),
    address
      ? supabase.rpc("dormant_proposals", { ...args, p_limit: 6 })
      : Promise.resolve({ data: [] }),
    address
      ? supabase.rpc("signal_feed", { ...args, p_limit: 12 })
      : Promise.resolve({ data: [] }),
  ]);

  const queue = (attention ?? []) as AttentionItem[];
  const sleeping = (dormant ?? []) as DormantProposal[];
  const events = (signal ?? []) as SignalEvent[];

  const here =
    address?.kind === "group"
      ? address.group.name
      : address
        ? (address.place ?? address.label)
        : "Say where you are, and proposals will find you.";

  return (
    <Page>
      <PageTitle sub={here}>Connection</PageTitle>

      <CollectiveTabs />

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

      {ready?.length ? (
        <section className="mb-8">
          <SectionLabel>Ready to share</SectionLabel>
          <div className="space-y-2">
            {(ready as Entry[]).map((e) => (
              <ReadyToShare
                key={e.id}
                id={e.id}
                body={e.body}
                when={ago(e.created_at)}
                hasGroup={Boolean(group)}
              />
            ))}
          </div>
        </section>
      ) : null}

      {/* ------------------------------------------------- WAITING ON YOU */}
      <section className="mb-10">
        <SectionLabel
          right={
            <Link href="/connection/proposals" className="hover:text-gold">
              all
            </Link>
          }
        >
          Waiting on you
        </SectionLabel>
        <Attention items={queue} />

        {!queue.length ? (
          <div className="mt-4">
            <LinkButton href="/connection/proposals/new" tone="gold">
              Write a proposal
            </LinkButton>
          </div>
        ) : null}
      </section>

      {/* ----------------------------------------------------- DORMANT */}
      <Dormant items={sleeping} />

      {/* ------------------------------------------------------ SIGNAL */}
      <Signal events={events} />

      {/* ------------------------------------------------------- PEOPLE */}
      <section>
        <SectionLabel>From the people you share a place with</SectionLabel>

        {posts?.length ? (
          <ul className="space-y-3">
            {posts.map((raw) => {
              const post = raw as unknown as Post & {
                profiles: { display_name: string } | null;
                post_reactions: { profile_id: string }[];
              };
              return (
                <li key={post.id}>
                  <FeedItem
                    id={post.id}
                    author={post.profiles?.display_name ?? "A member"}
                    body={post.body}
                    when={ago(post.created_at)}
                    sourceTag={post.source_tag}
                    reactions={post.post_reactions?.length ?? 0}
                    reacted={
                      post.post_reactions?.some((r) => r.profile_id === profile.id) ?? false
                    }
                    mine={post.author_id === profile.id}
                  />
                </li>
              );
            })}
          </ul>
        ) : (
          <Empty>
            Nothing here yet. What you write in Launch under Output arrives above
            as something you can choose to post — or not.
          </Empty>
        )}
      </section>

      {!profile.place_set_at ? (
        <div className="mt-8">
          <Empty
            action={
              <Link
                href="/settings/place"
                className="smallcaps inline-flex rounded-md bg-gold px-4 py-2.5 text-xs text-ink"
              >
                Say where you are
              </Link>
            }
          >
            Nobody has to invite you into anything. Write down where you are —
            a street, a city, a country — and the proposals addressed to those
            places become yours to read, answer and write. A group is the other
            way in, and entirely optional.
          </Empty>
        </div>
      ) : null}
    </Page>
  );
}

export const dynamic = "force-dynamic";
