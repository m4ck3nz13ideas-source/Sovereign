"use client";

import { useState, useTransition } from "react";

import { Button, Field, inputClass } from "@/components/ui";
import { shortDate } from "@/lib/format";
import { reviewBars, reviewMean, stars, type Review, type ReviewSummary } from "@/lib/business";

import { removeReview, replyToReview, writeReview } from "../ops";

/** The spread first, and a mean only beside it, and only from five reviews. */
export function ReviewBars({ summary }: { summary: ReviewSummary }) {
  if (!summary.reviews) return null;
  const mean = reviewMean(summary);
  return (
    <div className="mb-4">
      <p className="mb-2 text-center text-sm text-paper-dim">
        {summary.reviews} {summary.reviews === 1 ? "review" : "reviews"} from completed orders
        {mean ? ` · ${mean} on average` : ""}
      </p>
      <ul className="mx-auto max-w-xs space-y-1">
        {reviewBars(summary).map((b) => (
          <li key={b.stars} className="flex items-center gap-2 text-xs text-paper-faint">
            <span className="w-6 text-right">{b.stars}★</span>
            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface">
              <span className="block h-full bg-paper-dim" style={{ width: `${Math.round(b.share * 100)}%` }} />
            </span>
            <span className="w-6">{b.count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ReviewList({
  reviews,
  canReply,
  reviewer,
}: {
  reviews: Review[];
  canReply: boolean;
  reviewer: boolean;
}) {
  if (!reviews.length) return <p className="text-center text-sm text-paper-faint">No reviews yet.</p>;
  return (
    <ul className="space-y-3">
      {reviews.map((r) => (
        <li key={r.id} className="rounded-card border border-line px-4 py-3">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-sm text-gold" aria-label={`${r.rating} of 5`}>
              {stars(r.rating)}
            </span>
            <span className="text-xs text-paper-faint">{shortDate(r.created_at)}</span>
          </div>
          <p className="mt-1.5 text-[0.95rem] leading-relaxed whitespace-pre-wrap text-paper-dim">{r.body}</p>
          <p className="mt-1.5 text-xs text-paper-faint">
            {r.author_name} · {r.item_name}
          </p>
          {r.reply ? (
            <div className="mt-3 border-l-2 border-line pl-3">
              <p className="smallcaps text-[10px] text-paper-faint">The business replied</p>
              <p className="mt-1 text-sm leading-relaxed whitespace-pre-wrap text-paper-dim">{r.reply}</p>
            </div>
          ) : canReply ? (
            <ReplyForm reviewId={r.id} />
          ) : null}
          {reviewer && !canReply ? <RemoveForm reviewId={r.id} /> : null}
        </li>
      ))}
    </ul>
  );
}

function ReplyForm({ reviewId }: { reviewId: string }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="mt-2 text-sm text-gold hover:underline">
        Reply once, publicly
      </button>
    );
  return (
    <div className="mt-3 space-y-2">
      <textarea className={`${inputClass} min-h-20`} value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} />
      {error ? <p className="text-sm text-alarm">{error}</p> : null}
      <Button
        type="button"
        tone="quiet"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await replyToReview(reviewId, text);
            if (!r.ok) setError(r.error);
          })
        }
      >
        Post reply
      </Button>
    </div>
  );
}

function RemoveForm({ reviewId }: { reviewId: string }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="mt-2 block text-xs text-paper-faint hover:text-alarm">
        Remove (reviewer)
      </button>
    );
  return (
    <div className="mt-3 space-y-2">
      <Field label="Which law it breaks, and how">
        <textarea className={`${inputClass} min-h-16`} value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      {error ? <p className="text-sm text-alarm">{error}</p> : null}
      <Button
        type="button"
        tone="danger"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await removeReview(reviewId, note);
            if (!r.ok) setError(r.error);
          })
        }
      >
        Remove review
      </Button>
    </div>
  );
}

/** Written once, after the customer has confirmed the order. */
export function ReviewForm({ orderId, vendorName }: { orderId: string; vendorName: string }) {
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();
  if (done) return <p className="text-center text-sm text-calm">Posted on {vendorName}&rsquo;s page.</p>;
  return (
    <div className="space-y-3">
      <div className="flex justify-center gap-1" role="radiogroup" aria-label="Stars">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={rating === n}
            aria-label={`${n} of 5`}
            onClick={() => setRating(n)}
            className={`press text-2xl ${n <= rating ? "text-gold" : "text-paper-faint"}`}
          >
            ★
          </button>
        ))}
      </div>
      <textarea
        className={`${inputClass} min-h-24`}
        value={body}
        maxLength={2000}
        onChange={(e) => setBody(e.target.value)}
        placeholder="What it was like: what they made or did, how it went"
      />
      <p className="text-center text-xs text-paper-faint">
        Shown on their page with your name. Written once; it cannot be edited, and the business cannot remove it.
      </p>
      {error ? <p className="text-sm text-alarm">{error}</p> : null}
      <div className="flex justify-center">
        <Button
          type="button"
          disabled={pending || !rating}
          onClick={() =>
            start(async () => {
              const r = await writeReview(orderId, rating, body);
              if (!r.ok) setError(r.error);
              else setDone(true);
            })
          }
        >
          Post review
        </Button>
      </div>
    </div>
  );
}
