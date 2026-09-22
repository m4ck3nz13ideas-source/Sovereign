import Link from "next/link";

import { Card, Page, PageTitle, Tag } from "@/components/ui";
import { ALL_PROMPTS, aiIsLive } from "@/lib/ai";
import { requireSession } from "@/lib/session";

export const metadata = { title: "Prompts · Sovereign" };

/**
 * The four prompts, readable by every member.
 *
 * A group whose proposals are scored by a rubric should be able to read the
 * rubric. Every artefact the AI layer writes carries the id and version shown
 * here, so any score on any proposal can be traced back to the exact wording
 * that produced it.
 */
export default async function PromptsPage() {
  await requireSession();
  const live = aiIsLive();

  return (
    <Page>
      <Link
        href="/settings"
        className="smallcaps mb-6 inline-block text-[11px] text-paper-faint hover:text-gold"
      >
        ← Settings
      </Link>

      <PageTitle sub="What the AI layer is actually told to do.">
        The prompts
      </PageTitle>

      {!live ? (
        <p className="mb-6 rounded-md border border-alarm/40 bg-alarm/10 px-3 py-2.5 text-sm leading-relaxed text-alarm">
          These are not currently in use. No API key is configured, so the
          offline reviewer is running instead.
        </p>
      ) : null}

      <div className="space-y-4">
        {ALL_PROMPTS.map((prompt) => (
          <Card key={prompt.id}>
            <div className="flex items-start justify-between gap-3">
              <h2 className="font-serif text-xl text-paper">{prompt.title}</h2>
              <Tag>v{prompt.version}</Tag>
            </div>

            <p className="mt-1.5 text-sm leading-relaxed text-paper-dim">
              {prompt.purpose}
            </p>

            <details className="group mt-4">
              <summary className="smallcaps cursor-pointer list-none text-[11px] text-gold hover:underline [&::-webkit-details-marker]:hidden">
                <span className="group-open:hidden">Read it</span>
                <span className="hidden group-open:inline">Close</span>
              </summary>
              <pre className="mt-3 max-h-[28rem] overflow-auto whitespace-pre-wrap rounded-md border border-line bg-ink-raised p-4 font-sans text-sm leading-relaxed text-paper-dim">
                {prompt.system}
              </pre>
            </details>

            <p className="smallcaps mt-4 text-[10px] text-paper-faint">
              {prompt.id} · {prompt.tier} tier
            </p>
          </Card>
        ))}
      </div>

      <p className="mt-8 text-xs leading-relaxed text-paper-faint">
        The Universal Law audit is first because its verdicts invalidate rather than advise. Changing a rubric means bumping its version in{" "}
        <code className="text-paper-dim">src/lib/ai/prompts.ts</code>, never
        editing it in place. Artefacts already written keep pointing at the
        wording that produced them, so an old score never silently acquires a
        new meaning.
      </p>
    </Page>
  );
}
