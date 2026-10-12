import { Container, CtaBand, Faq, PageHero, PrimaryLink, Section, SecondaryLink, SectionHead, TickList } from "../_site/blocks";
import { MarketScreen, PhoneFrame } from "../_site/mockups";
import { CONTACT_EMAIL, pageMeta } from "../_site/site";

export const metadata = pageMeta("business");

export default function BusinessPage() {
  return (
    <>
      <PageHero
        eyebrow="For business"
        title="Sell to people who care how you do business."
        lead="Prove you are real. Pass ten laws. Reach people whose values match yours."
      >
        <PrimaryLink href="/login?next=/market/sell">Apply to list</PrimaryLink>
        <SecondaryLink href={`mailto:${CONTACT_EMAIL}?subject=Business enquiry`}>Talk to us</SecondaryLink>
      </PageHero>

      {/* ------------------------------------------------------------ STEPS */}
      <Section id="verified">
        <SectionHead
          eyebrow="Getting verified"
          title="Four steps. No shortcut for money."
          lead="Approval is earned, and holds for the exact words you stand on."
        />
        <ol className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Say who you are", "What you sell, how you treat people, where it comes from. With evidence."],
            ["Prove it", "A token on your website or DNS. UK companies add a Companies House number."],
            ["Ten laws", "AI reads your business against all ten. One violation stops it."],
            ["A person signs", "A reviewer can refuse what the AI passed. Never pass what it refused."],
          ].map(([t, d], i) => (
            <li key={t} className="rounded-sheet border border-line p-6">
              <span className="font-serif text-3xl tabular-nums text-gold">{i + 1}</span>
              <p className="mt-4 text-lg font-semibold text-paper">{t}</p>
              <p className="mt-1.5 text-paper-dim">{d}</p>
            </li>
          ))}
        </ol>
        <p className="mt-6 text-paper-faint">
          Edit your listing and approval lapses until it is read and signed again.
        </p>
      </Section>

      {/* -------------------------------------------------------- ADVERTISE */}
      <Section id="advertise" className="bg-surface-soft">
        <div className="grid items-center gap-14 lg:grid-cols-2">
          <div>
            <SectionHead
              eyebrow="Advertising"
              title="The best fit wins. Not the biggest budget."
              lead="One labelled slot in Search and the Market, chosen for each person by how well you match the values they wrote."
            />
            <div className="mt-8">
              <TickList
                items={[
                  "Pay per click: once per person, per campaign, per day.",
                  "70% values match, 30% vetting. Your bid only breaks ties.",
                  "You see clicks and spend. Never who. Never why.",
                ]}
              />
            </div>
          </div>
          <PhoneFrame active={3}>
            <MarketScreen />
          </PhoneFrame>
        </div>
      </Section>

      {/* ----------------------------------------------------------- WHY */}
      <Section>
        <SectionHead center eyebrow="Why list" title="A market where being good is the advantage." />
        <Container className="mt-12 grid gap-4 px-0 sm:grid-cols-3">
          {[
            ["Customers who agree", "Your ad reaches people whose values match yours."],
            ["A badge that means something", "Proven, checked, signed. Never bought."],
            ["Fair to the small", "Listings newest first, not for sale. A sole trader stands beside a chain."],
          ].map(([t, d]) => (
            <div key={t} className="rounded-sheet border border-line p-6">
              <p className="font-serif text-xl text-paper">{t}</p>
              <p className="mt-2 text-paper-dim">{d}</p>
            </div>
          ))}
        </Container>
      </Section>

      <Section className="bg-surface-soft">
        <div className="mx-auto grid max-w-3xl gap-10">
          <h2 className="text-center font-serif text-3xl text-paper">Business questions</h2>
          <Faq
            items={[
              {
                q: "Do you handle payments?",
                a: "Not yet. Listings link to your site. Payments held until the buyer approves the work are next on the roadmap.",
              },
              {
                q: "We're not a UK company. Can we list?",
                a: "Yes. Companies House is optional; proving your website is not. Sole traders, co-ops and non-UK businesses welcome.",
              },
              {
                q: "What if a buyer has a concern about us?",
                a: "It goes to the reviewers, who can look again or suspend a listing. Concerns are not shown publicly, or to you.",
              },
              {
                q: "What does it cost?",
                a: "Rates on request while the first businesses join. Get in touch.",
              },
            ]}
          />
        </div>
      </Section>

      <CtaBand title="For people, not profit." lead="And for businesses that agree." />
    </>
  );
}
