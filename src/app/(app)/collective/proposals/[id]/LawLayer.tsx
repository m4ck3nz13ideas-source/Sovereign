"use client";

import { useState, useTransition } from "react";

import { Button, Card, Empty, Tag, inputClass } from "@/components/ui";
import { shortDate } from "@/lib/format";
import { LAWS_BY_ID, UNIVERSAL_LAWS, type LawId } from "@/lib/universal-law";
import type { LawAssessment } from "@/lib/types";

import { answerLawTension, challengeLawReading, runLawAudit } from "../../actions";

/**
 * The Universal Law layer on the review screen.
 *
 * Sits above everything else on the page, because it is above everything else
 * in the architecture: a violation here ends the proposal regardless of what
 * the review found or how the group voted.
 *
 * The three verdicts are visually distinct on purpose. A member glancing at
 * this should be able to tell in one second whether the proposal is
 * constitutionally dead, needs an answer, or is clear.
 */
export function LawLayer({
  proposalId,
  assessments,
  open,
}: {
  proposalId: string;
  assessments: (LawAssessment & { profiles: { display_name: string } | null })[];
  open: boolean;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!assessments.length) {
    return (
      <Empty
        action={
          <Button
            type="button"
            tone="quiet"
            disabled={pending}
            onClick={() =>
              start(async () => {
                setError(null);
                const r = await runLawAudit(proposalId);
                if (!r.ok) setError(r.error);
              })
            }
          >
            {pending ? "Auditing" : "Run the Universal Law audit"}
          </Button>
        }
      >
        {error ??
          "This proposal has not been tested against Universal Law. Until it has, it cannot pass — and nobody is asked to resonate with it."}
      </Empty>
    );
  }

  const byLaw = new Map(assessments.map((a) => [a.law_id, a]));
  const violations = assessments.filter((a) => a.verdict === "violation");
  const tensions = assessments.filter((a) => a.verdict === "tension");
  const openTensions = tensions.filter((a) => !a.resolved_at);
  const isMock = assessments[0]?.model === "mock";

  return (
    <div className="space-y-4">
      {isMock ? (
        <p className="rounded-md border border-alarm/40 bg-alarm/10 px-3 py-2.5 text-sm leading-relaxed text-alarm">
          No model read this. The offline reviewer records no objection because
          it cannot weigh a proposal against a law — not because the proposal is
          clear. Treat it as unexamined. A guessed violation would invalidate
          this permanently, so it declines to guess.
        </p>
      ) : null}

      {violations.length ? (
        <Card className="border-alarm">
          <div className="flex items-start justify-between gap-3">
            <h3 className="font-serif text-xl text-alarm">
              {violations.length === 1
                ? "This violates a Universal Law"
                : `This violates ${violations.length} Universal Laws`}
            </h3>
          </div>
          <p className="mt-2 text-[0.95rem] leading-relaxed text-paper-dim">
            The proposal cannot pass and resonance is closed. This is not a low
            score to be outvoted — law constrains what the group may decide, and
            no steward can set it aside. If the audit is wrong, challenge it
            below; if it is right, the proposal has to change and be submitted
            again.
          </p>
        </Card>
      ) : openTensions.length ? (
        <Card className="border-gold-dim bg-gold-wash">
          <p className="text-[0.95rem] leading-relaxed text-paper">
            {openTensions.length === 1
              ? "One law is in tension with this proposal."
              : `${openTensions.length} laws are in tension with this proposal.`}{" "}
            Each needs an answer in writing before it can pass. A tension is not
            a violation — the group resolves it and proceeds.
          </p>
        </Card>
      ) : (
        <Card className="border-calm/40">
          <p className="text-[0.95rem] leading-relaxed text-paper">
            Clear against all ten Universal Laws.
          </p>
        </Card>
      )}

      <ul className="space-y-2">
        {UNIVERSAL_LAWS.map((law) => {
          const a = byLaw.get(law.id);
          if (!a) {
            return (
              <li key={law.id}>
                <Card className="border-alarm/40">
                  <p className="text-[0.95rem] text-paper">{law.name}</p>
                  <p className="mt-1 text-sm text-alarm">
                    Not assessed. The audit did not cover this law, so it is
                    incomplete — run it again.
                  </p>
                </Card>
              </li>
            );
          }
          return (
            <li key={law.id}>
              <LawRow
                law={law.id}
                assessment={a}
                proposalId={proposalId}
                canAct={open}
              />
            </li>
          );
        })}
      </ul>

      {error ? <p className="text-sm text-alarm">{error}</p> : null}

      <p className="smallcaps text-[10px] text-paper-faint">
        {assessments[0].prompt_id} v{assessments[0].prompt_version} ·{" "}
        {assessments[0].model} · {shortDate(assessments[0].created_at)}
      </p>
    </div>
  );
}

function LawRow({
  law,
  assessment,
  proposalId,
  canAct,
}: {
  law: LawId | string;
  assessment: LawAssessment & { profiles: { display_name: string } | null };
  proposalId: string;
  canAct: boolean;
}) {
  const spec = LAWS_BY_ID[law as LawId];
  const [expanded, setExpanded] = useState(
    assessment.verdict !== "aligned",
  );
  const [mode, setMode] = useState<"idle" | "answer" | "challenge">("idle");
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const tone =
    assessment.verdict === "violation"
      ? "alarm"
      : assessment.verdict === "tension"
        ? assessment.resolved_at
          ? "calm"
          : "gold"
        : "neutral";

  return (
    <Card
      className={
        assessment.verdict === "violation"
          ? "border-alarm/50"
          : assessment.verdict === "tension" && !assessment.resolved_at
            ? "border-gold-dim"
            : ""
      }
    >
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-start justify-between gap-3 text-left"
      >
        <span className="min-w-0">
          <span className="block text-[0.95rem] text-paper">
            {spec?.name ?? law}
          </span>
          {!expanded ? (
            <span className="mt-0.5 block truncate text-sm text-paper-faint">
              {assessment.reasoning}
            </span>
          ) : null}
        </span>
        <Tag tone={tone}>
          {assessment.verdict === "tension" && assessment.resolved_at
            ? "answered"
            : assessment.verdict}
        </Tag>
      </button>

      {expanded ? (
        <div className="mt-3 border-t border-line pt-3">
          {spec ? (
            <p className="mb-3 text-sm italic leading-relaxed text-paper-faint">
              &ldquo;{spec.text}&rdquo;
            </p>
          ) : null}

          <p className="whitespace-pre-wrap text-[0.95rem] leading-relaxed text-paper-dim">
            {assessment.reasoning}
          </p>

          {assessment.resolved_at ? (
            <div className="mt-3.5 border-t border-line pt-3.5">
              <p className="smallcaps mb-1 text-[10px] text-paper-faint">
                answered by {assessment.profiles?.display_name ?? "a member"} ·{" "}
                {shortDate(assessment.resolved_at)}
              </p>
              <p className="text-sm leading-relaxed text-paper">
                {assessment.resolution}
              </p>
            </div>
          ) : null}

          {canAct && mode === "idle" ? (
            <div className="mt-3.5 flex flex-wrap gap-3">
              {assessment.verdict === "tension" && !assessment.resolved_at ? (
                <button
                  type="button"
                  onClick={() => setMode("answer")}
                  className="smallcaps text-[11px] text-gold hover:underline"
                >
                  Answer this
                </button>
              ) : null}
              {assessment.verdict !== "aligned" ? (
                <button
                  type="button"
                  onClick={() => setMode("challenge")}
                  className="smallcaps text-[11px] text-paper-faint hover:text-paper-dim"
                >
                  Challenge this reading
                </button>
              ) : null}
            </div>
          ) : null}

          {mode !== "idle" ? (
            <div className="mt-3.5 space-y-3 border-t border-line pt-3.5">
              <p className="text-sm leading-relaxed text-paper-dim">
                {mode === "answer"
                  ? "What changed in the proposal, or why this tension is acceptable here. Goes on the record with your name on it."
                  : "Why the audit is wrong — what it misread, or why the law does not reach this proposal. This does not overturn the verdict. It sends your argument back to the Truth Engine, which must address it and may well not change its mind."}
              </p>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={4}
                autoFocus
                className={`${inputClass} resize-y leading-relaxed`}
              />
              {error ? <p className="text-sm text-alarm">{error}</p> : null}
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  disabled={
                    pending || text.trim().length < (mode === "answer" ? 20 : 40)
                  }
                  onClick={() =>
                    start(async () => {
                      setError(null);
                      const r =
                        mode === "answer"
                          ? await answerLawTension(assessment.id, text)
                          : await challengeLawReading(assessment.id, proposalId, text);
                      if (!r.ok) setError(r.error);
                      else {
                        setMode("idle");
                        setText("");
                      }
                    })
                  }
                >
                  {pending
                    ? mode === "answer"
                      ? "Recording"
                      : "Re-auditing"
                    : mode === "answer"
                      ? "Answer it"
                      : "Send the challenge"}
                </Button>
                <Button type="button" tone="ghost" onClick={() => setMode("idle")}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}
