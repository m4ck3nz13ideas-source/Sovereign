"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Four tabs, left to right: Individual, Home, Ask, Collective.
 *
 * The first three come straight from the overview's architecture diagram —
 * SOVEREIGN APP branching into HOME, INDIVIDUAL and COLLECTIVE — with Home
 * left of centre because it is the one you sit in. Each tab has its own strip
 * of sub-tabs underneath it, so the depth is in the tab rather than in here.
 *
 * Ask is the fourth, next to Home rather than raised in the middle. Rule 2 is
 * understanding before opinion, and a surface for going and finding something
 * out earns a place at this level; a raised centre button does not, because
 * that is the shape of an app whose whole purpose is posting. Writing stays a
 * plus in the Home bar for the same reason.
 *
 * Four is the ceiling. A fifth would start the argument about which of these
 * matters least, and the answer would be whichever one somebody added last.
 */

const TABS = [
  { href: "/individual", label: "Individual", Icon: IndividualIcon },
  { href: "/home", label: "Home", Icon: HomeIcon },
  { href: "/ask", label: "Ask", Icon: AskIcon },
  { href: "/collective", label: "Collective", Icon: CollectiveIcon },
] as const;

export function TabBar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-veil backdrop-blur-xl"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto flex max-w-2xl items-center px-2 py-1.5">
        {TABS.map((tab) => {
          const active =
            pathname === tab.href || pathname.startsWith(`${tab.href}/`);

          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`press flex flex-col items-center gap-0.5 rounded-xl py-1.5 ${
                  active ? "text-paper" : "text-paper-faint"
                }`}
              >
                <tab.Icon filled={active} />
                <span className="text-[0.625rem] font-medium tracking-wide">
                  {tab.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/* --------------------------------------------------------------------------
   Icons. Outline when idle, filled when you are there — the one convention
   every phone app shares, so nobody has to learn it.
-------------------------------------------------------------------------- */

type IconProps = { filled?: boolean };

function IndividualIcon({ filled }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden>
      <circle
        cx="12"
        cy="8"
        r="3.5"
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <path
        d="M4.5 20c0-3.6 3.4-6 7.5-6s7.5 2.4 7.5 6"
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

function HomeIcon({ filled }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden>
      <path
        d="M3.5 10.5 12 4l8.5 6.5V19a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 19z"
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function AskIcon({ filled }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden>
      <circle
        cx="10.75"
        cy="10.75"
        r="6.25"
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <path
        d="m15.5 15.5 4.25 4.25"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CollectiveIcon({ filled }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden>
      <circle
        cx="12"
        cy="12"
        r="8.25"
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <path
        d="M3.75 12h16.5M12 3.75c2.2 2.4 3.3 5.2 3.3 8.25S14.2 17.85 12 20.25c-2.2-2.4-3.3-5.2-3.3-8.25S9.8 6.15 12 3.75z"
        fill="none"
        stroke={filled ? "var(--color-ink)" : "currentColor"}
        strokeWidth="1.5"
      />
    </svg>
  );
}
