"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * The collective's own navigation, sitting under Connection in the bottom nav.
 *
 * This is the chain from Sovereign Overview (2) laid out left to right:
 * Feed → Proposals → Decisions → Projects → Impact. Each tab is the next stage
 * of the same loop, which is why they are tabs and not separate destinations.
 */
const tabs = [
  { href: "/connection", label: "Feed", exact: true },
  { href: "/connection/proposals", label: "Proposals" },
  { href: "/connection/decisions", label: "Decisions" },
  { href: "/connection/projects", label: "Projects" },
  { href: "/connection/impact", label: "Impact" },
];

export function CollectiveTabs() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Collective"
      className="no-scrollbar -mx-5 mb-7 overflow-x-auto px-5"
    >
      <ul className="flex min-w-max gap-1 border-b border-line">
        {tabs.map((tab) => {
          const active = tab.exact
            ? pathname === tab.href
            : pathname.startsWith(tab.href);

          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`smallcaps -mb-px block border-b-2 px-3 py-2.5 text-[11px] transition-colors ${
                  active
                    ? "border-gold text-gold"
                    : "border-transparent text-paper-faint hover:text-paper-dim"
                }`}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
