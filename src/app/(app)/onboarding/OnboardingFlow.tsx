"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button, Card, Field, inputClass } from "@/components/ui";

import { completeOnboarding } from "./actions";

const SUGGESTIONS = [
  "Honesty",
  "Restraint",
  "Hospitality",
  "Craft",
  "Fairness",
  "Patience",
  "Courage",
  "Stewardship",
];

export function OnboardingFlow({ displayName }: { displayName: string }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [name, setName] = useState(displayName === "Unnamed" ? "" : displayName);
  const [values, setValues] = useState([
    { name: "", definition: "" },
    { name: "", definition: "" },
    { name: "", definition: "" },
  ]);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function setValue(i: number, key: "name" | "definition", v: string) {
    setValues((vs) => vs.map((row, j) => (j === i ? { ...row, [key]: v } : row)));
  }

  if (step === 0) {
    return (
      <div className="space-y-5">
        <p className="text-[0.95rem] leading-relaxed text-paper-dim">
          Sovereign has two halves. One is yours alone — what you write, what
          you are working out, what you believe. The other is shared with a
          group, and is where things get decided.
        </p>
        <p className="text-[0.95rem] leading-relaxed text-paper-dim">
          The first half never becomes the second unless you send it there.
        </p>

        <Field label="What should we call you?">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            className={inputClass}
          />
        </Field>

        <Button type="button" onClick={() => setStep(1)} disabled={!name.trim()}>
          Next
        </Button>
      </div>
    );
  }

  if (step === 1) {
    return (
      <div className="space-y-5">
        <p className="text-[0.95rem] leading-relaxed text-paper-dim">
          Name a few things you actually value, in your own words. These are not
          decoration: every proposal your group considers is scored against
          these names, using these definitions.
        </p>
        <p className="text-sm leading-relaxed text-paper-faint">
          Three is plenty. You can change them whenever, and a definition in
          your own phrasing is worth more than a word that sounds right.
        </p>

        <div className="space-y-4">
          {values.map((v, i) => (
            <Card key={i}>
              <input
                value={v.name}
                onChange={(e) => setValue(i, "name", e.target.value)}
                placeholder={SUGGESTIONS[i] ?? "A value"}
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
        </div>

        <button
          type="button"
          onClick={() => setValues((vs) => [...vs, { name: "", definition: "" }])}
          className="smallcaps text-[11px] text-gold hover:underline"
        >
          + one more
        </button>

        {error ? <p className="text-sm text-alarm">{error}</p> : null}

        <div className="flex gap-2">
          <Button
            type="button"
            disabled={pending}
            onClick={() =>
              start(async () => {
                setError(null);
                const r = await completeOnboarding(name, values);
                if (!r.ok) setError(r.error);
                else setStep(2);
              })
            }
          >
            {pending ? "Saving" : "Save"}
          </Button>
          <Button type="button" tone="ghost" onClick={() => setStep(0)}>
            Back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <p className="text-[0.95rem] leading-relaxed text-paper-dim">
        That is the individual half set up. Launch is where everything goes in;
        it files itself to the right place.
      </p>
      <p className="text-[0.95rem] leading-relaxed text-paper-dim">
        The collective half needs somewhere to be. Write down where you are —
        a neighbourhood, a city, a country — and the proposals addressed to
        those places are yours to read, answer and write. Nobody has to invite
        you.
      </p>
      <p className="text-[0.95rem] leading-relaxed text-paper-dim">
        A group is the other way in, for people who already know each other. It
        is entirely optional, and you can set one up later.
      </p>

      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={() => router.push("/settings/place")}>
          Say where you are
        </Button>
        <Button type="button" tone="quiet" onClick={() => router.push("/onboarding/group")}>
          Set up a group instead
        </Button>
        <Button type="button" tone="ghost" onClick={() => router.push("/home")}>
          Later
        </Button>
      </div>
    </div>
  );
}
