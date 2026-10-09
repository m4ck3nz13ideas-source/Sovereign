import type { ReactNode } from "react";

import { Container } from "./blocks";

/** A plain-English legal page: a title, a date, numbered sections. */
export function Legal({ title, updated, intro, sections }: { title: string; updated: string; intro: ReactNode; sections: { h: string; body: ReactNode }[] }) {
  return (
    <section className="py-16 sm:py-24">
      <Container>
        <div className="mx-auto max-w-3xl">
          <h1 className="font-serif text-4xl tracking-tight text-paper sm:text-5xl">{title}</h1>
          <p className="mt-3 text-paper-faint">Last updated {updated}</p>
          <div className="mt-8 text-lg leading-relaxed text-paper-dim">{intro}</div>
          <ol className="mt-12 space-y-10">
            {sections.map((s, i) => (
              <li key={s.h}>
                <h2 className="font-serif text-2xl text-paper">
                  <span className="mr-3 tabular-nums text-gold">{i + 1}</span>
                  {s.h}
                </h2>
                <div className="mt-3 space-y-3 leading-relaxed text-paper-dim [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-1.5">{s.body}</div>
              </li>
            ))}
          </ol>
        </div>
      </Container>
    </section>
  );
}
