"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { AiChat } from "./AiChat";

/**
 * Your AI, one tap away on every page (23 October — it was Individual only).
 * Finds your way around, answers questions, or just talks. The chat stays
 * open in the background as you move between pages, so following a link it
 * gives you does not lose the conversation; reloading the app does.
 *
 * Hidden where the bottom of the screen is already somebody's composer or a
 * full-page chat, so it never sits on top of a Send button.
 */
const HIDDEN = [/^\/chats\/.+/, /^\/write/, /^\/individual\/ai/, /^\/onboarding/, /^\/consent/, /^\/collective\/proposals\/new/];

export function AiBubble() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const hidden = HIDDEN.some((r) => r.test(pathname));

  return (
    <>
      {!open && !hidden ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Your AI"
          title="Your AI"
          className="press fixed right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-gold text-ink shadow-lg"
          style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 5.25rem)" }}
        >
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden>
            <path
              d="M12 3l1.8 4.6L18.5 9.5l-4.7 1.9L12 16l-1.8-4.6L5.5 9.5l4.7-1.9L12 3zM18 15l.9 2.1 2.1.9-2.1.9L18 21l-.9-2.1-2.1-.9 2.1-.9L18 15z"
              fill="currentColor"
            />
          </svg>
        </button>
      ) : null}
      {/* Kept mounted while closed, so the conversation survives. */}
      <div
        className={`fixed inset-0 z-50 flex-col justify-end bg-black/50 ${open ? "flex" : "hidden"}`}
        onClick={() => setOpen(false)}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Your AI"
          className="mx-auto flex h-[80dvh] w-full max-w-xl flex-col rounded-t-3xl border border-line bg-ink"
          style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="relative flex items-center justify-between px-4 pt-3">
            <span aria-hidden className="mx-auto h-1 w-10 rounded-full bg-line" />
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="press absolute right-3 top-1 flex h-9 w-9 items-center justify-center rounded-full text-paper-faint"
            >
              ✕
            </button>
          </div>
          <AiChat
            className="flex-1"
            where={pathname}
            onNavigate={() => setOpen(false)}
            greeting="Ask me anything, or where to find something."
          />
        </div>
      </div>
    </>
  );
}
