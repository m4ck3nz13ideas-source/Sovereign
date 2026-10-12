import Link from "next/link";

import { Compose } from "@/app/(app)/home/Compose";
import { Feed } from "@/app/(app)/home/Feed";
import { Empty, Gutter, Prose, Screen, SectionLabel, Tag, TopBar } from "@/components/ui";
import { pageFeed } from "@/lib/page-feed";
import { requireSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import type { Group } from "@/lib/types";

import { DecideButton } from "../../DecideButton";
import { AboutEditor } from "./AboutEditor";

export const metadata = { title: "Group · Sovereign" };

/**
 * A group's page (0053): the rundown — what it is for, what it is trying to
 * do, the values it holds and the values its members share — then its media
 * and its feed, for everyone in it and nobody else.
 *
 * "Values its members share" is counted, never listed by person, from members
 * who chose to share their values, and only where two or more name the same
 * one. That is `group_shared_values()`; this screen only draws it.
 */
export default async function GroupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { userId, groups } = await requireSession();
  const mine = groups.find((g) => g.id === id);

  if (!mine) {
    return (
      <>
        <TopBar title="Group" back="/connection" />
        <Screen>
          <Gutter className="pt-6">
            <Empty>This page is for the group&rsquo;s members. Groups are by invitation.</Empty>
          </Gutter>
        </Screen>
      </>
    );
  }

  const supabase = await createClient();
  const [{ data: groupRow }, { data: shared }, { data: memberRows }, feed] = await Promise.all([
    supabase.from("groups").select("*").eq("id", id).maybeSingle(),
    supabase.rpc("group_shared_values", { p_group: id }),
    supabase.from("group_members").select("profile_id, role").eq("group_id", id),
    pageFeed({ groupId: id }, userId),
  ]);
  const group = (groupRow ?? mine) as Group;
  const sharedValues = (shared ?? []) as { value: string; holders: number }[];
  const members = (memberRows ?? []) as { profile_id: string; role: string }[];
  const { data: names } = members.length
    ? await supabase
        .from("public_profiles")
        .select("id, display_name")
        .in("id", members.map((m) => m.profile_id).slice(0, 60))
    : { data: [] };
  const people = ((names ?? []) as { id: string; display_name: string }[]).sort((a, b) =>
    a.display_name.localeCompare(b.display_name),
  );
  const steward = mine.role === "owner" || mine.role === "steward";
  const stated = group.group_values ?? [];

  return (
    <>
      <TopBar title={group.name} back="/connection" />
      <Screen>
        <Gutter className="space-y-8 pt-6 pb-8">
          {/* --------------------------------------------------- RUNDOWN */}
          <header className="text-center">
            <h2 className="display text-[1.75rem] leading-tight text-paper">{group.name}</h2>
            <p className="smallcaps mt-2 text-[10px] text-paper-faint">
              {group.scope} · {members.length} {members.length === 1 ? "member" : "members"}
            </p>
            <div className="mt-4 flex justify-center gap-2">
              <Link href={`/chats/group/${id}`} className="press rounded-pill bg-gold px-4 py-2 text-sm font-semibold text-ink">
                Chat
              </Link>
              <DecideButton groupId={id} className="press rounded-pill border border-line px-4 py-2 text-sm font-semibold text-paper">
                Decide
              </DecideButton>
            </div>
          </header>

          <section>
            <SectionLabel>What it is for</SectionLabel>
            {group.purpose ? <Prose>{group.purpose}</Prose> : <Empty>No purpose written yet.</Empty>}
          </section>

          <section>
            <SectionLabel>What it is trying to do</SectionLabel>
            {group.goal ? <Prose>{group.goal}</Prose> : <Empty>No goal written yet.</Empty>}
          </section>

          <section>
            <SectionLabel>Its values</SectionLabel>
            {stated.length ? (
              <ul className="flex flex-wrap justify-center gap-2">
                {stated.map((v) => (
                  <li key={v}>
                    <Tag tone="gold">{v}</Tag>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>The stewards have not named its values yet.</Empty>
            )}
          </section>

          <section>
            <SectionLabel>Values members share</SectionLabel>
            {sharedValues.length ? (
              <ul className="flex flex-wrap justify-center gap-2">
                {sharedValues.map((v) => (
                  <li key={v.value}>
                    <Tag>
                      {v.value} · {v.holders}
                    </Tag>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>Shows once two members who share their values name the same one.</Empty>
            )}
            <p className="mt-2 text-center text-[0.8125rem] text-paper-faint">
              Counted from members who chose to share their values. Never who.
            </p>
          </section>

          {steward ? (
            <AboutEditor groupId={id} purpose={group.purpose ?? ""} goal={group.goal ?? ""} values={stated} />
          ) : null}

          {/* ----------------------------------------------------- MEDIA */}
          {feed.media.length ? (
            <section>
              <SectionLabel>Media</SectionLabel>
              <ul className="grid grid-cols-3 gap-1.5">
                {feed.media.slice(0, 9).map((m) => (
                  <li key={m.item_id}>
                    <a href={m.media_url!} target="_blank" rel="noopener noreferrer nofollow">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={m.media_url!} alt="" loading="lazy" className="aspect-square w-full rounded-lg object-cover" />
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {/* ------------------------------------------------------ FEED */}
          <section className="space-y-3">
            <SectionLabel>Feed</SectionLabel>
            <Compose hasGroup target={{ groupId: id, label: `everyone in ${group.name}` }} />
            <Feed
              items={feed.items}
              kept={feed.kept}
              counts={feed.counts}
              empty={`Nothing posted in ${group.name} yet.`}
            />
          </section>

          {/* --------------------------------------------------- MEMBERS */}
          <section>
            <SectionLabel>Members</SectionLabel>
            <ul className="flex flex-wrap justify-center gap-2">
              {people.map((p) => (
                <li key={p.id}>
                  <Link href={`/collective/people/${p.id}`} className="press rounded-pill bg-surface px-3 py-1.5 text-[0.8125rem] text-paper-dim">
                    {p.id === userId ? "You" : p.display_name}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </Gutter>
      </Screen>
    </>
  );
}

export const dynamic = "force-dynamic";
