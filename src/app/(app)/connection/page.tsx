import Link from "next/link";

import { CollectiveTabs } from "@/components/nav/CollectiveTabs";
import { ScaleSelector } from "@/components/nav/ScaleSelector";
import { Empty, Page, PageTitle, SectionLabel, Tag } from "@/components/ui";
import { addressOptions, currentAddress } from "@/lib/address";
import { ago, STATUS_LABEL } from "@/lib/format";
import { requireSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import type { Entry, Post, Proposal } from "@/lib/types";

import { FeedItem } from "./FeedItem";
import { ReadyToShare } from "./ReadyToShare";

export const metadata = { title: "Connection · Sovereign" };

/**
 * Connection — outward contribution: posting, reading others, engaging.
 *
 * Output banners from Launch sit in a thin strip above the feed. The feed
 * itself is warm and intellectual, not social-media frantic: no trending, no
 * algorithmic noise labels, no counts on anything but replies.
 */
export default async function ConnectionPage() {
  const session = await requireSession();
  const { profile, group } = session;
  const address = await currentAddress(session);
  const supabase = await createClient();

  const [{ data: ready }, { data: posts }, { data: open }] = await Promise.all([
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
      ? (address.kind === "group"
          ? supabase
              .from("proposals")
              .select("id, title, status, submitted_at")
              .eq("group_id", address.group.id)
          : supabase
              .from("proposals")
              .select("id, title, status, submitted_at")
              .is("group_id", null)
              .eq("scope", address.scope)
        )
          .in("status", ["in_review", "in_deliberation", "voting"])
          .order("submitted_at", { ascending: false })
          .limit(3)
      : Promise.resolve({ data: [] as Proposal[] }),
  ]);

  return (
    <Page>
      <PageTitle
        sub={
          address
            ? address.kind === "group"
              ? address.group.name
              : (address.place ?? address.label)
            : "Say where you are, and proposals will find you."
        }
      >
        Connection
      </PageTitle>

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

      {open?.length ? (
        <section className="mb-8">
          <SectionLabel right={<Link href="/connection/proposals" className="hover:text-gold">all</Link>}>
            {address?.kind === "group" ? "Waiting on the group" : "Waiting on a response"}
          </SectionLabel>
          <ul className="space-y-2">
            {(open as Proposal[]).map((p) => (
              <li key={p.id}>
                <Link
                  href={`/connection/proposals/${p.id}`}
                  className="flex items-center justify-between gap-3 rounded-card border border-line bg-surface-soft px-4 py-3 transition-colors hover:border-gold-dim"
                >
                  <span className="min-w-0 truncate text-[0.95rem] text-paper">
                    {p.title}
                  </span>
                  <Tag tone={p.status === "voting" ? "gold" : "neutral"}>
                    {STATUS_LABEL[p.status]}
                  </Tag>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section>
        <SectionLabel>From the people you follow</SectionLabel>

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
