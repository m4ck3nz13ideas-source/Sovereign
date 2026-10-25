import Link from "next/link";

import { Card, Divider, Page, PageTitle, SectionLabel, Tag } from "@/components/ui";
import { aiIsLive } from "@/lib/ai";
import { identity, treasury } from "@/lib/ledger";
import { isSteward, requireSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { shortDate } from "@/lib/format";
import { THEMES, currentTheme } from "@/lib/theme";

import { SignOutButton } from "./SignOutButton";
import { ThemePanel } from "./ThemePanel";

export const metadata = { title: "Settings · Sovereign" };

export default async function SettingsPage() {
  const { groups } = await requireSession();
  const supabase = await createClient();
  const theme = await currentTheme();
  const { data: verified } = await supabase.rpc("is_verified_person", {
    p_profile_id: null,
  });

  const live = aiIsLive();
  const { data: founder } = await supabase.rpc("is_founder");

  return (
    <Page>
      <Link
        href="/individual/profile"
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
            Ten laws sit above every decision made here. A proposal is released
            only at 0.618 alignment with them, and one that violates any of
            them cannot pass, whatever a steward does.
          </p>
          <Link
            href="/settings/law"
            className="smallcaps mt-3 inline-block text-[11px] text-gold hover:underline"
          >
            Read the ten laws →
          </Link>
        </Card>
      </section>

      <section className="mb-10">
        <SectionLabel>Appearance</SectionLabel>
        <div className="overflow-hidden rounded-card border border-line bg-surface-soft py-1">
          <ThemePanel current={theme} options={THEMES} />
          <p className="px-5 pb-3 text-[0.8125rem] leading-relaxed text-paper-faint">
            System follows your phone, including when it changes at dusk.
          </p>
        </div>
      </section>

      <section className="mb-10">
        <SectionLabel
          right={<Tag tone={verified ? "calm" : undefined}>{verified ? "verified" : "not verified"}</Tag>}
        >
          One person
        </SectionLabel>
        <Card>
          <p className="text-[0.95rem] leading-relaxed text-paper-dim">
            A place has no register, so one person could hold five accounts.
            Proof of personhood closes that where it matters — national scale
            and above — and stores nothing about you but an opaque hash.
          </p>
          <Link
            href="/settings/personhood"
            className="smallcaps mt-3 inline-block text-[11px] text-gold hover:underline"
          >
            {verified ? "Read what it does →" : "Prove you are one person →"}
          </Link>
        </Card>
      </section>

      <section className="mb-10">
        <SectionLabel>Your data</SectionLabel>
        <Card>
          <p className="text-[0.95rem] leading-relaxed text-paper-dim">
            What you agreed to, a copy of everything Sovereign holds about you,
            and deleting your account.
          </p>
          <Link
            href="/settings/data"
            className="smallcaps mt-3 inline-block text-[11px] text-gold hover:underline"
          >
            Your data →
          </Link>
        </Card>
      </section>

      <section className="mb-10">
        <SectionLabel>Where you are</SectionLabel>
        <Card>
          <p className="text-[0.95rem] leading-relaxed text-paper-dim">
            Four lines that decide which proposals are addressed to you, and
            which ones you can write. No coordinates, no register — a claim,
            checkable by the people standing next to you.
          </p>
          <Link
            href="/settings/place"
            className="smallcaps mt-3 inline-block text-[11px] text-gold hover:underline"
          >
            Set where you are →
          </Link>
        </Card>
      </section>

      {founder ? (
        <section className="mb-10">
          <SectionLabel right={<Tag tone="gold">founders</Tag>}>Founder</SectionLabel>
          <Card>
            <p className="text-[0.95rem] leading-relaxed text-paper-dim">
              How the founding 50 are getting on: the way in, activity, proposals and what needs attention.
            </p>
            <Link href="/settings/founder" className="smallcaps mt-3 inline-block text-[11px] text-gold hover:underline">
              Open the dashboard →
            </Link>
          </Card>
        </section>
      ) : null}

      {/* Groups are managed on their own pages in Connection since 0057:
          the charter, members and invitations live with the group. */}
      <section className="mb-10">
        <SectionLabel right={groups.length ? `${groups.length}` : undefined}>Your groups</SectionLabel>
        <Card>
          {groups.length ? (
            <ul className="space-y-2.5">
              {groups.map((g) => (
                <li key={g.id} className="flex items-baseline justify-between gap-3">
                  <Link href={`/connection/g/${g.id}`} className="text-[0.95rem] text-paper hover:text-gold">
                    {g.name}
                  </Link>
                  <Link
                    href={`/connection/g/${g.id}/manage`}
                    className="smallcaps text-[10px] text-paper-faint hover:text-gold"
                  >
                    {g.role} · {isSteward(g.role) ? "manage" : "charter"}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[0.95rem] leading-relaxed text-paper-dim">You are not in a group yet.</p>
          )}
          <Link
            href="/onboarding/group"
            className="smallcaps mt-3 inline-block text-[11px] text-gold hover:underline"
          >
            Start or join one →
          </Link>
        </Card>
      </section>

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
