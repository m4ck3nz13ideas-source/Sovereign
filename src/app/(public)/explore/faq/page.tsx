import { CtaBand, Faq, PageHero, Section } from "../_site/blocks";
import { CONTACT_EMAIL } from "../_site/site";
import { FAQ_GROUPS } from "./questions";

export const metadata = { title: "FAQ" };

export default function FaqPage() {
  return (
    <>
      <PageHero
        eyebrow="FAQ"
        title="Questions, answered."
        lead={
          <>
            Can&apos;t find yours?{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-gold hover:underline">
              Ask us
            </a>
            .
          </>
        }
      />
      <Section>
        <div className="space-y-16">
          {FAQ_GROUPS.map((g) => (
            <div key={g.title} className="grid gap-8 lg:grid-cols-[1fr_2.5fr]">
              <h2 className="font-serif text-2xl text-paper">{g.title}</h2>
              <Faq items={g.items} />
            </div>
          ))}
        </div>
      </Section>
      <CtaBand />
    </>
  );
}
