import { PageHero, Section } from "../_site/blocks";
import { CONTACT_EMAIL } from "../_site/site";

export const metadata = { title: "Contact" };

const REASONS = [
  ["General", "Questions about Sovereign, the founding 50 or the ideas behind it.", "Hello"],
  ["Business", "Getting listed in the Market, verification or advertising.", "Business enquiry"],
  ["Press and partners", "Interviews, collaborations and groups who want to pilot it.", "Press and partners"],
  ["Privacy", "Your data, a request to see or delete it, or a concern.", "Privacy request"],
];

export default function ContactPage() {
  return (
    <>
      <PageHero eyebrow="Contact" title="Talk to a person." lead="Every message is read by the founder. Expect a reply within a few working days." />
      <Section>
        <div className="grid gap-4 sm:grid-cols-2">
          {REASONS.map(([t, d, subject]) => (
            <a
              key={t}
              href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}`}
              className="press group rounded-sheet border border-line p-6 hover:border-gold-dim"
            >
              <p className="font-serif text-2xl text-paper">{t}</p>
              <p className="mt-2 text-paper-dim">{d}</p>
              <p className="mt-6 font-semibold text-gold">{CONTACT_EMAIL} →</p>
            </a>
          ))}
        </div>
      </Section>
    </>
  );
}
