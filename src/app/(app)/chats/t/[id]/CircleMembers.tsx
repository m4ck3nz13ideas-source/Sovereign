"use client";

import { useState, useTransition } from "react";

import { addToCircle, leaveCircle } from "@/app/(app)/chats/threads";

/** Who is in a circle, adding a friend of yours, and leaving. */
export function CircleMembers({
  thread,
  members,
  addable,
}: {
  thread: string;
  members: { id: string; name: string }[];
  addable: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="rounded-card border border-line bg-surface-soft p-4">
      <p className="text-[0.875rem] text-paper-dim">{members.map((m) => m.name).join(", ")}</p>
      <div className="mt-3 flex gap-4">
        {addable.length ? (
          <button type="button" onClick={() => setOpen(!open)} className="smallcaps text-[11px] text-gold">
            {open ? "done" : "add a friend"}
          </button>
        ) : null}
        <button
          type="button"
          disabled={pending}
          onClick={() => start(async () => { await leaveCircle(thread); })}
          className="smallcaps text-[11px] text-paper-faint hover:text-alarm"
        >
          leave
        </button>
      </div>
      {open ? (
        <ul className="mt-3 flex flex-wrap gap-2">
          {addable.map((f) => (
            <li key={f.id}>
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    setError(null);
                    const res = await addToCircle(thread, f.id);
                    if (!res.ok) setError(res.error);
                  })
                }
                className="press rounded-pill bg-surface px-3 py-1.5 text-[0.8125rem] text-paper-dim"
              >
                + {f.name}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {error ? <p className="mt-2 text-[0.85rem] text-alarm">{error}</p> : null}
    </div>
  );
}
