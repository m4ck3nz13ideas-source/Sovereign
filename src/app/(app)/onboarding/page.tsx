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
  const { profile } = await requireSession();

  if (profile.onboarded_at) redirect("/launch");

  return (
    <Page>
      <PageTitle sub="Three things, then you are in.">Sovereign</PageTitle>
      <OnboardingFlow displayName={profile.display_name} />
    </Page>
  );
}
