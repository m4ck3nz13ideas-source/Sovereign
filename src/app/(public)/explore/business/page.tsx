import { Container, CtaBand, Faq, PageHero, PrimaryLink, Section, SecondaryLink, SectionHead, TickList } from "../_site/blocks";
import { MarketScreen, PhoneFrame } from "../_site/mockups";
import { CONTACT_EMAIL } from "../_site/site";

export const metadata = { title: "For business" };

export default function BusinessPage() {
  return (
    <>
      <PageHero
        eyebrow="For business"
        title="Sell to people who care how you do business."
        lead="The Market is like Amazon for good, proven businesses. Pass the ten laws, prove you're real, and reach people whose values match yours."
      >
        <PrimaryLink href="/login?next=/market/sell">Apply to list</PrimaryLink>
        <SecondaryLink href={`mailto:${CONTACT_EMAIL}?subject=Business enquiry`}>Talk to us</SecondaryLink>
      </PageHero>

      {/* ------------------------------------------------------------ STEPS */}
      <Section id="verified">
        <SectionHead
          eyebrow="Getting verified"
          title="Four steps. No shortcuts for money."
          lead="Approval is earned by what your business is, and it holds for the exact words you stand on."
        />
        <ol className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Tell us who you are", "What you sell, how you treat people, what it's made of and where it comes from — with your evidence."],
            ["Prove it's you", "Publish a token on your website or DNS. UK companies can add a Companies House number, checked by a reviewer."],
            ["The ten laws", "AI reads your business against all ten. Any violation and it stops here."],
            ["A person signs off", "A reviewer checks the reading. They can refuse what the AI passed, never pass what it refused."],
          ].map(([t, d], i) => (
            <li key={t} className="rounded-sheet border border-line p-6">
              <span className="font-serif text-3xl tabular-nums text-gold">{i + 1}</span>
              <p className="mt-4 text-lg font-semibold text-paper">{t}</p>
              <p className="mt-1.5 text-paper-dim">{d}</p>
            </li>
          ))}
        </ol>
        <p className="mt-6 text-paper-faint">
          Edit your name, description or evidence and approval lapses until it&apos;s read and signed again.
        </p>
      </Section>

      {/* -------------------------------------------------------- ADVERTISE */}
      <Section id="advertise" className="bg-surface-soft">
        <div className="grid items-center gap-14 lg:grid-cols-2">
          <div>
            <SectionHead
              eyebrow="Advertising"
              title="The top slot goes to the best fit. Not the biggest budget."
              lead="One labelled sponsored slot, in Search and the Market. It's chosen for each person by how well your business matches the values they wrote for themselves."
            />
            <div className="mt-8">
              <TickList
                items={[
                  "Pay per click — once per person per campaign per day.",
                  "Never charged for your own clicks, never past budget.",
                  "70% values match, 30% how cleanly you passed. Your bid breaks ties.",
                  "You see clicks and spend. Never who, and never why — their values stay theirs.",
                  "Only approved businesses can advertise. Lose approval and ads stop at once.",
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
            ["Customers who already agree with you", "Your ad reaches people whose own values match what you stand for."],
            ["A badge that means something", "Verified means proven, read against ten laws and signed off by a person — not paid for."],
            ["Fair to small businesses", "Organic listings are newest first and not for sale. A sole trader stands beside a chain."],
          ].map(([t, d]) => (
            <div key={t} className="rounded-sheet border border-line p-6">
              <p className="font-serif text-xl text-paper">{t}</p>
              <p className="mt-2 text-paper-dim">{d}</p>
            </div>
          ))}
        </Container>
      </Section>

      <Section className="bg-surface-soft">
        <div className="grid gap-12 lg:grid-cols-[1fr_2fr]">
          <h2 className="font-serif text-3xl text-paper">Business questions</h2>
          <Faq
            items={[
              {
                q: "Do you handle payments?",
                a: "Not yet. Listings link to your own site for now. Payments held until the buyer approves the work are next on the roadmap.",
              },
              {
                q: "We're not a UK company. Can we list?",
                a: "Yes. The Companies House check is optional. Sole traders, co-operatives and businesses outside the UK are welcome. Proving your website is required for everyone.",
              },
              {
                q: "What if a buyer has a concern about us?",
                a: "It goes to the reviewers, who can look again or suspend a listing. Concerns are not shown publicly or to you.",
              },
              {
                q: "What does it cost?",
                a: "Listing terms and advertising rates are on request while we onboard the first businesses. Get in touch.",
              },
            ]}
          />
        </div>
      </Section>

      <CtaBand title="For people, not profit." lead="And for businesses that agree." />
    </>
  );
}
