import { Gutter, Screen, SectionLabel, TopBar } from "@/components/ui";
import { requireSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import type { MyInquiry } from "@/lib/types";

import { AskPanel } from "./AskPanel";

export const metadata = { title: "Ask · Sovereign" };

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
      <TopBar title="Ask" />
      <Gutter>
        <p className="mt-2 text-[0.9375rem] leading-relaxed text-paper-dim">
          Find something the group has already said, or ask a question and see
          what several ways of knowing hold about it.
        </p>

        <AskPanel mine={(data ?? []) as MyInquiry[]} />
      </Gutter>

      <Gutter>
        <SectionLabel>How this works</SectionLabel>
        <div className="space-y-3 pb-4 text-sm leading-relaxed text-paper-faint">
          <p>
            <span className="text-paper-dim">Finding</span> searches only what
            is addressed to you — the same question every other screen asks.
            Nothing here is a way to see what a group you are not part of is
            doing. Results are in time order, not by relevance, because
            relevance would need something to rank on and the only honest
            candidates are recency and attention.
          </p>
          <p>
            <span className="text-paper-dim">Asking</span> returns positions,
            never an answer. Two ways of knowing is the floor and nothing is
            ranked, so there is no row at the bottom telling you which one
            wins. Reconciling them is the part you are here to do.
          </p>
          <p>
            A question asked here is <span className="text-paper-dim">yours
            alone</span> and stays that way — there is no path that attaches it
            to a proposal afterwards. To put a question in front of the people
            a decision concerns, ask it on the proposal, where everyone it is
            addressed to can read the answer.
          </p>
        </div>
      </Gutter>
    </Screen>
  );
}
