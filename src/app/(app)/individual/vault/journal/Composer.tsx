"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui";
import { folderName } from "@/lib/journal";

import { saveJournal } from "./actions";

/**
 * Write and save. That is the whole journal: no mode to pick, nothing to
 * file afterwards. Where it went is said once, with a way to change it.
 */
export function Composer() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<{ id: string; where: string } | null>(null);
  const [pending, start] = useTransition();

  function save() {
    if (!text.trim() || pending) return;
    setError(null);
    start(async () => {
      const r = await saveJournal(text);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setText("");
      const where = [folderName(r.folder), ...r.labels.map((l) => `#${l}`)].join(" · ");
      setSaved({ id: r.id, where });
      router.refresh();
    });
  }

  return (
    <div className="rounded-card border border-line bg-surface-soft p-3">
      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          if (saved) setSaved(null);
        }}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") save();
        }}
        rows={text.length > 120 ? 8 : 3}
        placeholder="What's on your mind?"
        aria-label="New journal entry"
        className="w-full resize-none bg-transparent px-1 py-1 text-[1rem] leading-relaxed text-paper placeholder:text-paper-faint focus:outline-none"
      />
      {error ? <p className="px-1 pb-2 text-sm text-alarm">{error}</p> : null}
      <div className="flex items-center justify-between gap-3">
        <p className="min-w-0 truncate px-1 text-[0.8125rem] text-paper-faint">
          {saved ? (
            <>
              Filed to <span className="text-paper">{saved.where}</span> ·{" "}
              <Link href={`/individual/vault/journal/${saved.id}`} className="text-gold">
                change
              </Link>
            </>
          ) : (
            "Filed for you as you save"
          )}
        </p>
        <Button type="button" onClick={save} disabled={!text.trim() || pending} className="min-h-9 px-4 py-1.5">
          {pending ? "Saving" : "Save"}
        </Button>
      </div>
    </div>
  );
}
