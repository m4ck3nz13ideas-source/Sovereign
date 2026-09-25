"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Three tabs, left to right: Individual, Home, Collective.
 *
 * Straight from the overview's architecture diagram — SOVEREIGN APP branching
 * into HOME, INDIVIDUAL and COLLECTIVE — with Home promoted to the middle
 * because it is the one you sit in. Each tab has its own strip of sub-tabs
 * underneath it, so the depth is in the tab rather than in the bar.
 *
 * Write sits in the centre, raised, always amber: the one thing you can do
 * from anywhere. Everything else in this bar is navigation.
 */

const TABS = [
  { href: "/individual", label: "Individual", Icon: IndividualIcon },
  { href: "/home", label: "Home", Icon: HomeIcon },
  { href: "/collective", label: "Collective", Icon: CollectiveIcon },
] as const;

export function TabBar() {
  const pathname = usePathname();
  const onWrite = pathname.startsWith("/write");

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-ink/85 backdrop-blur-xl"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto flex max-w-2xl items-center justify-around px-2 py-1.5">
        {TABS.map((tab, i) => {
          const active =
            pathname === tab.href || pathname.startsWith(`${tab.href}/`);

          return (
            <li key={tab.href} className="contents">
              {i === 2 ? (
                <li className="flex-none px-1">
                  <Link
                    href="/write"
                    aria-label="Write"
                    aria-current={onWrite ? "page" : undefined}
                    className="press flex h-11 w-11 items-center justify-center rounded-full bg-gold text-ink"
                  >
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden>
                      <path
                        d="M12 5v14M5 12h14"
                        stroke="currentColor"
                        strokeWidth="2.25"
                        strokeLinecap="round"
                      />
                    </svg>
                  </Link>
                </li>
              ) : null}

              <li className="flex-1">
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
