"use client";

import { useState } from "react";

import { inputClass, Pill } from "@/components/ui";
import { cleanLabel, FOLDERS, MAX_LABELS } from "@/lib/journal";

/**
 * Folder chips and label chips for one entry. Every change is reported up
 * with `touched`, so the entry knows the filing is now the person's own.
 */
export function FilingEditor({
  folder,
  labels,
  onChange,
}: {
  folder: string | null;
  labels: string[];
  onChange: (next: { folder: string | null; labels: string[] }) => void;
}) {
  const [draft, setDraft] = useState("");

  function add() {
    const l = cleanLabel(draft);
    setDraft("");
    if (!l || labels.includes(l) || labels.length >= MAX_LABELS) return;
    onChange({ folder, labels: [...labels, l] });
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="smallcaps mb-2 text-[11px] text-paper-faint">Folder</p>
        <div className="flex flex-wrap gap-2">
          {[...FOLDERS, null].map((f) => (
            <Pill key={f ?? "other"} type="button" active={folder === f} onClick={() => onChange({ folder: f, labels })}>
              {f ?? "Other"}
            </Pill>
          ))}
        </div>
      </div>

      <div>
        <p className="smallcaps mb-2 text-[11px] text-paper-faint">Labels</p>
        <div className="flex flex-wrap items-center gap-2">
          {labels.map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => onChange({ folder, labels: labels.filter((x) => x !== l) })}
              className="press rounded-pill border border-line px-3 py-1 text-[0.8125rem] text-paper"
              aria-label={`Remove ${l}`}
            >
              #{l} <span className="ml-1 text-paper-faint">×</span>
            </button>
          ))}
          {labels.length < MAX_LABELS ? (
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === ",") {
                  e.preventDefault();
                  add();
                }
              }}
              onBlur={add}
              placeholder="+ label"
              aria-label="Add a label"
              className={`${inputClass} w-28 py-1 text-[0.8125rem]`}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
