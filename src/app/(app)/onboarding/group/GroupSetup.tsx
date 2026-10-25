"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button, Card, Field, inputClass } from "@/components/ui";
import { CHARTER_FOUNDING_SIZE, TEMPLATES, WHO_LABEL, type Template, type Who } from "@/lib/charters";
import type { GroupScope } from "@/lib/types";

import { createGroup, joinGroup } from "../actions";

const SCOPES: GroupScope[] = ["local", "regional", "national", "continental", "global"];

/**
 * Start a group or join one.
 *
 * Starting one means writing its first charter (0057): pick the template
 * closest to what the group is, then make it yours. There are no decision
 * numbers to set — each proposal gets its own conditions from the AI, and the
 * charter is the context it reads.
 */
export function GroupSetup({ hasGroups }: { hasGroups: boolean }) {
  const router = useRouter();
  const [mode, setMode] = useState<"pick" | "template" | "create" | "join">("pick");
  const [template, setTemplate] = useState<Template | null>(null);
  const [name, setName] = useState("");
  const [purpose, setPurpose] = useState("");
  const [goal, setGoal] = useState("");
  const [values, setValues] = useState("");
  const [inviters, setInviters] = useState<Who>("stewards");
  const [proposers, setProposers] = useState<Who>("members");
  const [aiContext, setAiContext] = useState("");
  const [scope, setScope] = useState<GroupScope>("local");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function choose(t: Template) {
    setTemplate(t);
    setValues(t.charter.values.join(", "));
    setInviters(t.charter.inviters);
    setProposers(t.charter.proposers);
    setAiContext(t.charter.ai_context);
    setMode("create");
  }

  if (mode === "pick") {
    return (
      <div className="space-y-3">
        <Card>
          <h2 className="text-center font-serif text-lg text-paper">Start one</h2>
          <p className="mt-1.5 text-center text-sm leading-relaxed text-paper-dim">
            You write its charter and invite the others.
          </p>
          <Button type="button" className="mt-3 w-full" onClick={() => setMode("template")}>
            Start a group
          </Button>
        </Card>
        <Card>
          <h2 className="text-center font-serif text-lg text-paper">Join one</h2>
          <p className="mt-1.5 text-center text-sm leading-relaxed text-paper-dim">
            With a code from someone already in it.
          </p>
          <Button type="button" tone="quiet" className="mt-3 w-full" onClick={() => setMode("join")}>
            I have a code
          </Button>
        </Card>
        {hasGroups ? (
          <button
            type="button"
            onClick={() => router.push("/connection")}
            className="smallcaps block w-full text-center text-[11px] text-paper-faint hover:text-gold"
          >
            back to Connection
          </button>
        ) : null}
      </div>
    );
  }

  if (mode === "template") {
    return (
      <div className="space-y-3">
        <p className="text-center text-[0.95rem] leading-relaxed text-paper-dim">What kind of group is it?</p>
        {TEMPLATES.map((t) => (
          <button key={t.id} type="button" onClick={() => choose(t)} className="press block w-full text-left">
            <Card>
              <p className="text-center font-serif text-lg text-paper">{t.name}</p>
              <p className="mt-1 text-center text-sm text-paper-dim">{t.line}</p>
            </Card>
          </button>
        ))}
        <Button type="button" tone="ghost" className="w-full" onClick={() => setMode("pick")}>
          Back
        </Button>
      </div>
    );
  }

  if (mode === "create") {
    return (
      <div className="space-y-5">
        <p className="text-center text-[0.95rem] leading-relaxed text-paper-dim">
          {template?.name ?? "Your group"}: its charter. Rewrite anything. Until it has{" "}
          {CHARTER_FOUNDING_SIZE} members you can change it freely; after that, only by proposal.
        </p>
        <Field label="Name">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            placeholder="Thursday Studio, Hillside Co-op, the board"
            className={inputClass}
          />
        </Field>
        <Field label="What it is for">
          <textarea
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            rows={2}
            placeholder={template?.charter.purposeHint}
            className={inputClass}
          />
        </Field>
        <Field label="What it is trying to do">
          <textarea
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            rows={2}
            placeholder={template?.charter.goalHint}
            className={inputClass}
          />
        </Field>
        <Field label="Its values" hint="Comma-separated, up to twelve.">
          <input value={values} onChange={(e) => setValues(e.target.value)} className={inputClass} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Who can invite">
            <select value={inviters} onChange={(e) => setInviters(e.target.value as Who)} className={inputClass}>
              {(["stewards", "members"] as Who[]).map((w) => (
                <option key={w} value={w}>
                  {WHO_LABEL[w]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Who can propose">
            <select value={proposers} onChange={(e) => setProposers(e.target.value as Who)} className={inputClass}>
              {(["members", "stewards"] as Who[]).map((w) => (
                <option key={w} value={w}>
                  {WHO_LABEL[w]}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field
          label="What the AI should weigh"
          hint="Read when it sets each proposal's conditions. It can make them stricter, never looser than the floors."
        >
          <textarea
            value={aiContext}
            onChange={(e) => setAiContext(e.target.value)}
            rows={3}
            className={inputClass}
          />
        </Field>
        <Field label="Scope" hint="Where its decisions apply. Most groups are local.">
          <select value={scope} onChange={(e) => setScope(e.target.value as GroupScope)} className={inputClass}>
            {SCOPES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </Field>

        {error ? <p className="text-sm text-alarm">{error}</p> : null}

        <div className="flex flex-col gap-2">
          <Button
            type="button"
            disabled={pending || !name.trim()}
            onClick={() =>
              start(async () => {
                setError(null);
                const r = await createGroup(name, purpose, scope, {
                  template: template?.id ?? "custom",
                  goal,
                  values: values.split(","),
                  inviters,
                  proposers,
                  aiContext,
                });
                if (!r.ok) setError(r.error);
                else router.push(`/connection/g/${r.groupId}/manage`);
              })
            }
          >
            {pending ? "Creating" : "Create it"}
          </Button>
          <Button type="button" tone="ghost" onClick={() => setMode("template")}>
            Back
          </Button>
        </div>
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
      <div className="flex flex-col gap-2">
        <Button
          type="button"
          disabled={pending || !code.trim()}
          onClick={() =>
            start(async () => {
              setError(null);
              const r = await joinGroup(code);
              if (!r.ok) setError(r.error);
              else router.push(`/connection/g/${r.groupId}`);
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
