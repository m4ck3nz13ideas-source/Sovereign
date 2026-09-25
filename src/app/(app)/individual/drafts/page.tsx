import { Empty, Gutter, LinkButton, Screen } from "@/components/ui";
import { requireSession } from "@/lib/session";

export const metadata = { title: "Drafts · Sovereign" };

/**
 * Drafts — the private proposal space.
 *
 *   §3 "Before ideas go public, they start here."
 *
 * And they stay here, in this browser. A draft exists in localStorage and in
 * no database, which is the private-first rule made structural rather than
 * enforced by a status column. That is why this screen can only point at the
 * composer: from the server there is nothing to list, by design.
 */
export default async function DraftsPage() {
  await requireSession();

  return (
    <Screen>
      <Gutter className="pt-6">
        <h2 className="display text-[1.75rem] text-paper">Drafts</h2>
        <p className="mt-2 text-[0.9375rem] leading-relaxed text-paper-dim">
          A draft lives in this browser and nowhere else. Not in the database,
          not on a server, not recoverable by anyone including you on another
          device. That is the cost of a half-formed idea being nobody
          else&rsquo;s business until you decide it is.
        </p>

        <div className="mt-6">
          <LinkButton href="/collective/proposals/new" tone="gold">
            Open the composer
          </LinkButton>
        </div>

        <div className="mt-8">
          <Empty>
            Whatever you last had open is waiting in the composer. It restores
            itself when you get there.
          </Empty>
        </div>
      </Gutter>
    </Screen>
  );
}

export const dynamic = "force-dynamic";
