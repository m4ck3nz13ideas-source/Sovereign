"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { SPHERES } from "@/lib/spheres";

import { setSphereFollow } from "./actions";

/**
 * All · Following · each Sphere. Following is private: nobody sees who
 * follows what, and nothing counts it, so there is no number on any chip.
 */
export function SphereFilter({ current, following }: { current: string; following: string[] }) {
  const [follows, setFollows] = useState(following);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const chip = (on: boolean) =>
    `press shrink-0 rounded-full border px-3 py-1.5 text-xs ${on ? "border-paper bg-paper text-ink" : "border-line text-paper-dim"}`;

  const selected = SPHERES.find((s) => s.id === current);
  const isFollowing = selected ? follows.includes(selected.id) : false;

  function toggle() {
    if (!selected) return;
    const next = !isFollowing;
    setError(null);
    start(async () => {
      const r = await setSphereFollow(selected.id, next);
      if (!r.ok) return setError(r.error);
      setFollows((f) => (next ? [...f, selected.id] : f.filter((x) => x !== selected.id)));
    });
  }

  return (
    <div className="mb-6">
      <nav className="-mx-5 flex gap-1.5 overflow-x-auto px-5 pb-1" aria-label="Spheres">
        <Link href="/collective/proposals" className={chip(!current)}>All</Link>
        <Link href="/collective/proposals?sphere=following" className={chip(current === "following")}>Following</Link>
        {SPHERES.map((s) => (
          <Link key={s.id} href={`/collective/proposals?sphere=${s.id}`} className={chip(current === s.id)}>
            {s.name}
          </Link>
        ))}
      </nav>

      {selected ? (
        <div className="mt-3 flex items-start justify-between gap-3">
          <p className="text-sm leading-snug text-paper-dim">{selected.description}</p>
          <button
            type="button"
            onClick={toggle}
            disabled={pending}
            className={`press shrink-0 rounded-lg border px-3 py-1.5 text-xs ${isFollowing ? "border-line text-paper-dim" : "border-gold text-gold"}`}
          >
            {isFollowing ? "Following" : "Follow"}
          </button>
        </div>
      ) : current === "following" && !follows.length ? (
        <p className="mt-3 text-sm text-paper-dim">Pick a Sphere and follow it to see only what you care about here.</p>
      ) : null}
      {error ? <p className="mt-2 text-xs text-alarm">{error}</p> : null}
    </div>
  );
}
