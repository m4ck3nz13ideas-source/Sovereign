import { TabActions } from "@/components/nav/TabActions";
import { Gutter, Readers, Screen, TopBar } from "@/components/ui";
import { requireSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import type { MyInquiry } from "@/lib/types";

import { AskPanel } from "./AskPanel";

export const metadata = { title: "Search · Sovereign" };

/**
 * Ask — one field, two jobs.
 *
 * FIND looks through what this group has already decided, proposed and built.
 * ASK goes and reads what several bodies of thought hold about a question,
 * and returns their positions rather than an answer.
 *
 * They share a field because they are the same impulse: you want to know
 * something before you decide. They stay visibly separate because one stays
 * inside the address you belong to and the other does not, and blurring that
 * would be the first step towards a search box that quietly answers questions
 * about the group's own decisions.
 */
export default async function AskPage() {
  await requireSession();
  const supabase = await createClient();

  const { data } = await supabase.rpc("my_inquiries", { p_limit: 30 });

  return (
    <Screen>
      <TopBar title="Search" action={<TabActions plus="/ask" plusLabel="New search" />} />
      <Gutter>
        <Readers className="mt-3">
          A question asked here: only you, permanently. One asked on a proposal:
          everyone that proposal is addressed to.
        </Readers>

        <AskPanel mine={(data ?? []) as MyInquiry[]} />
      </Gutter>

    </Screen>
  );
}
