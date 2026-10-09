import { Legal } from "../_site/Legal";
import { CONTACT_EMAIL } from "../_site/site";

export const metadata = { title: "Privacy" };

export default function PrivacyPage() {
  return (
    <Legal
      title="Privacy"
      updated="9 October 2026"
      intro={
        <p>
          The short version: what you write for yourself is readable by you alone, enforced by the database. We
          don&apos;t sell data, we don&apos;t run trackers, and advertisers never learn who you are.
        </p>
      }
      sections={[
        {
          h: "What we keep",
          body: (
            <ul>
              <li>Your email address, to sign you in with a link. There is no password.</li>
              <li>Your profile, values and anything you choose to write, post, propose or list.</li>
              <li>What you do in shared spaces — responses, comments, likes, projects — so decisions can be counted and checked.</li>
              <li>If you prove personhood: one opaque code. No name, document, photo or biometric.</li>
            </ul>
          ),
        },
        {
          h: "Who can read it",
          body: (
            <>
              <p>
                Your journal, ideas, drafts, to-dos and Know yourself results are readable by you alone. That is a
                rule in the database, not a setting anyone can change. Drafts of proposals stay on your device until
                you submit them.
              </p>
              <p>
                Posts, proposals and anything you say in a shared space can be read by the people that space is
                for. Every screen in the app tells you who that is.
              </p>
            </>
          ),
        },
        {
          h: "Advertising",
          body: (
            <p>
              To choose the sponsored slot, your values are matched against a business&apos;s words at the moment you
              look. The match is not stored and is never shown to the business. Advertisers see clicks and spend,
              never who clicked or why.
            </p>
          ),
        },
        {
          h: "AI",
          body: (
            <p>
              When you use an AI feature, the text involved is sent to our AI provider to produce the answer. It is
              not used to build a profile of you. Readings that decide something — a proposal&apos;s review, a
              post&apos;s check — are signed and published with their reasons.
            </p>
          ),
        },
        {
          h: "Cookies",
          body: (
            <p>
              Only the ones Sovereign needs to work: keeping you signed in, your light or dark choice, and which group
              you&apos;re looking at. No analytics, no advertising cookies, no third-party trackers. Fonts are served
              from Sovereign itself.
            </p>
          ),
        },
        {
          h: "Who processes it",
          body: (
            <p>
              Sovereign runs on Supabase (database and sign-in) and Vercel (hosting), and uses an AI provider for AI
              features. They process data on our behalf and for nothing else.
            </p>
          ),
        },
        {
          h: "Your rights",
          body: (
            <p>
              You can ask to see, correct, export or delete your data at any time. Some shared records — a decision,
              a law reading, a flag and its answer — are written once so the record can be trusted; if you leave, we
              will tell you exactly what stays and why. Email{" "}
              <a href={`mailto:${CONTACT_EMAIL}?subject=Privacy request`} className="text-gold hover:underline">
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
