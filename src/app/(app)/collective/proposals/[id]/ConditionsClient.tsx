"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button, inputClass } from "@/components/ui";

import {
  answerMyChallenge,
  answerRequirement,
  challengeConditions,
  markAffectedReached,
  replyToChallenge,
  runConditions,
} from "../../actions";

export function RequirementAnswer({ proposalId, idx }: { proposalId: string; idx: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="mt-2 text-sm text-gold hover:underline">
        Answer
      </button>
    );

  return (
    <div className="mt-2 space-y-2">
      <textarea className={`${inputClass} min-h-20`} value={text} onChange={(e) => setText(e.target.value)} />
      {error ? <p className="text-xs text-alarm">{error}</p> : null}
      <Button
        type="button"
        tone="quiet"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await answerRequirement(proposalId, idx, text);
            if (!r.ok) setError(r.error);
            else router.refresh();
          })
        }
      >
        Answer on the record
      </Button>
    </div>
  );
}

export function RunConditions({ proposalId }: { proposalId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div>
      <Button
        type="button"
        tone="quiet"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await runConditions(proposalId);
            if (!r.ok) setError(r.error);
            else router.refresh();
          })
        }
      >
        {pending ? "Setting" : "Set its conditions"}
      </Button>
      {error ? <p className="mt-2 text-xs text-alarm">{error}</p> : null}
    </div>
  );
}

export function AffectedReached({ proposalId, idx }: { proposalId: string; idx: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="mt-2 text-sm text-gold hover:underline">
        Mark reached
      </button>
    );
  return (
    <div className="mt-2 space-y-2">
      <textarea
        className={`${inputClass} min-h-20`}
        placeholder="How and when they were given the chance to take part"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      {error ? <p className="text-xs text-alarm">{error}</p> : null}
      <Button
        type="button"
        tone="quiet"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await markAffectedReached(proposalId, idx, text);
            if (!r.ok) setError(r.error);
            else router.refresh();
          })
        }
      >
        Record on the record
      </Button>
    </div>
  );
}

export function ChallengeConditions({
  proposalId,
  fixed,
  unread,
}: {
  proposalId: string;
  fixed: boolean;
  unread: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="mt-3">
      {unread ? (
        <Button
          type="button"
          tone="quiet"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await answerMyChallenge(proposalId);
              if (!r.ok) setError(r.error);
              else router.refresh();
            })
          }
        >
          {pending ? "Re-reading" : "Re-read with my challenge"}
        </Button>
      ) : null}
      {!open ? (
        <button type="button" onClick={() => setOpen(true)} className="mt-2 block text-xs text-paper-faint hover:text-gold">
          These conditions aren&apos;t right
        </button>
      ) : (
        <div className="mt-2 space-y-2">
          <textarea
            className={`${inputClass} min-h-20`}
            placeholder="What should change, and why it matters for this decision"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <Button
            type="button"
            tone="quiet"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await challengeConditions(proposalId, text);
                if (!r.ok) setError(r.error);
                else {
                  setText("");
                  setOpen(false);
                  router.refresh();
                }
              })
            }
          >
            {pending ? "Sending" : "Challenge"}
          </Button>
          <p className="text-xs text-paper-faint">
            {fixed
              ? "People have already responded, so the conditions are fixed. Your challenge goes on the record for debate — an improved proposal is how it changes things."
              : "The AI re-reads with your argument and can only add, never remove. It never holds up the decision."}
          </p>
        </div>
      )}
      {error ? <p className="mt-2 text-xs text-alarm">{error}</p> : null}
    </div>
  );
}

export function ChallengeReply({ proposalId, challengeId }: { proposalId: string; challengeId: string }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  return (
    <form
      className="mt-2 flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!text.trim()) return;
        start(async () => {
          const r = await replyToChallenge(proposalId, challengeId, text);
          if (r.ok) {
            setText("");
            router.refresh();
          }
        });
      }}
    >
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Reply"
        aria-label="Reply to this challenge"
        className="min-w-0 flex-1 rounded-full border border-line bg-ink px-3 py-1.5 text-sm text-paper outline-none focus:border-gold"
      />
      <button type="submit" disabled={pending || !text.trim()} className="text-sm text-gold disabled:opacity-40">
        Reply
      </button>
    </form>
  );
}
