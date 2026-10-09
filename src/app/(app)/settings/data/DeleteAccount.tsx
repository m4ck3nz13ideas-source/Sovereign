"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button, inputClass } from "@/components/ui";

import { eraseAccount } from "./actions";

const WORDS = "delete my account";

export function DeleteAccount() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!open) {
    return (
      <Button type="button" tone="danger" onClick={() => setOpen(true)}>
        Delete my account
      </Button>
    );
  }

  return (
    <div className="space-y-3">
      <label className="block text-sm text-paper-dim">
        Type <span className="font-semibold text-paper">{WORDS}</span> to confirm. This cannot be undone.
        <input
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoComplete="off"
          className={`${inputClass} mt-2`}
          aria-label="Confirmation"
        />
      </label>
      {error ? <p className="text-sm text-alarm">{error}</p> : null}
      <div className="flex gap-2">
        <Button
          type="button"
          tone="danger"
          disabled={typed.trim().toLowerCase() !== WORDS || pending}
          onClick={() =>
            start(async () => {
              setError(null);
              const res = await eraseAccount(typed);
              if (!res.ok) setError(res.error);
              else router.replace("/explore");
            })
          }
        >
          {pending ? "Deleting" : "Delete everything"}
        </Button>
        <Button type="button" tone="ghost" onClick={() => setOpen(false)}>
          Keep my account
        </Button>
      </div>
    </div>
  );
}
