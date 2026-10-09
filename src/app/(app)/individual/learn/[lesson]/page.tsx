import Link from "next/link";
import { notFound } from "next/navigation";

import { Gutter, Readers } from "@/components/ui";
import { COURSES, lesson as findLesson, nextInCourse } from "@/lib/learn";
import { requireSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { UNIVERSAL_LAWS } from "@/lib/universal-law";

import { LessonNote } from "./LessonNote";

export default async function LessonPage({ params }: { params: Promise<{ lesson: string }> }) {
  const { lesson: id } = await params;
  const l = findLesson(id);
  if (!l) notFound();

  const { userId } = await requireSession();
  const supabase = await createClient();
  const { data: mine } = await supabase
    .from("lesson_progress")
    .select("reflection, completed_at")
    .eq("profile_id", userId)
    .eq("lesson_id", l.id)
    .maybeSingle();

  const course = COURSES.find((c) => c.id === l.course)!;
  const law = l.law ? UNIVERSAL_LAWS.find((x) => x.id === l.law) : null;
  const next = nextInCourse(l.id);

  return (
    <Gutter className="pb-28 pt-6">
      <Link href="/individual/learn" className="text-sm text-paper-faint">
        ← Learn
      </Link>
      <p className="smallcaps mt-4 text-[10px] text-paper-faint">
        {course.title} · {l.minutes} min
      </p>
      <h2 className="display mt-1 text-[1.75rem] leading-tight text-paper">{l.title}</h2>

      {law ? (
        <blockquote className="mt-5 border-l-2 border-gold pl-4 font-serif text-lg leading-relaxed text-paper">
          {law.text}
        </blockquote>
      ) : null}

      <div className="mt-5 space-y-4 text-[1rem] leading-relaxed text-paper-dim">
        {l.body.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>

      {l.sphere ? (
        <Link href={`/collective/proposals?sphere=${l.sphere}`} className="mt-4 inline-block text-sm text-gold">
          See proposals in this Sphere →
        </Link>
      ) : null}

      <section className="mt-8">
        <div className="mb-2 flex items-baseline justify-between">
          <p className="text-[0.95rem] text-paper">{l.ask}</p>
        </div>
        <Readers className="mb-2">Only you. Not your groups, not reviewers, not your AI.</Readers>
        <LessonNote id={l.id} initial={mine?.reflection ?? ""} done={Boolean(mine?.completed_at)} />
      </section>

      {next ? (
        <Link
          href={`/individual/learn/${next.id}`}
          className="press mt-8 block rounded-card border border-line p-4 text-sm text-paper-dim hover:border-gold-dim"
        >
          Next: <span className="text-paper">{next.title}</span> →
        </Link>
      ) : null}
    </Gutter>
  );
}
