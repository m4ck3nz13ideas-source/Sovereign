import Link from "next/link";
import { redirect } from "next/navigation";

import { Page, PageTitle } from "@/components/ui";
import { requireSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

import { ConsentForm } from "./ConsentForm";

export const metadata = { title: "Before you start · Sovereign" };

/**
 * Explicit consent, asked once per wording (rule 42, 0045).
 *
 * Sovereign's core data is special category under UK GDPR — a response to a
 * proposal is a political opinion — so this comes before anything is
 * collected, including for people who joined before it existed.
 */
export default async function ConsentPage() {
  const { profile } = await requireSession({ allowUnonboarded: true, allowUnconsented: true });

  const supabase = await createClient();
  const { data: consented } = await supabase.rpc("has_current_consent");
  const next = profile.onboarded_at ? "/home" : "/onboarding";
  if (consented) redirect(next);

  return (
    <Page>
      <PageTitle sub="One thing before you start.">What you&apos;re trusting us with</PageTitle>

      <div className="space-y-4 text-[0.95rem] leading-relaxed text-paper-dim">
        <p>
          Sovereign only works if it holds things the law treats as sensitive. Every response to a proposal is a
          political opinion. What you write about faith, values and beliefs is exactly that. Your journal may hold
          anything.
        </p>
        <p className="text-paper">
          So we ask for your explicit consent, and we keep a record of it. What&apos;s yours alone stays readable by
          you alone. Nothing is sold. Advertisers never learn who you are.
        </p>
        <p>
          You can take a copy of everything, or delete your account, at any time from Settings → Your data. Read the
          full{" "}
          <Link href="/explore/privacy" className="text-gold hover:underline">
            privacy notice
          </Link>
          .
        </p>
      </div>

      <div className="mt-8">
        <ConsentForm next={next} />
      </div>
    </Page>
  );
}
