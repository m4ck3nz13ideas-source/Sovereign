"use client";

import { useState, useTransition } from "react";

import { Button, Card, Empty, ScoreBar, inputClass } from "@/components/ui";
import { RESONANCE_DIMENSIONS } from "@/lib/collective";
import type { ResonanceSummary, ResonanceVote } from "@/lib/types";

import { castResonance, markRead } from "../../actions";

/**
 * Resonance: three sliders, not a yes or a no.
 *
 * Two rules are enforced here and again in the database:
 *
 *   1. UNDERSTANDING BEFORE ACTION. The sliders are inert until a review
 *      exists and this member has said they have read it. Not a nudge — the
 *      controls genuinely do not work.
 *
 *   2. NO LIVE AVERAGE. Members see how many have responded and their own
 *      numbers. The group's averages appear only once the proposal closes.
 *      A visible running average recreates exactly the bandwagon dynamic that
 *      resonance exists to remove, and it is the single easiest thing to get
 *      wrong in a tool like this.
 */
export function ResonancePanel({
  proposalId,
  hasReview,
  hasRead,
  open,
  mine,
  summary,
}: {
  proposalId: string;
  hasReview: boolean;
  hasRead: boolean;
  open: boolean;
  mine: ResonanceVote | null;
  summary: ResonanceSummary;
}) {
  const [values, setValues] = useState({
    alignment: mine ? Number(mine.alignment) : 0.5,
    confidence: mine ? Number(mine.confidence) : 0.5,
    urgency: mine ? Number(mine.urgency) : 0.5,
  });
  const [note, setNote] = useState(mine?.note ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();

  const locked = !hasReview || !hasRead || !open;

  return (
    <div className="space-y-4">
      {/* The gate. Explicit, not implied. */}
      {!hasReview ? (
        <Empty>
          Resonance opens when the review lands. Nobody is asked to respond to
          something that has not been read.
        </Empty>
      ) : !hasRead && open ? (
        <ReadGate proposalId={proposalId} />
      ) : null}

      {hasReview && hasRead && open ? (
        <Card>
          <div className="space-y-6">
            {RESONANCE_DIMENSIONS.map((dim) => (
              <div key={dim.key}>
                <div className="mb-1.5 flex items-baseline justify-between gap-3">
                  <label
                    htmlFor={`res-${dim.key}`}
                    className="text-[0.95rem] text-paper"
                  >
                    {dim.label}
                  </label>
                  <span className="tabular-nums text-sm text-gold">
                    {values[dim.key].toFixed(2)}
                  </span>
                </div>

                <p className="mb-2.5 text-sm leading-relaxed text-paper-dim">
                  {dim.question}
                </p>

                <input
                  id={`res-${dim.key}`}
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={values[dim.key]}
                  disabled={locked}
                  onChange={(e) =>
                    setValues((v) => ({ ...v, [dim.key]: Number(e.target.value) }))
                  }
                  className="w-full accent-[var(--color-gold)]"
                />

                <div className="smallcaps mt-1 flex justify-between text-[10px] text-paper-faint">
                  <span>{dim.low}</span>
                  <span>{dim.high}</span>
                </div>
              </div>
            ))}

            <div>
              <label
                htmlFor="res-note"
                className="smallcaps mb-1.5 block text-[11px] text-paper-faint"
              >
                Anything you want on the record
              </label>
              <textarea
                id="res-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                disabled={locked}
                placeholder="Optional. Read by the group once this closes."
                className={`${inputClass} resize-y`}
              />
            </div>

            {error ? <p className="text-sm text-alarm">{error}</p> : null}

            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                disabled={pending || locked}
                onClick={() =>
                  start(async () => {
                    setError(null);
                    const r = await castResonance(
                      proposalId,
                      values.alignment,
                      values.confidence,
                      values.urgency,
                      note,
                    );
                    if (!r.ok) setError(r.error);
                    else {
                      setSaved(true);
                      window.setTimeout(() => setSaved(false), 2200);
                    }
                  })
                }
              >
                {pending ? "Recording" : mine ? "Change my resonance" : "Record resonance"}
              </Button>

              {saved ? (
                <span className="smallcaps text-[10px] text-gold">recorded</span>
              ) : mine ? (
                <span className="smallcaps text-[10px] text-paper-faint">
                  you have responded — you can change it until this closes
                </span>
              ) : null}
            </div>
          </div>
        </Card>
      ) : null}

      {/* Counts always. Numbers only once closed. */}
      <Card>
        <p className="text-[0.95rem] text-paper">
          {summary.voter_count} of {summary.member_count}{" "}
          {summary.member_count === 1 ? "member has" : "members have"} responded
        </p>

        {summary.revealed ? (
          <div className="mt-4 space-y-3.5">
            <ScoreBar label="Alignment" value={summary.avg_alignment} />
            <ScoreBar label="Confidence" value={summary.avg_confidence} />
            <ScoreBar label="Urgency" value={summary.avg_urgency} />
          </div>
        ) : (
          <p className="mt-2 text-sm leading-relaxed text-paper-faint">
            The group&rsquo;s numbers stay hidden until this closes. Seeing a
            running average changes what people report, which is the problem
            resonance exists to solve.
          </p>
        )}

        {mine && !summary.revealed ? (
          <div className="mt-5 border-t border-line pt-4">
            <p className="smallcaps mb-3 text-[10px] text-paper-faint">yours</p>
            <div className="space-y-3">
              <ScoreBar label="Alignment" value={Number(mine.alignment)} />
              <ScoreBar label="Confidence" value={Number(mine.confidence)} />
              <ScoreBar label="Urgency" value={Number(mine.urgency)} />
            </div>
          </div>
        ) : null}
      </Card>
    </div>
  );
}

/**
 * The understanding gate.
 *
 * Deliberately a separate, deliberate action rather than a checkbox on the
 * form. It is recorded on the proposal, so the group can see who read the
 * review before responding to it.
 */
function ReadGate({ proposalId }: { proposalId: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <Card className="border-gold-dim bg-gold-wash">
      <p className="text-[0.95rem] leading-relaxed text-paper">
        The sliders unlock once you have read the review above.
      </p>
      <p className="mt-2 text-sm leading-relaxed text-paper-dim">
        This is recorded. Not to police anyone — so that the group can tell the
        difference between a proposal three people considered and one three
        people scrolled past.
      </p>
      {error ? <p className="mt-2 text-sm text-alarm">{error}</p> : null}
      <Button
        type="button"
        className="mt-4"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError(null);
            const r = await markRead(proposalId);
            if (!r.ok) setError(r.error);
          })
        }
      >
        {pending ? "Recording" : "I have read the review"}
      </Button>
    </Card>
  );
}
