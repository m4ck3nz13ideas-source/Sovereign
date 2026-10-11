import "server-only";

import { cache } from "react";

import { createClient } from "@/lib/supabase/server";

/** What shared_decision() returns (0049): nothing that names anybody. */
export interface SharedDecision {
  title: string;
  summary: string;
  rationale: string | null;
  outcome: "passed" | "failed";
  status: string;
  scale: string;
  by_group: boolean;
  decided_on: string;
  voices: number;
  members: number | null;
  participation: number | null;
  alignment: number | null;
  confidence: number | null;
  urgency: number | null;
  spread: number | null;
  split: boolean | null;
}

/** One read per request, shared by the page, its metadata and its image. */
export const getSharedDecision = cache(async (token: string): Promise<SharedDecision | null> => {
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(token)) return null;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("shared_decision", { p_token: token });
    if (error) return null;
    const row = ((data ?? []) as SharedDecision[])[0];
    if (!row) return null;
    const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));
    return {
      ...row,
      participation: num(row.participation),
      alignment: num(row.alignment),
      confidence: num(row.confidence),
      urgency: num(row.urgency),
      spread: num(row.spread),
    };
  } catch {
    return null;
  }
});

export const SCALE_LABEL: Record<string, string> = {
  local: "a street",
  regional: "a region",
  national: "a nation",
  continental: "a continent",
  global: "the world",
};

export function longDate(iso: string) {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}
