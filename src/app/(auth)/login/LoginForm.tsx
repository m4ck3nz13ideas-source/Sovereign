"use client";

import { useState } from "react";

import { Button, Field, inputClass } from "@/components/ui";
import { env } from "@/lib/env";
import { createClient } from "@/lib/supabase/client";

export function LoginForm({ next }: { next?: string }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");

    const supabase = createClient();

    // The same rule as the callback: the configured origin wins, and the
    // window's own is the fallback. A link built from a preview host sends the
    // person back to the preview, which is correct there and wrong everywhere
    // else — and the address in the email is the one thing nobody can correct
    // afterwards.
    const redirect = new URL("/auth/callback", env.publicSiteUrl ?? window.location.origin);
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
