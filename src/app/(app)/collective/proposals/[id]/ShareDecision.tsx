"use client";

import { useState, useTransition } from "react";

import { Button, Card } from "@/components/ui";

import { shareDecision, unshareDecision } from "../../actions";

/**
 * Share a decision (rule 45).
 *
 * Says exactly what goes public before anyone presses anything, because a
 * share is the one place this app lets a record leave the people it was
 * addressed to.
 */
export function ShareDecision({
  proposalId,
  title,
  token: initial,
  canShare,
  byGroup,
}: {
  proposalId: string;
  title: string;
  /** The live link's token, if it is shared. */
  token: string | null;
  /** A steward (group) or the author (place). */
  canShare: boolean;
  byGroup: boolean;
}) {
  const [token, setToken] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();

  if (!token && !canShare) return null;

  const url = token && typeof window !== "undefined" ? `${window.location.origin}/explore/decision/${token}` : null;

  function share() {
    setError(null);
    start(async () => {
      const r = await shareDecision(proposalId);
      if (r.ok) setToken(r.token);
      else setError(r.error);
    });
  }

  function stop() {
    setError(null);
    start(async () => {
      const r = await unshareDecision(proposalId);
      if (r.ok) setToken(null);
      else setError(r.error);
    });
  }

  async function send() {
    if (!url) return;
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        // Cancelled, or not allowed here. Fall through to copying.
      }
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Card>
      <h3 className="text-center font-serif text-lg text-paper">
        {token ? "Shared publicly" : "Share this decision"}
      </h3>
      <p className="mt-1.5 text-sm leading-relaxed text-paper-dim">
        Public: the title, summary, outcome, rationale and {byGroup ? "the group's numbers" : "the numbers"}.
        Never public: names, responses, notes.
      </p>

      {token ? (
        <>
          <p className="mt-3 break-all rounded-md border border-line bg-surface px-3 py-2 text-xs text-paper-dim">
            {url ?? `/explore/decision/${token}`}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" onClick={send} disabled={pending}>
              {copied ? "Link copied" : "Send the link"}
            </Button>
            {canShare ? (
              <Button type="button" tone="ghost" onClick={stop} disabled={pending}>
                Stop sharing
              </Button>
            ) : null}
          </div>
          {canShare ? (
            <p className="mt-2 text-xs text-paper-faint">Stopping kills the link at once.</p>
          ) : null}
        </>
      ) : (
        <div className="mt-3">
          <Button type="button" onClick={share} disabled={pending}>
            {pending ? "Making the link…" : "Make a public link"}
          </Button>
        </div>
      )}

      {error ? <p className="mt-2 text-sm text-alarm">{error}</p> : null}
    </Card>
  );
}
