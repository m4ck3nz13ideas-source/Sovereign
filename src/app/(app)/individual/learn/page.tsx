import Link from "next/link";

import { Card, Gutter, Readers, SectionLabel } from "@/components/ui";
import { COURSES, courseLessons, forYou, sphereLesson, type AssessmentLike } from "@/lib/learn";
import { topSpheres, type Rating } from "@/lib/foryou";
import { requireSession } from "@/lib/session";
import { sphereLine } from "@/lib/spheres";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Learn · Sovereign" };

/**
 * Learn: what is important and true for you (0044, rule 41).
 *
 * For you — chosen from your own Know yourself results, here and now, stored
 * nowhere. Deciding now — background on proposals open to you that you have
 * not responded to. Then the four courses, and where to go further.
 */
export default async function LearnPage() {
  const { userId } = await requireSession();
  const supabase = await createClient();

  const [{ data: progress, error }, { data: assessment }, { data: open }, { data: mine }, { data: rated }] = await Promise.all([
    supabase.from("lesson_progress").select("lesson_id, completed_at").eq("profile_id", userId),
    supabase
      .from("self_assessments")
      .select("needs, values_toward, values_away, beliefs, goals")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("proposals")
      .select("id, title, summary, sphere, sphere_area, spheres_also, author_id, proposal_reviews(summary, created_at)")
      .in("status", ["in_deliberation", "voting"])
      .neq("author_id", userId)
      .order("submitted_at", { ascending: false })
      .limit(20),
    supabase.from("resonance_votes").select("proposal_id").eq("profile_id", userId),
    supabase.from("sphere_priorities").select("sphere_id, rating").eq("profile_id", userId),
  ]);

  if (error) {
    return (
      <Gutter className="pt-6">
        <p className="text-sm text-alarm">Learn needs migration 0044.</p>
      </Gutter>
    );
  }

  const done = new Set((progress ?? []).filter((p) => p.completed_at).map((p) => p.lesson_id as string));
  const [topSphere] = topSpheres((rated ?? []) as Rating[]);
  const picks = forYou((assessment as AssessmentLike | null) ?? null, done, 4, topSphere ?? null);
  const responded = new Set((mine ?? []).map((v) => v.proposal_id as string));
  const deciding = (open ?? []).filter((p) => !responded.has(p.id)).slice(0, 4) as unknown as {
    id: string;
    title: string;
    summary: string;
    sphere: string | null;
    sphere_area: string | null;
    spheres_also: string[] | null;
    proposal_reviews: { summary: string | null; created_at: string }[];
  }[];

  return (
    <Gutter className="space-y-10 pb-28 pt-6">
      <div className="flex items-baseline justify-between">
        <h2 className="display text-[1.75rem] text-paper">Learn</h2>
        <Readers>Only you. What you finish and write here is yours; nothing collective reads it.</Readers>
      </div>

      <section>
        <SectionLabel>For you</SectionLabel>
        {!assessment ? (
          <Link
            href="/individual/self/know"
            className="press mb-3 block rounded-2xl border border-gold/50 bg-gold/10 px-4 py-3 text-sm text-paper-dim"
          >
            Take <span className="text-paper">Know yourself</span> and this picks lessons for what drives you.{" "}
            <span className="text-gold">Start →</span>
          </Link>
        ) : null}
        {picks.length ? (
          <ul className="space-y-2">
            {picks.map((p) => (
              <li key={p.lesson.id}>
                <Link
                  href={`/individual/learn/${p.lesson.id}`}
                  className="press block rounded-card border border-line bg-surface-soft p-4 hover:border-gold-dim"
                >
                  <p className="font-serif text-lg leading-snug text-paper">{p.lesson.title}</p>
                  <p className="mt-1 text-sm text-paper-dim">{p.why}</p>
                  <p className="smallcaps mt-2 text-[10px] text-paper-faint">
                    {COURSES.find((c) => c.id === p.lesson.course)?.title} · {p.lesson.minutes} min
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-paper-dim">You have finished everything picked for you. Retake Know yourself to see what has changed.</p>
        )}
      </section>

      {deciding.length ? (
        <section>
          <SectionLabel>Deciding now</SectionLabel>
          <ul className="space-y-2">
            {deciding.map((p) => {
              const review = [...(p.proposal_reviews ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
              const bg = sphereLesson(p.sphere);
              return (
                <li key={p.id}>
                  <Card>
                    <p className="smallcaps text-[10px] text-paper-faint">
                      {sphereLine(p.sphere, p.sphere_area, p.spheres_also) ?? "Open to you"}
                    </p>
                    <p className="mt-1 font-serif text-lg leading-snug text-paper">{p.title}</p>
                    <p className="mt-1 text-sm leading-relaxed text-paper-dim">{p.summary}</p>
                    {review?.summary ? (
                      <p className="mt-3 border-l-2 border-line pl-3 text-sm leading-relaxed text-paper-dim">
                        <span className="text-paper-faint">The review: </span>
                        {review.summary}
                      </p>
                    ) : null}
                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                      <Link href={`/collective/proposals/${p.id}`} className="text-gold">
                        Read it, then respond →
                      </Link>
                      {bg ? (
                        <Link href={`/individual/learn/${bg.id}`} className="text-paper-dim">
                          Background: {bg.title}
                        </Link>
                      ) : null}
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <section>
        <SectionLabel>Courses</SectionLabel>
        <ul className="space-y-2">
          {COURSES.map((c) => {
            const lessons = courseLessons(c.id);
            const finished = lessons.filter((l) => done.has(l.id)).length;
            return (
              <li key={c.id}>
                <details className="group rounded-card border border-line bg-surface-soft">
                  <summary className="press flex cursor-pointer list-none items-start justify-between gap-3 p-4 [&::-webkit-details-marker]:hidden">
                    <span>
                      <span className="block font-serif text-lg text-paper">{c.title}</span>
                      <span className="mt-1 block text-sm text-paper-dim">{c.blurb}</span>
                    </span>
                    <span className="shrink-0 text-xs text-paper-faint">
                      {finished}/{lessons.length}
                    </span>
                  </summary>
                  <ol className="border-t border-line">
                    {lessons.map((l) => (
                      <li key={l.id}>
                        <Link
                          href={`/individual/learn/${l.id}`}
                          className="press flex items-center justify-between gap-3 px-4 py-3 text-sm text-paper-dim hover:text-paper"
                        >
                          <span>{l.title}</span>
                          <span className={done.has(l.id) ? "text-gold" : "text-paper-faint"}>
                            {done.has(l.id) ? "✓" : `${l.minutes} min`}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ol>
                </details>
              </li>
            );
          })}
        </ul>
      </section>

      <section>
        <SectionLabel>Go further</SectionLabel>
        <ul className="space-y-2 text-sm">
          {FURTHER.map((f) => (
            <li key={f.href}>
              <a href={f.href} target="_blank" rel="noreferrer" className="text-paper hover:text-gold">
                {f.name} ↗
              </a>
              <span className="text-paper-dim"> — {f.what}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-paper-faint">Outside Sovereign. Free, and not paid to be here.</p>
      </section>
    </Gutter>
  );
}

const FURTHER = [
  { name: "Khan Academy", href: "https://www.khanacademy.org", what: "free courses in almost anything" },
  { name: "OpenLearn", href: "https://www.open.edu/openlearn", what: "free courses from the Open University" },
  { name: "Our World in Data", href: "https://ourworldindata.org", what: "the evidence on health, climate, poverty and more" },
];
