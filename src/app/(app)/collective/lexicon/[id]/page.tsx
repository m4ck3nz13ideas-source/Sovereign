import Link from "next/link";
import { notFound } from "next/navigation";

import { Card, Empty, Page, ScreenHead, Tag } from "@/components/ui";
import { ago, shortDate } from "@/lib/format";
import { requireSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import type { Reading, ReadingRevision } from "@/lib/types";

import { YourReading } from "./YourReading";

/**
 * One word, and what each person takes it to mean.
 *
 * The readings are in the order they were first written, so nobody is at the
 * top for a reason. Not by length, not by recency, and above all not by
 * anything resembling quality — there is no quality column and there is no
 * ordering here that is a judgement.
 *
 * The screen never says whether two readings agree. That is the sharpest
 * absence in this feature and the easiest to undo by accident: the obvious
 * addition is a line at the top saying "these three broadly match" or "these
 * two conflict", and it would be a number on meaning dressed as a summary.
 * Rule 30. The readings are next to each other; the members can read.
 */
export default async function TermPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireSession();
  const supabase = await createClient();

  // RLS answers this: a word outside a group you belong to is not found, which
  // is the same answer as a word that does not exist, deliberately.
  const { data: term } = await supabase
    .from("terms")
    .select("id, term, raised_at")
    .eq("id", id)
    .maybeSingle();

  if (!term) notFound();

  const { data } = await supabase.rpc("readings_for", { p_term_id: id });
  const readings = (data ?? []) as Reading[];
  const mine = readings.find((r) => r.mine) ?? null;
  const others = readings.filter((r) => !r.mine);

  return (
    <Page>
      <ScreenHead
        sub={
          <>
            <Link href="/collective/lexicon" className="text-paper-faint underline">
              Words
            </Link>{" "}
            · raised {shortDate(term.raised_at as string)}
          </>
        }
      >
        {term.term as string}
      </ScreenHead>

      <Card className="mb-6">
        <p className="smallcaps mb-3 text-[10px] text-gold">Yours</p>
        <YourReading
          termId={id}
          term={term.term as string}
          existing={mine?.body ?? null}
        />
        {mine?.revised ? (
          <p className="mt-3 text-sm text-paper-faint">
            You have written this {mine.revision} times. The earlier wordings are
            below and stay there.
          </p>
        ) : null}
      </Card>

      <p className="smallcaps mb-1 text-[10px] text-paper-faint">
        {others.length === 0
          ? "Nobody else yet"
          : others.length === 1
            ? "One other person"
            : `${others.length} other people`}
      </p>

      {others.length ? (
        <ul className="space-y-0">
          {others.map((r) => (
            <li key={r.profile_id} className="border-b border-line-soft py-4">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-[0.9375rem] text-paper">
                  {r.handle ? (
                    <Link
                      href={`/collective/people/${r.profile_id}`}
                      className="underline decoration-line"
                    >
                      {r.display_name}
                    </Link>
                  ) : (
                    r.display_name
                  )}
                </p>
                {r.revised ? <Tag>revised</Tag> : null}
              </div>
              <p
                className="mt-1 text-[0.9375rem] leading-relaxed text-paper-dim"
                data-selectable
              >
                {r.body}
              </p>
              <p className="smallcaps mt-1 text-[10px] text-paper-faint">
                {r.revised
                  ? `wording ${r.revision}, ${ago(r.written_at)} · first written ${shortDate(r.first_at)}`
                  : ago(r.written_at)}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <Empty>
          Only you so far. A word with one reading on it is a note to yourself;
          it starts being useful the moment somebody writes a second one that
          turns out not to match.
        </Empty>
      )}

      {mine ? <History termId={id} profileId={mine.profile_id} /> : null}

      <p className="mt-8 border-t border-line-soft pt-4 text-sm leading-relaxed text-paper-faint">
        Nothing on this page decides anything. A reading is not a vote, there is
        no agreed definition and nothing here measures how close these are to
        each other — a number on that would be wrong in a way nobody could
        check, and it would look like a fact. It is here so that a group can find
        out, before it counts anything, that it has been using one word for two
        arrangements.
      </p>
    </Page>
  );
}

/**
 * How your own wording moved.
 *
 * Only your own. Watching somebody else's language change over time is a
 * behavioural record of them, and the only person entitled to that record is
 * the person who wrote it — `reading_history()` will return anybody's to a
 * member, because the rows are group-visible, and this screen asks for one.
 */
async function History({
  termId,
  profileId,
}: {
  termId: string;
  profileId: string;
}) {
  const supabase = await createClient();
  const { data } = await supabase.rpc("reading_history", {
    p_term_id: termId,
    p_profile_id: profileId,
  });

  const revisions = ((data ?? []) as ReadingRevision[]).slice(0, -1);
  if (!revisions.length) return null;

  return (
    <div className="mt-8">
      <p className="smallcaps mb-1 text-[10px] text-paper-faint">
        What you used to mean by it
      </p>
      <ul className="space-y-0">
        {revisions.map((r) => (
          <li key={r.revision} className="border-b border-line-soft py-3">
            <p
              className="text-sm leading-relaxed text-paper-faint"
              data-selectable
            >
              {r.body}
            </p>
            <p className="smallcaps mt-1 text-[10px] text-paper-faint">
              wording {r.revision} · {shortDate(r.written_at)}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
