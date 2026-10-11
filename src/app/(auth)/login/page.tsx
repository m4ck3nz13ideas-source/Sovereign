import Link from "next/link";
import { LoginForm } from "./LoginForm";

export const metadata = {
  title: "Sign in · Sovereign",
  description: "Vote on ideas, not politicians. An email is all it takes.",
  alternates: { canonical: "/login" },
};

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
  { line: "Your data belongs to you.", rule: "1, 42" },
  { line: "Propose. Weigh. Act.", rule: "4, 9" },
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

        <Link href="/explore" className="mt-5 inline-block text-sm text-gold hover:underline">
          See how it works →
        </Link>

        <ul className="mt-12 space-y-3 border-t border-line-soft pt-6">
          {LINES.map((l) => (
            <li key={l.line} className="font-serif text-lg leading-snug text-paper">
              {l.line}
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
