import Link from "next/link";

import { Card, Divider, Page, PageTitle, SectionLabel, Tag } from "@/components/ui";
import { aiIsLive } from "@/lib/ai";
import { identity, treasury } from "@/lib/ledger";
import { isSteward, requireSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { shortDate } from "@/lib/format";

import { GroupPanel } from "./GroupPanel";
import { InvitePanel } from "./InvitePanel";
import { SignOutButton } from "./SignOutButton";
import { ThresholdPanel } from "./ThresholdPanel";

export const metadata = { title: "Settings · Sovereign" };

export default async function SettingsPage() {
  const { group, groups } = await requireSession();
  const supabase = await createClient();

  const { data: members } = group
    ? await supabase
        .from("group_members")
        .select("role, joined_at, profiles(display_name)")
        .eq("group_id", group.id)
        .order("joined_at", { ascending: true })
    : { data: [] };

  const live = aiIsLive();

  return (
    <Page>
      <Link
        href="/profile"
        className="smallcaps mb-6 inline-block text-[11px] text-paper-faint hover:text-gold"
      >
        ← Profile
      </Link>

      <PageTitle>Settings</PageTitle>

      <section className="mb-10">
        <SectionLabel right={<Tag tone="gold">constitutional</Tag>}>
          Universal Law
        </SectionLabel>
        <Card>
          <p className="text-[0.95rem] leading-relaxed text-paper-dim">
            Ten laws sit above every decision made here. A proposal that
            violates one cannot pass, whatever the resonance says and whatever a
            steward does.
          </p>
          <Link
            href="/settings/law"
            className="smallcaps mt-3 inline-block text-[11px] text-gold hover:underline"
          >
            Read the ten laws →
          </Link>
        </Card>
      </section>

      {group ? (
        <>
          <section className="mb-10">
            <SectionLabel right={<Tag>{group.role}</Tag>}>Group</SectionLabel>
            <GroupPanel
              group={group}
              groups={groups}
              canEdit={isSteward(group.role)}
            />
          </section>

          <section className="mb-10">
            <SectionLabel>The decision rule</SectionLabel>
            <ThresholdPanel group={group} canEdit={isSteward(group.role)} />
          </section>

          <section className="mb-10">
            <SectionLabel right={`${members?.length ?? 0}`}>Members</SectionLabel>
            <Card>
              <ul className="space-y-2.5">
                {(members ?? []).map((m, i) => (
                  <li key={i} className="flex items-baseline justify-between gap-3">
                    <span className="text-[0.95rem] text-paper">
                      {(m.profiles as unknown as { display_name: string } | null)
                        ?.display_name ?? "A member"}
                    </span>
                    <span className="smallcaps text-[10px] text-paper-faint">
                      {m.role} · {shortDate(m.joined_at)}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          </section>

          {isSteward(group.role) ? (
            <section className="mb-10">
              <SectionLabel>Invite someone</SectionLabel>
              <InvitePanel groupId={group.id} />
            </section>
          ) : null}
        </>
      ) : (
        <section className="mb-10">
          <SectionLabel>Group</SectionLabel>
          <Card>
            <p className="text-[0.95rem] leading-relaxed text-paper-dim">
              You are not in a group yet.
            </p>
            <Link
              href="/onboarding/group"
              className="smallcaps mt-3 inline-block text-[11px] text-gold hover:underline"
            >
              Start or join one →
            </Link>
          </Card>
        </section>
      )}

      <Divider />

      <section className="mb-10">
        <SectionLabel right={<Tag tone={live ? "calm" : "alarm"}>{live ? "live" : "offline"}</Tag>}>
          The AI layer
        </SectionLabel>
        <Card>
          <p className="text-[0.95rem] leading-relaxed text-paper">
            {live
              ? "A model is reading proposals, writing rationales and surfacing prompts. Every artefact records the prompt version and model that produced it."
              : "No API key is configured, so Sovereign is using its offline reviewer. The loop works end to end, but the scores are structural guesses rather than a reading, and every review it writes says so."}
          </p>
          <Link
            href="/settings/prompts"
            className="smallcaps mt-3 inline-block text-[11px] text-gold hover:underline"
          >
            Read the prompts →
          </Link>
        </Card>
      </section>

      <section className="mb-10">
        <SectionLabel>How identity works here</SectionLabel>
        <Card>
          <p className="text-[0.95rem] leading-relaxed text-paper-dim">
            {identity().describe()}
          </p>
        </Card>
      </section>

      <section className="mb-10">
        <SectionLabel>How money works here</SectionLabel>
        <Card>
          <p className="text-[0.95rem] leading-relaxed text-paper-dim">
            {treasury().describe()}
          </p>
        </Card>
      </section>

      <Divider />

      <SignOutButton />
    </Page>
  );
}
