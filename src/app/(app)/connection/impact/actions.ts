"use server";

import { ledger } from "@/lib/ledger";

export async function verifyRecord(groupId: string) {
  try {
    const result = await ledger().verify(groupId);
    return { ok: true as const, result };
  } catch (e) {
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : "The record could not be replayed.",
    };
  }
}
