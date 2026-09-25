"use client";

import { useState, useTransition } from "react";

import { Button, Card, Empty, Tag, inputClass } from "@/components/ui";
import type { ContributionKind } from "@/lib/types";

import { adoptAmendment, answerContribution, contribute } from "../../actions";

/**
 * The deliberation thread.
 *
 *   "Unlike social media, debate here focuses on improving proposals. Users
 *    can: ask questions, suggest edits, propose alternatives, flag concerns."
 *
 * A top-level contribution says what kind of thing it is, and that is not
 * taxonomy for its own sake: a question can be answered and counted, and a
 * thread where everything looks the same is one where nothing has to be
 * answered by anybody.
 *
 * No voting on contributions and no sorting by popularity. The order is the
 * order people said things in, because that is what an argument is.
 */

export interface Contribution {
  id: string;
  kind: ContributionKind;
  author: string;
  body: string;
  when: string;
  mine: boolean;
  answer: string | null;
  answeredBy: string | null;
  adopted: boolean;
  replies: Contribution[];
}

const KINDS: {
  value: Exclude<ContributionKind, "reply">;
  label: string;
  prompt: string;
  hint: string;
}[] = [
  {
    value: "question",
    label: "Question",
    prompt: "What do you need to know before you could answer this?",
    hint: "Somebody has to answer it in writing, and it stays on the record unanswered if nobody does.",
  },
  {
    value: "amendment",
    label: "Amendment",
    prompt: "What exactly would you change, and to what?",
    hint: "The proposal's text is fixed. An adopted amendment is one the author says they will carry into a rewrite.",
  },
  {
    value: "alternative",
    label: "Alternative",
    prompt: "What would you do instead?",
    hint: "A different way at the same problem. If it is better, write it as its own proposal.",
  },
  {
    value: "concern",
    label: "Concern",
    prompt: "What is wrong with this?",
    hint: "Answered in writing like a question. It does not block the proposal — everyone sees it before they respond, and the record keeps it.",
  },
];

const TONE: Record<string, "gold" | "alarm" | "calm" | "neutral"> = {
  question: "gold",
  amendment: "neutral",
  alternative: "neutral",
  concern: "alarm",
};

export function Deliberation({
  proposalId,
  contributions,
  canContribute,
  canAdopt,
}: {
  proposalId: string;
  contributions: Contribution[];
  canContribute: boolean;
  /** The author, or a steward of the group it belongs to. */
  canAdopt: boolean;
}) {
  return (
    <div className="space-y-5">
      {contributions.length ? (
        <ul className="space-y-3">
          {contributions.map((c) => (
            <li key={c.id}>
              <Contribution
                item={c}
                proposalId={proposalId}
                canContribute={canContribute}
                canAdopt={canAdopt}
              />
            </li>
          ))}
        </ul>
      ) : (
        <Empty>
          Nothing said yet. The questions in the review are a reasonable place
          to start, and a question here is one somebody has to answer.
        </Empty>
      )}

      {canContribute ? <Compose proposalId={proposalId} /> : null}
    </div>
  );
}

function Contribution({
  item,
  proposalId,
  canContribute,
  canAdopt,
}: {
  item: Contribution;
  proposalId: string;
  canContribute: boolean;
  canAdopt: boolean;
}) {
  const [replying, setReplying] = useState(false);
  const [answering, setAnswering] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const answerable =
    (item.kind === "question" || item.kind === "concern") && !item.answer;

  return (
    <Card className={item.answer ? "border-calm/25" : undefined}>
      <div className="flex items-start justify-between gap-3">
        <p className="whitespace-pre-wrap text-[0.95rem] leading-relaxed text-paper">
          {item.body}
        </p>
        <Tag tone={item.adopted ? "calm" : TONE[item.kind] ?? "neutral"}>
          {item.adopted ? "adopted" : item.kind}
        </Tag>
      </div>

      <p className="smallcaps mt-2 text-[10px] text-paper-faint">
        {item.mine ? "you" : item.author} · {item.when}
      </p>

      {item.answer ? (
        <div className="mt-3 border-t border-line pt-3">
          <p className="smallcaps text-[10px] text-paper-faint">
            answered by {item.answeredBy ?? "a member"}
          </p>
          <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-paper-dim">
            {item.answer}
          </p>
        </div>
      ) : null}

      {item.replies.length ? (
        <ul className="mt-3 space-y-2 border-l border-line pl-4">
          {item.replies.map((r) => (
            <li key={r.id}>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-paper-dim">
                {r.body}
              </p>
              <p className="smallcaps mt-1 text-[10px] text-paper-faint">
                {r.mine ? "you" : r.author} · {r.when}
              </p>
            </li>
          ))}
        </ul>
      ) : null}

      {error ? <p className="mt-2 text-sm text-alarm">{error}</p> : null}

      {replying || answering ? (
        <div className="mt-3 space-y-2 border-t border-line pt-3">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            autoFocus
            placeholder={
              answering
                ? "What is the case, or what you will do about it."
                : "Reply."
            }
            className={`${inputClass} resize-y leading-relaxed`}
          />
          {answering ? (
            <p className="text-xs leading-relaxed text-paper-faint">
              An answer is attributed and permanent. There is no path to change
              or remove it — the same standard as answering a flag.
            </p>
          ) : null}
          <div className="flex gap-2">
            <Button
              type="button"
              disabled={pending || !text.trim()}
              onClick={() =>
                start(async () => {
                  setError(null);
                  const r = answering
                    ? await answerContribution(item.id, proposalId, text)
                    : await contribute(proposalId, "reply", text, item.id);
                  if (!r.ok) setError(r.error);
                  else {
                    setText("");
                    setReplying(false);
                    setAnswering(false);
                  }
                })
              }
            >
              {pending ? "Saving" : answering ? "Answer it" : "Reply"}
            </Button>
            <Button
              type="button"
              tone="ghost"
              onClick={() => {
                setReplying(false);
                setAnswering(false);
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : canContribute ? (
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
          {answerable ? (
            <button
              type="button"
              onClick={() => setAnswering(true)}
              className="smallcaps text-[11px] text-gold hover:underline"
            >
              Answer this
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setReplying(true)}
            className="smallcaps text-[11px] text-paper-faint hover:text-paper-dim"
          >
            reply
          </button>
          {canAdopt && item.kind === "amendment" && !item.adopted ? (
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  setError(null);
                  const r = await adoptAmendment(item.id, proposalId);
                  if (!r.ok) setError(r.error);
                })
              }
              className="smallcaps text-[11px] text-paper-faint hover:text-gold"
            >
              adopt it
            </button>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}

function Compose({ proposalId }: { proposalId: string }) {
  const [kind, setKind] = useState<Exclude<ContributionKind, "reply">>("question");
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const spec = KINDS.find((k) => k.value === kind)!;

  return (
    <div className="space-y-3 border-t border-line pt-5">
      <div className="flex flex-wrap gap-1.5">
        {KINDS.map((k) => (
          <button
            key={k.value}
            type="button"
            onClick={() => setKind(k.value)}
            aria-current={k.value === kind ? "true" : undefined}
            className={`smallcaps rounded-full border px-3 py-1.5 text-[10px] transition-colors ${
              k.value === kind
                ? "border-gold bg-gold-wash text-gold"
                : "border-line text-paper-faint hover:border-gold-dim hover:text-paper-dim"
            }`}
          >
            {k.label}
          </button>
        ))}
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        placeholder={spec.prompt}
        className={`${inputClass} resize-y leading-relaxed`}
      />

      <p className="text-xs leading-relaxed text-paper-faint">{spec.hint}</p>

      {error ? <p className="text-sm text-alarm">{error}</p> : null}

      <Button
        type="button"
        tone="quiet"
        disabled={pending || !text.trim()}
        onClick={() =>
          start(async () => {
            setError(null);
            const r = await contribute(proposalId, kind, text);
            if (!r.ok) setError(r.error);
            else setText("");
          })
        }
      >
        {pending ? "Adding" : `Add ${spec.label.toLowerCase()}`}
      </Button>
    </div>
  );
}
