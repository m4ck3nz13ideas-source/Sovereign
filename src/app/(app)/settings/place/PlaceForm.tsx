"use client";

import { useState, useTransition } from "react";

import { Button, Field, inputClass } from "@/components/ui";
import { SCOPES } from "@/lib/collective";
import type { Profile } from "@/lib/types";

import { savePlaces } from "./actions";

const FIELDS = SCOPES.filter((s) => s.field !== null) as {
  value: string;
  label: string;
  field: "place_local" | "place_regional" | "place_national" | "place_continental";
  hint: string;
}[];

export function PlaceForm({ profile }: { profile: Profile }) {
  const [form, setForm] = useState({
    place_local: profile.place_local ?? "",
    place_regional: profile.place_regional ?? "",
    place_national: profile.place_national ?? "",
    place_continental: profile.place_continental ?? "",
  });
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="space-y-5">
      {FIELDS.map((f) => (
        <Field key={f.field} label={f.label} hint={f.hint}>
          <input
            value={form[f.field]}
            onChange={(e) => {
              setSaved(false);
              setForm((s) => ({ ...s, [f.field]: e.target.value }));
            }}
            className={inputClass}
          />
        </Field>
      ))}

      {error ? <p className="text-sm text-alarm">{error}</p> : null}

      <div className="flex items-center gap-3 border-t border-line pt-5">
        <Button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              setError(null);
              const r = await savePlaces(form);
              if (r.ok) setSaved(true);
              else setError(r.error);
            })
          }
        >
          {pending ? "Saving" : "Save"}
        </Button>
        {saved ? (
          <span className="smallcaps text-[10px] text-calm">saved</span>
        ) : null}
      </div>

      <p className="text-xs leading-relaxed text-paper-faint">
        Changing these changes what you can see and what you can propose. It
        does not change anything already decided: a proposal you responded to
        keeps your response, and the record keeps the place it was addressed to.
      </p>
    </div>
  );
}
