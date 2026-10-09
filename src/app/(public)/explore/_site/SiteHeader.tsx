"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { NAV } from "./site";

/**
 * The public site's top bar: brand, the page links, sign in and the one amber
 * action. On a phone the links fold into a sheet under the bar.
 */
export function SiteHeader() {
  const pathname = usePathname();
  // Open on one page only: a link tapped in the sheet navigates, and the
  // sheet does not follow it there.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;

  return (
    <header className="sticky top-0 z-40 border-b border-line-soft bg-veil backdrop-blur-xl">
      <div
        className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-5 py-3.5"
        style={{ paddingTop: "max(0.875rem, env(safe-area-inset-top))" }}
      >
        <Link href="/explore" className="flex items-center gap-2.5" aria-label="Sovereign home">
          <Mark />
          <span className="font-serif text-xl tracking-tight text-paper">Sovereign</span>
        </Link>

        <nav className="hidden items-center gap-1 lg:flex" aria-label="Main">
          {NAV.map((n) => {
            const active = pathname === n.href;
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={active ? "page" : undefined}
                className={`rounded-pill px-3.5 py-2 text-[0.95rem] transition-colors ${
                  active ? "bg-surface text-paper" : "text-paper-dim hover:text-paper"
                }`}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <Link href="/login" className="hidden px-3 py-2 text-[0.95rem] text-paper-dim hover:text-paper sm:inline">
            Sign in
          </Link>
          <Link href="/login" className="press rounded-pill bg-gold px-4 py-2 text-sm font-semibold text-ink">
            Get started
          </Link>
          <button
            type="button"
            onClick={() => setOpenOn(open ? null : pathname)}
            aria-expanded={open}
            aria-controls="site-menu"
            aria-label={open ? "Close menu" : "Open menu"}
            className="press -mr-2 grid h-10 w-10 place-items-center rounded-pill text-paper lg:hidden"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
            </svg>
          </button>
        </div>
      </div>

      {open ? (
        <nav id="site-menu" className="animate-settle-in border-t border-line-soft px-5 pb-6 pt-2 lg:hidden" aria-label="Main">
          <ul className="divide-y divide-line-soft">
            {NAV.map((n) => (
              <li key={n.href}>
                <Link href={n.href} className="block py-3.5 text-lg text-paper">
                  {n.label}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/login" className="block py-3.5 text-lg text-paper-dim">
                Sign in
              </Link>
            </li>
          </ul>
        </nav>
      ) : null}
    </header>
  );
}

/** The mark: two circles, one inside the other — the individual in the collective. */
export function Mark({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <circle cx="16" cy="16" r="14" fill="none" stroke="var(--color-paper)" strokeWidth="2" />
      <circle cx="16" cy="16" r="5.5" fill="var(--color-gold)" />
    </svg>
  );
}
