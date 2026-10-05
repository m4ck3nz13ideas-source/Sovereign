"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Self · Ideas · To do · Vault — the strip under the profile header.
 *
 * Only what is yours alone, with no crossover to anybody else. Each tab also
 * owns the older screens that belong to it, so arriving at one of those still
 * lights the right tab.
 */
const TABS = [
  { href: "/individual/self", label: "Self", also: ["/individual/values", "/individual/profile", "/individual/journal"] },
  { href: "/individual/ideas", label: "Ideas", also: ["/individual/drafts"] },
  { href: "/individual/todo", label: "To do", also: [] },
  { href: "/individual/vault", label: "Vault", also: ["/individual/sov"] },
];

export function IndividualTabs() {
  const pathname = usePathname();
  const on = (p: string) => pathname === p || pathname.startsWith(`${p}/`);

  return (
    <nav className="grid grid-cols-4 border-b border-line" aria-label="Individual">
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

/** The AI, one tap away anywhere in Individual. */
export function AiBubble() {
  const pathname = usePathname();
  if (pathname.startsWith("/individual/ai")) return null;
  return (
    <Link
      href="/individual/ai"
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
    </Link>
  );
}
