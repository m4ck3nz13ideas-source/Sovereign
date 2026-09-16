/**
 * Dates read as a person would say them: "three days ago", not "16/09/2026".
 * The banners depend on this — "From three days ago: '…'. Ready to sit with this?"
 */
export function ago(iso: string): string {
  const then = new Date(iso).getTime();
  const mins = Math.floor((Date.now() - then) / 60000);

  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;

  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;

  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 14) return "last week";
  if (days < 60) return `${Math.floor(days / 7)} weeks ago`;

  const months = Math.floor(days / 30);
  if (months < 18) return `${months} months ago`;
  return `${Math.floor(days / 365)} years ago`;
}

/** An ISO timestamp N days in the past. Kept out of components — see lastNDays. */
export function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 864e5).toISOString();
}

/**
 * The last N calendar days as YYYY-MM-DD, oldest first.
 *
 * Reading the clock is impure, so it lives here rather than in the component
 * that renders the rhythm display.
 */
export function lastNDays(n: number): string[] {
  const now = Date.now();
  const days: string[] = [];
  for (let i = n - 1; i >= 0; i -= 1) {
    days.push(new Date(now - i * 864e5).toISOString().slice(0, 10));
  }
  return days;
}

export function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** The first line of an entry, for a banner. */
export function firstLine(text: string, max = 90): string {
  const line = text.split("\n").find((l) => l.trim()) ?? text;
  const clean = line.trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

export function money(amount: number | null, currency = "GBP"): string {
  if (amount === null || Number.isNaN(amount)) return "—";
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
}

/** "Good morning" / "What are you carrying today" — the greeting adapts to the hour. */
export function greeting(name: string): string {
  const h = new Date().getHours();
  const first = name.split(" ")[0];
  if (h < 5) return `Still awake, ${first}?`;
  if (h < 12) return `What are you carrying this morning, ${first}?`;
  if (h < 18) return `What are you carrying today, ${first}?`;
  return `What are you carrying tonight, ${first}?`;
}

export const STATUS_LABEL: Record<string, string> = {
  in_review: "In review",
  in_deliberation: "In deliberation",
  voting: "Resonance open",
  passed: "Passed",
  failed: "Did not pass",
  withdrawn: "Withdrawn",
  executing: "In progress",
  completed: "Completed",
  planning: "Planning",
  abandoned: "Abandoned",
  todo: "To do",
  doing: "Doing",
  done: "Done",
  seed: "Seed",
  developing: "Developing",
  named: "Named",
  dormant: "Dormant",
};
