import { redirect } from "next/navigation";

import { Page, PageTitle } from "@/components/ui";
import { requireSession } from "@/lib/session";

import { accessionReady } from "./actions";
import { OnboardingFlow } from "./OnboardingFlow";

export const metadata = { title: "Welcome · Sovereign" };

/**
 * First run.
 *
 * Three questions, in this order: what you are called, what you value, and
 * whether you have a group. Values come before the group deliberately — they
 * are the rubric every proposal is read against, and a group whose members
 * have named nothing gets scored on nothing.
 */
export default async function OnboardingPage() {
  // The one screen that may be seen before onboarding is finished — everywhere
  // else redirects here until it is.
  const { profile } = await requireSession({ allowUnonboarded: true });

  if (profile.onboarded_at) redirect("/write");

  // Asked here rather than discovered at step two, because the error PostgREST
  // gives for a missing function reads like the feature was never built.
  const accession = await accessionReady();

  return (
    <Page>
      <PageTitle sub="Who you are, what you are agreeing to, what you believe, and a look round.">
        Sovereign
      </PageTitle>
      {accession.ready ? null : (
        <div className="mb-6 rounded-card border border-alarm/40 bg-alarm/5 px-4 py-3">
          <p className="text-sm leading-relaxed text-paper">
            This install cannot record an agreement to the Universal Laws yet,
            so onboarding will not be able to finish.
          </p>
          <p className="mt-2 text-sm leading-relaxed text-paper-dim">
            {accession.missing ??
              "The accession migration has not been applied to this database."}
          </p>
        </div>
      )}

      <OnboardingFlow
        displayName={profile.display_name}
        handle={profile.handle ?? null}
      />
    </Page>
  );
}
