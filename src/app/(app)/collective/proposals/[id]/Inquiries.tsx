"use client";

import { useState, useTransition } from "react";

import { askQuestion, withdrawInquiry } from "@/app/(app)/collective/actions";
import { Button, Card, Empty, inputClass } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import type { InquiryLens, InquirySummary, Position } from "@/lib/types";

/**
 * Look something up, before you decide.
 *
 * Rule 2 of the UX rules is understanding before opinion, and between reading
 * a proposal and moving the sliders there was nowhere to go and check
 * anything. This is that.
 *
 * It returns POSITIONS, never an answer, and the screen has to keep saying so.
 * Nothing here is sorted by quality, nothing carries a score, and the lenses
 * appear in the order they came back rather than in any order that would imply
 * one of them settles it. If a future version of this grows a "best answer"
 * banner, the thing has become an oracle and the governance layer underneath
 * it has stopped mattering.
 */

const LENS_NAME: Record<InquiryLens, string> = {
  empirical: "The literature",
  scripture: "Scripture",
  philosophy: "Philosophy",
  literature: "Books",
  screen: "Film",
  practice: "Practice",
  testimony: "Testimony",
};

const LENS_NOTE: Record<InquiryLens, string> = {
  empirical: "the scientific and statistical record",
  scripture: "religious and wisdom texts",
  philosophy: "argued philosophical positions",
  literature: "novels, poetry, essays",
  screen: "film and documentary",
  practice: "what people who do this work do",
  testimony: "people the question lands on",
};

export function Inquiries({
  proposalId,
  inquiries,
  userId,
  canAsk,
}: {
  proposalId: string;
  inquiries: InquirySummary[];
  userId: string;
  canAsk: boolean;
}) {
  const [question, setQuestion] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [open, setOpen] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <p className="text-sm leading-relaxed text-paper-faint">
        Ask a question this proposal turns on and several ways of knowing will
        say what they hold about it — the literature, the traditions, the people
        who do the work. They are not reconciled into an answer, because
        reconciling them is the part you are here to do.
      </p>

      {canAsk ? (
        <div className="space-y-2">
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Does sharing a tool between households actually work?"
            className={inputClass}
            aria-label="Your question"
          />
          <div className="flex items-center gap-2">
            <Button
              type="button"
              tone="quiet"
              disabled={pending || question.trim().length < 12}
              onClick={() =>
                start(async () => {
                  setError(null);
                  const r = await askQuestion({ proposalId, question });
                  if (!r.ok) setError(r.error);
                  else setQuestion("");
                })
              }
            >
              {pending ? "Looking" : "Look it up"}
            </Button>
            {question.trim().length > 0 && question.trim().length < 12 ? (
              <span className="text-sm text-paper-faint">A bit more.</span>
            ) : null}
          </div>
          {error ? <p className="text-sm text-alarm">{error}</p> : null}
        </div>
      ) : null}

      {inquiries.length ? (
        <div className="space-y-3">
          {inquiries.map((inq) => (
            <Inquiry
              key={inq.id}
              inquiry={inq}
              proposalId={proposalId}
              mine={inq.asked_by === userId}
              expanded={open === inq.id}
              onToggle={() => setOpen(open === inq.id ? null : inq.id)}
            />
          ))}
        </div>
      ) : (
        <Empty>
          Nothing has been looked up on this one yet. What a question turns up
          stays here for everybody, so nobody has to look it up twice.
        </Empty>
      )}
    </div>
  );
}

function Inquiry({
  inquiry,
  proposalId,
  mine,
  expanded,
  onToggle,
}: {
  inquiry: InquirySummary;
  proposalId: string;
  mine: boolean;
  expanded: boolean;
  onToggle: () => void;
}) {
  const [positions, setPositions] = useState<Position[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [pending, start] = useTransition();

  async function toggle() {
    onToggle();
    if (!expanded && positions === null) {
      setLoading(true);
      const supabase = createClient();
      const { data } = await supabase.rpc("positions_for", {
        p_inquiry_id: inquiry.id,
      });
      setPositions((data ?? []) as Position[]);
      setLoading(false);
    }
  }

  return (
    <Card>
      <button
        type="button"
        onClick={toggle}
        className="press w-full text-left"
        aria-expanded={expanded}
      >
        <p className="text-[0.9375rem] leading-relaxed text-paper" data-selectable>
          {inquiry.question}
        </p>
        <p className="smallcaps mt-1 text-[10px] text-paper-faint">
          {inquiry.lenses} ways of knowing · asked by {inquiry.asked_by_name} ·{" "}
          {expanded ? "hide" : "read"}
        </p>
      </button>

      {expanded ? (
        <div className="mt-4 space-y-4 border-t border-line-soft pt-4">
          {loading ? (
            <p className="text-sm text-paper-faint">Reading…</p>
          ) : (
            <>
              {(positions ?? []).map((pos) => (
                <div key={`${pos.lens}-${pos.ordinal}`}>
                  <p className="smallcaps text-[10px] text-gold">
                    {LENS_NAME[pos.lens]}
                  </p>
                  <p className="text-[10px] text-paper-faint">
                    {LENS_NOTE[pos.lens]}
                  </p>
                  <p
                    className="mt-2 text-[0.9375rem] leading-relaxed text-paper"
                    data-selectable
                  >
                    {pos.claim}
                  </p>
                  <p
                    className="mt-1 text-[0.9375rem] leading-relaxed text-paper-dim"
                    data-selectable
                  >
                    {pos.reasoning}
                  </p>
                  {pos.source_hint ? (
                    <p className="mt-1 text-sm text-paper-faint">
                      Somewhere to start: {pos.source_hint}
                    </p>
                  ) : null}
                </div>
              ))}

              {inquiry.note ? (
                <p className="border-t border-line-soft pt-4 text-sm leading-relaxed text-paper-dim">
                  {inquiry.note}
                </p>
              ) : null}

              {/*
                Said every time, not once in a tooltip. The failure mode this
                guards against is somebody reading a fluent paragraph as a
                citation, and fluency is exactly what a model is good at.
              */}
              <p className="border-t border-line-soft pt-4 text-sm leading-relaxed text-paper-faint">
                These are {inquiry.model}&rsquo;s account of what each of these
                holds, not a literature review and not verified. A named work is
                somewhere to start reading, not evidence that the claim is true.
                Nothing here has been reconciled into an answer, and none of it
                counts towards anything — the decision is still yours.
              </p>

              {mine ? (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      await withdrawInquiry(inquiry.id, proposalId);
                    })
                  }
                  className="smallcaps text-[11px] text-paper-faint hover:text-alarm"
                >
                  {pending ? "Withdrawing" : "Withdraw this"}
                </button>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </Card>
  );
}
