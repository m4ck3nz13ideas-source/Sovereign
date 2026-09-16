"use client";

import { useState } from "react";

import { Button, Field, inputClass } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";

export function LoginForm({ next }: { next?: string }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");

    const supabase = createClient();
    const redirect = new URL("/auth/callback", window.location.origin);
    if (next) redirect.searchParams.set("next", next);

    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: redirect.toString() },
    });

    if (error) {
      setState("error");
      setMessage(error.message);
      return;
    }

    setState("sent");
  }

  if (state === "sent") {
    return (
      <div className="rounded-card border border-gold-dim bg-gold-wash px-4 py-5">
        <p className="font-serif text-lg text-paper">Check your email.</p>
        <p className="mt-2 text-sm leading-relaxed text-paper-dim">
          A sign-in link is on its way to {email}. It opens Sovereign directly —
          there is nothing to remember and nothing to type back.
        </p>
        <button
          type="button"
          onClick={() => setState("idle")}
          className="smallcaps mt-4 text-[11px] text-gold hover:underline"
        >
          Use a different address
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field label="Email">
        <input
          type="email"
          required
          autoComplete="email"
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className={inputClass}
        />
      </Field>

      <Button type="submit" disabled={state === "sending"} className="w-full">
        {state === "sending" ? "Sending…" : "Send sign-in link"}
      </Button>

      {state === "error" ? (
        <p className="text-sm text-alarm">{message}</p>
      ) : null}
    </form>
  );
}
