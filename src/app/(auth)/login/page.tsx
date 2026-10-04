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
  { line: "Advertising buys a labelled slot in the Marketplace, never approval — every business there is read against the ten laws and signed off first.", rule: "37" },
];

/**
 * What is inside, tab by tab, in the order the tab bar shows them.
 *
 * The door is the only page somebody sees before they are invited in, so it
 * says what they are being invited into. Each line describes something that
 * exists and works today — not a roadmap. When a tab changes, this changes in
 * the same commit as TabBar.tsx.
 */
const TABS: { name: string; line: string }[] = [
  {
    name: "Individual",
    line: "Your profile, values, journal, ideas, drafts, a private guardian, chats with friends, and your SOV — all yours alone unless you share them.",
  },
  {
    name: "Home",
    line: "A feed of first-hand posts and the decisions the people you know have made, in time order, and what is waiting on you.",
  },
  {
    name: "Search",
    line: "Find what you or your group have already written, or ask a question and see what several ways of knowing hold about it.",
  },
  {
    name: "Marketplace",
    line: "Trade with businesses whose products and services align with the ten Universal Laws, each vetted by the AI and signed off by a reviewer. Buy on their site; one sponsored slot, always labelled.",
  },
  {
    name: "Collective",
    line: "Proposals, sharpened and audited against the ten Universal Laws, debated and resonated with — then projects, outcomes, the words a group uses, and the people in it.",
  },
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
          <p className="smallcaps mb-3 text-[10px] text-paper-faint">What is inside</p>
          <dl className="space-y-3">
            {TABS.map((t) => (
              <div key={t.name}>
                <dt className="text-[0.875rem] font-medium text-paper">{t.name}</dt>
                <dd className="mt-0.5 text-[0.875rem] leading-snug text-paper-dim">{t.line}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="mt-8 border-t border-line-soft pt-6">
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
