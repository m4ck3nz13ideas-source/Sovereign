"use client";

import { useState, useTransition } from "react";

import { createCircle } from "@/app/(app)/chats/threads";
import { Button, cx, inputClass } from "@/components/ui";

export function NewCircle({ friends }: { friends: { id: string; name: string }[] }) {
  const [name, setName] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const toggle = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  return (
    <div className="space-y-4">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Name it"
        aria-label="Name"
        maxLength={80}
        className={inputClass}
      />
      <ul className="flex flex-wrap gap-2">
        {friends.map((f) => {
          const on = picked.includes(f.id);
          return (
            <li key={f.id}>
              <button
                type="button"
                aria-pressed={on}
                onClick={() => toggle(f.id)}
                className={cx(
                  "press rounded-pill px-3.5 py-1.5 text-[0.875rem]",
                  on ? "bg-gold text-ink" : "bg-surface text-paper-dim",
                )}
              >
                {f.name}
              </button>
            </li>
          );
        })}
      </ul>
      {error ? <p className="text-[0.85rem] text-alarm">{error}</p> : null}
      <Button
        tone="gold"
        disabled={pending || !name.trim() || !picked.length}
        onClick={() =>
          start(async () => {
            setError(null);
            const res = await createCircle(name, picked);
            if (res && !res.ok) setError(res.error);
          })
        }
      >
        {pending ? "Starting…" : `Start${picked.length ? ` with ${picked.length}` : ""}`}
      </Button>
    </div>
  );
}
