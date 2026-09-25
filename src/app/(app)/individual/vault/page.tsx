import Link from "next/link";

import { Card, Gutter, Screen, SectionLabel, Tag } from "@/components/ui";
import { requireSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Vault · Sovereign" };

/**
 * The Vault.
 *
 *   Screen 5: identity, data permissions, wallet, reputation record.
 *   "The principle is: everything belongs to the user."
 *
 * Two halves, and the line between them is the point. What is REAL runs on
 * what this build actually has: your records, what you have chosen to share
 * and with whom, and an export. What is NOT YET — the self-sovereign identity,
 * the wallet, the keys — is shown as architecture with nothing behind it, and
 * labelled as such in the plainest words available.
 *
 * An empty section that says it is empty is a map. An empty section dressed as
 * a balance is a lie, and this is the screen where that would matter most.
 */
export default async function VaultPage() {
  const { userId, profile } = await requireSession();
  const supabase = await createClient();

  const [{ count: entries }, { count: revisions }, { count: proposals }, { count: commitments }] =
    await Promise.all([
      supabase.from("entries").select("id", { count: "exact", head: true }).eq("profile_id", userId),
      supabase.from("statement_revisions").select("id", { count: "exact", head: true }).eq("profile_id", userId),
      supabase.from("proposals").select("id", { count: "exact", head: true }).eq("author_id", userId),
      supabase.from("commitments").select("id", { count: "exact", head: true }).eq("profile_id", userId),
    ]);

  const shared = [
    profile.share_values ? "your values" : null,
    profile.share_purpose ? "your purpose" : null,
    profile.share_faith ? "your statement of faith" : null,
  ].filter(Boolean);

  return (
    <Screen>
      <Gutter className="space-y-8 pt-6">
        <div>
          <h2 className="display text-[1.75rem] text-paper">Vault</h2>
          <p className="mt-2 text-[0.9375rem] leading-relaxed text-paper-dim">
            Everything belongs to you. This is what is here, what is shared, and
            what has not been built.
          </p>
        </div>

        {/* ------------------------------------------------------- WHAT IS HERE */}
        <section>
          <SectionLabel>What is here</SectionLabel>
          <Card className="space-y-3">
            <Line label="Things you have written" value={String(entries ?? 0)} />
            <Line label="Versions of your statements" value={String(revisions ?? 0)} />
            <Line label="Proposals you have authored" value={String(proposals ?? 0)} />
            <Line label="Commitments you have made" value={String(commitments ?? 0)} />
            <p className="border-t border-line pt-3 text-sm leading-relaxed text-paper-faint">
              Every version of a statement is kept and never overwritten. How a
              belief moved is a different thing from what it currently is, and
              the second being shared never makes the first shared.
            </p>
          </Card>
        </section>

        {/* -------------------------------------------------------- PERMISSIONS */}
        <section>
          <SectionLabel>What others can see</SectionLabel>
          <Card>
            {shared.length ? (
              <p className="text-[0.9375rem] leading-relaxed text-paper">
                People you share a group or a place with can see{" "}
                {shared.join(", ")}. Nothing else.
              </p>
            ) : (
              <p className="text-[0.9375rem] leading-relaxed text-paper">
                Nothing. You have shared none of it, which is the default and
                stays the default until you change it.
              </p>
            )}
            <p className="mt-3 text-sm leading-relaxed text-paper-faint">
              Your journal, your ideas and the history of your statements are
              owner-only in the database, with no path to group visibility at
              all. That is not a setting you could turn off by accident.
            </p>
            <Link
              href="/individual/profile"
              className="mt-3 inline-block text-[0.9375rem] font-medium text-gold"
            >
              Change what you share →
            </Link>
          </Card>
        </section>

        {/* ---------------------------------------------------------- NOT YET */}
        <section>
          <SectionLabel right={<Tag>not built</Tag>}>The rest of it</SectionLabel>

          <p className="mb-3 text-sm leading-relaxed text-paper-faint">
            These are in the architecture and have nothing behind them. They are
            here so the shape is visible, and labelled so nobody mistakes an
            empty room for a furnished one.
          </p>

          <div className="space-y-2">
            <Stub
              title="Self-sovereign identity"
              body="An identity you own and nobody can take away, usable as a login elsewhere with permissioned data sharing you can revoke. Today identity is an email and an invite, which has no uniqueness guarantee and is the honest level of assurance at this scale."
            />
            <Stub
              title="Wallet and SOV"
              body="A non-speculative token earned through contribution rather than bought. There is no chain here and no token, by decision — what exists is a hash-chained record in Postgres, which is tamper-evident rather than trustless, and the Impact screen says so in those words."
            />
            <Stub
              title="Keys and recovery"
              body="Follows the identity layer. There is nothing to hold keys for yet."
            />
            <Stub
              title="Apps with access"
              body="Follows the identity layer too. Nothing outside this app can read anything in it."
            />
          </div>
        </section>
      </Gutter>
    </Screen>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-[0.9375rem] text-paper-dim">{label}</span>
      <span className="tabular-nums text-[0.9375rem] text-paper">{value}</span>
    </div>
  );
}

function Stub({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-card border border-dashed border-line px-4 py-3.5">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-[0.9375rem] font-medium text-paper-dim">{title}</h3>
        <Tag>not yet</Tag>
      </div>
      <p className="mt-1.5 text-sm leading-relaxed text-paper-faint">{body}</p>
    </div>
  );
}

export const dynamic = "force-dynamic";
