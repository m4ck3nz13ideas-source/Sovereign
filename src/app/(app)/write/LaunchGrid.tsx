"use client";

import { useEffect, useRef, useState } from "react";

import {
  BroadcastIcon,
  FlameIcon,
  QuillIcon,
  SparkIcon,
} from "@/components/icons";
import { Button } from "@/components/ui";
import { LAUNCH_MODES, type EntryMode } from "@/lib/types";

import { createEntry } from "./actions";

const ICONS: Record<EntryMode, (p: { className?: string }) => React.ReactElement> = {
  journal: QuillIcon,
  faith: FlameIcon,
  idea: SparkIcon,
  output: BroadcastIcon,
};

type Phase = "grid" | "writing" | "dissolving";

/**
 * Four tiles in a 2×2 grid. Tapping one opens a full-screen input with a soft
 * prompt; sending lifts the text away and returns to the grid.
 */
export function LaunchGrid() {
  const [phase, setPhase] = useState<Phase>("grid");
  const [mode, setMode] = useState<EntryMode | null>(null);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [landed, setLanded] = useState<string | null>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);

  const spec = LAUNCH_MODES.find((m) => m.mode === mode);

  useEffect(() => {
    if (phase === "writing") textarea.current?.focus();
  }, [phase]);

  // Escape closes the input, keeping whatever was typed in state so an
  // accidental dismissal does not destroy the entry.
  useEffect(() => {
    if (phase !== "writing") return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setPhase("grid");
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase]);

  async function send() {
    if (!mode || !text.trim() || pending) return;
    setPending(true);
    setError(null);

    const result = await createEntry(mode, text);
    setPending(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setPhase("dissolving");
    setLanded(spec?.filesTo ?? null);
    window.setTimeout(() => {
      setText("");
      setMode(null);
      setPhase("grid");
      window.setTimeout(() => setLanded(null), 2600);
    }, 900);
  }

  if (phase === "writing" || phase === "dissolving") {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-ink px-5 pt-14 pb-8">
        <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col">
          <p className="font-serif text-xl leading-snug text-paper-dim">
            {spec?.prompt}
          </p>

          <textarea
            ref={textarea}
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={phase === "dissolving"}
            placeholder=""
            className={`mt-7 w-full flex-1 resize-none bg-transparent text-[1.05rem] leading-relaxed text-paper placeholder:text-paper-faint focus:outline-none ${
              phase === "dissolving" ? "animate-lift-away" : ""
            }`}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") send();
            }}
          />

          {error ? <p className="mb-3 text-sm text-alarm">{error}</p> : null}

          <div className="flex items-center justify-between gap-4">
            <button
              type="button"
              onClick={() => setPhase("grid")}
              className="smallcaps text-[11px] text-paper-faint hover:text-paper-dim"
            >
              Back
            </button>

            <div className="flex items-center gap-3">
              <span className="smallcaps text-[10px] text-paper-faint">
                files to {spec?.filesTo}
              </span>
              <Button
                type="button"
                onClick={send}
                disabled={!text.trim() || pending || phase === "dissolving"}
              >
                {pending ? "Sending" : "Send"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="mt-10 grid grid-cols-2 gap-3">
        {LAUNCH_MODES.map((m) => {
          const Icon = ICONS[m.mode];
          return (
            <button
              key={m.mode}
              type="button"
              onClick={() => {
                setMode(m.mode);
                setError(null);
                setPhase("writing");
              }}
              className="group flex aspect-[4/3] flex-col items-start justify-between rounded-card border border-line bg-surface-soft p-4 text-left transition-colors hover:border-gold-dim active:scale-[0.99]"
            >
              <span className="text-paper-dim transition-colors group-hover:text-gold">
                <Icon />
              </span>
              <span className="font-serif text-xl text-paper">{m.label}</span>
            </button>
          );
        })}
      </div>

      {landed ? (
        <p className="animate-settle-in smallcaps mt-6 text-center text-[11px] text-gold">
          filed to {landed}
        </p>
      ) : null}
    </>
  );
}
