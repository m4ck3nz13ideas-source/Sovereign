"use client";

import Link from "next/link";
import { useTransition } from "react";

import { chooseAddress } from "@/app/(app)/collective/actions";

/**
 * The scale selector.
 *
 *   "At the top of every collective page is a scale selector. Local, Regional,
 *    National, Continental, Global. This enforces subsidiarity: decisions
 *    happen at the lowest level possible."
 *
 * Groups sit to the right of the scales rather than above them, which is the
 * order the argument runs in: where you are first, then the people who invited
 * each other.
 */
export function ScaleSelector({
  options,
  current,
}: {
  options: { value: string; label: string; detail: string | null }[];
  current: string;
}) {
  const [pending, start] = useTransition();

  if (options.length <= 1 && options[0]?.value.startsWith("scope:")) {
    // One scale and nothing to switch to. A selector would be furniture.
    return (
      <p className="smallcaps mb-6 text-[10px] text-paper-faint">
        {options[0].label}
        {options[0].detail ? ` · ${options[0].detail}` : ""}
        {" · "}
        <Link href="/settings/place" className="hover:text-gold">
          where you are
        </Link>
      </p>
    );
  }

  return (
    <div className="no-scrollbar -mx-5 mb-6 overflow-x-auto px-5">
      <div className="flex min-w-max items-center gap-1.5">
        {options.map((o) => {
          const active = o.value === current;
          return (
            <button
              key={o.value}
              type="button"
              disabled={pending}
              onClick={() => start(async () => { await chooseAddress(o.value); })}
              aria-current={active ? "true" : undefined}
              title={o.detail ?? undefined}
              className={`smallcaps rounded-full border px-3 py-1.5 text-[10px] transition-colors ${
                active
                  ? "border-gold bg-gold-wash text-gold"
                  : "border-line text-paper-faint hover:border-gold-dim hover:text-paper-dim"
              }`}
            >
              {o.label}
            </button>
          );
        })}
        <Link
          href="/settings/place"
          className="smallcaps whitespace-nowrap px-2 text-[10px] text-paper-faint hover:text-gold"
        >
          where you are
        </Link>
      </div>
    </div>
  );
}
