import Link from "next/link";

import { BarList, StatGrid, StatTile, pct } from "@/components/dash";
import { Card, Empty, Page, PageTitle, Readers, SectionLabel, Tag } from "@/components/ui";
import { aiIsLive } from "@/lib/ai";
import { requireSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Founder · Sovereign" };

/** The founding cohort Sovereign is getting ready for before 2027. */
const FOUNDING = 50;

interface Pulse {
  funnel: Record<
    "signed_up" | "consented" | "agreed_laws" | "onboarded" | "in_a_group" | "responded" | "proposed",
    number
  >;
  active_7d: number;
  new_7d: number;
  weekly_signups: { week: string; n: number }[];
  groups: number;
  proposals: Record<"held" | "open" | "passed" | "failed" | "withdrawn", number>;
  posts_7d: number;
  attention: Record<"open_flags" | "open_concerns" | "held_over_7d" | "passed_waiting", number>;
  ai_30d: Record<"reviews" | "law_audits" | "conditions" | "by_stand_in", number>;
}

/**
 * The founder's dashboard (0058): whether the founding 50 are really using
 * Sovereign. Counts only, from `founder_pulse()`, which refuses anybody not
 * in `founders` and returns no name, id or per-person figure.
 */
export default async function FounderPage() {
  await requireSession();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("founder_pulse");

  const back = (
    <Link href="/settings" className="smallcaps mb-6 inline-block text-[11px] text-paper-faint hover:text-gold">
      ← Settings
    </Link>
  );

  if (error || !data) {
    return (
      <Page>
        {back}
        <PageTitle>Founder</PageTitle>
        <Empty>This is for Sovereign&rsquo;s founders. A founder is added from the database, not from here.</Empty>
      </Page>
    );
  }

  const p = data as Pulse;
  const f = p.funnel;
  const live = aiIsLive();

  return (
    <Page>
      {back}
      <PageTitle sub={`How the founding ${FOUNDING} are getting on. Counts only — nobody is named here.`}>
        Founder
      </PageTitle>

      <section className="mb-10">
        <StatGrid>
          <StatTile label="Onboarded" value={f.onboarded} hint={`of ${FOUNDING} founding places`} />
          <StatTile label="Active, 7 days" value={p.active_7d} hint={`${pct(p.active_7d, f.onboarded)} of onboarded`} />
          <StatTile label="New, 7 days" value={p.new_7d} hint="signed up" />
          <StatTile label="Groups" value={p.groups} />
          <StatTile label="Posts, 7 days" value={p.posts_7d} />
          <StatTile label="Proposals open" value={p.proposals.open} hint={`${p.proposals.passed} passed so far`} />
        </StatGrid>
      </section>

      <section className="mb-10">
        <SectionLabel right={`towards ${FOUNDING}`}>The way in</SectionLabel>
        <Card>
          <BarList
            max={Math.max(FOUNDING, f.signed_up)}
            rows={[
              { label: "Signed up", value: f.signed_up },
              { label: "Consented", value: f.consented, note: pct(f.consented, f.signed_up) },
              { label: "Agreed the ten", value: f.agreed_laws, note: pct(f.agreed_laws, f.signed_up) },
              { label: "Onboarded", value: f.onboarded, note: pct(f.onboarded, f.signed_up) },
              { label: "In a group", value: f.in_a_group, note: pct(f.in_a_group, f.onboarded) },
              { label: "Responded", value: f.responded, note: pct(f.responded, f.onboarded) },
              { label: "Proposed", value: f.proposed, note: pct(f.proposed, f.onboarded) },
            ]}
          />
          <p className="mt-3 text-center text-[0.8125rem] text-paper-dim">
            The biggest drop between two steps is where to look first.
          </p>
        </Card>
      </section>

      {p.weekly_signups.length ? (
        <section className="mb-10">
          <SectionLabel>Sign-ups by week</SectionLabel>
          <Card>
            <BarList
              rows={p.weekly_signups.map((w) => ({
                label: new Date(w.week).toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
                value: w.n,
              }))}
            />
          </Card>
        </section>
      ) : null}

      <section className="mb-10">
        <SectionLabel>Proposals</SectionLabel>
        <Card>
          <BarList
            rows={[
              { label: "Held in review", value: p.proposals.held },
              { label: "Open", value: p.proposals.open },
              { label: "Passed", value: p.proposals.passed },
              { label: "Did not pass", value: p.proposals.failed },
              { label: "Withdrawn", value: p.proposals.withdrawn },
            ]}
          />
        </Card>
      </section>

      <section className="mb-10">
        <SectionLabel>Needs attention</SectionLabel>
        <StatGrid>
          <StatTile
            label="Held over a week"
            value={p.attention.held_over_7d}
            attention={p.attention.held_over_7d > 0}
            hint="in review, below 0.618 or unread"
          />
          <StatTile
            label="Passed, waiting"
            value={p.attention.passed_waiting}
            attention={p.attention.passed_waiting > 0}
            hint="no one against a need yet"
          />
          <StatTile
            label="Open flags"
            value={p.attention.open_flags}
            attention={p.attention.open_flags > 0}
            hint="critical, unanswered"
          />
          <StatTile
            label="Business concerns"
            value={p.attention.open_concerns}
            attention={p.attention.open_concerns > 0}
            hint="raised, not closed"
          />
        </StatGrid>
      </section>

      <section className="mb-10">
        <SectionLabel right={<Tag tone={live ? "calm" : "alarm"}>{live ? "model live" : "stand-in"}</Tag>}>
          AI, 30 days
        </SectionLabel>
        <StatGrid>
          <StatTile label="Reviews" value={p.ai_30d.reviews} hint={`${p.ai_30d.by_stand_in} by the stand-in`} />
          <StatTile label="Law audits" value={p.ai_30d.law_audits} />
          <StatTile label="Conditions set" value={p.ai_30d.conditions} />
        </StatGrid>
        <p className="mt-3 text-center text-[0.8125rem] text-paper-dim">
          Spend is not recorded in Sovereign. These are the readings written, which is what a model would be paid
          for once one is connected.
        </p>
      </section>

      <Readers>Founders only, by database rule. Counts of the whole app; no person, group or proposal is named.</Readers>
    </Page>
  );
}
