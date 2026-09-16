"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button, Card, Field, inputClass } from "@/components/ui";
import type { Group, GroupRole } from "@/lib/types";

import { switchGroup, updateGroupDetails } from "./actions";

export function GroupPanel({
  group,
  groups,
  canEdit,
}: {
  group: Group & { role: GroupRole };
  groups: (Group & { role: GroupRole })[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(group.name);
  const [purpose, setPurpose] = useState(group.purpose ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <Card>
      {editing ? (
        <div className="space-y-4">
          <Field label="Name">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="What it is for">
            <textarea
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              rows={3}
              className={`${inputClass} resize-y`}
            />
          </Field>
          {error ? <p className="text-sm text-alarm">{error}</p> : null}
          <div className="flex gap-2">
            <Button
              type="button"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  setError(null);
                  const r = await updateGroupDetails(group.id, name, purpose);
                  if (!r.ok) setError(r.error);
                  else setEditing(false);
                })
              }
            >
              {pending ? "Saving" : "Save"}
            </Button>
            <Button type="button" tone="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <>
          <h3 className="font-serif text-lg text-paper">{group.name}</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-paper-dim">
            {group.purpose || "No purpose written."}
          </p>
          <p className="smallcaps mt-2 text-[10px] text-paper-faint">{group.scope}</p>
          {canEdit ? (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="smallcaps mt-3 text-[11px] text-gold hover:underline"
            >
              Edit
            </button>
          ) : null}
        </>
      )}

      {groups.length > 1 ? (
        <div className="mt-5 border-t border-line pt-4">
          <p className="smallcaps mb-2 text-[10px] text-paper-faint">switch</p>
          <div className="flex flex-wrap gap-2">
            {groups.map((g) => (
              <button
                key={g.id}
                type="button"
                disabled={pending || g.id === group.id}
                onClick={() =>
                  start(async () => {
                    await switchGroup(g.id);
                    router.refresh();
                  })
                }
                className={`smallcaps rounded-md border px-3 py-1.5 text-[10px] transition-colors ${
                  g.id === group.id
                    ? "border-gold text-gold"
                    : "border-line text-paper-dim hover:border-gold-dim"
                }`}
              >
                {g.name}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </Card>
  );
}
