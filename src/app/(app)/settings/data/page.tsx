import Link from "next/link";

import { Card, Page, PageTitle, SectionLabel, Tag } from "@/components/ui";
import { shortDate } from "@/lib/format";
import { requireSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

import { DeleteAccount } from "./DeleteAccount";

export const metadata = { title: "Your data · Sovereign" };

/**
 * Your data (rule 42): what you agreed to, a copy of everything, and leaving.
 * Reachable without consent, so somebody who will not agree can still take a
 * copy and go.
 */
export default async function DataPage() {
  await requireSession({ allowUnonboarded: true, allowUnconsented: true });
  const supabase = await createClient();
  const { data: consents } = await supabase
    .from("data_consents")
    .select("purpose, version, given_at")
    .order("given_at", { ascending: false });

  const label: Record<string, string> = {
    special_category: "Explicit consent to sensitive data",
    adult: "Confirmed 18 or over",
  };

  return (
    <Page>
      <Link href="/settings" className="smallcaps mb-6 inline-block text-[11px] text-paper-faint hover:text-gold">
        ← Settings
      </Link>
      <PageTitle sub="What you agreed to, a copy of everything, and leaving.">Your data</PageTitle>

      <section className="mb-10">
        <SectionLabel>What you agreed to</SectionLabel>
        <Card>
          {consents && consents.length ? (
            <ul className="space-y-2.5">
              {consents.map((c) => (
                <li key={`${c.purpose}-${c.version}`} className="flex items-baseline justify-between gap-3">
                  <span className="text-[0.95rem] text-paper">{label[c.purpose as string] ?? c.purpose}</span>
                  <span className="smallcaps text-[10px] text-paper-faint">
                    {shortDate(c.given_at as string)} · wording {c.version as string}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[0.95rem] text-paper-dim">Nothing yet.</p>
          )}
          <p className="mt-4 text-[0.8125rem] leading-relaxed text-paper-faint">
            Consent can&apos;t be taken back while you keep using Sovereign, because nearly everything in it is a
            political opinion or a belief. Withdrawing it means deleting your account, below.
          </p>
        </Card>
      </section>

      <section className="mb-10">
        <SectionLabel>A copy of everything</SectionLabel>
        <Card>
          <p className="text-[0.95rem] leading-relaxed text-paper-dim">
            Every row that names you, table by table, as one file. What other people chose privately about you —
            who muted or follows you, their read state, their SOV — is theirs and isn&apos;t included.
          </p>
          <a
            href="/settings/data/export"
            className="press mt-4 inline-flex min-h-11 items-center rounded-pill bg-surface px-5 py-2.5 text-[0.9375rem] font-semibold text-paper"
          >
            Download my data
          </a>
        </Card>
      </section>

      <section className="mb-10">
        <SectionLabel>Who can read what</SectionLabel>
        <Card>
          <div className="space-y-3 text-[0.95rem] leading-relaxed text-paper-dim">
            <p>
              <span className="text-paper">Other people</span> can&apos;t read your private space, and can&apos;t
              see how you responded to a proposal — only the tally, without names. That&apos;s enforced by the
              database.
            </p>
            <p>
              <span className="text-paper">Whoever runs Sovereign</span> technically could, today. We don&apos;t
              look. Next: your private space encrypted on your device with a key only you hold, and ballots that
              are secret from us too.{" "}
              <Link href="/explore/privacy" className="text-gold hover:underline">
                Where privacy is going →
              </Link>
            </p>
          </div>
        </Card>
      </section>

      <section className="mb-10">
        <SectionLabel right={<Tag tone="alarm">permanent</Tag>}>Delete my account</SectionLabel>
        <Card>
          <div className="space-y-3 text-[0.95rem] leading-relaxed text-paper-dim">
            <p className="text-paper">Deleted for good:</p>
            <p>
              your email and sign-in, profile, journal, ideas, values, beliefs, Know yourself, guardian notes, to-dos,
              learning, posts, comments and likes, messages you wrote, follows and friendships, your personhood proof,
              any business you own, and your place in every group.
            </p>
            <p className="text-paper">Kept, but no longer linked to anyone:</p>
            <p>
              proposals and debate you wrote (shown as by a &ldquo;Former member&rdquo;), your responses (already
              secret — they stay in the tally), flags, predictions, decisions, projects and SOV entries. A decision is
              a record of what people said when it closed; removing a response afterwards would make it untrue.
            </p>
          </div>
          <div className="mt-5">
            <DeleteAccount />
          </div>
        </Card>
      </section>
    </Page>
  );
}
