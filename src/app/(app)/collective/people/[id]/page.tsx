import Link from "next/link";
import { notFound } from "next/navigation";

import { Card, Empty, Gutter, Screen, SectionLabel, Tag } from "@/components/ui";
import { shortDate } from "@/lib/format";
import { requireSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import type { PersonStanding, ProfileValue } from "@/lib/types";

import { Tie } from "./Tie";

/**
 * A public profile.
 *
 * What a person has done, and nothing about what they think.
 *
 * Every number here is a count of a completed act. There is no ratio anywhere
 * and there is not going to be: "written 12, passed 3" is a record, "25%
 * success rate" is a score, and the distance between those two is one division
 * and the entire difference between this and a reputation system. The overview
 * asks for reputation; the Alignment section of the same document says
 * Sovereign does not score individuals. This is what honours both.
 *
 * Also absent, permanently: how they resonated on anything, their journal,
 * their drafts, where they live, who follows them, and how many.
 */
export default async function PersonPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { userId } = await requireSession();

  if (id === userId) {
    // Your own public profile is a different question, and it is answered on
    // the screen where you can change it.
    return (
      <Screen>
        <Gutter className="space-y-4 pt-6">
          <h2 className="display text-[1.75rem] text-paper">You</h2>
          <p className="text-[0.9375rem] leading-relaxed text-paper-dim">
            This is what other people see of you.
          </p>
          <Link href="/individual/profile" className="smallcaps text-[11px] text-gold">
            Your profile →
          </Link>
        </Gutter>
      </Screen>
    );
  }

  const supabase = await createClient();

  const [{ data: standingRows }, { data: profileRow }, { data: valueRows }] =
    await Promise.all([
      supabase.rpc("person_standing", { p_profile_id: id }),
      supabase
        .from("public_profiles")
        .select("*")
        .eq("id", id)
        .maybeSingle(),
      supabase.from("profile_values").select("*").eq("profile_id", id).order("position"),
    ]);

  const standing = (
    Array.isArray(standingRows) ? standingRows[0] : standingRows
  ) as PersonStanding | undefined;

  if (!standing) notFound();

  const profile = profileRow as
    | {
        display_name: string;
        handle: string | null;
        bio: string | null;
        purpose: string | null;
        share_values: boolean;
      }
    | null;

  const values = (valueRows ?? []) as ProfileValue[];
  const name = profile?.display_name ?? "A member";

  return (
    <Screen>
      <Gutter className="space-y-8 pt-6">
        <div>
          <h2 className="display text-[1.75rem] text-paper">{name}</h2>
          {profile?.handle ? (
            <p className="smallcaps mt-1 text-[10px] text-paper-faint">
              @{profile.handle}
            </p>
          ) : null}
          {profile?.bio ? (
            <p
              className="mt-3 text-[0.9375rem] leading-relaxed text-paper-dim"
              data-selectable
            >
              {profile.bio}
            </p>
          ) : null}
          {standing.they_follow_you ? (
            <p className="smallcaps mt-3 text-[10px] text-paper-faint">
              follows you
            </p>
          ) : null}
        </div>

        <Tie
          profileId={id}
          following={standing.you_follow}
          friendship={standing.friendship}
        />

        {standing.you_are_friends ? (
          <Link
            href={`/individual/chats/${id}`}
            className="smallcaps inline-block text-[11px] text-gold hover:underline"
          >
            Say something →
          </Link>
        ) : null}

        {profile?.purpose ? (
          <section>
            <SectionLabel>Purpose</SectionLabel>
            <Card>
              <p
                className="text-[0.95rem] leading-relaxed text-paper"
                data-selectable
              >
                {profile.purpose}
              </p>
            </Card>
          </section>
        ) : null}

        <section>
          <SectionLabel>What they have done</SectionLabel>
          <div className="grid grid-cols-2 gap-3">
            <Count label="Proposals written" value={standing.proposals_written} />
            <Count label="Of those, passed" value={standing.proposals_passed} />
            <Count label="Projects finished" value={standing.projects_finished} />
            <Count
              label="Predictions marked"
              value={standing.predictions_marked}
            />
            <Count
              label="Questions answered"
              value={standing.questions_answered}
            />
            <Count label="Here since" value={shortDate(standing.joined_at)} />
          </div>
          <p className="mt-3 text-xs leading-relaxed text-paper-faint">
            Counts of things finished, and only the ones addressed to places you
            can reach. Nothing here is a rate, a rank or a score, and nothing
            here weights what this person&rsquo;s resonance is worth.
          </p>
        </section>

        <section>
          <SectionLabel
            right={
              profile?.share_values ? undefined : <Tag>not shared</Tag>
            }
          >
            What they value
          </SectionLabel>
          {profile?.share_values && values.length ? (
            <ul className="space-y-2">
              {values.map((v) => (
                <li key={v.id}>
                  <Card>
                    <p className="text-[0.95rem] text-paper">{v.name}</p>
                    {v.definition ? (
                      <p className="mt-1 text-[0.875rem] leading-relaxed text-paper-dim">
                        {v.definition}
                      </p>
                    ) : null}
                  </Card>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>
              They have not published these. Values are private here until
              somebody chooses otherwise, and nobody is asked to.
            </Empty>
          )}
        </section>
      </Gutter>
    </Screen>
  );
}

function Count({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-card border border-line bg-surface-soft px-4 py-3.5">
      <p className="font-serif text-2xl text-paper">{value}</p>
      <p className="smallcaps mt-0.5 text-[10px] text-paper-faint">{label}</p>
    </div>
  );
}

export const dynamic = "force-dynamic";
