import "server-only";

import { cookies } from "next/headers";

const THEME_COOKIE = "sovereign.theme";

/**
 * Light, dark, or whatever the phone is already doing.
 *
 * "system" is the default and stores nothing — a person who has never touched
 * this should follow their device, including when it switches at dusk. Only an
 * explicit choice is written down, and it overrides the device until changed.
 *
 * The cookie is read in the root layout so the server renders the right
 * `data-theme` on the first byte. A theme applied by JavaScript after paint is
 * a white flash on a black app, which is exactly the thing people turn dark
 * mode on to avoid.
 */
export type Theme = "system" | "light" | "dark";

export const THEMES: { value: Theme; label: string }[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

function parse(value: string | undefined): Theme {
  return value === "light" || value === "dark" ? value : "system";
}

export async function currentTheme(): Promise<Theme> {
  const store = await cookies();
  return parse(store.get(THEME_COOKIE)?.value);
}

export async function setTheme(theme: Theme) {
  const store = await cookies();

  if (theme === "system") {
    store.delete(THEME_COOKIE);
    return;
  }

  store.set(THEME_COOKIE, theme, {
    httpOnly: false, // the toggle flips the attribute before the reload lands
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}
