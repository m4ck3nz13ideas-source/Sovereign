import Link from "next/link";

import { ComposeProposal } from "@/app/(app)/collective/proposals/new/ComposeProposal";
import { Card, Empty, Page, PageTitle } from "@/components/ui";
import { addressOptions, requireAddress } from "@/lib/address";
import { reachableScopes } from "@/lib/collective";
import { createClient } from "@/lib/supabase/server";
import { UNIVERSAL_LAWS } from "@/lib/universal-law";

export const metadata = { title: "Amend a law · Sovereign" };

/**
 * Proposing an amendment.
 *
 * Its own door, because this is a rare and deliberate act and burying it as a
 * checkbox on the ordinary composer would mean somebody reaching it by
 * accident. Behind the door it is the same composer, the same sharpening gate
 * and the same audit — a special ceremony in a side room is how constitutions
 * get amended by people who were not watching.
 *
 * Global only, which means the existing subsidiarity engine already makes this
 * as hard as it should be before anything in 0015 applies: a thousand voices
 * and thirty days, and proof of personhood to respond at all.
 */
export default async function AmendPage({
  searchParams,
}: {
  searchParams: Promise<{ law?: string }>;
}) {
  const { law: lawId } = await searchParams;
  const session = await requireAddress();

  const reachable = reachableScopes(session.profile);
  const canGlobal = reachable.includes("global");
  const law = UNIVERSAL_LAWS.find((l) => l.id === lawId);

  const back = (
    <Link
      href="/settings/law"
      className="smallcaps mb-6 inline-block text-[11px] text-paper-faint hover:text-gold"
    >
      ← Universal Law
    </Link>
  );

  if (!law) {
    return (
      <Page>
        {back}
        <PageTitle sub="Which one. An amendment rewrites the wording of one existing law — there is no repeal, no eleventh and no merge.">
          Amend a law
        </PageTitle>
        <ol className="space-y-2">
          {UNIVERSAL_LAWS.map((l) => (
            <li key={l.id}>
              <Link href={`/settings/law/amend?law=${l.id}`} className="press block">
                <Card>
                  <div className="flex items-baseline gap-3">
                    <span className="font-serif text-lg text-gold">{l.ordinal}</span>
                    <span className="font-serif text-lg text-paper">{l.name}</span>
                  </div>
                  <p className="mt-1 text-[0.875rem] leading-relaxed text-paper-dim">
                    {l.text}
                  </p>
                </Card>
              </Link>
            </li>
          ))}
        </ol>
      </Page>
    );
  }

  if (!canGlobal) {
    return (
      <Page>
        {back}
        <PageTitle>Amend {law.name}</PageTitle>
        <Empty
          action={
            <Link href="/settings/place" className="text-gold hover:underline">
              Say where you are
            </Link>
          }
        >
          An amendment is addressed to everybody, so it is written at global
          scale — and you can only propose at a scale you have said you are in.
          Global is one everybody is in; you have not filled in where you are at
          all yet.
        </Empty>
      </Page>
    );
  }

  // Whatever the law currently says, which is not necessarily what shipped.
  const supabase = await createClient();
  const { data: currentRows } = await supabase.rpc("law_text", { p_law_id: law.id });
  const current = (Array.isArray(currentRows) ? currentRows[0] : currentRows) as
    | { text: string; violation_looks_like: string }
    | undefined;

  return (
    <Page>
      {back}

      <PageTitle sub="The tenth law says no law is final. This is what that costs.">
        Amend {law.name}
      </PageTitle>

      <ComposeProposal
        addresses={addressOptions(session)}
        defaultAddress="scope:global"
        unsetScopes={[]}
        takingUp={null}
        amend={{
          lawId: law.id,
          lawName: law.name,
          currentText: current?.text ?? law.text,
          currentViolation: current?.violation_looks_like ?? law.violationLooksLike,
          globalAddress: "scope:global",
        }}
      />
    </Page>
  );
}

export const dynamic = "force-dynamic";
