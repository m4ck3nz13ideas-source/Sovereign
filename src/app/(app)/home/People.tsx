import Link from "next/link";

import { Empty } from "@/components/ui";
import { ago } from "@/lib/format";
import type { PeopleFeedEvent } from "@/lib/types";

/**
 * The social feed: what the people you know have actually done.
 *
 * Read off the ledger, ordered by time, and that is the whole algorithm. There
 * is no ranking, no score, no count on anything, and nothing here can be
 * reacted to — the point is presence, not response.
 *
 * Resonance is deliberately missing. "Four people you follow have responded to
 * this" is the single most effective engagement mechanic there is, and it is a
 * bandwagon wearing a friendly face: the same dynamic rule 3 hides live
 * averages to prevent. Whether somebody voted is not news. What they built is.
 */

const SAID: Record<string, string> = {
  "proposal.submitted": "put something to",
  "proposal.decided": "closed",
  "project.started": "started",
  "project.completed": "finished",
  "projection.resolved": "said how a prediction went on",
};

export function People({ events }: { events: PeopleFeedEvent[] }) {
  if (!events.length) {
    return (
      <Empty>
        Nothing from anyone yet. Follow somebody by handle in People and what
        they propose, decide and finish arrives here — never what they voted,
        and never with a number on it.
      </Empty>
    );
  }

  return (
    <ul className="divide-y divide-line-soft">
      {events.map((e) => {
        const href =
          e.subject_type === "project"
            ? `/collective/projects/${e.subject_id}`
            : `/collective/proposals/${e.subject_id}`;

        return (
          <li key={e.event_id}>
            <Link href={href} className="press block py-3.5">
              <p className="text-[0.9375rem] leading-relaxed text-paper">
                <span className="font-medium">{e.actor_name}</span>{" "}
                <span className="text-paper-dim">
                  {SAID[e.kind] ?? "did something to"}
                </span>{" "}
                {e.title ?? "something"}
              </p>
              <p className="smallcaps mt-1 text-[10px] text-paper-faint">
                {e.tie === "friend" ? "friend" : "following"}
                {e.actor_handle ? ` · @${e.actor_handle}` : ""} · {ago(e.happened_at)}
              </p>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
