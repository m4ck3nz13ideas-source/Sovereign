import { Gutter, Readers, Screen, SectionLabel, TopBar } from "@/components/ui";
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
          Find something you or the group has already written, or ask a
          question and see what several ways of knowing hold about it.
        </p>
        <Readers className="mt-2">
          A question asked here: only you, permanently. One asked on a proposal:
          everyone that proposal is addressed to.
        </Readers>

        <AskPanel mine={(data ?? []) as MyInquiry[]} />
      </Gutter>

      <Gutter>
        <SectionLabel>How this works</SectionLabel>
        <div className="space-y-3 pb-4 text-sm leading-relaxed text-paper-faint">
          <p>
            <span className="text-paper-dim">Finding</span> searches both
            halves and keeps them apart. The collective side reaches only what
            is addressed to you — the same question every other screen asks, so
            nothing here shows you what a group you are not part of is doing.
            Your side reaches what you wrote, and nobody else can see any of
            it. Two lists rather than one with a label on each row, because the
            difference between them is who else can read the thing.
            Results are in time order, not by relevance, because relevance
            would need something to rank on and the only honest candidates are
            recency and attention.
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
