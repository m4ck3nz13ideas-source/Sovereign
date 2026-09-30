import { redirect } from "next/navigation";

import { Page, PageTitle } from "@/components/ui";
import { requireSession } from "@/lib/session";

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

  return (
    <Page>
      <PageTitle sub="Who you are, what you are agreeing to, what you believe, and a look round.">
        Sovereign
      </PageTitle>
      <OnboardingFlow
        displayName={profile.display_name}
        handle={profile.handle ?? null}
      />
    </Page>
  );
}
