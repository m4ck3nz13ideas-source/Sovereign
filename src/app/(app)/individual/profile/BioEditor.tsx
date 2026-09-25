"use client";

import { useState, useTransition } from "react";

import { Button, inputClass } from "@/components/ui";

import { updateBio } from "./actions";

export function BioEditor({
  displayName,
  bio,
}: {
  displayName: string;
  bio: string | null;
  email?: string | null;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(displayName);
  const [text, setText] = useState(bio ?? "");
  const [pending, start] = useTransition();

  const initials = displayName
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

  if (editing) {
    return (
      <div className="space-y-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={inputClass}
          aria-label="Name"
        />
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          placeholder="A line about yourself."
          className={`${inputClass} resize-y`}
          aria-label="Bio"
        />
        <div className="flex gap-2">
          <Button
            type="button"
            disabled={pending}
            onClick={() =>
              start(async () => {
                await updateBio(name, text);
                setEditing(false);
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
    );
  }

  return (
    <div className="flex items-start gap-4">
      <div
        aria-hidden
        className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-gold-dim bg-surface font-serif text-lg text-gold"
      >
        {initials || "·"}
      </div>
      <div className="min-w-0 flex-1">
        <h1 className="font-serif text-2xl leading-tight text-paper">
          {displayName}
        </h1>
        <p className="mt-1 text-sm leading-relaxed text-paper-dim">
          {bio || "No line yet."}
        </p>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="smallcaps mt-2 text-[11px] text-paper-faint hover:text-gold"
        >
          Edit
        </button>
      </div>
    </div>
  );
}
