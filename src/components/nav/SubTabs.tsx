"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { PillLink, Rail } from "@/components/ui";

/**
 * The strip of sub-tabs inside a top-level tab.
 *
 * INDIVIDUAL — the overview's five (Profile, AI, Values, Drafts, Vault) plus
 * Journal and Ideas, which are the life_OS screens and stay, Chats, which is
 * private by nature and so belongs on this side of the app rather than the
 * collective one, and SOV, which is here rather than under Collective because
 * what you hold is yours alone and nobody else can read it.
 *
 * COLLECTIVE — two groups (Mackenzie, 20 October). Live is what is still being
 * decided: Proposals and Debate. Record is what has been: Projects (with their
 * impact shown on the same screen) and Decisions. People moved to Connection
 * and Words to Search, so what is left here is only the governance cycle.
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
  { href: "/individual/sov", label: "SOV" },
];

export const COLLECTIVE_GROUPS = [
  {
    key: "live",
    label: "Live",
    tabs: [
      { href: "/collective/proposals", label: "Proposals" },
      { href: "/collective/debate", label: "Debate" },
    ],
  },
  {
    key: "record",
    label: "Record",
    tabs: [
      { href: "/collective/projects", label: "Projects" },
      { href: "/collective/decisions", label: "Decisions" },
    ],
  },
] as const;

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

/**
 * Collective's two-level strip: a Live / Record switch, and under it the tabs
 * in whichever half you are in. The switch goes to the first tab of its half.
 */
export function CollectiveTabs() {
  const pathname = usePathname();
  const on = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const current =
    COLLECTIVE_GROUPS.find((g) => g.tabs.some((t) => on(t.href))) ?? COLLECTIVE_GROUPS[0];

  return (
    <div className="pb-1">
      <div className="flex justify-center px-5 pt-2.5">
        <div role="tablist" aria-label="Collective" className="inline-flex rounded-pill bg-surface p-1">
          {COLLECTIVE_GROUPS.map((g) => {
            const active = g.key === current.key;
            return (
              <Link
                key={g.key}
                href={g.tabs[0].href}
                role="tab"
                aria-selected={active}
                className={`press rounded-pill px-5 py-1.5 text-[0.8125rem] font-medium ${
                  active ? "bg-paper text-ink" : "text-paper-dim"
                }`}
              >
                {g.label}
              </Link>
            );
          })}
        </div>
      </div>
      <div className="flex justify-center gap-5 px-5 pt-2">
        {current.tabs.map((t) => {
          const active = on(t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? "page" : undefined}
              className={`press border-b-2 pb-1.5 text-[0.875rem] ${
                active ? "border-gold text-paper" : "border-transparent text-paper-faint"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
