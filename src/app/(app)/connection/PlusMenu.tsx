"use client";

import Link from "next/link";
import { useState } from "react";

/** Connection's "+": start whichever kind of connection you meant. */
const ITEMS = [
  { href: "/chats/new", label: "New chat" },
  { href: "/onboarding/group", label: "New group" },
  { href: "/connection?show=people", label: "Find a person" },
  { href: "/market/sell", label: "Add a business" },
];

export function PlusMenu() {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="New"
        aria-expanded={open}
        title="New"
        className="press flex h-10 w-9 items-center justify-center rounded-full text-gold active:bg-surface"
      >
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden>
          <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" />
        </svg>
      </button>
      {open ? (
        <>
          <button type="button" aria-hidden tabIndex={-1} onClick={() => setOpen(false)} className="fixed inset-0 z-40 cursor-default" />
          <div className="absolute right-0 top-11 z-50 min-w-[11rem] overflow-hidden rounded-card border border-line bg-surface shadow-lg">
            {ITEMS.map((i) => (
              <Link
                key={i.href}
                href={i.href}
                onClick={() => setOpen(false)}
                className="block px-4 py-2.5 text-[0.875rem] text-paper active:bg-surface-lift"
              >
                {i.label}
              </Link>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
