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
  /**
   * Model IDs are retired over time, so this is configuration rather than a
   * constant. If a review starts failing with a model-not-found error, the
   * default below has aged out — set ANTHROPIC_MODEL and carry on.
   */
  get anthropicModel(): string {
    return process.env.ANTHROPIC_MODEL?.trim() || "claude-sonnet-5";
  },
  /**
   * The personhood verifier. Absent almost everywhere, and the app says so
   * rather than pretending: with no verifier, resonance at national scale and
   * above is closed to everyone on the instance. See src/lib/personhood.
   */
  get worldIdAppId(): string | null {
    return process.env.NEXT_PUBLIC_WORLD_ID_APP_ID?.trim() || null;
  },
  /**
   * The action the nullifier is scoped to. Changing it invalidates every proof
   * already recorded, because the same human hashes differently under a
   * different action — so it is configuration with a default, not a knob.
   */
  get worldIdAction(): string {
    return process.env.NEXT_PUBLIC_WORLD_ID_ACTION?.trim() || "sovereign-personhood";
  },
  /**
   * The origin this install is actually reached at, ONLY when it has been set
   * explicitly. No VERCEL_URL fallback, deliberately.
   *
   * Sign-in redirects have to use this one. The per-deployment `*.vercel.app`
   * host that VERCEL_URL names sits behind Vercel Authentication on a project
   * with deployment protection on, so sending somebody there after they click
   * a magic link lands them on a login wall belonging to a different company.
   * An unset value means "use the request's own origin", which is right in
   * development and right behind a correctly configured proxy.
   */
  get publicSiteUrl(): string | null {
    return process.env.NEXT_PUBLIC_SITE_URL?.trim() || null;
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
