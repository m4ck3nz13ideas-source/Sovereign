"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  ConnectionIcon,
  PipelineIcon,
  ProfileIcon,
  ReflectionIcon,
} from "@/components/icons";

/**
 * Five items, left to right, exactly as life_OS.pdf specifies. Launch sits
 * above the baseline, always gold, visually distinct from the four flanking it.
 * The bar is always visible.
 */

const items = [
  { href: "/connection", label: "Connection", Icon: ConnectionIcon },
  { href: "/pipeline", label: "Pipeline", Icon: PipelineIcon },
  null, // Launch occupies the centre slot
  { href: "/reflection", label: "Reflection", Icon: ReflectionIcon },
  { href: "/profile", label: "Profile", Icon: ProfileIcon },
] as const;

export function BottomNav() {
  const pathname = usePathname();
  const onLaunch = pathname.startsWith("/launch");

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-ink/95 backdrop-blur-sm"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto flex max-w-2xl items-end justify-between px-2 pt-2 pb-1.5">
        {items.map((item) => {
          if (item === null) {
            return (
              <li key="launch" className="relative -mt-7 flex-1">
                <Link
                  href="/launch"
                  aria-label="Launch"
                  aria-current={onLaunch ? "page" : undefined}
                  className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gold text-ink shadow-[0_0_0_6px_var(--color-ink),0_6px_20px_-4px_rgba(201,168,76,0.5)] transition-transform active:scale-95"
                >
                  <span className="sr-only">Launch</span>
                  <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden>
                    <circle cx="12" cy="12" r="7.5" stroke="currentColor" strokeWidth="1.8" />
                  </svg>
                </Link>
                <span className="smallcaps mt-1.5 block text-center text-[10px] text-gold">
                  Launch
                </span>
              </li>
            );
          }

          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center gap-1 rounded-md py-1 transition-colors ${
                  active ? "text-gold" : "text-paper-faint hover:text-paper-dim"
                }`}
              >
                <item.Icon />
                <span className="smallcaps text-[10px] leading-none">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
