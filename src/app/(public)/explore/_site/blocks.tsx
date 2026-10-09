import Link from "next/link";
import type { ReactNode } from "react";

import { FOUNDING_PLACES } from "./site";
import type { Pulse } from "./pulse";

/* --- layout --------------------------------------------------------------- */

export function Container({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-6xl px-5 ${className}`}>{children}</div>;
}

export function Section({
  id,
  children,
  className = "",
}: {
  id?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={`scroll-mt-20 py-16 sm:py-24 ${className}`}>
      <Container>{children}</Container>
    </section>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="smallcaps text-[11px] font-semibold text-gold">{children}</p>;
}

export function SectionHead({
  eyebrow,
  title,
  lead,
  center = false,
}: {
  eyebrow?: string;
  title: ReactNode;
  lead?: ReactNode;
  center?: boolean;
}) {
  return (
    <div className={center ? "mx-auto max-w-2xl text-center" : "max-w-2xl"}>
      {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
      <h2 className="mt-3 font-serif text-3xl leading-tight tracking-tight text-paper sm:text-4xl">{title}</h2>
      {lead ? <p className="mt-4 text-lg leading-relaxed text-paper-dim">{lead}</p> : null}
    </div>
  );
}

/** The top of every inner page. */
export function PageHero({ eyebrow, title, lead, children }: { eyebrow: string; title: ReactNode; lead: ReactNode; children?: ReactNode }) {
  return (
    <section className="border-b border-line-soft pt-16 pb-14 sm:pt-24 sm:pb-20">
      <Container>
        <div className="max-w-3xl">
          <Eyebrow>{eyebrow}</Eyebrow>
          <h1 className="mt-4 font-serif text-4xl leading-[1.05] tracking-tight text-paper sm:text-6xl">{title}</h1>
          <p className="mt-6 text-xl leading-snug text-paper-dim">{lead}</p>
          {children ? <div className="mt-8 flex flex-wrap gap-3">{children}</div> : null}
        </div>
      </Container>
    </section>
  );
}

/* --- actions -------------------------------------------------------------- */

export function PrimaryLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="press inline-flex items-center gap-2 rounded-pill bg-gold px-6 py-3 font-semibold text-ink">
      {children}
    </Link>
  );
}

export function SecondaryLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="press inline-flex items-center gap-2 rounded-pill border border-line px-6 py-3 font-semibold text-paper hover:bg-surface">
      {children}
    </Link>
  );
}

export function ArrowLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1.5 font-semibold text-gold hover:underline">
      {children} <span aria-hidden="true">→</span>
    </Link>
  );
}

/* --- small marks ---------------------------------------------------------- */

export function Tick({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={`h-5 w-5 shrink-0 text-gold ${className}`} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M5 10.5l3.2 3L15 6.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Cross({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={`h-5 w-5 shrink-0 text-paper-faint ${className}`} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M6 6l8 8M14 6l-8 8" strokeLinecap="round" />
    </svg>
  );
}

export function TickList({ items }: { items: ReactNode[] }) {
  return (
    <ul className="space-y-3">
      {items.map((it, i) => (
        <li key={i} className="flex gap-3 text-paper-dim">
          <Tick className="mt-0.5" />
          <span>{it}</span>
        </li>
      ))}
    </ul>
  );
}

/* --- pulse and the founding fifty ----------------------------------------- */

export function PulseStrip({ pulse }: { pulse: Pulse | null }) {
  if (!pulse) return null;
  const items: [number, string][] = [
    [pulse.people, "people in"],
    [pulse.decisions, "decisions made"],
    [pulse.projects_done, "projects finished"],
    [pulse.businesses, "verified businesses"],
  ];
  return (
    <div className="rounded-sheet border border-line bg-surface-soft p-6 sm:p-8">
      <div className="flex items-center gap-2">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-calm opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-calm" />
        </span>
        <p className="smallcaps text-[11px] text-paper-faint">Live from the database · totals only, never names</p>
      </div>
      <div className="mt-6 grid grid-cols-2 gap-6 sm:grid-cols-4">
        {items.map(([n, label]) => (
          <div key={label}>
            <p className="font-serif text-4xl tabular-nums text-paper sm:text-5xl">{n.toLocaleString("en-GB")}</p>
            <p className="mt-1 text-sm text-paper-dim">{label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function FoundingFifty({ pulse }: { pulse: Pulse | null }) {
  const taken = pulse ? Math.min(pulse.people, FOUNDING_PLACES) : null;
  const left = taken === null ? null : FOUNDING_PLACES - taken;
  return (
    <div className="overflow-hidden rounded-sheet border border-gold-dim bg-gold-wash">
      <div className="grid gap-10 p-6 sm:p-10 lg:grid-cols-[1.3fr_1fr] lg:items-center">
        <div>
          <Eyebrow>The founding {FOUNDING_PLACES}</Eyebrow>
          <h2 className="mt-3 font-serif text-3xl leading-tight text-paper sm:text-4xl">
            Be one of the first fifty people to really use it.
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-paper-dim">
            Before Sovereign opens to everyone in 2027, it is being made ready for fifty people who will use it
            for real: write in it, propose, decide, trade. What you find shapes what gets built next.
          </p>
          <ul className="mt-6 grid gap-2.5 sm:grid-cols-2">
            {["Free, as it always will be for people", "Direct line to the founder", "Your proposals among the first decided", "Early say on the roadmap"].map((t) => (
              <li key={t} className="flex gap-2.5 text-paper-dim">
                <Tick />
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-card border border-line bg-ink p-6">
          {left !== null ? (
            <>
              <p className="font-serif text-5xl tabular-nums text-paper">
                {left}
                <span className="text-2xl text-paper-faint"> / {FOUNDING_PLACES}</span>
              </p>
              <p className="mt-1 text-paper-dim">{left === 1 ? "place left" : "places left"}</p>
              <div className="mt-5 grid grid-cols-10 gap-1" aria-hidden="true">
                {Array.from({ length: FOUNDING_PLACES }, (_, i) => (
                  <span key={i} className={`h-2.5 rounded-full ${i < (taken ?? 0) ? "bg-gold" : "bg-surface-lift"}`} />
                ))}
              </div>
            </>
          ) : (
            <p className="font-serif text-2xl text-paper">Places are open.</p>
          )}
          <Link href="/login" className="press mt-6 flex w-full items-center justify-center rounded-pill bg-gold px-6 py-3 font-semibold text-ink">
            {left === 0 ? "Join the next wave" : "Claim a place"}
          </Link>
          <p className="mt-3 text-center text-sm text-paper-faint">Just an email. No password, no card.</p>
        </div>
      </div>
    </div>
  );
}

/* --- closing band --------------------------------------------------------- */

export function CtaBand({ title = "Heaven on Earth is a decision.", lead = "Make it with us." }: { title?: string; lead?: string }) {
  return (
    <Section>
      <div className="rounded-sheet bg-gold px-6 py-14 text-center text-ink sm:py-20">
        <p className="font-serif text-3xl sm:text-5xl">{title}</p>
        <p className="mt-3 text-lg opacity-80">{lead}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/login" className="press rounded-pill bg-ink px-6 py-3 font-semibold text-paper">
            Get started free
          </Link>
          <Link href="/explore#try" className="press rounded-pill border border-ink/30 px-6 py-3 font-semibold text-ink">
            Try the demo
          </Link>
        </div>
      </div>
    </Section>
  );
}

/* --- FAQ ------------------------------------------------------------------ */

export function Faq({ items }: { items: { q: string; a: ReactNode }[] }) {
  return (
    <ul className="divide-y divide-line border-y border-line">
      {items.map((it) => (
        <li key={it.q}>
          <details className="group py-5">
            <summary className="flex cursor-pointer list-none items-start justify-between gap-6 text-lg text-paper [&::-webkit-details-marker]:hidden">
              <span>{it.q}</span>
              <span className="mt-1 text-paper-faint transition-transform group-open:rotate-45" aria-hidden="true">
                +
              </span>
            </summary>
            <div className="mt-3 max-w-3xl leading-relaxed text-paper-dim">{it.a}</div>
          </details>
        </li>
      ))}
    </ul>
  );
}
