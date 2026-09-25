"use client";

import { usePathname } from "next/navigation";

import { PillLink, Rail } from "@/components/ui";

/**
 * The strip of sub-tabs inside a top-level tab.
 *
 * INDIVIDUAL — the overview's five (Profile, AI, Values, Drafts, Vault) plus
 * Journal and Ideas, which are the life_OS screens and stay.
 *
 * COLLECTIVE — the overview's five, with Feed promoted out to Home.
 *
 * A rail rather than a fixed tab bar because seven does not fit across a phone
 * and a dropdown hides where you are. A rail shows the shape of the space and
 * lets you flick through it.
 */

export const INDIVIDUAL_TABS = [
  { href: "/individual/profile", label: "Profile" },
  { href: "/individual/ai", label: "AI" },
  { href: "/individual/values", label: "Values" },
  { href: "/individual/journal", label: "Journal" },
  { href: "/individual/ideas", label: "Ideas" },
  { href: "/individual/drafts", label: "Drafts" },
  { href: "/individual/vault", label: "Vault" },
];

export const COLLECTIVE_TABS = [
  { href: "/collective/proposals", label: "Proposals" },
  { href: "/collective/debate", label: "Debate" },
  { href: "/collective/projects", label: "Projects" },
  { href: "/collective/impact", label: "Impact" },
  { href: "/collective/decisions", label: "Decisions" },
  { href: "/collective/people", label: "People" },
];

export function SubTabs({ tabs }: { tabs: { href: string; label: string }[] }) {
  const pathname = usePathname();

  return (
    <Rail>
      {tabs.map((t) => (
        <PillLink
          key={t.href}
          href={t.href}
          active={pathname === t.href || pathname.startsWith(`${t.href}/`)}
        >
          {t.label}
        </PillLink>
      ))}
    </Rail>
  );
}
