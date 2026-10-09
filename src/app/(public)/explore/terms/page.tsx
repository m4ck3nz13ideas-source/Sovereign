import Link from "next/link";

import { Legal } from "../_site/Legal";
import { CONTACT_EMAIL } from "../_site/site";

export const metadata = { title: "Terms" };

export default function TermsPage() {
  return (
    <Legal
      title="Terms"
      updated="9 October 2026"
      intro={<p>Plain terms for using Sovereign. By joining, you agree to these and to the ten Universal Laws.</p>}
      sections={[
        {
          h: "The Universal Laws",
          body: (
            <p>
              Everyone in Sovereign — people and businesses — agrees to the{" "}
              <Link href="/explore/about#laws" className="text-gold hover:underline">
                ten Universal Laws
              </Link>
              . Proposals, posts and listings are read against them. Your agreement is recorded against the wording
              you read.
            </p>
          ),
        },
        {
          h: "Your account",
          body: (
            <ul>
              <li>You must be 18 or over (we plan to open to 16 and 17 year olds in 2027). One account per person. Keep access to your email, since that is how you sign in.</li>
              <li>You can take a copy of your data or delete your account at any time from Settings → Your data.</li>
              <li>You own what you write. You let Sovereign show it to the people you shared it with.</li>
              <li>Don&apos;t impersonate anyone, harass anyone, or try to get around the rules in the app.</li>
            </ul>
          ),
        },
        {
          h: "Decisions and the record",
          body: (
            <p>
              Decisions, law readings, flags and debate are written once and can&apos;t be edited afterwards, so the
              record can be trusted. A decision in Sovereign is what the people involved agreed; it is not a law of
              any country and creates no legal obligation by itself.
            </p>
          ),
        },
        {
          h: "SOV",
          body: (
            <p>
              SOV is a simulation of a contribution record. It is not money, has no cash value, and can&apos;t be
              exchanged for anything outside Sovereign.
            </p>
          ),
        },
        {
          h: "Buying and selling",
          body: (
            <p>
              Purchases happen on the business&apos;s own website, under their terms. Verification means a business
              proved it owns its website and passed the laws when it was reviewed — not a guarantee of every
              product. Businesses agree to keep their listing truthful; editing it sends it back for review.
            </p>
          ),
        },
        {
          h: "AI",
          body: (
            <p>
              AI readings are published with their reasons and can be challenged. They can be wrong — read them as a
              careful second opinion, not the final word.
            </p>
          ),
        },
        {
          h: "Changes and contact",
          body: (
            <p>
              Sovereign is early and these terms will change; we&apos;ll tell you in the app when they do. Questions:{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-gold hover:underline">
                {CONTACT_EMAIL}
              </a>
              .
            </p>
          ),
        },
      ]}
    />
  );
}
