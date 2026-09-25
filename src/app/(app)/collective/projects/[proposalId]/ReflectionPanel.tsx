"use client";

import { useState, useTransition } from "react";

import { Button, Card, Field, inputClass } from "@/components/ui";

import { writeReflection } from "../actions";

/**
 * The reflection gate.
 *
 * A project cannot be completed without this. That is not a nag — the database
 * refuses, because a group that closes projects without recording what
 * happened has a memory that cannot teach it anything, and the retrieval step
 * on the next proposal has nothing to retrieve.
 *
 * The middle question is the one that earns its place: what did we believe,
 * going in, that turned out to be wrong? A group that can answer that honestly
 * is the one this whole product is for.
 */
export function ReflectionPanel({
  projectId,
  expected,
}: {
  projectId: string;
  expected: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [actual, setActual] = useState("");
  const [assumption, setAssumption] = useState("");
  const [lesson, setLesson] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!open) {
    return (
      <Card>
        <p className="text-[0.95rem] leading-relaxed text-paper">
          When this is finished, write what happened. That is what completes it
          — there is no other way to mark a project done.
        </p>
        <Button type="button" tone="quiet" className="mt-3" onClick={() => setOpen(true)}>
          Write the reflection
        </Button>
      </Card>
    );
  }

  return (
    <Card className="border-gold-dim">
      <div className="space-y-5">
        {expected ? (
          <div>
            <p className="smallcaps mb-1.5 text-[11px] text-paper-faint">
              what was expected
            </p>
            <p className="text-sm leading-relaxed text-paper-dim">{expected}</p>
          </div>
        ) : null}

        <Field
          label="What actually happened"
          hint="Enough that someone reading this in a year learns something. At least eighty characters."
        >
          <textarea
            value={actual}
            onChange={(e) => setActual(e.target.value)}
            rows={7}
            autoFocus
            className={`${inputClass} resize-y leading-relaxed`}
          />
        </Field>

        <Field
          label="What we believed that turned out to be wrong"
          hint="Optional, and the most valuable line on this page."
        >
          <textarea
            value={assumption}
            onChange={(e) => setAssumption(e.target.value)}
            rows={3}
            className={`${inputClass} resize-y leading-relaxed`}
          />
        </Field>

        <Field
          label="The lesson, for next time"
          hint="This is read by the review layer when a similar proposal arrives."
        >
          <textarea
            value={lesson}
            onChange={(e) => setLesson(e.target.value)}
            rows={3}
            className={`${inputClass} resize-y leading-relaxed`}
          />
        </Field>

        {error ? (
          <p className="rounded-md border border-alarm/40 bg-alarm/10 px-3 py-2.5 text-sm leading-relaxed text-alarm">
            {error}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            disabled={pending || actual.trim().length < 80}
            onClick={() =>
              start(async () => {
                setError(null);
                const r = await writeReflection(projectId, actual, lesson, assumption);
                if (!r.ok) setError(r.error);
                else setOpen(false);
              })
            }
          >
            {pending ? "Recording" : "Complete the project"}
          </Button>
          <Button type="button" tone="ghost" onClick={() => setOpen(false)}>
            Not yet
          </Button>
        </div>
      </div>
    </Card>
  );
}
