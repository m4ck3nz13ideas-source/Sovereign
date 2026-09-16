"use client";

import { createBrowserClient } from "@supabase/ssr";

import { env } from "@/lib/env";

/** Supabase client for Client Components. Anon key only — never a service key. */
export function createClient() {
  return createBrowserClient(env.supabaseUrl, env.supabaseAnonKey);
}
