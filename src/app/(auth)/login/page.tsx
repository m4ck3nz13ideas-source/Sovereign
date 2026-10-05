import { LoginForm } from "./LoginForm";

export const metadata = { title: "Sign in · Sovereign" };

/**
 * The door. Short, direct, and every line true.
 *
 * Mackenzie asked for copy that persuades and does not explain. The discipline
 * from before still holds: each line is something the database enforces or
 * the product does today, with its rule number here so a promise cannot drift
 * from the code that keeps it. Change a rule, change its line in the same
 * commit. No line may promise what no policy or function enforces.
 */
const LINES: { line: string; rule: string }[] = [
  { line: "Vote on ideas, not politicians.", rule: "3, 13" },
  { line: "Nobody sees which way a vote is leaning until it closes.", rule: "3" },
  { line: "What you write for yourself, only you can read.", rule: "1" },
  { line: "No likes. No follower counts.", rule: "19, 23, 32" },
  { line: "Every business here passed ten laws before it could sell to you.", rule: "37" },
  { line: "The work you put in earns SOV.", rule: "33" },
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
        <p className="mt-3 text-xl leading-snug text-paper">Decide what matters. Together.</p>

        <div className="mt-10">
          <LoginForm next={next} />
        </div>

        {error ? (
          <p className="mt-6 rounded-md border border-alarm/40 bg-alarm/10 px-3 py-2.5 text-sm text-alarm">
            {error}
          </p>
        ) : null}

        <ul className="mt-12 space-y-3 border-t border-line-soft pt-6">
          {LINES.map((l) => (
            <li key={l.line} className="text-[0.95rem] leading-snug text-paper-dim">
              {l.line}
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
