"use client";

import { useEffect } from "react";

import { Button, Card, Page } from "@/components/ui";

/**
 * When a page throws.
 *
 * The common causes here are a database that has not had its migrations run
 * and a Supabase project that is unreachable, so the copy names those rather
 * than saying "something went wrong". The message itself is shown: hiding it
 * helps nobody, and there is nothing secret in a Postgres error.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[sovereign]", error);
  }, [error]);

  const looksUnmigrated =
    /relation .* does not exist|function .* does not exist|schema "public"/i.test(
      error.message,
    );

  return (
    <Page>
      <h1 className="font-serif text-[1.75rem] leading-tight text-paper">
        That did not load.
      </h1>

      <Card className="mt-6">
        <p className="text-[0.95rem] leading-relaxed text-paper-dim">
          {looksUnmigrated
            ? "The database is missing something this page needs. If this is a fresh install, the migrations in supabase/migrations have probably not been run yet."
            : "Something failed on the way to rendering this page."}
        </p>

        <pre className="mt-4 overflow-auto rounded-md border border-line bg-ink-raised p-3 font-mono text-xs leading-relaxed text-paper-faint">
          {error.message}
          {error.digest ? `\n\ndigest: ${error.digest}` : ""}
        </pre>

        <div className="mt-5 flex flex-wrap gap-2">
          <Button type="button" onClick={reset}>
            Try again
          </Button>
          <a
            href="/launch"
            className="smallcaps inline-flex items-center rounded-md border border-line bg-surface px-4 py-2.5 text-xs text-paper transition-colors hover:border-gold-dim"
          >
            Back to Launch
          </a>
        </div>
      </Card>
    </Page>
  );
}
