import { PageHero, Section } from "../_site/blocks";
import { CONTACT_EMAIL, pageMeta } from "../_site/site";

export const metadata = pageMeta("contact");

const REASONS = [
  ["General", "Sovereign, the founding 50, the ideas behind it.", "Hello"],
  ["Business", "Listing, verification, advertising.", "Business enquiry"],
  ["Press and partners", "Interviews, collaborations, pilots.", "Press and partners"],
  ["Privacy", "Your data: see it, delete it, raise a concern.", "Privacy request"],
];

export default function ContactPage() {
  return (
    <>
      <PageHero eyebrow="Contact" title="Talk to a person." lead="The founder reads every message. Replies within a few working days." />
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
