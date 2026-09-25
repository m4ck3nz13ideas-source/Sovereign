"use client";

import { useOptimistic, useTransition } from "react";

import { Pill, Rail } from "@/components/ui";
import type { Theme } from "@/lib/theme";

import { chooseTheme } from "./actions";

/**
 * Light, dark, or whatever the phone is doing.
 *
 * The attribute on <html> is set here as well as on the server, so the screen
 * changes under your finger rather than after a round trip. The server action
 * behind it is what makes the choice survive a reload — and what makes the
 * next first paint already correct, which is the only part that matters once
 * you have stopped looking at the setting.
 *
 * The options arrive as a prop rather than being imported: the module that
 * knows about themes also reads the cookie, and that is server-only.
 */
export function ThemePanel({
  current,
  options,
}: {
  current: Theme;
  options: { value: Theme; label: string }[];
}) {
  const [, start] = useTransition();
  const [chosen, choose] = useOptimistic(current);

  function pick(theme: Theme) {
    if (theme === "system") {
      document.documentElement.removeAttribute("data-theme");
    } else {
      document.documentElement.setAttribute("data-theme", theme);
    }

    start(async () => {
      choose(theme);
      await chooseTheme(theme);
    });
  }

  return (
    <Rail>
      {options.map((t) => (
        <Pill key={t.value} active={t.value === chosen} onClick={() => pick(t.value)}>
          {t.label}
        </Pill>
      ))}
    </Rail>
  );
}
