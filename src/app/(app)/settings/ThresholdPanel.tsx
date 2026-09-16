"use client";

import { useState, useTransition } from "react";

import { Button, Card, Field, inputClass } from "@/components/ui";
import type { Group } from "@/lib/types";

import { updateThresholds } from "./actions";

/**
 * The decision rule, in the open.
 *
 * A proposal passes only if all three hold: participation at or above its
 * threshold, mean alignment at or above its threshold, and no unresolved
 * critical flag. The numbers are visible to every member, not just stewards,
 * because a group being governed by a rule should be able to read the rule.
 */
export function ThresholdPanel({
  group,
  canEdit,
}: {
  group: Group;
  canEdit: boolean;
}) {
  const [alignment, setAlignment] = useState(String(group.threshold_alignment));
  const [participation, setParticipation] = useState(String(group.threshold_participation));
  const [floor, setFloor] = useState(String(group.threshold_values_floor));
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();

  return (
    <Card>
      <p className="text-[0.95rem] leading-relaxed text-paper-dim">
        A proposal passes only if <em className="text-paper">all three</em> hold.
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        <Field label="Alignment" hint="Mean, across everyone who responded.">
          <input
            value={alignment}
            onChange={(e) => setAlignment(e.target.value)}
            disabled={!canEdit}
            inputMode="decimal"
            className={inputClass}
          />
        </Field>
        <Field label="Participation" hint="Share of members who responded.">
          <input
            value={participation}
            onChange={(e) => setParticipation(e.target.value)}
            disabled={!canEdit}
            inputMode="decimal"
            className={inputClass}
          />
        </Field>
        <Field label="Values floor" hint="Below this, a written answer is required.">
          <input
            value={floor}
            onChange={(e) => setFloor(e.target.value)}
            disabled={!canEdit}
            inputMode="decimal"
            className={inputClass}
          />
        </Field>
      </div>

      <p className="mt-4 text-sm leading-relaxed text-paper-dim">
        And: no unresolved critical flag. That one is not a number and cannot be
        turned off.
      </p>

      {error ? <p className="mt-3 text-sm text-alarm">{error}</p> : null}

      {canEdit ? (
        <Button
          type="button"
          tone="quiet"
          className="mt-4"
          disabled={pending}
          onClick={() =>
            start(async () => {
              setError(null);
              const r = await updateThresholds(
                group.id,
                Number(alignment),
                Number(participation),
                Number(floor),
              );
              if (!r.ok) setError(r.error);
              else {
                setSaved(true);
                window.setTimeout(() => setSaved(false), 2200);
              }
            })
          }
        >
          {pending ? "Saving" : saved ? "Saved" : "Save the rule"}
        </Button>
      ) : (
        <p className="smallcaps mt-4 text-[10px] text-paper-faint">
          only a steward can change these
        </p>
      )}

      <p className="mt-5 border-t border-line pt-4 text-xs leading-relaxed text-paper-faint">
        These started as guesses. If proposals keep passing that the group later
        regrets, raise the alignment threshold; if good proposals keep failing
        on turnout, lower participation. Changing them does not reopen past
        decisions — the rule that applied is recorded with each one.
      </p>
    </Card>
  );
}
