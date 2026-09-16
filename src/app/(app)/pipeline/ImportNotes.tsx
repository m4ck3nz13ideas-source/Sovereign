"use client";

import { useRef, useState, useTransition } from "react";

import { importMarkdown } from "./actions";

/**
 * Import a folder of markdown notes.
 *
 * This is the manual half of the vault seam. Titles come from the first
 * heading, paths are kept so a re-import updates rather than duplicates, and
 * a sync adapter could later do the same thing on a schedule without any of
 * the data model changing.
 */
export function ImportNotes() {
  const input = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const [result, setResult] = useState<string | null>(null);

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;

    const payload = await Promise.all(
      Array.from(files)
        .filter((f) => f.name.toLowerCase().endsWith(".md"))
        .slice(0, 200)
        .map(async (f) => ({
          // webkitRelativePath is set when a whole folder is chosen.
          path: (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name,
          content: await f.text(),
        })),
    );

    if (!payload.length) {
      setResult("No .md files in that selection.");
      return;
    }

    start(async () => {
      const r = await importMarkdown(payload);
      setResult(
        r.ok
          ? `${r.created} new, ${r.updated} updated`
          : "Import failed.",
      );
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={pending}
        className="smallcaps text-[10px] text-paper-faint hover:text-gold disabled:opacity-50"
      >
        {pending ? "importing…" : result ?? "import .md"}
      </button>
      <input
        ref={input}
        type="file"
        accept=".md,text/markdown"
        multiple
        hidden
        onChange={(e) => onFiles(e.target.files)}
      />
    </>
  );
}
