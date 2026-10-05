import Link from "next/link";

import { AiBubble, IndividualTabs } from "@/components/nav/IndividualTabs";
import { TabActions } from "@/components/nav/TabActions";
import { TopBar } from "@/components/ui";
import { requireSession } from "@/lib/session";

/**
 * Individual — the private half, shaped like a profile.
 *
 * A header that stays put across every tab (who you are), then Self, Ideas,
 * To do and Vault underneath. Nothing here is visible to anybody else unless
 * it was explicitly sent somewhere: rule one of the schema, not a setting.
 * Your AI is the floating button, reachable from any of them.
 */
export default async function IndividualLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireSession();
  const name = profile.display_name || "You";
  const initial = name.trim().charAt(0).toUpperCase() || "·";
  const line = profile.purpose || profile.bio;

  return (
    <>
      <TopBar
        title={profile.handle ? `@${profile.handle}` : name}
        action={<TabActions plus="/write" plusLabel="New" />}
      />

      <section className="px-5 pb-4 pt-5">
        <div className="flex items-center gap-4">
          {profile.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.avatar_url}
              alt=""
              className="h-20 w-20 shrink-0 rounded-full border border-line object-cover"
            />
          ) : (
            <div
              aria-hidden
              className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full border border-line bg-surface font-serif text-3xl text-paper"
            >
              {initial}
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate font-serif text-xl text-paper">{name}</p>
            {line ? (
              <p className="mt-1 line-clamp-2 text-sm leading-snug text-paper-dim">{line}</p>
            ) : null}
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Link
            href="/individual/profile"
            className="press rounded-lg border border-line py-2 text-center text-sm text-paper active:bg-surface"
          >
            Edit profile
          </Link>
          <Link
            href="/write"
            className="press rounded-lg border border-line py-2 text-center text-sm text-paper active:bg-surface"
          >
            Journal
          </Link>
        </div>
      </section>

      <IndividualTabs />
      {children}
      <AiBubble />
    </>
  );
}
