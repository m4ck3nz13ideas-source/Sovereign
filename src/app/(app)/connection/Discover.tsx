import Link from "next/link";

import { Card, Empty, SectionLabel, Tag } from "@/components/ui";
import { ago, shortDate, STATUS_LABEL } from "@/lib/format";
import type { AttentionItem, DormantProposal, SignalEvent } from "@/lib/types";

/**
 * The discovery layer.
 *
 *   "Help people discover important issues. Prevent overload. Show signal over
 *    noise."
 *
 * Three sections, in the order the argument runs: what is waiting on you, what
 * deserves another look, and what actually happened. Nothing here is ranked by
 * engagement, because none of it has any — a proposal is not more important
 * because more people opened it.
 *
 * This matters more than it looks. A proposal addressed to a place needs a
 * floor of real responses before it can pass, so a proposal nobody finds gets
 * none. The feed is the difference between the loop running and stalling.
 */

export function Attention({ items }: { items: AttentionItem[] }) {
  if (!items.length) {
    return (
      <Empty>
        Nothing is waiting on you here. That is a real state, not an empty one —
        it means everything open has had your answer.
      </Empty>
    );
  }

  const yours = items.filter((i) => i.weight < 9);
  const others = items.filter((i) => i.weight >= 9);

  return (
    <div className="space-y-6">
      {yours.length ? (
        <ul className="space-y-2">
          {yours.map((i) => (
            <li key={i.proposal_id}>
              <AttentionRow item={i} />
            </li>
          ))}
        </ul>
      ) : null}

      {others.length ? (
        <div>
          <p className="smallcaps mb-2 text-[10px] text-paper-faint">
            open, and not waiting on you
          </p>
          <ul className="space-y-2">
            {others.map((i) => (
              <li key={i.proposal_id}>
                <AttentionRow item={i} quiet />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function AttentionRow({ item, quiet }: { item: AttentionItem; quiet?: boolean }) {
  const closing =
    item.closes_at && new Date(item.closes_at) > new Date()
      ? `deliberation closes ${shortDate(item.closes_at)}`
      : null;

  return (
    <Link
      href={`/connection/proposals/${item.proposal_id}`}
      className={`block rounded-card border p-4 transition-colors hover:border-gold-dim ${
        quiet
          ? "border-line bg-transparent"
          : "border-line bg-surface-soft"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-serif text-lg leading-snug text-paper">
          {item.title}
        </h3>
        <Tag tone={quiet ? "neutral" : item.weight <= 3 ? "alarm" : "gold"}>
          {item.reason}
        </Tag>
      </div>

      <p className="mt-1.5 text-sm leading-relaxed text-paper-dim">
        {item.summary}
      </p>

      {!quiet ? (
        <p className="mt-2 text-sm leading-relaxed text-paper-faint">
          {item.detail}
        </p>
      ) : null}

      <p className="smallcaps mt-2.5 flex flex-wrap items-center gap-x-2 text-[10px] text-paper-faint">
        <span>{STATUS_LABEL[item.status]}</span>
        <span>·</span>
        <span>{ago(item.submitted_at)}</span>
        {closing ? (
          <>
            <span>·</span>
            <span>{closing}</span>
          </>
        ) : null}
      </p>
    </Link>
  );
}

export function Dormant({ items }: { items: DormantProposal[] }) {
  if (!items.length) return null;

  return (
    <section className="mb-10">
      <SectionLabel right={`${items.length}`}>Deserves another look</SectionLabel>

      <p className="mb-3 text-sm leading-relaxed text-paper-faint">
        These did not fail on their merits. They ran out of people, or they were
        agreed and then nobody committed what they needed. Taking one up writes
        a new proposal from it — it goes through the sharpening and the audit
        again, because a clearance from one moment is not a clearance now.
      </p>

      <ul className="space-y-2">
        {items.map((d) => (
          <li key={d.proposal_id}>
            <Card>
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-serif text-lg leading-snug text-paper">
                  {d.title}
                </h3>
                <Tag>{shortDate(d.decided_at)}</Tag>
              </div>

              <p className="mt-1.5 text-sm leading-relaxed text-paper-dim">
                {d.summary}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-paper-faint">
                {d.why}
                {d.voices < d.needed
                  ? ` ${d.voices} ${d.voices === 1 ? "voice" : "voices"}, and this scale needs ${d.needed}.`
                  : ""}
              </p>

              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
                <Link
                  href={`/connection/proposals/new?from=${d.proposal_id}`}
                  className="smallcaps text-[11px] text-gold hover:underline"
                >
                  Take it up again →
                </Link>
                <Link
                  href={`/connection/proposals/${d.proposal_id}`}
                  className="smallcaps text-[11px] text-paper-faint hover:text-paper-dim"
                >
                  read it first
                </Link>
              </div>
            </Card>
          </li>
        ))}
      </ul>
    </section>
  );
}

const SIGNAL_VERB: Record<string, string> = {
  "proposal.decided": "decided",
  "project.started": "started",
  "project.completed": "finished",
  "flag.answered": "a flag answered on",
};

export function Signal({ events }: { events: SignalEvent[] }) {
  if (!events.length) return null;

  return (
    <section className="mb-10">
      <SectionLabel>What has actually happened</SectionLabel>

      <ul className="space-y-1.5">
        {events.map((e) => {
          const outcome =
            e.kind === "proposal.decided"
              ? String(e.payload?.outcome ?? "")
              : null;

          return (
            <li
              key={e.seq}
              className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-line py-2.5 last:border-0"
            >
              <span className="min-w-0 text-[0.95rem] leading-snug text-paper-dim">
                <Link
                  href={
                    e.kind.startsWith("project")
                      ? `/connection/projects`
                      : `/connection/proposals/${e.subject_id}`
                  }
                  className="text-paper hover:text-gold"
                >
                  {e.title}
                </Link>{" "}
                {SIGNAL_VERB[e.kind] ?? e.kind}
                {outcome ? (
                  <span className={outcome === "passed" ? "text-calm" : "text-paper-faint"}>
                    {" "}
                    — {outcome}
                  </span>
                ) : null}
              </span>
              <span className="smallcaps whitespace-nowrap text-[10px] text-paper-faint">
                {ago(e.created_at)}
              </span>
            </li>
          );
        })}
      </ul>

      <p className="mt-3 text-xs leading-relaxed text-paper-faint">
        Read off the ledger, not assembled from the tables — these are the
        governance acts themselves, in the order they were recorded.
      </p>
    </section>
  );
}
