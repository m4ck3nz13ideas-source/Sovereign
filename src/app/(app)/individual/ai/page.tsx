import Link from "next/link";

import { Card, Empty, Gutter, Screen, SectionLabel, Tag } from "@/components/ui";
import { aiIsLive } from "@/lib/ai";
import { ago } from "@/lib/format";
import { requireSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import type { GuardianNote } from "@/lib/types";

import { Forget } from "./Forget";

export const metadata = { title: "Your AI · Sovereign" };

/**
 * The guardian.
 *
 * This screen exists mostly to say what the thing is not, because the version
 * of it everybody expects — a personal AI that knows what you believe and
 * tells you how to vote — is the version that would wreck this product, and
 * somebody arriving here will assume that is what they have got.
 *
 * It never speaks first, so there is nothing here until you have asked it
 * something. That emptiness is the feature.
 */
export default async function GuardianPage() {
  await requireSession();
  const supabase = await createClient();

  const [{ data: noteRows }, { data: values }] = await Promise.all([
    supabase.rpc("my_guardian_notes", { p_limit: 30 }),
    supabase.rpc("guardian_context"),
  ]);

  const notes = (noteRows ?? []) as GuardianNote[];
  const live = aiIsLive();

  return (
    <Screen>
      <Gutter className="space-y-8 pt-6">
        <div>
          <h2 className="display text-[1.75rem] text-paper">Your AI</h2>
          <p className="mt-2 text-[0.9375rem] leading-relaxed text-paper-dim">
            It reads a proposal against what you wrote down and asks you
            questions about it. Nobody else ever sees any of this, and none of
            it is attached to anything.
          </p>
        </div>

        <section>
          <SectionLabel right={<Tag tone={live ? "calm" : undefined}>{live ? "live" : "offline"}</Tag>}>
            What it will not do
          </SectionLabel>
          <Card>
            <ul className="space-y-2.5 text-[0.9375rem] leading-relaxed text-paper-dim">
              <li>
                <strong className="text-paper">Tell you how to respond.</strong>{" "}
                Not directly, not as a lean, not as a score, and not as
                &ldquo;this seems consistent with your values&rdquo;. It has no
                view on whether a proposal is good.
              </li>
              <li>
                <strong className="text-paper">Speak first.</strong> No
                notifications and no nudges. Everything here happened because
                you pressed something.
              </li>
              <li>
                <strong className="text-paper">Learn anything about you.</strong>{" "}
                It is given the proposal and the{" "}
                {values?.length ? `${values.length} values you wrote down` : "values you write down"}
                . Not your journal, not your drafts, not how you have voted, not
                what you have read, not who you know. It builds no picture of
                you, so there is none to leak and none to be turned against you
                later.
              </li>
              <li>
                <strong className="text-paper">Reach anything.</strong> Nothing
                it says touches a proposal, a decision or the record.
              </li>
            </ul>
          </Card>
        </section>

        <section>
          <SectionLabel
            right={notes.length ? <Forget count={notes.length} /> : undefined}
          >
            What you have asked it
          </SectionLabel>

          {notes.length ? (
            <ul className="space-y-3">
              {notes.map((n) => (
                <li key={n.id}>
                  <Card>
                    <div className="flex items-baseline justify-between gap-3">
                      {n.proposal_id ? (
                        <Link
                          href={`/collective/proposals/${n.proposal_id}`}
                          className="text-[0.95rem] text-paper hover:text-gold"
                        >
                          {n.title ?? "A proposal"}
                        </Link>
                      ) : (
                        <span className="text-[0.95rem] text-paper">A draft</span>
                      )}
                      <span className="smallcaps text-[10px] text-paper-faint">
                        {ago(n.created_at)}
                      </span>
                    </div>

                    {n.questions.length ? (
                      <ul className="mt-3 space-y-2">
                        {n.questions.map((q, i) => (
                          <li
                            key={i}
                            className="border-l border-gold-dim pl-3 text-[0.9375rem] leading-relaxed text-paper"
                            data-selectable
                          >
                            {q}
                          </li>
                        ))}
                      </ul>
                    ) : null}

                    {n.gaps.length ? (
                      <div className="mt-3 border-t border-line pt-3">
                        <p className="smallcaps mb-2 text-[10px] text-paper-faint">
                          not addressed
                        </p>
                        <ul className="space-y-2">
                          {n.gaps.map((g, i) => (
                            <li key={i} className="text-[0.875rem] leading-relaxed text-paper-dim">
                              <span className="text-paper">{g.value}</span> — {g.note}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}

                    {n.reading ? (
                      <p
                        className="mt-3 border-t border-line pt-3 text-[0.9375rem] leading-relaxed text-paper-dim"
                        data-selectable
                      >
                        {n.reading}
                      </p>
                    ) : null}

                    <p className="smallcaps mt-3 text-[10px] text-paper-faint">
                      {n.model}
                    </p>
                  </Card>
                </li>
              ))}
            </ul>
          ) : (
            <Empty
              action={
                <Link href="/collective/proposals" className="text-gold hover:underline">
                  Find something to read
                </Link>
              }
            >
              Nothing yet, and there will be nothing until you ask. Open a
              proposal and press <em>ask your guardian</em> — it is at the
              bottom, under the sliders, where it cannot get between you and
              the thing itself.
            </Empty>
          )}
        </section>

        {!values?.length ? (
          <section>
            <SectionLabel>Before it is much use</SectionLabel>
            <Empty
              action={
                <Link href="/individual/values" className="text-gold hover:underline">
                  Write down what you value
                </Link>
              }
            >
              You have not written any values down, so the guardian has nothing
              of yours to read a proposal against. It will still ask about the
              proposal on its own terms, and it will not guess at what you care
              about.
            </Empty>
          </section>
        ) : null}
      </Gutter>
    </Screen>
  );
}

export const dynamic = "force-dynamic";
