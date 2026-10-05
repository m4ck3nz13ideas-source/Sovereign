"use client";

import { useEffect, useRef, useState, useTransition } from "react";

import { chatWithAi } from "@/app/(app)/individual/ai/actions";

type Msg = { role: "you" | "ai"; text: string };

/**
 * The private chat. Lives in the browser: close the tab and it is gone, which
 * is the point — there is nothing stored to leak, sell or subpoena.
 */
export function AiChat({ className = "" }: { className?: string }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [msgs, pending]);

  const send = () => {
    const text = draft.trim();
    if (!text || pending) return;
    const next: Msg[] = [...msgs, { role: "you", text }];
    setMsgs(next);
    setDraft("");
    setError(null);
    start(async () => {
      const r = await chatWithAi(next);
      if (r.ok) setMsgs((m) => [...m, { role: "ai", text: r.reply }]);
      else setError(r.error);
    });
  };

  return (
    <div className={`flex min-h-0 flex-col ${className}`}>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {msgs.length === 0 ? (
          <p className="pt-8 text-center font-serif text-xl text-paper-dim">What&apos;s on your mind?</p>
        ) : null}
        {msgs.map((m, i) => (
          <div key={i} className={m.role === "you" ? "flex justify-end" : "flex justify-start"}>
            <p
              className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-[0.95rem] leading-relaxed ${
                m.role === "you" ? "bg-gold text-ink" : "bg-surface text-paper"
              }`}
            >
              {m.text}
            </p>
          </div>
        ))}
        {pending ? <p className="text-sm text-paper-faint">…</p> : null}
        {error ? <p className="text-sm text-alarm">{error}</p> : null}
        <div ref={end} />
      </div>
      <form
        className="flex items-end gap-2 border-t border-line p-3"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          rows={1}
          placeholder="Message"
          aria-label="Message your AI"
          className="max-h-32 min-h-10 flex-1 resize-none rounded-2xl border border-line bg-surface-soft px-3.5 py-2.5 text-[0.95rem] text-paper outline-none focus:border-gold"
        />
        <button
          type="submit"
          disabled={pending || !draft.trim()}
          aria-label="Send"
          className="press flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gold text-ink disabled:opacity-40"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden>
            <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </form>
    </div>
  );
}
