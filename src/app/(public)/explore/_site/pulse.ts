import "server-only";

import { createClient } from "@/lib/supabase/server";

export interface Pulse {
  people: number;
  decisions: number;
  projects_done: number;
  businesses: number;
}

/**
 * The four public totals (0037). Null when the database cannot be reached,
 * so a page renders without numbers rather than with made-up ones.
 */
export async function getPulse(): Promise<Pulse | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("public_pulse");
    if (error) return null;
    return ((data ?? []) as Pulse[])[0] ?? null;
  } catch {
    return null;
  }
}
