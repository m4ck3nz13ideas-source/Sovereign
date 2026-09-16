import Link from "next/link";

import { Page, PageTitle } from "@/components/ui";
import { requireSession } from "@/lib/session";

import { GroupSetup } from "./GroupSetup";

export const metadata = { title: "Your group · Sovereign" };

export default async function GroupSetupPage() {
  const { groups } = await requireSession();

  return (
    <Page>
      <Link
        href="/launch"
        className="smallcaps mb-6 inline-block text-[11px] text-paper-faint hover:text-gold"
      >
        ← Launch
      </Link>

      <PageTitle sub="Five to fifty people who already know each other. Not a public square.">
        A group
      </PageTitle>

      <GroupSetup hasGroups={groups.length > 0} />
    </Page>
  );
}
