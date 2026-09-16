/**
 * Environment configuration.
 *
 * Supabase values are read eagerly because nothing works without them.
 * The Anthropic key is deliberately optional: with no key the AI layer runs
 * on the mock adapter, so the app is usable — and reviewable — before anyone
 * spends money. See src/lib/ai/index.ts.
 */

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Missing ${name}. Copy .env.example to .env.local and fill it in — see README.md.`,
    );
  }
  return value;
}

export const env = {
  get supabaseUrl() {
    return required(
      "NEXT_PUBLIC_SUPABASE_URL",
      process.env.NEXT_PUBLIC_SUPABASE_URL,
    );
  },
  get supabaseAnonKey() {
    return required(
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    );
  },
  /** Absent in development and in CI. The mock adapter covers it. */
  get anthropicKey(): string | null {
    return process.env.ANTHROPIC_API_KEY?.trim() || null;
  },
  get anthropicModel(): string {
    return process.env.ANTHROPIC_MODEL?.trim() || "claude-sonnet-4-5";
  },
  get siteUrl(): string {
    return (
      process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")
    );
  },
};

/** True when Supabase is configured at all. Used to render a helpful setup page. */
export function isConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
