import { SectionLabel } from "@/components/ui";
import { shortDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

import { RequirementAnswer, RunConditions } from "./ConditionsClient";

export interface Conditions {
  proposal_id: string;
  min_voices: number;
  window_hours: number;
  requirements: string[];
  rationale: string;
  model: string;
  closes_at: string;
}

/**
 * What this proposal needs before it can be decided (0039). Set by the AI for
 * this proposal alone, once, before anybody responded — and shown with its
 * reasons so a soft bar is visible to the people it affects.
 */
export async function ConditionsSection({
  proposalId,
  conditions,
  open,
  voters,
}: {
  proposalId: string;
  conditions: Conditions | null;
  open: boolean;
  voters: number;
}) {
  if (!conditions) {
    return open && voters === 0 ? (
      <section className="mb-10">
        <SectionLabel>What it needs</SectionLabel>
        <RunConditions proposalId={proposalId} />
      </section>
    ) : null;
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("proposal_requirement_answers")
    .select("idx, answer, answered_at, profiles:answered_by(display_name)")
    .eq("proposal_id", proposalId);
  const answers = new Map(
    ((data ?? []) as unknown as { idx: number; answer: string; profiles: { display_name: string } | null }[]).map(
      (a) => [a.idx, a],
    ),
  );

  return (
    <section className="mb-10">
      <SectionLabel>What it needs</SectionLabel>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-card border border-line px-4 py-3">
          <p className="font-serif text-2xl tabular-nums text-paper">
            {voters}
            <span className="text-paper-faint"> / {conditions.min_voices}</span>
          </p>
          <p className="text-xs text-paper-faint">voices</p>
        </div>
        <div className="rounded-card border border-line px-4 py-3">
          <p className="font-serif text-lg text-paper">{shortDate(conditions.closes_at)}</p>
          <p className="text-xs text-paper-faint">decided after</p>
        </div>
      </div>

      {conditions.requirements.length ? (
        <ol className="mt-4 space-y-3">
          {conditions.requirements.map((req, i) => {
            const a = answers.get(i + 1);
            return (
              <li key={i} className="rounded-card border border-line px-4 py-3">
                <p className="text-[0.95rem] text-paper">{req}</p>
                {a ? (
                  <p className="mt-2 text-sm leading-relaxed text-paper-dim">
                    {a.answer}
                    <span className="text-paper-faint"> — {a.profiles?.display_name ?? "a member"}</span>
                  </p>
                ) : open ? (
                  <RequirementAnswer proposalId={proposalId} idx={i + 1} />
                ) : (
                  <p className="mt-2 text-sm text-alarm">Not answered</p>
                )}
              </li>
            );
          })}
        </ol>
      ) : null}

      <details className="mt-3">
        <summary className="cursor-pointer text-xs text-paper-faint">Why these</summary>
        <p className="mt-1.5 text-sm leading-relaxed text-paper-dim">{conditions.rationale}</p>
      </details>
    </section>
  );
}
