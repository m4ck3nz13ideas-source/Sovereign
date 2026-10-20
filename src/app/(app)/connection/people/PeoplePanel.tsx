import Link from "next/link";

import { Card, Empty, Gutter, SectionLabel, Tag } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import type { FriendshipRequest, Person } from "@/lib/types";

import { Finder } from "./Finder";
import { Requests } from "./Requests";

/**
 * People — one of Connection's filters, beside Chats and Groups (20 October).
 *
 * Two relationships doing two jobs. Following puts somebody's public record in
 * your feed and needs nobody's permission. Friendship is mutual, asked for, and
 * carries private conversation.
 *
 * Neither changes what anybody may decide. Your address decides that, and a
 * thousand followers does not reach a proposal on a street you do not live on.
 * The screen says so out loud, because this is the exact surface where a
 * governance tool starts turning into a network if nobody is watching.
 *
 * There is no follower count anywhere here. The overview rules out vanity
 * metrics by name, and a number next to somebody's name is the whole of what a
 * vanity metric is.
 */
export async function PeoplePanel({ handle }: { handle?: string }) {
  const supabase = await createClient();

  const [{ data: peopleRows }, { data: requestRows }] = await Promise.all([
    supabase.rpc("my_people"),
    supabase.rpc("friendship_requests"),
  ]);

  const people = (peopleRows ?? []) as Person[];
  const requests = (requestRows ?? []) as FriendshipRequest[];

  const friends = people.filter((p) => p.tie === "friend");
  const following = people.filter((p) => p.tie === "following");

  return (
      <Gutter className="space-y-8 pt-2">
        <div>
          <p className="text-center text-[0.875rem] leading-relaxed text-paper-faint">
            Following puts what somebody does in your feed. Friendship is
            mutual and carries conversation. Neither has any bearing on what
            either of you can decide — that is settled by where you are.
          </p>
        </div>

        <section>
          <SectionLabel>Find someone</SectionLabel>
          <Finder initial={(handle ?? "").replace(/^@/, "").slice(0, 40)} />
          <p className="mt-2 text-[0.8125rem] leading-relaxed text-paper-faint">
            By handle, exactly. There is no directory and no search — if
            somebody wants to be found they give you theirs.
          </p>
        </section>

        {requests.length ? (
          <section>
            <SectionLabel right={`${requests.length}`}>Waiting</SectionLabel>
            <Requests requests={requests} />
          </section>
        ) : null}

        <section>
          <SectionLabel>Friends</SectionLabel>
          {friends.length ? (
            <PersonList people={friends} />
          ) : (
            <Empty>
              Nobody yet. A friendship here gives no access to anything you have
              not published — not your journal, not your drafts, not how you
              resonated on anything.
            </Empty>
          )}
        </section>

        <section>
          <SectionLabel>Following</SectionLabel>
          {following.length ? (
            <PersonList people={following} />
          ) : (
            <Empty>
              Nobody yet. Following is one-way and public: they find out, they
              do not approve it, and it gives you their public record and
              nothing else.
            </Empty>
          )}
        </section>
      </Gutter>
  );
}

function PersonList({ people }: { people: Person[] }) {
  return (
    <ul className="space-y-2">
      {people.map((p) => (
        <li key={p.profile_id}>
          <Card>
            <Link
              href={`/connection/people/${p.profile_id}`}
              className="flex items-baseline justify-between gap-3"
            >
              <span className="text-[0.95rem] text-paper">{p.display_name}</span>
              {p.handle ? (
                <span className="smallcaps text-[10px] text-paper-faint">
                  @{p.handle}
                </span>
              ) : (
                <Tag>no handle</Tag>
              )}
            </Link>
          </Card>
        </li>
      ))}
    </ul>
  );
}

