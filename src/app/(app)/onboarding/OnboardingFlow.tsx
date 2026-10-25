"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition, type ReactNode } from "react";

import { TAB_ICON } from "@/components/nav/TabBar";
import { SphereRatings } from "@/components/spheres/SphereRatings";
import { Button, Card, Field, inputClass } from "@/components/ui";
import { SPACES, STATUS_LABEL } from "@/lib/capabilities";
import { proposalProgress } from "@/lib/collective";
import { GLOSSARY } from "@/lib/glossary";
import { AMENDMENT_RULE, RELEASE_THRESHOLD, UNIVERSAL_LAWS } from "@/lib/universal-law";

import { agreeToUniversalLaw, finishOnboarding, saveBeliefs, saveDetails } from "./actions";

const VALUE_HINTS = ["Honesty", "Restraint", "Hospitality", "Craft", "Fairness"];
const PASSION_HINTS = ["Growing things", "Repair", "Music", "Walking"];

type Pair = { name: string; definition: string };
type Passion = { name: string; note: string };

/**
 * First run, in four parts, in Mackenzie's order: who you are, the ten laws
 * read and agreed to, what you value and what matters to you, then a tour.
 *
 * The laws come before the values because the laws are what the values are
 * read alongside, and somebody should know what they are joining before being
 * asked to describe themselves to it.
 *
 * THE TOUR READS THE APP, NOT A SCRIPT
 *
 * The tour used to be four hand-written panels, and they went stale as the
 * app moved (three sliders that are not the three on screen, People under
 * Collective, a guardian that "never speaks first"). It now draws from the
 * same sources as everything else: each tab card is `SPACES` from
 * lib/capabilities — the list the tab pop-ups and the public site read — the
 * decision card is `proposalProgress()` and the glossary, and the icons are
 * the tab bar's own. Change the app and the tour follows. Do not put
 * hand-written claims about what a tab does back in here.
 */
const BLANK_VALUES: Pair[] = [
  { name: "", definition: "" },
  { name: "", definition: "" },
  { name: "", definition: "" },
];
const BLANK_PASSIONS: Passion[] = [
  { name: "", note: "" },
  { name: "", note: "" },
];

const STEP_NAMES = ["You", "The ten", "Yours", "Your tabs"];

/** Each step's title, centred like every heading in the app. */
function Heading({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <div className="text-center">
      <h2 className="display text-[1.375rem] text-paper">{children}</h2>
      {sub ? <p className="mt-1.5 text-[0.95rem] leading-relaxed text-paper-dim">{sub}</p> : null}
    </div>
  );
}

/** The tab bar's order, left to right, so the tour walks it the same way. */
const TAB_ORDER = ["individual", "connection", "search", "market", "collective"] as const;

export function OnboardingFlow({
  displayName,
  handle,
  places,
  savedValues,
  savedPassions,
  purpose: savedPurpose,
  faith: savedFaith,
  sphereRatings,
  agreed,
  startAt,
}: {
  displayName: string;
  handle: string | null;
  places: { local: string; regional: string; national: string; continental: string };
  savedValues: Pair[];
  savedPassions: Passion[];
  purpose: string;
  faith: string;
  /** Sphere id → 1–5, as already saved. Ratings save on tap, not with the step. */
  sphereRatings: Record<string, number>;
  /** Whether the ten are already on the record, so the laws step knows. */
  agreed: boolean;
  /** Where the database says this person got to. See the page's comment. */
  startAt: number;
}) {
  const router = useRouter();
  const [step, setStep] = useState(startAt);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const [name, setName] = useState(displayName === "Unnamed" ? "" : displayName);
  const [tag, setTag] = useState(handle ?? "");
  const [local, setLocal] = useState(places.local);
  const [regional, setRegional] = useState(places.regional);
  const [national, setNational] = useState(places.national);
  const [continental, setContinental] = useState(places.continental);

  // Somebody returning to a step they already completed has read the laws
  // once; making them scroll again would be ceremony rather than care.
  const [read, setRead] = useState(agreed);

  const [values, setValues] = useState<Pair[]>(
    savedValues.length ? savedValues : BLANK_VALUES,
  );
  const [passions, setPassions] = useState<Passion[]>(
    savedPassions.length ? savedPassions : BLANK_PASSIONS,
  );
  const [purpose, setPurpose] = useState(savedPurpose);
  const [faith, setFaith] = useState(savedFaith);

  const [card, setCard] = useState(0);
  const track = useRef<HTMLDivElement>(null);

  function setValue(i: number, key: keyof Pair, v: string) {
    setValues((vs) => vs.map((row, j) => (j === i ? { ...row, [key]: v } : row)));
  }
  function setPassion(i: number, key: keyof Passion, v: string) {
    setPassions((ps) => ps.map((row, j) => (j === i ? { ...row, [key]: v } : row)));
  }

  // Four steps with a visible end. This is not the progress mechanic the
  // roadmap rules out — that one is open-ended and never finishes, which is
  // what makes it a debt. Knowing there are four of these and which one you
  // are on is ordinary courtesy.
  const Steps = (
    <ol className="mb-6 flex items-center gap-1.5" aria-label="Onboarding progress">
      {STEP_NAMES.map((label, i) => (
        <li key={label} className="flex flex-1 flex-col gap-1">
          <span
            className={`h-0.5 rounded-full ${i <= step ? "bg-gold" : "bg-surface"}`}
            aria-hidden
          />
          <span
            className={`smallcaps text-center text-[9px] ${
              i === step ? "text-gold" : "text-paper-faint"
            }`}
          >
            {label}
          </span>
        </li>
      ))}
    </ol>
  );

  // ---------------------------------------------------------------- 1. you

  if (step === 0) {
    return (
      <div className="space-y-5">
        {Steps}
        <Heading sub="Half of Sovereign is yours alone. Half is where things get decided. Nothing crosses unless you send it.">
          You
        </Heading>

        <Field label="Your name">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            className={inputClass}
          />
        </Field>

        <Field
          label="Your handle"
          hint="How people find you: share it as a link or QR code from Connection. There is no directory of people."
        >
          <input
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            placeholder="optional"
            autoCapitalize="none"
            className={inputClass}
          />
        </Field>

        <div className="pt-2 text-center">
          <p className="display text-[1.125rem] text-paper">Where you are</p>
          <p className="mt-1 text-sm leading-relaxed text-paper-faint">
            Decides which proposals reach you. Fill in as many as you want to
            hear from. Nothing is looked up.
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
          className="w-full"
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
        {Steps}
        <Heading sub="Every proposal and every business is read against these. Break one and it cannot pass, whatever the vote.">
          The ten
        </Heading>

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
            {AMENDMENT_RULE} What you agree to today stays on the record as the
            wording you read.
          </p>
        </div>

        <p className="text-center text-sm text-paper-faint">
          {read ? "Your agreement records the exact wording above." : "Read to the end to agree."}
        </p>

        {error ? <p className="text-sm text-alarm">{error}</p> : null}

        <div className="flex flex-col gap-2">
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

  // ------------------------------- 3. values, what matters, passions, beliefs

  if (step === 2) {
    return (
      <div className="space-y-7">
        {Steps}
        <Heading sub="The ten are shared. These are yours, and private unless you choose to share them.">
          Yours
        </Heading>

        <section className="space-y-3">
          <div className="text-center">
            <p className="display text-[1.125rem]">What you value</p>
            <p className="mt-1 text-sm leading-relaxed text-paper-faint">
              In your own words. Proposals are scored against these definitions,
              so a sentence that is yours beats a word that sounds right.
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
            className="smallcaps block w-full text-center text-[11px] text-gold hover:underline"
          >
            + one more
          </button>
        </section>

        {/* Ratings save on tap through the same action as Individual → Self,
            so leaving this step half-done loses nothing (0047). */}
        <section>
          <div className="text-center">
            <p className="display text-[1.125rem]">What matters to you</p>
            <p className="mt-1 text-sm leading-relaxed text-paper-faint">
              Rate each Sphere. It fills your For you feed and shapes your AI
              and Learn. Only you see your ratings.
            </p>
          </div>
          <div className="mt-3 rounded-card border border-line bg-surface-soft px-4 pb-2 pt-1">
            <SphereRatings initial={sphereRatings} compact />
          </div>
        </section>

        <section className="space-y-3">
          <div className="text-center">
            <p className="display text-[1.125rem]">What you keep returning to</p>
            <p className="mt-1 text-sm leading-relaxed text-paper-faint">
              The things you think about when nobody has asked. Optional.
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
            className="smallcaps block w-full text-center text-[11px] text-gold hover:underline"
          >
            + one more
          </button>
        </section>

        <Field label="Your purpose, in one sentence">
          <input
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            placeholder="Optional"
            className={inputClass}
          />
        </Field>
        <Field
          label="What you believe"
          hint="Optional. Every version is kept, privately, so you can see how it moves."
        >
          <textarea
            value={faith}
            onChange={(e) => setFaith(e.target.value)}
            rows={4}
            placeholder="In your own words"
            className={inputClass}
          />
        </Field>

        {error ? <p className="text-sm text-alarm">{error}</p> : null}

        <div className="flex flex-col gap-2">
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
          {/* Values are private, but they are still not a toll to get in:
              anybody can explore first and come back from Individual → Self. */}
          <Button type="button" tone="quiet" disabled={pending} onClick={() => setStep(3)}>
            Skip for now
          </Button>
          <Button type="button" tone="ghost" onClick={() => setStep(1)}>
            Back
          </Button>
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------- 4. the tour

  const spaces = TAB_ORDER.map((id) => SPACES.find((s) => s.id === id)!);
  const guardian = SPACES.find((s) => s.id === "individual")?.can.find((c) => /AI/.test(c.title));
  const path = proposalProgress("completed");

  const cards: { key: string; body: ReactNode }[] = [
    {
      key: "intro",
      body: (
        <>
          <p className="smallcaps text-center text-[11px] font-semibold text-gold">Sovereign</p>
          <h2 className="display mt-1 text-center text-[1.75rem] leading-tight text-paper">
            Better decisions. Together.
          </h2>
          <p className="mt-3 text-center text-[0.95rem] leading-relaxed text-paper-dim">
            Five tabs. One is yours alone. Four you share.
          </p>
          <ul className="mt-6 flex justify-center gap-4 text-paper" aria-hidden>
            {TAB_ORDER.map((id) => {
              const Icon = TAB_ICON[id];
              return (
                <li key={id}>
                  <Icon filled={id === "search"} />
                </li>
              );
            })}
          </ul>
        </>
      ),
    },
    ...spaces.map((sp) => {
      const Icon = TAB_ICON[sp.id];
      return {
        key: sp.id,
        body: (
          <>
            <div className="flex justify-center text-gold" aria-hidden>
              <Icon filled />
            </div>
            <h2 className="display mt-2 text-center text-[1.5rem] text-paper">{sp.name}</h2>
            <p className="mt-2 text-center text-[0.95rem] leading-relaxed text-paper-dim">{sp.purpose}</p>
            <ul className="mt-4 space-y-2">
              {sp.can.map((c) => (
                <li key={c.title} className="flex gap-2.5 text-[0.9rem] leading-snug">
                  <span
                    aria-hidden
                    className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${c.status === "current" ? "bg-gold" : "bg-line"}`}
                  />
                  <span>
                    <span className="text-paper">{c.title}</span>
                    {c.status !== "current" ? (
                      <span className="text-paper-faint"> · {STATUS_LABEL[c.status].toLowerCase()}</span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-4 rounded-lg bg-surface px-3.5 py-3 text-[0.9rem] leading-relaxed text-paper-dim">
              <span className="font-semibold text-paper">Try first: </span>
              {sp.firstAction}
            </p>
          </>
        ),
      };
    }),
    {
      key: "decide",
      body: (
        <>
          <h2 className="display text-center text-[1.5rem] text-paper">How a decision is made</h2>
          <ol className="mt-4 flex flex-wrap justify-center gap-1.5">
            {path.map((p, i) => (
              <li key={p.key} className="flex items-center gap-1.5 text-[0.8125rem] text-paper">
                <span className="rounded-pill bg-surface px-2.5 py-1">{p.label}</span>
                {i < path.length - 1 ? <span aria-hidden className="text-paper-faint">→</span> : null}
              </li>
            ))}
          </ol>
          <div className="mt-5 grid grid-cols-2 gap-2 text-center">
            <div className="rounded-lg bg-surface px-3 py-2.5">
              <p className="font-serif text-xl tabular-nums text-gold">{RELEASE_THRESHOLD}</p>
              <p className="mt-0.5 text-[0.8125rem] leading-snug text-paper-dim">alignment with the laws releases it to the public</p>
            </div>
            <div className="rounded-lg bg-surface px-3 py-2.5">
              <p className="font-serif text-xl text-gold">Its own</p>
              <p className="mt-0.5 text-[0.8125rem] leading-snug text-paper-dim">conditions, once met, pass it into a project</p>
            </div>
          </div>
          <dl className="mt-5 space-y-3 text-[0.9rem] leading-relaxed">
            {(["Universal Laws", "Alignment", "Conditions", "Activation", "Reflection"] as const).map((t) => (
              <div key={t}>
                <dt className="font-semibold text-paper">{t}</dt>
                <dd className="text-paper-dim">{GLOSSARY[t]}</dd>
              </div>
            ))}
          </dl>
        </>
      ),
    },
    {
      key: "ask",
      body: (
        <>
          <div className="flex justify-center" aria-hidden>
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gold text-sm font-semibold text-ink">
              AI
            </span>
          </div>
          <h2 className="display mt-3 text-center text-[1.5rem] text-paper">Ask anywhere</h2>
          <p className="mt-2 text-center text-[0.95rem] leading-relaxed text-paper-dim">
            The gold button sits on every page. Ask where something is, what a
            word means, or talk something through.
          </p>
          <p className="mt-4 text-center text-[0.9rem] leading-relaxed text-paper-dim">
            The <span className="font-semibold text-paper">i</span> at the top
            of each tab brings back what it is for.
          </p>
          {guardian && guardian.status !== "current" && guardian.note ? (
            <p className="mt-4 text-center text-[0.8125rem] leading-relaxed text-paper-faint">
              {STATUS_LABEL[guardian.status]}: {guardian.note}
            </p>
          ) : null}
        </>
      ),
    },
  ];

  const last = card === cards.length - 1;

  function goTo(i: number) {
    const el = track.current;
    const next = Math.max(0, Math.min(cards.length - 1, i));
    setCard(next);
    el?.scrollTo({ left: next * el.clientWidth, behavior: "smooth" });
  }

  return (
    <div className="space-y-5">
      {Steps}

      {/* Swipe, or use the buttons. Scroll-snap does the swiping, so it is a
          plain scroll container a screen reader can walk card by card. */}
      <div
        ref={track}
        onScroll={(e) => {
          const el = e.currentTarget;
          const i = Math.round(el.scrollLeft / el.clientWidth);
          if (i !== card) setCard(i);
        }}
        className="-mx-1 flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        aria-roledescription="carousel"
        aria-label="A look round"
      >
        {cards.map((c, i) => (
          <section
            key={c.key}
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${cards.length}`}
            className="w-full shrink-0 snap-start px-1"
          >
            <div className="min-h-[26rem] rounded-card border border-line bg-surface-soft p-5">{c.body}</div>
          </section>
        ))}
      </div>

      <div className="flex justify-center gap-1.5" aria-hidden>
        {cards.map((c, i) => (
          <button
            key={c.key}
            type="button"
            tabIndex={-1}
            onClick={() => goTo(i)}
            className={`h-1.5 rounded-full transition-all ${i === card ? "w-5 bg-gold" : "w-1.5 bg-line"}`}
          />
        ))}
      </div>

      {error ? <p className="text-sm text-alarm">{error}</p> : null}

      <div className="flex flex-col gap-2">
        {!last ? (
          <Button type="button" onClick={() => goTo(card + 1)}>
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
                if (r.ok) {
                  router.push("/write");
                } else {
                  setError(r.error);
                  // The database refused because the ten were never recorded.
                  // Somewhere to go is more use than a message.
                  if (r.needsLaws) {
                    setRead(false);
                    setStep(1);
                  }
                }
              })
            }
          >
            {pending ? "One moment" : "Start"}
          </Button>
        )}
        {last ? (
          <Button
            type="button"
            tone="quiet"
            disabled={pending}
            onClick={() =>
              start(async () => {
                setError(null);
                const r = await finishOnboarding();
                if (r.ok) router.push("/onboarding/group");
                else setError(r.error);
              })
            }
          >
            Start, and set up a group
          </Button>
        ) : null}
        {card > 0 ? (
          <Button type="button" tone="ghost" onClick={() => goTo(card - 1)}>
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
