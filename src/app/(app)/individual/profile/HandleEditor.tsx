"use client";

import { useState, useTransition } from "react";

import { setHandle } from "@/app/(app)/collective/people/actions";
import { Button, Card, inputClass } from "@/components/ui";

/**
 * Your handle.
 *
 * Optional, and plenty of people will never want one. Its only job is to be
 * given out: there is no directory here and no search, so a handle is the one
 * way somebody who does not share a street or a group with you can find you at
 * all. Not having one is a working choice, not an incomplete profile.
 */
export function HandleEditor({ handle }: { handle: string | null }) {
  const [value, setValue] = useState(handle ?? "");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const changed = value.trim().replace(/^@/, "").toLowerCase() !== (handle ?? "");

  return (
    <Card>
      <div className="flex gap-2">
        <input
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setSaved(false);
            setError(null);
          }}
          placeholder="nobody has to have one"
          aria-label="Handle"
          className={inputClass}
        />
        <Button
          tone="quiet"
          disabled={pending || !changed}
          onClick={() =>
            start(async () => {
              const res = await setHandle(value);
              if (!res.ok) setError(res.error);
              else setSaved(true);
            })
          }
        >
          {pending ? "…" : saved ? "Saved" : "Save"}
        </Button>
      </div>

      {error ? <p className="mt-2 text-[0.85rem] text-alarm">{error}</p> : null}

      <p className="mt-3 text-[0.8125rem] leading-relaxed text-paper-faint">
        Three to thirty characters, lowercase. There is no directory and no
        search on this instance, so this is the only way somebody who does not
        share a place or a group with you can find you — and it only works if
        you give it to them.
      </p>
    </Card>
  );
}
