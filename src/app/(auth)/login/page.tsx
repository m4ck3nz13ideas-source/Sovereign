import { LoginForm } from "./LoginForm";

export const metadata = { title: "Sign in · Sovereign" };

/**
 * What this place will not do, on the door.
 *
 * Every line is a rule the database enforces, with its number in CLAUDE.md
 * beside it here so that a promise cannot drift away from the code that keeps
 * it. If a rule is ever changed on purpose, the line changes in the same
 * commit — a door that promises more than the policies give is worse than a
 * door that promises nothing. No line may promise something no policy or
 * function enforces.
 */
const REFUSALS: { line: string; rule: string }[] = [
  { line: "What you write for yourself is readable by you alone.", rule: "1" },
  { line: "Nobody sees which way a decision is leaning until it closes.", rule: "3" },
  { line: "Ask shows you positions, never a verdict.", rule: "29" },
  { line: "What you agreed to stays what you agreed to — an amendment cannot rewrite it.", rule: "28" },
  { line: "No follower counts, no directory, no read receipts.", rule: "19, 23" },
];

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;

  return (
    <main className="flex min-h-dvh items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <h1 className="font-serif text-4xl tracking-tight text-paper">Sovereign</h1>
        <p className="mt-3 text-[0.95rem] leading-relaxed text-paper-dim">
          A quiet place to think, and a way for a group to decide together.
        </p>

        <div className="mt-10">
          <LoginForm next={next} />
        </div>

        {error ? (
          <p className="mt-6 rounded-md border border-alarm/40 bg-alarm/10 px-3 py-2.5 text-sm text-alarm">
            {error}
          </p>
        ) : null}

        <div className="mt-10 border-t border-line-soft pt-6">
          <p className="smallcaps mb-3 text-[10px] text-paper-faint">What this place will not do</p>
          <ul className="space-y-2">
            {REFUSALS.map((r) => (
              <li key={r.rule} className="text-[0.875rem] leading-snug text-paper-dim">
                {r.line}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs leading-relaxed text-paper-faint">
            Each of these is enforced by the database rather than by this page.
            Sovereign sends a sign-in link rather than keeping a password.
          </p>
        </div>
      </div>
    </main>
  );
}
