import { LoginForm } from "./LoginForm";

export const metadata = { title: "Sign in · Sovereign" };

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

        <p className="mt-10 text-xs leading-relaxed text-paper-faint">
          Sovereign sends a sign-in link rather than keeping a password. Your
          individual space — entries, concepts, the history of what you have
          believed — is readable by you alone, enforced in the database rather
          than by this page.
        </p>
      </div>
    </main>
  );
}
