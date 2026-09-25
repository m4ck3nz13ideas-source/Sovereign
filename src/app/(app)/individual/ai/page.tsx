import { Empty, Gutter, Screen, SectionLabel } from "@/components/ui";
import { requireSession } from "@/lib/session";

export const metadata = { title: "AI · Sovereign" };

/**
 * The personal AI guardian.
 *
 *   §1.3 "A local-first AI agent that learns your values, helps draft
 *   proposals, explains governance, tracks alignment with Universal Law, flags
 *   contradictions in your actions, and summarises debates and feeds. This AI
 *   never acts publicly without consent."
 *
 * Not built yet. This screen says so plainly rather than showing a chat box
 * that answers nothing — an empty room is honest, a fake one is not.
 */
export default async function AiPage() {
  const { profile } = await requireSession();

  return (
    <Screen>
      <Gutter className="pt-6">
        <h2 className="display text-[1.75rem] text-paper">
          Your guardian
        </h2>
        <p className="mt-2 text-[0.9375rem] leading-relaxed text-paper-dim">
          {profile.display_name}, this is the half of Sovereign that is yours.
          It learns what you hold from what you have written, helps you draft
          before anyone else sees it, explains what a proposal actually means
          for you, and tells you privately when what you say you value and what
          you have been doing have come apart.
        </p>
        <p className="mt-3 text-[0.9375rem] leading-relaxed text-paper-dim">
          It never acts publicly without you saying so. It has no vote, no
          standing, and nothing it says is visible to anybody else.
        </p>

        <div className="mt-8">
          <SectionLabel>Not built yet</SectionLabel>
          <Empty>
            The Truth Engine on proposals, the sharpening pass on drafts and the
            debate summariser are all running. This one — the AI that is yours
            rather than the group&rsquo;s — is next.
          </Empty>
        </div>
      </Gutter>
    </Screen>
  );
}

export const dynamic = "force-dynamic";
