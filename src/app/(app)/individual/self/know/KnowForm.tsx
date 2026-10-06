"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button, inputClass } from "@/components/ui";
import { AREAS, AWAY, STATEMENTS, TOWARD, scoreNeeds, type Belief, type Goal } from "@/lib/know";

import { saveAssessment } from "../actions";

const STEPS = ["Needs", "Values", "Avoid", "Beliefs", "Goals"] as const;

export function KnowForm() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [toward, setToward] = useState<string[]>([]);
  const [own, setOwn] = useState("");
  const [away, setAway] = useState<string[]>([]);
  const [beliefs, setBeliefs] = useState<Belief[]>([{ area: "Work", limiting: "", empowering: "" }]);
  const [goals, setGoals] = useState<Goal[]>([{ result: "", purpose: "", actions: ["", "", ""] }]);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const answered = Object.keys(answers).length;
  const canNext =
    step === 0 ? answered === STATEMENTS.length : step === 1 ? toward.length >= 3 : true;

  const move = (list: string[], i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= list.length) return list;
    const next = [...list];
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  };

  return (
    <div className="pb-10">
      {/* progress */}
      <div className="mb-6 flex gap-1.5">
        {STEPS.map((s, i) => (
          <div key={s} className="flex-1">
            <div className={`h-1 rounded-full ${i <= step ? "bg-gold" : "bg-line"}`} />
            <p className={`mt-1 text-[11px] ${i === step ? "text-paper" : "text-paper-faint"}`}>{s}</p>
          </div>
        ))}
      </div>

      {step === 0 ? (
        <section>
          <h2 className="font-serif text-2xl text-paper">What drives you</h2>
          <p className="mt-1 text-sm text-paper-dim">How true is each one? 1 not at all, 5 completely.</p>
          <ol className="mt-5 space-y-5">
            {STATEMENTS.map((s, i) => (
              <li key={i}>
                <p className="text-[0.95rem] leading-snug text-paper">{s.text}</p>
                <div className="mt-2 grid grid-cols-5 gap-1.5" role="radiogroup" aria-label={s.text}>
                  {[1, 2, 3, 4, 5].map((v) => (
                    <button
                      key={v}
                      type="button"
                      role="radio"
                      aria-checked={answers[i] === v}
                      onClick={() => setAnswers({ ...answers, [i]: v })}
                      className={`press rounded-lg py-2 text-sm ${
                        answers[i] === v ? "bg-gold text-ink" : "border border-line text-paper-dim"
                      }`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {step === 1 ? (
        <section>
          <h2 className="font-serif text-2xl text-paper">What you move toward</h2>
          <p className="mt-1 text-sm text-paper-dim">Choose up to seven, then put them in order — most important first.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {[...TOWARD, ...toward.filter((t) => !TOWARD.includes(t))].map((v) => {
              const on = toward.includes(v);
              return (
                <button
                  key={v}
                  type="button"
                  onClick={() =>
                    setToward(on ? toward.filter((x) => x !== v) : toward.length < 7 ? [...toward, v] : toward)
                  }
                  className={`press rounded-pill px-3 py-1.5 text-sm ${
                    on ? "bg-gold text-ink" : "border border-line text-paper-dim"
                  }`}
                >
                  {v}
                </button>
              );
            })}
          </div>
          <form
            className="mt-3 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const v = own.trim();
              if (v && !toward.includes(v) && toward.length < 7) setToward([...toward, v]);
              setOwn("");
            }}
          >
            <input className={`${inputClass} flex-1`} value={own} maxLength={40} placeholder="Your own word" onChange={(e) => setOwn(e.target.value)} />
            <Button type="submit" tone="quiet">Add</Button>
          </form>
          {toward.length ? (
            <ol className="mt-5 space-y-2">
              {toward.map((v, i) => (
                <li key={v} className="flex items-center justify-between rounded-2xl border border-line px-4 py-2.5">
                  <span className="text-paper">
                    <span className="mr-3 tabular-nums text-paper-faint">{i + 1}</span>
                    {v}
                  </span>
                  <span className="flex gap-3 text-paper-faint">
                    <button type="button" aria-label={`Move ${v} up`} onClick={() => setToward(move(toward, i, -1))}>↑</button>
                    <button type="button" aria-label={`Move ${v} down`} onClick={() => setToward(move(toward, i, 1))}>↓</button>
                  </span>
                </li>
              ))}
            </ol>
          ) : null}
        </section>
      ) : null}

      {step === 2 ? (
        <section>
          <h2 className="font-serif text-2xl text-paper">What you move away from</h2>
          <p className="mt-1 text-sm text-paper-dim">The feelings you&apos;d do most to avoid. Choose up to five, worst first.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {AWAY.map((v) => {
              const on = away.includes(v);
              return (
                <button
                  key={v}
                  type="button"
                  onClick={() => setAway(on ? away.filter((x) => x !== v) : away.length < 5 ? [...away, v] : away)}
                  className={`press rounded-pill px-3 py-1.5 text-sm ${
                    on ? "bg-alarm text-ink" : "border border-line text-paper-dim"
                  }`}
                >
                  {on ? `${away.indexOf(v) + 1}. ` : ""}
                  {v}
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      {step === 3 ? (
        <section>
          <h2 className="font-serif text-2xl text-paper">What holds you back</h2>
          <p className="mt-1 text-sm text-paper-dim">A belief that stops you, and what you&apos;d rather believe instead.</p>
          <div className="mt-4 space-y-5">
            {beliefs.map((b, i) => (
              <div key={i} className="space-y-2 rounded-2xl border border-line p-4">
                <select
                  className={inputClass}
                  value={b.area}
                  onChange={(e) => setBeliefs(beliefs.map((x, j) => (j === i ? { ...x, area: e.target.value } : x)))}
                >
                  {AREAS.map((a) => (
                    <option key={a}>{a}</option>
                  ))}
                </select>
                <input
                  className={inputClass}
                  placeholder="I believe… (e.g. I'm not someone who finishes things)"
                  value={b.limiting}
                  maxLength={300}
                  onChange={(e) => setBeliefs(beliefs.map((x, j) => (j === i ? { ...x, limiting: e.target.value } : x)))}
                />
                <input
                  className={inputClass}
                  placeholder="I'd rather believe… (e.g. I finish what matters to me)"
                  value={b.empowering}
                  maxLength={300}
                  onChange={(e) => setBeliefs(beliefs.map((x, j) => (j === i ? { ...x, empowering: e.target.value } : x)))}
                />
              </div>
            ))}
          </div>
          {beliefs.length < 3 ? (
            <button
              type="button"
              className="mt-3 text-sm text-gold"
              onClick={() => setBeliefs([...beliefs, { area: "Health", limiting: "", empowering: "" }])}
            >
              + Another
            </button>
          ) : null}
        </section>
      ) : null}

      {step === 4 ? (
        <section>
          <h2 className="font-serif text-2xl text-paper">What you&apos;re going for</h2>
          <p className="mt-1 text-sm text-paper-dim">The result, why it matters to you, and the first things you&apos;ll do.</p>
          <div className="mt-4 space-y-5">
            {goals.map((g, i) => (
              <div key={i} className="space-y-2 rounded-2xl border border-line p-4">
                <input
                  className={inputClass}
                  placeholder="The result (e.g. Run a half marathon by May)"
                  value={g.result}
                  maxLength={300}
                  onChange={(e) => setGoals(goals.map((x, j) => (j === i ? { ...x, result: e.target.value } : x)))}
                />
                <textarea
                  className={`${inputClass} min-h-16`}
                  placeholder="Why it matters to you"
                  value={g.purpose}
                  maxLength={300}
                  onChange={(e) => setGoals(goals.map((x, j) => (j === i ? { ...x, purpose: e.target.value } : x)))}
                />
                {g.actions.map((a, k) => (
                  <input
                    key={k}
                    className={inputClass}
                    placeholder={`First action ${k + 1}`}
                    value={a}
                    maxLength={300}
                    onChange={(e) =>
                      setGoals(
                        goals.map((x, j) =>
                          j === i ? { ...x, actions: x.actions.map((y, m) => (m === k ? e.target.value : y)) } : x,
                        ),
                      )
                    }
                  />
                ))}
              </div>
            ))}
          </div>
          {goals.length < 3 ? (
            <button
              type="button"
              className="mt-3 text-sm text-gold"
              onClick={() => setGoals([...goals, { result: "", purpose: "", actions: ["", "", ""] }])}
            >
              + Another goal
            </button>
          ) : null}
        </section>
      ) : null}

      {error ? <p className="mt-5 text-sm text-alarm">{error}</p> : null}

      <div className="mt-8 flex items-center justify-between">
        {step > 0 ? (
          <Button type="button" tone="ghost" onClick={() => setStep(step - 1)}>
            Back
          </Button>
        ) : (
          <span />
        )}
        {step < STEPS.length - 1 ? (
          <Button type="button" disabled={!canNext} onClick={() => setStep(step + 1)}>
            {step === 0 && !canNext ? `${answered} of ${STATEMENTS.length}` : step === 1 && !canNext ? "Choose at least 3" : "Next"}
          </Button>
        ) : (
          <Button
            type="button"
            disabled={pending}
            onClick={() =>
              start(async () => {
                setError(null);
                const r = await saveAssessment({ needs: scoreNeeds(answers), toward, away, beliefs, goals });
                if (!r.ok) setError(r.error);
                else router.push("/individual/self");
              })
            }
          >
            {pending ? "Reading it…" : "See what I found"}
          </Button>
        )}
      </div>
    </div>
  );
}
