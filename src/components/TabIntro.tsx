"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";

import { SPACES, STATUS_LABEL, type Space } from "@/lib/capabilities";
import { GLOSSARY, SPACE_TERMS } from "@/lib/glossary";

/**
 * The first-run note at the top of each of the five tabs: what the space is
 * for, one thing to try, and the words it uses. Shown until dismissed, then
 * never again on this device; "About this space" in the corner brings it back.
 *
 * It renders nothing on the server and nothing until it has read the
 * dismissal, so a returning person never sees it flash. The dismissal is a
 * per-device convenience in localStorage — nothing about it reaches the
 * database, and losing it costs one more look at the note.
 */

const key = (id: string) => `sovereign.intro.${id}`;

function read(id: string): boolean {
  try {
    return window.localStorage.getItem(key(id)) === "dismissed";
  } catch {
    return false;
  }
}

const listeners = new Set<() => void>();

function write(id: string, dismissed: boolean) {
  try {
    if (dismissed) window.localStorage.setItem(key(id), "dismissed");
    else window.localStorage.removeItem(key(id));
  } catch {
    /* private window or blocked storage: the note just shows again */
  }
  listeners.forEach((l) => l());
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function TabIntro({ space, className = "" }: { space: Space["id"]; className?: string }) {
  const sp = SPACES.find((s) => s.id === space)!;
  // "loading" on the server and during hydration, then whatever this device
  // remembers — so a returning person never sees the note flash.
  const state = useSyncExternalStore(
    subscribe,
    () => (read(space) ? "closed" : "open"),
    () => "loading" as const,
  );

  if (state === "loading") return null;

  if (state === "closed") {
    return (
      <div className={`px-5 pt-2 text-right ${className}`}>
        <button
          type="button"
          onClick={() => {
            write(space, false);
          }}
          className="text-xs text-paper-faint hover:text-gold"
        >
          About this space
        </button>
      </div>
    );
  }

  const testing = sp.can.filter((c) => c.status !== "current");

  return (
    <div className={`px-5 pt-4 ${className}`}>
      <section
        aria-label={`About ${sp.name}`}
        className="rounded-card border border-line bg-surface-soft p-4"
      >
        <div className="flex items-start justify-between gap-3">
          <p className="smallcaps text-[11px] font-semibold text-gold">{sp.name}</p>
          <button
            type="button"
            onClick={() => {
              write(space, true);
            }}
            className="-mt-1 -mr-1 rounded-pill px-2 py-1 text-xs text-paper-faint hover:text-paper"
          >
            Got it<span className="sr-only">, hide this note</span>
          </button>
        </div>
        <p className="mt-1.5 text-[0.95rem] leading-relaxed text-paper">{sp.purpose}</p>
        <p className="mt-3 text-[0.9rem] leading-relaxed text-paper-dim">
          <span className="font-semibold text-paper">Try first: </span>
          <Link href={sp.href} className="text-gold hover:underline">
            {sp.firstAction}
          </Link>
        </p>
        {testing.length ? (
          <p className="mt-2 text-[0.8125rem] leading-relaxed text-paper-faint">
            {testing.map((c) => `${c.title}: ${STATUS_LABEL[c.status].toLowerCase()}.`).join(" ")}
          </p>
        ) : null}
        <details className="mt-3 text-[0.875rem]">
          <summary className="cursor-pointer text-paper-dim hover:text-paper">Words used here</summary>
          <dl className="mt-2 space-y-2">
            {SPACE_TERMS[space].map((t) => (
              <div key={t}>
                <dt className="font-semibold text-paper">{t}</dt>
                <dd className="leading-relaxed text-paper-dim">{GLOSSARY[t]}</dd>
              </div>
            ))}
          </dl>
        </details>
      </section>
    </div>
  );
}
