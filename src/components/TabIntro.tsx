"use client";

import Link from "next/link";
import { useEffect, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

import { SPACES, type Space } from "@/lib/capabilities";
import { GLOSSARY, SPACE_TERMS } from "@/lib/glossary";

/**
 * What each of the five tabs is for, what to try first, and the words it uses.
 *
 * 26 October (Mackenzie): cut to one line, up to three things that work
 * today, and one "Coming soon" line in plain words. The main button does the
 * first action; "Skip" puts it away. Build notes stay on the public roadmap.
 *
 * Since 23 October (Mackenzie) it is a pop-up the first time you open a tab,
 * not a note in the page. "Got it" puts it away for good on this device, and
 * the "i" in the top-right corner — beside "+" and settings — brings it back
 * whenever you want it.
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

function useIntro(space: Space["id"]) {
  // "loading" on the server and during hydration, then whatever this device
  // remembers — so a returning person never sees the pop-up flash.
  return useSyncExternalStore(
    subscribe,
    () => (read(space) ? "closed" : "open"),
    () => "loading" as const,
  );
}

/** The pop-up. Place it once per tab; it shows itself until dismissed. */
export function TabIntro({ space }: { space: Space["id"]; className?: string }) {
  const sp = SPACES.find((s) => s.id === space)!;
  const state = useIntro(space);
  const close = () => write(space, true);

  useEffect(() => {
    if (state !== "open") return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, space]);

  if (state !== "open") return null;

  const { intro } = sp;

  // Portalled to the body: some tabs place this inside the sticky top bar,
  // whose backdrop blur would otherwise trap a fixed overlay inside it.
  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-4 sm:items-center"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 1rem)" }}
      onClick={close}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={`intro-${space}`}
        className="max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-card border border-line bg-ink p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={`intro-${space}`} className="display text-center text-2xl text-paper">
          {sp.name}
        </h2>
        <p className="mt-2 text-center text-[0.95rem] leading-relaxed text-paper">{intro.line}</p>

        <ul className="mt-4 space-y-2">
          {intro.points.map((p) => (
            <li key={p} className="flex gap-2.5 text-[0.9rem] leading-snug text-paper">
              <span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
              <span>{p}</span>
            </li>
          ))}
        </ul>

        {intro.soon ? (
          <p className="mt-3 text-[0.8125rem] leading-relaxed text-paper-faint">
            <span className="font-semibold">Coming soon:</span> {intro.soon}
          </p>
        ) : null}

        <Link
          href={sp.href}
          onClick={close}
          ref={(el) => el?.focus()}
          className="press mt-5 block w-full rounded-pill bg-gold py-3 text-center text-[0.95rem] font-semibold text-ink"
        >
          {intro.cta}
        </Link>
        <button
          type="button"
          onClick={close}
          className="mt-2 w-full py-2 text-center text-[0.875rem] text-paper-dim hover:text-paper"
        >
          Skip
        </button>

        <details className="mt-1 text-[0.8125rem]">
          <summary className="cursor-pointer text-center text-paper-faint hover:text-paper-dim">Words used here</summary>
          <dl className="mt-2 space-y-2">
            {SPACE_TERMS[space].map((t) => (
              <div key={t}>
                <dt className="font-semibold text-paper">{t}</dt>
                <dd className="leading-relaxed text-paper-dim">{GLOSSARY[t]}</dd>
              </div>
            ))}
          </dl>
        </details>

        <p className="mt-3 text-center text-xs text-paper-faint">
          Find this again under <span className="font-semibold">i</span>, top right.
        </p>
      </section>
    </div>,
    document.body,
  );
}

/** The "i" in the top-right corner: opens the tab's pop-up again. */
export function AboutButton({ space }: { space: Space["id"] }) {
  const sp = SPACES.find((s) => s.id === space)!;
  return (
    <button
      type="button"
      onClick={() => write(space, false)}
      aria-label={`About ${sp.name}`}
      title={`About ${sp.name}`}
      className="press flex h-10 w-9 items-center justify-center rounded-full text-paper-dim active:bg-surface"
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden>
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.75" />
        <path d="M12 11v5.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <circle cx="12" cy="7.75" r="1.15" fill="currentColor" />
      </svg>
    </button>
  );
}
