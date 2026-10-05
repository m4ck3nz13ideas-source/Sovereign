"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { inputClass } from "@/components/ui";

import { addTodo, deleteTodo, toggleTodo } from "./actions";

export type Todo = { id: string; body: string; done_at: string | null; created_at: string };

export function TodoList({ items }: { items: Todo[] }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) =>
    start(async () => {
      setError(null);
      const r = await fn();
      if (!r.ok) setError(r.error ?? "Something went wrong.");
      else {
        after?.();
        router.refresh();
      }
    });

  const open = items.filter((t) => !t.done_at);
  const done = items.filter((t) => t.done_at);

  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (text.trim()) run(() => addTodo(text), () => setText(""));
        }}
      >
        <input
          className={inputClass}
          value={text}
          maxLength={500}
          placeholder="Add a to-do"
          aria-label="Add a to-do"
          onChange={(e) => setText(e.target.value)}
          disabled={pending}
        />
      </form>
      {error ? <p className="mt-2 text-sm text-alarm">{error}</p> : null}

      <ul className="mt-4 divide-y divide-line-soft">
        {[...open, ...done].map((t) => (
          <li key={t.id} className="flex items-center gap-3 py-3">
            <button
              type="button"
              aria-label={t.done_at ? "Mark not done" : "Mark done"}
              onClick={() => run(() => toggleTodo(t.id, !t.done_at))}
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
                t.done_at ? "border-gold bg-gold text-ink" : "border-line"
              }`}
            >
              {t.done_at ? (
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden>
                  <path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : null}
            </button>
            <span className={`flex-1 text-[0.95rem] ${t.done_at ? "text-paper-faint line-through" : "text-paper"}`}>
              {t.body}
            </span>
            <button
              type="button"
              aria-label="Delete"
              onClick={() => run(() => deleteTodo(t.id))}
              className="text-paper-faint hover:text-alarm"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden>
                <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
