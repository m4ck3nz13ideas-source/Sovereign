import { isConfigured } from "@/lib/env";

export const metadata = { title: "Setup · Sovereign" };

/**
 * Shown when Supabase is not configured.
 *
 * A fresh clone should explain itself rather than crash with a stack trace
 * about a missing environment variable.
 */
export default function SetupPage() {
  const configured = isConfigured();

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="font-serif text-3xl text-paper">Sovereign</h1>

      {configured ? (
        <p className="mt-6 text-[0.95rem] leading-relaxed text-paper-dim">
          Configuration looks complete.{" "}
          <a href="/launch" className="text-gold hover:underline">
            Open the app →
          </a>
        </p>
      ) : (
        <>
          <p className="mt-6 text-[0.95rem] leading-relaxed text-paper-dim">
            This install has no database yet. Sovereign needs a Supabase project
            — the free tier is enough for a group of fifty.
          </p>

          <ol className="mt-8 space-y-6">
            <Step n={1} title="Make a Supabase project">
              At supabase.com. Any region; the free tier is fine.
            </Step>

            <Step n={2} title="Run the migrations">
              Paste the three files in <Code>supabase/migrations/</Code> into the
              SQL editor, in order. Or, with the Supabase CLI:{" "}
              <Code>supabase db push</Code>.
            </Step>

            <Step n={3} title="Fill in .env.local">
              Copy <Code>.env.example</Code> to <Code>.env.local</Code> and add
              your project URL and anon key, both from Settings → API.
            </Step>

            <Step n={4} title="Optionally, add a model">
              Set <Code>ANTHROPIC_API_KEY</Code> for real proposal reviews.
              Without it the app runs on an offline reviewer — the whole loop
              works, and every review it writes says plainly that no model read
              it.
            </Step>
          </ol>

          <p className="mt-8 text-sm leading-relaxed text-paper-faint">
            Full instructions are in the README.
          </p>
        </>
      )}
    </main>
  );
}

function Step({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-4">
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-gold-dim text-xs text-gold">
        {n}
      </span>
      <div>
        <h2 className="text-[0.95rem] text-paper">{title}</h2>
        <p className="mt-1 text-sm leading-relaxed text-paper-dim">{children}</p>
      </div>
    </li>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded bg-surface px-1.5 py-0.5 font-mono text-[0.85em] text-paper">
      {children}
    </code>
  );
}
