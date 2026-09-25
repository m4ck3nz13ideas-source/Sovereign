"use client";

import { useState, useTransition } from "react";

import { Button, Panel, inputClass } from "@/components/ui";
import { shortDate } from "@/lib/format";
import type { StatementRevision } from "@/lib/types";

import { saveStatement } from "./actions";
import { ShareToggle } from "./ValuesPanel";

/**
 * Faith and Purpose. Revisable, timestamped, and never overwritten — the older
 * versions stay so you can see how the belief has moved.
 *
 * The revision history is private even when the current statement is shared.
 */
export function StatementPanel({
  kind,
  title,
  hint,
  placeholder,
  statement,
  updatedAt,
  shared,
  revisions,
}: {
  kind: "faith" | "purpose";
  title: string;
  hint: string;
  placeholder: string;
  statement: string | null;
  updatedAt: string | null;
  shared: boolean;
  revisions: StatementRevision[];
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(statement ?? "");
  const [showHistory, setShowHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const past = revisions.filter((r) => r.statement !== statement);

  return (
    <Panel title={title} hint={hint} defaultOpen={!statement}>
      {editing ? (
        <div className="space-y-3">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={kind === "purpose" ? 4 : 10}
            autoFocus
            placeholder={placeholder}
            className={`${inputClass} resize-y leading-relaxed`}
          />
          {error ? <p className="text-sm text-alarm">{error}</p> : null}
          <div className="flex gap-2">
            <Button
              type="button"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  setError(null);
                  const r = await saveStatement(kind, text);
                  if (!r.ok) setError(r.error);
                  else setEditing(false);
                })
              }
            >
              {pending ? "Saving" : "Save revision"}
            </Button>
            <Button
              type="button"
              tone="ghost"
              onClick={() => {
                setText(statement ?? "");
                setEditing(false);
              }}
            >
              Cancel
            </Button>
          </div>
          <p className="text-xs leading-relaxed text-paper-faint">
            Saving keeps the previous version. Nothing here is overwritten.
          </p>
        </div>
      ) : (
        <>
          {statement ? (
            <p className="whitespace-pre-wrap text-[0.95rem] leading-relaxed text-paper-dim">
              {statement}
            </p>
          ) : (
            <p className="text-sm leading-relaxed text-paper-faint">{placeholder}</p>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="smallcaps text-[11px] text-gold hover:underline"
            >
              {statement ? "Revise" : "Write it"}
            </button>

            {past.length ? (
              <button
                type="button"
                onClick={() => setShowHistory((s) => !s)}
                className="smallcaps text-[11px] text-paper-faint hover:text-paper-dim"
              >
                {showHistory ? "Hide" : `${past.length} earlier ${past.length === 1 ? "version" : "versions"}`}
              </button>
            ) : null}

            {updatedAt ? (
              <span className="smallcaps ml-auto text-[10px] text-paper-faint">
                {shortDate(updatedAt)}
              </span>
            ) : null}
          </div>

          {showHistory ? (
            <ul className="mt-4 space-y-3 border-t border-line pt-4">
              {past.map((r) => (
                <li key={r.id}>
                  <p className="smallcaps text-[10px] text-paper-faint">
                    {shortDate(r.created_at)}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-paper-faint">
                    {r.statement}
                  </p>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      )}

      <ShareToggle
        field={kind === "faith" ? "share_faith" : "share_purpose"}
        shared={shared}
        label={`Show my ${kind === "faith" ? "statement of faith" : "purpose"} to my group`}
        note="Only the current version. The history of how it changed stays private either way."
      />
    </Panel>
  );
}
