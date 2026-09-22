import Link from "next/link";

import { Card, Page, PageTitle } from "@/components/ui";
import { requireSession } from "@/lib/session";
import {
  AMENDMENT_RULE,
  RESONANCE_THRESHOLD,
  UNIVERSAL_LAWS,
} from "@/lib/universal-law";

export const metadata = { title: "Universal Law · Sovereign" };

/**
 * The constitution, readable by every member.
 *
 * Not a settings screen — there is nothing here to change. That is the point:
 * these are the invariants every proposal is tested against, and a member
 * being governed by them is entitled to read them in full rather than infer
 * them from verdicts.
 */
export default async function LawPage() {
  await requireSession();

  return (
    <Page>
      <Link
        href="/settings"
        className="smallcaps mb-6 inline-block text-[11px] text-paper-faint hover:text-gold"
      >
        ← Settings
      </Link>

      <PageTitle sub="The constitution. Ten laws, above every decision this app can make.">
        Universal Law
      </PageTitle>

      <Card className="mb-8 border-gold-dim bg-gold-wash">
        <p className="text-[0.95rem] leading-relaxed text-paper">
          &ldquo;Moral law precedes legal code and forms the guiding
          constitution of all human creation.&rdquo;
        </p>
        <p className="mt-3 text-sm leading-relaxed text-paper-dim">
          Every proposal is tested against all ten. A <em>tension</em> is a real
          friction the group answers in writing and then proceeds. A{" "}
          <em>violation</em> ends the proposal — it cannot be voted through, and
          no steward can set it aside. Law constrains what a group may decide;
          it is not one more thing to weigh.
        </p>
      </Card>

      <ol className="space-y-3">
        {UNIVERSAL_LAWS.map((law) => (
          <li key={law.id}>
            <Card>
              <div className="flex items-baseline gap-3">
                <span className="font-serif text-lg text-gold">
                  {law.ordinal}
                </span>
                <h2 className="font-serif text-lg text-paper">{law.name}</h2>
              </div>
              <p className="mt-2 text-[0.95rem] leading-relaxed text-paper-dim">
                {law.text}
              </p>
              <details className="group mt-3">
                <summary className="smallcaps cursor-pointer list-none text-[10px] text-paper-faint hover:text-gold [&::-webkit-details-marker]:hidden">
                  <span className="group-open:hidden">
                    what a violation looks like
                  </span>
                  <span className="hidden group-open:inline">close</span>
                </summary>
                <p className="mt-2 border-l border-line pl-3 text-sm leading-relaxed text-paper-faint">
                  {law.violationLooksLike}
                </p>
              </details>
            </Card>
          </li>
        ))}
      </ol>

      <Card className="mt-8">
        <h2 className="smallcaps mb-2 text-[11px] text-paper-faint">
          Amending a law
        </h2>
        <p className="text-[0.95rem] leading-relaxed text-paper-dim">
          {AMENDMENT_RULE}
        </p>
        <p className="mt-3 text-sm leading-relaxed text-paper-faint">
          Not a threshold — everyone. That mechanism does not exist in this
          build, so the laws are shipped as code rather than stored as rows a
          steward could edit. Representing them as editable data would be a lie
          about what they are.
        </p>
      </Card>

      <p className="mt-8 text-xs leading-relaxed text-paper-faint">
        Resonance ratifies at ≥ {RESONANCE_THRESHOLD} — the golden ratio, as
        specified, so that consensus comes through harmony rather than
        dominance. It is a threshold on those who responded, not a share of any
        population.
      </p>
    </Page>
  );
}
