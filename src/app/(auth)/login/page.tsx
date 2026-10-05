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
  { line: "Vote on policies, not politicians.", rule: "3, 13" },
  { line: "Your data belongs to you.", rule: "1" },
  { line: "Turn ideas into action.", rule: "5, 6" },
  { line: "Positive, productive social media.", rule: "19, 20, 32" },
  { line: "Built on trust, transparency and sovereignty.", rule: "2, 36" },
  { line: "Propose. Participate. Play.", rule: "33" },
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
        <p className="mt-3 text-xl leading-snug text-paper">Better decisions. Together.</p>

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
