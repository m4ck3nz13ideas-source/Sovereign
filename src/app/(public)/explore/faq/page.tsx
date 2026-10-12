import { CtaBand, Faq, PageHero, Section } from "../_site/blocks";
import { CONTACT_EMAIL, pageMeta } from "../_site/site";
import { FAQ_GROUPS } from "./questions";

export const metadata = pageMeta("faq");

/** FAQPage structured data, from the answers that are plain text. */
function faqJsonLd() {
  const items = FAQ_GROUPS.flatMap((g) => g.items).filter((i) => typeof i.a === "string");
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((i) => ({
      "@type": "Question",
      name: i.q,
      acceptedAnswer: { "@type": "Answer", text: i.a as string },
    })),
  }).replace(/</g, "\\u003c");
}

export default function FaqPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: faqJsonLd() }} />
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
            <div key={g.title} className="mx-auto grid max-w-3xl gap-8">
              <h2 className="text-center font-serif text-2xl text-paper">{g.title}</h2>
              <Faq items={g.items} />
            </div>
          ))}
        </div>
      </Section>
      <CtaBand />
    </>
  );
}
