import { redirect } from "next/navigation";

import { Page, PageTitle } from "@/components/ui";
import { requireSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

import { accessionReady } from "./actions";
import { OnboardingFlow } from "./OnboardingFlow";

export const metadata = { title: "Welcome · Sovereign" };

/**
 * First run.
 *
 * Four steps: who you are and where, the ten laws read and agreed to, what you
 * value and believe, and a walk through the rest. The laws come before the
 * values because the laws are what the values are read alongside, and somebody
 * should know what they are joining before being asked to describe themselves
 * to it.
 *
 * IT RESUMES
 *
 * Each step saves as it finishes, so the database already knows how far
 * somebody got. Working that out here and handing the flow a starting point is
 * the difference between closing the tab and losing ten minutes, and closing
 * the tab and losing nothing. Onboarding is the one screen where a person has
 * least invested and is most likely to walk away, so it is exactly the wrong
 * place to make them type anything twice.
 */
export default async function OnboardingPage() {
  // The one screen that may be seen before onboarding is finished — everywhere
  // else redirects here until it is.
  const { profile } = await requireSession({ allowUnonboarded: true });

  if (profile.onboarded_at) redirect("/write");

  const supabase = await createClient();

  const [accession, { data: standing }, { data: values }, { data: passions }] =
    await Promise.all([
      // Asked here rather than discovered at step two, because the error
      // PostgREST gives for a missing function reads like the feature was
      // never built.
      accessionReady(),
      supabase.rpc("accession_standing"),
      supabase
        .from("profile_values")
        .select("name, definition, position")
        .eq("profile_id", profile.id)
        .order("position"),
      supabase
        .from("profile_passions")
        .select("name, note, position")
        .eq("profile_id", profile.id)
        .order("position"),
    ]);

  const agreed =
    ((standing as { laws_agreed: number }[] | null)?.[0]?.laws_agreed ?? 0) >= 10;

  const savedValues = (values ?? []).map((v) => ({
    name: v.name as string,
    definition: (v.definition as string | null) ?? "",
  }));
  const savedPassions = (passions ?? []).map((p) => ({
    name: p.name as string,
    note: (p.note as string | null) ?? "",
  }));

  // A name that is still the default and no place written down means step one
  // has not really happened, whatever the row says.
  const detailsDone =
    profile.display_name !== "Unnamed" ||
    Boolean(profile.place_local || profile.place_national);

  const startAt =
    agreed && savedValues.length ? 3 : agreed ? 2 : detailsDone ? 1 : 0;

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

      {startAt > 0 ? (
        <p className="mb-6 text-sm leading-relaxed text-paper-faint">
          Picking up where you left off. Everything you had already answered is
          still here.
        </p>
      ) : null}

      <OnboardingFlow
        displayName={profile.display_name}
        handle={profile.handle ?? null}
        places={{
          local: profile.place_local ?? "",
          regional: profile.place_regional ?? "",
          national: profile.place_national ?? "",
          continental: profile.place_continental ?? "",
        }}
        savedValues={savedValues}
        savedPassions={savedPassions}
        purpose={profile.purpose ?? ""}
        faith={profile.faith_statement ?? ""}
        agreed={agreed}
        startAt={startAt}
      />
    </Page>
  );
}
