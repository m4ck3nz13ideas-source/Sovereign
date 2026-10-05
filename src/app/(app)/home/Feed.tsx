"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";

import { Empty } from "@/components/ui";
import { ago } from "@/lib/format";
import type { Ad } from "@/lib/marketplace";
import type { WitnessFeedItem } from "@/lib/types";

import { toggleKeep } from "../collective/actions";
import { addComment, loadThread, toggleLike } from "./actions";

export type Counts = Record<string, { likes: number; comments: number; i_liked: boolean }>;

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
  counts = {},
  ad = null,
}: {
  items: WitnessFeedItem[];
  kept: Set<string>;
  counts?: Counts;
  ad?: Ad | null;
}) {
  if (!items.length) {
    return (
      <Empty>Nothing yet. Post something, or follow someone.</Empty>
    );
  }

  return (
    <ul className="space-y-3">
      {items.map((item, i) => (
        <FeedRow key={item.item_id} item={item} kept={kept} counts={counts} ad={i === 3 ? ad : null} />
      ))}
      {ad && items.length < 4 ? <SponsoredPost ad={ad} /> : null}
    </ul>
  );
}

function FeedRow({
  item,
  kept,
  counts,
  ad,
}: {
  item: WitnessFeedItem;
  kept: Set<string>;
  counts: Counts;
  ad: Ad | null;
}) {
  return (
    <>
      {item.source === "post" ? (
        <PostCard item={item} kept={kept.has(item.item_id)} count={counts[item.item_id]} />
      ) : (
        <ActLine item={item} />
      )}
      {ad ? <SponsoredPost ad={ad} /> : null}
    </>
  );
}

/** An ad, shown as a post and labelled as one. Chosen by fit, never by bid. */
function SponsoredPost({ ad }: { ad: Ad }) {
  return (
    <li className="rounded-card border border-gold/40 bg-surface-soft p-4">
      <a href={`/market/ad/${ad.campaign_id}`} rel="sponsored noopener" className="press block">
        <div className="mb-2 flex items-center justify-between">
          <span className="smallcaps text-[10px] text-gold">Sponsored</span>
          <span className="text-xs text-paper-faint">{ad.vendor_name}</span>
        </div>
        <p className="font-serif text-lg leading-snug text-paper">{ad.headline}</p>
        <p className="mt-1 text-[0.95rem] leading-relaxed text-paper-dim">{ad.body}</p>
        {ad.matched?.length ? (
          <p className="mt-2 text-xs text-paper-faint">Fits: {ad.matched.join(", ")}</p>
        ) : null}
      </a>
    </li>
  );
}

function PostCard({
  item,
  kept,
  count,
}: {
  item: WitnessFeedItem;
  kept: boolean;
  count?: { likes: number; comments: number; i_liked: boolean };
}) {
  const [pending, start] = useTransition();
  const [liked, setLiked] = useState(count?.i_liked ?? false);
  const [likes, setLikes] = useState(count?.likes ?? 0);
  const [comments, setComments] = useState(count?.comments ?? 0);
  const [open, setOpen] = useState(false);

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

        <div className="ml-auto flex items-center gap-4">
          <button
            type="button"
            aria-label={liked ? "Unlike" : "Like"}
            aria-pressed={liked}
            disabled={pending}
            onClick={() => {
              const was = liked;
              setLiked(!was);
              setLikes((n) => n + (was ? -1 : 1));
              start(async () => {
                const r = await toggleLike(item.item_id, was);
                if (!r.ok) {
                  setLiked(was);
                  setLikes((n) => n + (was ? 1 : -1));
                }
              });
            }}
            className={`press flex items-center gap-1 text-sm ${liked ? "text-gold" : "text-paper-faint"}`}
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
              <path
                d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"
                fill={liked ? "currentColor" : "none"}
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinejoin="round"
              />
            </svg>
            {likes ? <span className="tabular-nums">{likes}</span> : null}
          </button>
          <button
            type="button"
            aria-label="Comments"
            onClick={() => setOpen((o) => !o)}
            className="press flex items-center gap-1 text-sm text-paper-faint"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden>
              <path d="M4 5h16v11H9l-5 4z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
            </svg>
            {comments ? <span className="tabular-nums">{comments}</span> : null}
          </button>
          <button
            type="button"
            aria-label={kept ? "Saved" : "Save"}
            disabled={pending}
            onClick={() => start(async () => { await toggleKeep(item.item_id); })}
            className={`press text-sm ${kept ? "text-gold" : "text-paper-faint"}`}
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
              <path
                d="M6 4h12v16l-6-4-6 4z"
                fill={kept ? "currentColor" : "none"}
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </div>
      {open ? <Thread postId={item.item_id} onAdded={() => setComments((n) => n + 1)} /> : null}
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

function Thread({ postId, onAdded }: { postId: string; onAdded: () => void }) {
  const [rows, setRows] = useState<Awaited<ReturnType<typeof loadThread>> | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  useEffect(() => {
    let live = true;
    loadThread(postId).then((r) => {
      if (live) setRows(r);
    });
    return () => {
      live = false;
    };
  }, [postId]);

  return (
    <div className="mt-3 border-t border-line-soft pt-3">
      <ul className="space-y-2">
        {(rows ?? []).map((c) => (
          <li key={c.id} className="text-[0.9rem] leading-relaxed">
            <span className="font-medium text-paper">{c.author_name}</span>{" "}
            <span className="text-paper-dim">{c.body}</span>
          </li>
        ))}
      </ul>
      <form
        className="mt-2 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const text = draft.trim();
          if (!text) return;
          start(async () => {
            const r = await addComment(postId, text);
            if (!r.ok) return setError(r.error);
            setDraft("");
            setError(null);
            onAdded();
            setRows(await loadThread(postId));
          });
        }}
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add a comment"
          aria-label="Add a comment"
          maxLength={2000}
          className="min-w-0 flex-1 rounded-full border border-line bg-ink px-3.5 py-2 text-[0.9rem] text-paper outline-none focus:border-gold"
        />
        <button type="submit" disabled={pending || !draft.trim()} className="text-sm text-gold disabled:opacity-40">
          Post
        </button>
      </form>
      {error ? <p className="mt-1 text-xs text-alarm">{error}</p> : null}
    </div>
  );
}
