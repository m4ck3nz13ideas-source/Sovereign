"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Five tabs, left to right: Individual, Connection, Search, Market,
 * Collective. Icons only, by Mackenzie's direction: the names stay as
 * aria-label and title, so screen readers and a desktop hover still say where
 * you are.
 *
 * Read against the four quadrants (12 October): Individual is the I, the
 * inner life. Connection is the We — friends, chats, groups, the proposals
 * and businesses you are part of. Market is the It, concrete exchange.
 * Collective is the Its, the systems you decide together. Search sits in the
 * centre as the lens across all four, and is where you land: look something
 * up, say something, see the feed.
 *
 * Search keeps the /home route so existing links and revalidations still
 * land; /ask redirects there.
 *
 * Five is the ceiling. A sixth would start the argument about which of these
 * matters least, and the answer would be whichever one somebody added last.
 */

const TABS = [
  { href: "/individual", label: "Individual", Icon: IndividualIcon, also: [] },
  { href: "/connection", label: "Connection", Icon: ConnectionIcon, also: ["/chats"] },
  { href: "/home", label: "Search", Icon: AskIcon, also: ["/ask"] },
  { href: "/market", label: "Market", Icon: MarketplaceIcon, also: [] },
  { href: "/collective", label: "Collective", Icon: CollectiveIcon, also: [] },
] as const;

const under = (pathname: string, href: string) =>
  pathname === href || pathname.startsWith(`${href}/`);

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
            under(pathname, tab.href) ||
            tab.also.some((h: string) => under(pathname, h));

          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                aria-label={tab.label}
                title={tab.label}
                className={`press flex flex-col items-center gap-1 rounded-xl py-2.5 ${
                  active ? "text-paper" : "text-paper-faint"
                }`}
              >
                <tab.Icon filled={active} />
                <span
                  aria-hidden
                  className={`h-1 w-1 rounded-full ${active ? "bg-gold" : "bg-transparent"}`}
                />
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

function ConnectionIcon({ filled }: IconProps) {
  // Three people joined: one node above, two below, each tied to the others.
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden>
      <path
        d="M12 7.5 6.5 16.5M12 7.5l5.5 9M6.5 16.5h11"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      {[
        [12, 6],
        [6, 17.5],
        [18, 17.5],
      ].map(([cx, cy]) => (
        <circle
          key={`${cx}-${cy}`}
          cx={cx}
          cy={cy}
          r="2.75"
          fill={filled ? "currentColor" : "var(--color-ink)"}
          stroke="currentColor"
          strokeWidth="1.75"
        />
      ))}
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

function MarketplaceIcon({ filled }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden>
      <path
        d="M5.5 8.5h13l-1 11a1.5 1.5 0 0 1-1.5 1.35H8A1.5 1.5 0 0 1 6.5 19.5z"
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path
        d="M9 10.5V7a3 3 0 0 1 6 0v3.5"
        fill="none"
        stroke={filled ? "var(--color-ink)" : "currentColor"}
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

/**
 * The same five icons, by space, for screens that show the tabs before you
 * have used them — onboarding's tour. One set of drawings, so the tour can
 * never show a tab that looks different from the bar.
 */
export const TAB_ICON = {
  individual: IndividualIcon,
  connection: ConnectionIcon,
  search: AskIcon,
  market: MarketplaceIcon,
  collective: CollectiveIcon,
} as const;
