"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Self · Ideas · To do · Learn · Vault — the strip under the profile header.
 *
 * Only what is yours alone, with no crossover to anybody else. Each tab also
 * owns the older screens that belong to it, so arriving at one of those still
 * lights the right tab.
 */
const TABS = [
  { href: "/individual/self", label: "Self", also: ["/individual/values", "/individual/profile", "/individual/journal"] },
  { href: "/individual/ideas", label: "Ideas", also: ["/individual/drafts"] },
  { href: "/individual/todo", label: "To do", also: [] },
  { href: "/individual/learn", label: "Learn", also: [] },
  { href: "/individual/vault", label: "Vault", also: ["/individual/sov"] },
];

export function IndividualTabs() {
  const pathname = usePathname();
  const on = (p: string) => pathname === p || pathname.startsWith(`${p}/`);

  return (
    <nav className="grid grid-cols-5 border-b border-line" aria-label="Individual">
      {TABS.map((t) => {
        const active = on(t.href) || t.also.some(on);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={`press border-b-2 py-3 text-center text-[0.8125rem] ${
              active ? "border-paper text-paper" : "border-transparent text-paper-faint"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
