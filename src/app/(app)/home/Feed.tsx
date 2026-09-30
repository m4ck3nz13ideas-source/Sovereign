"use client";

import Link from "next/link";
import { useTransition } from "react";

import { Empty } from "@/components/ui";
import { ago } from "@/lib/format";
import type { WitnessFeedItem } from "@/lib/types";

import { toggleKeep } from "../collective/actions";

/**
 * The feed: what people wrote, and what they did, in one stream in time order.
 *
 * That is the whole algorithm, and the thing to notice is what there is no
 * field for. No score, no count, no reach, nothing that could become a second
 * sort key. The selecting happens once, at the door, by the witness — see 0025
 * for why that is the only place it can honestly go.
 *
 * Resonance is deliberately absent, restating rule 20: "four people you follow
 * have responded to this" is the single most effective engagement mechanic
 * there is, and it is a bandwagon with a friendly face.
 */

const SAID: Record<string, string> = {
  "proposal.submitted": "put something to",
  "proposal.decided": "closed",
  "project.started": "started",
  "project.completed": "finished",
  "projection.resolved": "said how a prediction went on",
};

const SAYS: Record<string, string> = {
  made: "made",
  saw: "saw",
  asked: "asking",
  thanks: "grateful for",
  learned: "learned",
};

export function Feed({
  items,
  kept,
}: {
  items: WitnessFeedItem[];
  kept: Set<string>;
}) {
  if (!items.length) {
    return (
      <Empty>
        Nothing here yet. Follow somebody by handle in People, or write
        something yourself — what arrives is what people around you made, saw,
        asked and finished, in the order it happened.
      </Empty>
    );
  }

  return (
    <ul className="space-y-3">
      {items.map((item) =>
        item.source === "post" ? (
          <PostCard key={item.item_id} item={item} kept={kept.has(item.item_id)} />
        ) : (
          <ActLine key={item.item_id} item={item} />
        ),
      )}
    </ul>
  );
}

function PostCard({ item, kept }: { item: WitnessFeedItem; kept: boolean }) {
  const [pending, start] = useTransition();

  return (
    <li className="rounded-card border border-line bg-surface-soft p-4">
      <p className="smallcaps mb-2 text-[10px] text-paper-faint">
        {item.actor_name} {SAYS[item.kind] ?? "wrote"}
      </p>

      <p className="whitespace-pre-wrap text-[0.95rem] leading-relaxed text-paper">
        {item.body}
      </p>

      {item.media_url ? <Media url={item.media_url} kind={item.media_kind} /> : null}

      <div className="mt-3 flex items-center gap-3">
        <p className="smallcaps text-[10px] text-paper-faint">
          {[item.actor_handle ? `@${item.actor_handle}` : null, ago(item.happened_at)]
            .filter(Boolean)
            .join(" · ")}
        </p>

        {/* Kept, not liked. Nobody is told, there is no number, and it orders
            nothing — it is a shelf, not a signal. */}
        <button
          type="button"
          disabled={pending}
          onClick={() => start(async () => { await toggleKeep(item.item_id); })}
          className={`smallcaps ml-auto text-[10px] transition-colors ${
            kept ? "text-gold" : "text-paper-faint hover:text-paper-dim"
          }`}
        >
          {kept ? "kept" : "keep"}
        </button>
      </div>
    </li>
  );
}

/**
 * One link, rendered as what it says it is.
 *
 * Nothing is fetched and nothing is embedded from another origin — the app
 * cannot vouch for what is behind a link, so it does not dress one up as
 * though it can. An image is shown because an image is what it claims to be;
 * everything else is a link that says where it goes.
 */
function Media({ url, kind }: { url: string; kind: string | null }) {
  if (kind === "image") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt=""
        loading="lazy"
        className="mt-3 max-h-[28rem] w-full rounded-card border border-line object-cover"
      />
    );
  }

  let host = url;
  try {
    host = new URL(url).host;
  } catch {
    /* the constraint already refused anything unparseable; this is belt and braces */
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer nofollow"
      className="press mt-3 block rounded-card border border-line px-3 py-2.5"
    >
      <p className="smallcaps text-[10px] text-paper-faint">{kind ?? "link"}</p>
      <p className="mt-0.5 truncate text-[0.875rem] text-paper-dim">{host}</p>
    </a>
  );
}

function ActLine({ item }: { item: WitnessFeedItem }) {
  const href =
    item.subject_type === "project"
      ? `/collective/projects/${item.subject_id}`
      : `/collective/proposals/${item.subject_id}`;

  return (
    <li className="border-b border-line-soft last:border-b-0">
      <Link href={href} className="press block py-3.5">
        <p className="text-[0.9375rem] leading-relaxed text-paper">
          <span className="font-medium">{item.actor_name}</span>{" "}
          <span className="text-paper-dim">{SAID[item.kind] ?? "did something to"}</span>{" "}
          {item.title ?? "something"}
        </p>
        <p className="smallcaps mt-1 text-[10px] text-paper-faint">
          {item.tie === "friend" ? "friend" : item.tie === "following" ? "following" : "here"}
          {item.actor_handle ? ` · @${item.actor_handle}` : ""} · {ago(item.happened_at)}
        </p>
      </Link>
    </li>
  );
}
