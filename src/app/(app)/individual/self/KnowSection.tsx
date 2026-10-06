import Link from "next/link";

import { Card, Gutter, SectionLabel } from "@/components/ui";
import { shortDate } from "@/lib/format";
import { NEED_LABEL, NEED_MEANING, NEEDS, topNeeds, type Belief, type Goal, type NeedScores } from "@/lib/know";
import { createClient } from "@/lib/supabase/server";

/**
 * Know yourself on the Self tab: the latest findings, or the way in. Only the
 * person can ever read this (0041), and it is what their own AI understands
 * about them first.
 */
export async function KnowSection() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("self_assessments")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) {
    return (
      <Gutter className="pt-6">
        <Link
          href="/individual/self/know"
          className="press block rounded-3xl border border-gold/50 bg-gold/10 px-5 py-5 active:bg-gold/20"
        >
          <p className="font-serif text-2xl text-paper">Know yourself</p>
          <p className="mt-1 text-[0.95rem] text-paper-dim">
            What drives you, what you value, what holds you back and what you&apos;re going for. Ten minutes. Only you
            see it — and your AI starts from it.
          </p>
          <p className="mt-3 text-sm font-semibold text-gold">Start →</p>
        </Link>
      </Gutter>
    );
  }

  const needs = data.needs as NeedScores;
  const top = topNeeds(needs);
  const toward = data.values_toward as string[];
  const away = data.values_away as string[];
  const beliefs = data.beliefs as Belief[];
  const goals = data.goals as Goal[];

  return (
    <Gutter className="space-y-8 pt-6">
      <div className="flex items-baseline justify-between">
        <h2 className="display text-[1.75rem] text-paper">Know yourself</h2>
        <Link href="/individual/self/know" className="text-sm text-gold">
          Retake
        </Link>
      </div>

      {data.focus ? (
        <Card className="border-gold/50">
          <p className="smallcaps text-[10px] text-gold">Your focus</p>
          <p className="mt-2 whitespace-pre-line text-[0.95rem] leading-relaxed text-paper">{data.focus}</p>
        </Card>
      ) : null}

      <section>
        <SectionLabel>What drives you</SectionLabel>
        <p className="mb-3 text-[0.95rem] text-paper-dim">
          Mostly <span className="text-paper">{NEED_LABEL[top[0]]}</span> — {NEED_MEANING[top[0]]} — and{" "}
          <span className="text-paper">{NEED_LABEL[top[1]]}</span>, {NEED_MEANING[top[1]]}.
        </p>
        <ul className="space-y-2">
          {[...NEEDS]
            .sort((a, b) => needs[b] - needs[a])
            .map((n) => (
              <li key={n} className="flex items-center gap-3 text-sm">
                <span className="w-28 shrink-0 text-paper-dim">{NEED_LABEL[n]}</span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-line">
                  <span
                    className={`block h-full rounded-full ${top.includes(n) ? "bg-gold" : "bg-paper-faint"}`}
                    style={{ width: `${Math.round(needs[n] * 100)}%` }}
                  />
                </span>
              </li>
            ))}
        </ul>
      </section>

      <section>
        <SectionLabel>What you move toward</SectionLabel>
        <ol className="flex flex-wrap gap-2">
          {toward.map((v, i) => (
            <li key={v} className="rounded-pill border border-line px-3 py-1.5 text-sm text-paper">
              <span className="mr-1.5 text-paper-faint">{i + 1}</span>
              {v}
            </li>
          ))}
        </ol>
        {away.length ? (
          <p className="mt-3 text-sm text-paper-dim">
            And away from: <span className="text-paper">{away.join(", ")}</span>
          </p>
        ) : null}
      </section>

      {beliefs.length ? (
        <section>
          <SectionLabel>Beliefs to change</SectionLabel>
          <ul className="space-y-2">
            {beliefs.map((b, i) => (
              <li key={i}>
                <Card>
                  <p className="text-xs text-paper-faint">{b.area}</p>
                  <p className="mt-1 text-sm text-paper-faint line-through">{b.limiting}</p>
                  <p className="mt-1 text-[0.95rem] text-paper">{b.empowering}</p>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {goals.length ? (
        <section>
          <SectionLabel>What you&apos;re going for</SectionLabel>
          <ul className="space-y-2">
            {goals.map((g, i) => (
              <li key={i}>
                <Card>
                  <p className="font-serif text-lg text-paper">{g.result}</p>
                  {g.purpose ? <p className="mt-1 text-sm text-paper-dim">Because {g.purpose}</p> : null}
                  {g.actions.length ? (
                    <ul className="mt-2 space-y-1 text-sm text-paper">
                      {g.actions.map((a, k) => (
                        <li key={k}>→ {a}</li>
                      ))}
                    </ul>
                  ) : null}
                </Card>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <p className="text-xs text-paper-faint">
        {shortDate(data.created_at as string)} · only you can see this · your AI starts from it
      </p>
    </Gutter>
  );
}
