"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button, Card, Field, inputClass } from "@/components/ui";
import { RESONANCE_THRESHOLD, UNIVERSAL_LAWS } from "@/lib/universal-law";

import { agreeToUniversalLaw, finishOnboarding, saveBeliefs, saveDetails } from "./actions";

const VALUE_HINTS = ["Honesty", "Restraint", "Hospitality", "Craft", "Fairness"];
const PASSION_HINTS = ["Growing things", "Repair", "Music", "Walking"];

type Pair = { name: string; definition: string };
type Passion = { name: string; note: string };

/**
 * First run, in four parts: who you are, the constitution you are agreeing to,
 * what you actually believe, and a walk through what the thing does.
 *
 * The order is not arbitrary. The laws come before the values because the laws
 * are what the values are read alongside, and somebody should know what they
 * are joining before being asked to describe themselves to it.
 */
export function OnboardingFlow({
  displayName,
  handle,
}: {
  displayName: string;
  handle: string | null;
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const [name, setName] = useState(displayName === "Unnamed" ? "" : displayName);
  const [tag, setTag] = useState(handle ?? "");
  const [local, setLocal] = useState("");
  const [regional, setRegional] = useState("");
  const [national, setNational] = useState("");
  const [continental, setContinental] = useState("");

  const [read, setRead] = useState(false);

  const [values, setValues] = useState<Pair[]>([
    { name: "", definition: "" },
    { name: "", definition: "" },
    { name: "", definition: "" },
  ]);
  const [passions, setPassions] = useState<Passion[]>([
    { name: "", note: "" },
    { name: "", note: "" },
  ]);
  const [purpose, setPurpose] = useState("");
  const [faith, setFaith] = useState("");

  const [demo, setDemo] = useState(0);

  function setValue(i: number, key: keyof Pair, v: string) {
    setValues((vs) => vs.map((row, j) => (j === i ? { ...row, [key]: v } : row)));
  }
  function setPassion(i: number, key: keyof Passion, v: string) {
    setPassions((ps) => ps.map((row, j) => (j === i ? { ...row, [key]: v } : row)));
  }

  // ---------------------------------------------------------------- 1. details

  if (step === 0) {
    return (
      <div className="space-y-5">
        <p className="text-[0.95rem] leading-relaxed text-paper-dim">
          Sovereign has two halves. One is yours alone — what you write, what
          you are working out, what you believe. The other is shared, and is
          where things get decided. The first never becomes the second unless
          you send it there.
        </p>

        <Field label="What should we call you?">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            className={inputClass}
          />
        </Field>

        <Field label="A handle, if you want one">
          <input
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            placeholder="optional"
            className={inputClass}
          />
          <p className="mt-2 text-sm leading-relaxed text-paper-faint">
            An address, not a username. It is how somebody who already knows you
            can find you — there is no directory and no search, so if you never
            hand it out, nobody arrives.
          </p>
        </Field>

        <div className="pt-2">
          <p className="text-[0.95rem] leading-relaxed text-paper-dim">
            Where are you? Proposals are addressed to places, and these lines
            are what decides which ones reach you. Nothing is looked up or
            verified — write them the way you would say them.
          </p>
          <p className="mt-2 text-sm leading-relaxed text-paper-faint">
            They do not nest: being in a city does not put you in its country
            unless you say so. Fill in as many as you want to hear from, and
            leave the rest blank.
          </p>
        </div>

        <Field label="Neighbourhood or town">
          <input value={local} onChange={(e) => setLocal(e.target.value)} className={inputClass} />
        </Field>
        <Field label="Region or county">
          <input value={regional} onChange={(e) => setRegional(e.target.value)} className={inputClass} />
        </Field>
        <Field label="Country">
          <input value={national} onChange={(e) => setNational(e.target.value)} className={inputClass} />
        </Field>
        <Field label="Continent">
          <input value={continental} onChange={(e) => setContinental(e.target.value)} className={inputClass} />
        </Field>

        {error ? <p className="text-sm text-alarm">{error}</p> : null}

        <Button
          type="button"
          disabled={!name.trim() || pending}
          onClick={() =>
            start(async () => {
              setError(null);
              const r = await saveDetails({
                displayName: name,
                handle: tag,
                placeLocal: local,
                placeRegional: regional,
                placeNational: national,
                placeContinental: continental,
              });
              if (!r.ok) setError(r.error);
              else setStep(1);
            })
          }
        >
          {pending ? "Saving" : "Next"}
        </Button>
      </div>
    );
  }

  // ------------------------------------------------------------- 2. the laws

  if (step === 1) {
    return (
      <div className="space-y-5">
        <p className="text-[0.95rem] leading-relaxed text-paper-dim">
          Ten laws sit underneath everything here. They are not a rubric and not
          a set of guidelines: every proposal is read against them, and one that
          violates a law cannot pass whatever anybody votes.
        </p>
        <p className="text-sm leading-relaxed text-paper-faint">
          Read them. They are short, and agreeing to something you scrolled past
          is how people end up bound by things they never saw.
        </p>

        <div
          onScroll={(e) => {
            const el = e.currentTarget;
            if (el.scrollTop + el.clientHeight >= el.scrollHeight - 24) setRead(true);
          }}
          className="max-h-[22rem] space-y-4 overflow-y-auto rounded-lg border border-line bg-surface-soft p-4"
        >
          {UNIVERSAL_LAWS.map((law) => (
            <div key={law.id}>
              <p className="display text-[1rem]">
                {law.ordinal}. {law.name}
              </p>
              <p
                className="mt-1 text-[0.9375rem] leading-relaxed text-paper-dim"
                data-selectable
              >
                {law.text}
              </p>
            </div>
          ))}
          <p className="border-t border-line-soft pt-4 text-sm leading-relaxed text-paper-faint">
            These can be amended, one law&rsquo;s wording at a time, and only
            when every single voice is at 0.900 or above — not a majority, the
            lowest one. If that ever happens you will be told what changed, and
            what you agreed to today stays on the record as what you actually
            read.
          </p>
        </div>

        {!read ? (
          <p className="text-sm text-paper-faint">
            Scroll to the end to agree.
          </p>
        ) : null}

        {error ? <p className="text-sm text-alarm">{error}</p> : null}

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            disabled={!read || pending}
            onClick={() =>
              start(async () => {
                setError(null);
                const r = await agreeToUniversalLaw();
                if (!r.ok) setError(r.error);
                else setStep(2);
              })
            }
          >
            {pending ? "Recording" : "I have read these, and I agree"}
          </Button>
          <Button type="button" tone="ghost" onClick={() => setStep(0)}>
            Back
          </Button>
        </div>
      </div>
    );
  }

  // --------------------------------------------- 3. values, passions, beliefs

  if (step === 2) {
    return (
      <div className="space-y-6">
        <div>
          <p className="text-[0.95rem] leading-relaxed text-paper-dim">
            Now your own. The ten laws are shared; these are not, and nothing
            below is visible to anybody unless you turn sharing on.
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <p className="display text-[1.125rem]">What you value</p>
            <p className="mt-1 text-sm leading-relaxed text-paper-faint">
              In your own words, with your own definitions. Every proposal your
              group considers is scored against these names using these
              definitions — a word that sounds right is worth less than a
              sentence that is actually yours.
            </p>
          </div>
          {values.map((v, i) => (
            <Card key={i}>
              <input
                value={v.name}
                onChange={(e) => setValue(i, "name", e.target.value)}
                placeholder={VALUE_HINTS[i] ?? "A value"}
                className={inputClass}
                aria-label={`Value ${i + 1}`}
              />
              <input
                value={v.definition}
                onChange={(e) => setValue(i, "definition", e.target.value)}
                placeholder="What you mean by it"
                className={`${inputClass} mt-2`}
                aria-label={`Definition ${i + 1}`}
              />
            </Card>
          ))}
          <button
            type="button"
            onClick={() => setValues((vs) => [...vs, { name: "", definition: "" }])}
            className="smallcaps text-[11px] text-gold hover:underline"
          >
            + one more
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <p className="display text-[1.125rem]">What you keep returning to</p>
            <p className="mt-1 text-sm leading-relaxed text-paper-faint">
              Not skills and not a CV. The things you think about when nobody
              has asked you to. Optional.
            </p>
          </div>
          {passions.map((p, i) => (
            <Card key={i}>
              <input
                value={p.name}
                onChange={(e) => setPassion(i, "name", e.target.value)}
                placeholder={PASSION_HINTS[i] ?? "Something"}
                className={inputClass}
                aria-label={`Passion ${i + 1}`}
              />
              <input
                value={p.note}
                onChange={(e) => setPassion(i, "note", e.target.value)}
                placeholder="Why, in a line"
                className={`${inputClass} mt-2`}
                aria-label={`Passion note ${i + 1}`}
              />
            </Card>
          ))}
          <button
            type="button"
            onClick={() => setPassions((ps) => [...ps, { name: "", note: "" }])}
            className="smallcaps text-[11px] text-gold hover:underline"
          >
            + one more
          </button>
        </div>

        <Field label="Your purpose, in one sentence">
          <input
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            placeholder="Optional. Updated rarely, and deliberately."
            className={inputClass}
          />
        </Field>

        <Field label="What you believe">
          <textarea
            value={faith}
            onChange={(e) => setFaith(e.target.value)}
            rows={4}
            placeholder="Optional, and not a creed — your own articulation, in your own words."
            className={inputClass}
          />
          <p className="mt-2 text-sm leading-relaxed text-paper-faint">
            This and your purpose are revisable and never overwritten. Every
            version you write is kept, so you can see how it has moved — and the
            history stays private even if you later share the current one.
          </p>
        </Field>

        {error ? <p className="text-sm text-alarm">{error}</p> : null}

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            disabled={pending || !values.some((v) => v.name.trim())}
            onClick={() =>
              start(async () => {
                setError(null);
                const r = await saveBeliefs({ values, passions, purpose, faith });
                if (!r.ok) setError(r.error);
                else setStep(3);
              })
            }
          >
            {pending ? "Saving" : "Save"}
          </Button>
          <Button type="button" tone="ghost" onClick={() => setStep(1)}>
            Back
          </Button>
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------- 4. the demo

  const panels = [
    {
      title: "Three tabs, and one of them is yours alone",
      body: (
        <>
          <p>
            <strong className="text-paper">Individual</strong> is private, in the
            database rather than by promise: your journal, your ideas, your
            drafts, your values, the guardian. There is no policy anywhere that
            lets another person read it.
          </p>
          <p>
            <strong className="text-paper">Home</strong> is where everything you
            write goes in, and where what is waiting on you appears.
          </p>
          <p>
            <strong className="text-paper">Collective</strong> is the shared
            half — proposals, debate, projects, decisions, people — under a
            selector for which scale you are looking at: local, regional,
            national, continental, global.
          </p>
        </>
      ),
    },
    {
      title: "A proposal goes through five things",
      body: (
        <>
          <p>
            <strong className="text-paper">Propose.</strong> Six sections,
            addressed to the smallest scale that can actually decide it. It does
            not go anywhere until it has been read back to you and sharpened.
          </p>
          <p>
            <strong className="text-paper">Align.</strong> It is audited against
            the ten laws, and scored against the values the group has named. A
            violation ends it. A flag has to be answered in writing — it cannot
            be dismissed.
          </p>
          <p>
            <strong className="text-paper">Vote.</strong> Not yes or no. Three
            sliders — how aligned, how confident, how willing — and the average
            has to clear {RESONANCE_THRESHOLD}. You cannot move them until you
            have read the review.
          </p>
          <p>
            <strong className="text-paper">Activate.</strong> Agreement is not
            resources. Nothing starts until every named need has somebody
            against it.
          </p>
          <p>
            <strong className="text-paper">Reflect.</strong> What actually
            happened, in writing, before a project can close — and the next
            proposal&rsquo;s review reads it.
          </p>
        </>
      ),
    },
    {
      title: "What is deliberately not here",
      body: (
        <>
          <p>
            No follower counts, no streaks, no notifications designed to pull
            you back, no algorithmic feed, no read receipts, and no score on any
            person. The running averages on a live proposal are hidden until it
            closes, so nobody votes with the room.
          </p>
          <p>
            Most of the design here is an absence: a column that is not in the
            database, a policy that does not exist. Where something is missing
            on purpose, the screen says so rather than leaving you to wonder.
          </p>
        </>
      ),
    },
    {
      title: "Where to start",
      body: (
        <>
          <p>
            Write something. Home takes anything — a thought, a question, an
            idea — and files it without asking you to sort it.
          </p>
          <p>
            Then read one proposal addressed to a place you named, and respond
            to it. That is the whole loop in miniature, and it is worth doing
            once before you write one of your own.
          </p>
          <p>
            The guardian, under Individual, will read a draft with you if you
            ask it to. It never speaks first, has no opinion on whether
            something should pass, and keeps no model of you.
          </p>
        </>
      ),
    },
  ];

  const panel = panels[demo];
  const last = demo === panels.length - 1;

  return (
    <div className="space-y-5">
      <div>
        <p className="smallcaps text-[10px] text-paper-faint">
          A quick look — {demo + 1} of {panels.length}
        </p>
        <p className="display mt-1 text-[1.25rem]">{panel.title}</p>
      </div>

      <div className="space-y-3 text-[0.9375rem] leading-relaxed text-paper-dim">
        {panel.body}
      </div>

      {error ? <p className="text-sm text-alarm">{error}</p> : null}

      <div className="flex flex-wrap gap-2">
        {!last ? (
          <Button type="button" onClick={() => setDemo((d) => d + 1)}>
            Next
          </Button>
        ) : (
          <Button
            type="button"
            disabled={pending}
            onClick={() =>
              start(async () => {
                setError(null);
                const r = await finishOnboarding();
                if (!r.ok) setError(r.error);
                else router.push("/write");
              })
            }
          >
            {pending ? "One moment" : "Start"}
          </Button>
        )}
        {demo > 0 ? (
          <Button type="button" tone="ghost" onClick={() => setDemo((d) => d - 1)}>
            Back
          </Button>
        ) : (
          <Button type="button" tone="ghost" onClick={() => setStep(2)}>
            Back
          </Button>
        )}
      </div>
    </div>
  );
}
