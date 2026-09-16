"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button, Card, Field, inputClass } from "@/components/ui";
import type { GroupScope } from "@/lib/types";

import { createGroup, joinGroup } from "../actions";

const SCOPES: GroupScope[] = ["local", "regional", "national", "continental", "global"];

export function GroupSetup({ hasGroups }: { hasGroups: boolean }) {
  const router = useRouter();
  const [mode, setMode] = useState<"pick" | "create" | "join">("pick");
  const [name, setName] = useState("");
  const [purpose, setPurpose] = useState("");
  const [scope, setScope] = useState<GroupScope>("local");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (mode === "pick") {
    return (
      <div className="space-y-3">
        <Card>
          <h2 className="font-serif text-lg text-paper">Start one</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-paper-dim">
            You become its first steward. You set the decision rule and invite
            the others.
          </p>
          <Button type="button" className="mt-3" onClick={() => setMode("create")}>
            Start a group
          </Button>
        </Card>

        <Card>
          <h2 className="font-serif text-lg text-paper">Join one</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-paper-dim">
            With a code from someone already in it.
          </p>
          <Button type="button" tone="quiet" className="mt-3" onClick={() => setMode("join")}>
            I have a code
          </Button>
        </Card>

        {hasGroups ? (
          <button
            type="button"
            onClick={() => router.push("/connection")}
            className="smallcaps text-[11px] text-paper-faint hover:text-gold"
          >
            back to Connection
          </button>
        ) : null}
      </div>
    );
  }

  if (mode === "create") {
    return (
      <div className="space-y-5">
        <Field label="Name">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            placeholder="Thursday Studio, Hillside Co-op, the board"
            className={inputClass}
          />
        </Field>

        <Field label="What is it for?" hint="One line. Given to the review layer as context.">
          <textarea
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            rows={3}
            className={`${inputClass} resize-y`}
          />
        </Field>

        <Field label="Scope" hint="Where its decisions apply. Most groups are local.">
          <select
            value={scope}
            onChange={(e) => setScope(e.target.value as GroupScope)}
            className={inputClass}
          >
            {SCOPES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </Field>

        {error ? <p className="text-sm text-alarm">{error}</p> : null}

        <div className="flex gap-2">
          <Button
            type="button"
            disabled={pending || !name.trim()}
            onClick={() =>
              start(async () => {
                setError(null);
                const r = await createGroup(name, purpose, scope);
                if (!r.ok) setError(r.error);
                else router.push("/settings");
              })
            }
          >
            {pending ? "Creating" : "Create it"}
          </Button>
          <Button type="button" tone="ghost" onClick={() => setMode("pick")}>
            Back
          </Button>
        </div>

        <p className="text-xs leading-relaxed text-paper-faint">
          The decision rule starts at 0.60 alignment, 0.60 participation, and a
          values floor of 0.30. Those are guesses. They are editable in Settings,
          and tuning them against real decisions is the main thing this version
          is for.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Field label="Invite code">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          autoFocus
          placeholder="ab12cd34ef"
          className={inputClass}
        />
      </Field>

      {error ? <p className="text-sm text-alarm">{error}</p> : null}

      <div className="flex gap-2">
        <Button
          type="button"
          disabled={pending || !code.trim()}
          onClick={() =>
            start(async () => {
              setError(null);
              const r = await joinGroup(code);
              if (!r.ok) setError(r.error);
              else router.push("/connection");
            })
          }
        >
          {pending ? "Joining" : "Join"}
        </Button>
        <Button type="button" tone="ghost" onClick={() => setMode("pick")}>
          Back
        </Button>
      </div>
    </div>
  );
}
