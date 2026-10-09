"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui";

import { giveConsent } from "./actions";

/**
 * Two boxes, unticked, each saying exactly what it agrees to. Explicit consent
 * has to name the kind of data in words; a single "I agree to the terms"
 * would not be it.
 */
export function ConsentForm({ next }: { next: string }) {
  const router = useRouter();
  const [sensitive, setSensitive] = useState(false);
  const [adult, setAdult] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="space-y-4">
      <Box checked={sensitive} onChange={setSensitive}>
        I explicitly consent to Sovereign processing my <strong>political opinions</strong> (the proposals I write,
        how I respond and what I say in debate), my <strong>religious and philosophical beliefs</strong> (my faith,
        values and beliefs), and anything about my <strong>health</strong> or other sensitive matters I choose to
        write, so the app can work for me.
      </Box>
      <Box checked={adult} onChange={setAdult}>
        I am <strong>18 or over</strong>.
      </Box>

      {error ? <p className="text-sm text-alarm">{error}</p> : null}

      <Button
        type="button"
        className="w-full"
        disabled={!sensitive || !adult || pending}
        onClick={() =>
          start(async () => {
            setError(null);
            const res = await giveConsent();
            if (!res.ok) setError(res.error);
            else router.replace(next);
          })
        }
      >
        {pending ? "Saving" : "Agree and continue"}
      </Button>

      <p className="text-center text-sm text-paper-faint">
        Don&apos;t agree?{" "}
        <Link href="/settings/data" className="text-paper-dim underline hover:text-paper">
          Take a copy of your data or delete your account
        </Link>
        .
      </p>
    </div>
  );
}

function Box({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <label
      className={`flex cursor-pointer gap-3.5 rounded-card border p-4 text-[0.95rem] leading-relaxed ${
        checked ? "border-gold-dim bg-gold-wash text-paper" : "border-line bg-surface-soft text-paper-dim"
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 h-5 w-5 shrink-0 accent-[var(--color-gold)]"
      />
      <span className="[&_strong]:font-semibold [&_strong]:text-paper">{children}</span>
    </label>
  );
}
