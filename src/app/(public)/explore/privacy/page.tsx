import Link from "next/link";

import { Legal } from "../_site/Legal";
import { CONTACT_EMAIL, CONTROLLER } from "../_site/site";

export const metadata = { title: "Privacy notice" };

/**
 * The UK GDPR privacy notice. Every line restates something the database or
 * the code does (rules 1, 19, 23, 32, 33, 37, 42 in CLAUDE.md). Change a rule,
 * change its line here in the same commit.
 */

const mail = (subject: string) => `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}`;

function Table({ rows }: { rows: [string, string, string][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] border-collapse text-left text-[0.95rem]">
        <thead>
          <tr className="border-b border-line text-paper">
            <th className="py-2 pr-4 font-semibold">What for</th>
            <th className="py-2 pr-4 font-semibold">What we use</th>
            <th className="py-2 font-semibold">Lawful basis</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([a, b, c]) => (
            <tr key={a} className="border-b border-line-soft align-top">
              <td className="py-3 pr-4 text-paper">{a}</td>
              <td className="py-3 pr-4">{b}</td>
              <td className="py-3">{c}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function PrivacyPage() {
  return (
    <Legal
      title="Privacy notice"
      updated="9 October 2026"
      intro={
        <>
          <p>
            The short version: what you write for yourself is readable by you alone, enforced by the database. We
            don&apos;t sell data, we don&apos;t run trackers, and advertisers never learn who you are. You can take a
            copy of everything, or delete your account, from Settings → Your data, at any time.
          </p>
          <p className="mt-4">
            The long version follows. It&apos;s written to meet the UK GDPR and the Data Protection Act 2018.
          </p>
        </>
      }
      sections={[
        {
          h: "Who we are",
          body: (
            <>
              <p>
                {CONTROLLER.name} is the data controller for Sovereign. Contact us about anything in this notice at{" "}
                <a href={mail("Privacy")} className="text-gold hover:underline">
                  {CONTACT_EMAIL}
                </a>
                .
              </p>
              {CONTROLLER.icoRegistration ? (
                <p>Registered with the Information Commissioner&apos;s Office: {CONTROLLER.icoRegistration}.</p>
              ) : null}
            </>
          ),
        },
        {
          h: "Sensitive data, and why we ask for explicit consent",
          body: (
            <>
              <p>
                Sovereign can&apos;t work without data the law treats as special category. Every response to a
                proposal is a <strong className="text-paper">political opinion</strong>. What you write about faith,
                values and beliefs is <strong className="text-paper">religious or philosophical belief</strong>. Your
                journal may hold anything, including your <strong className="text-paper">health</strong>.
              </p>
              <p>
                We process all of this on the basis of your explicit consent (UK GDPR Article 9(2)(a)), which we ask
                for in plain words before you start and record with the date and the wording you agreed to. You must
                be 18 or over to use Sovereign.
              </p>
            </>
          ),
        },
        {
          h: "What we collect",
          body: (
            <ul>
              <li>Your email address, to sign you in with a link. There is no password.</li>
              <li>Your profile: name, handle, bio, and the places you say you belong to (no GPS, no coordinates).</li>
              <li>What you write for yourself: journal, ideas, to-dos, values, beliefs, Know yourself answers, notes.</li>
              <li>What you do in shared spaces: proposals, responses, debate, flags, predictions, projects, posts, comments, likes and messages.</li>
              <li>Your agreement to the ten Universal Laws and your consent record.</li>
              <li>If you prove you&apos;re one person: one opaque code from the verifier. No name, document, photo or biometric reaches us.</li>
              <li>If you run a business: what you tell us about it, your website check and, for UK companies, the public Companies House record.</li>
              <li>If you advertise: your campaigns, clicks and spend.</li>
            </ul>
          ),
        },
        {
          h: "What we use it for, and the lawful basis",
          body: (
            <Table
              rows={[
                ["Running your account and the app", "Email, profile, everything you write and do", "Contract (Art 6(1)(b)), and explicit consent for special category data (Art 9(2)(a))"],
                ["Collective decisions", "Proposals, responses, debate, the record of decisions", "Contract, and explicit consent"],
                ["Your private AI and Know yourself", "What you write for yourself, at the moment you ask", "Contract, and explicit consent"],
                ["Choosing the one sponsored slot", "Your values, matched against a business's words when you look — not stored", "Contract, and explicit consent"],
                ["Keeping the collective record after you leave", "Proposals, responses and debate, no longer linked to you", "Legitimate interests: decisions others relied on must stay true"],
                ["Vetting businesses", "Business details, website check, Companies House record", "Contract with the business"],
                ["Security and preventing abuse", "Sign-in records, technical logs kept by our hosts", "Legitimate interests"],
                ["Legal and tax records for advertisers", "Invoices and payments, once billing starts", "Legal obligation"],
              ]}
            />
          ),
        },
        {
          h: "Who can read it",
          body: (
            <>
              <p>
                Your journal, ideas, drafts, to-dos, values, Know yourself and learning are readable by you alone.
                That&apos;s a rule in the database, not a setting. Drafts of proposals stay on your device until you
                submit.
              </p>
              <p>
                Posts, proposals and what you say in a group or place can be read by the people it&apos;s for, and
                every screen says who that is. Nobody can see who you follow or who follows you, whether you&apos;ve
                read their messages, who you&apos;ve muted, or your SOV.
              </p>
              <p>
                Advertisers see clicks and spend. Never who clicked, never your values, never why an ad was shown to
                you.
              </p>
            </>
          ),
        },
        {
          h: "AI and automated decisions",
          body: (
            <>
              <p>
                Proposals, posts and businesses are read by AI against the ten Universal Laws. A proposal that breaks a
                law ends; a post below the bar isn&apos;t published. Every reading that decides something is signed,
                published with its reasons, and can be challenged — a challenge re-runs it. A business is only approved
                when a person signs the reading off.
              </p>
              <p>
                If you think an automated reading got something wrong about you, tell us at{" "}
                <a href={mail("AI decision")} className="text-gold hover:underline">
                  {CONTACT_EMAIL}
                </a>{" "}
                and a person will look at it.
              </p>
              <p>
                When you use an AI feature, the text involved is sent to our AI provider to produce the answer. It
                isn&apos;t used to train their models or to build a profile of you.
              </p>
            </>
          ),
        },
        {
          h: "Who processes it for us",
          body: (
            <>
              <ul>
                <li>Supabase — database, sign-in and sign-in emails.</li>
                <li>Vercel — hosting the app and the website.</li>
                <li>Anthropic — the AI features, when they are switched on.</li>
                <li>A personhood verifier — only if you choose to prove you&apos;re one person; we receive one code.</li>
              </ul>
              <p>
                Each works under a data processing agreement and only on our instructions. Some are based in, or use
                servers in, the United States. Where data leaves the UK we rely on the UK–US data bridge for certified
                providers, or the UK International Data Transfer Addendum otherwise.
              </p>
            </>
          ),
        },
        {
          h: "How long we keep it",
          body: (
            <>
              <p>
                Everything is kept while your account exists. When you delete your account, everything that is yours
                alone is deleted at once: email and sign-in, profile, journal, ideas, values, beliefs, Know yourself,
                to-dos, learning, posts, comments, likes, messages you wrote, follows, friendships, your personhood
                code, any business you own, and your group memberships.
              </p>
              <p>
                The collective record — proposals, responses, debate, flags, predictions, decisions, projects and SOV
                entries — is kept, shown as written by a &ldquo;Former member&rdquo;, and no longer linked to your
                email or name. A decision is a record of what people said when it closed; removing a response
                afterwards would make it untrue. Deleted data leaves our hosts&apos; backups as they roll over.
              </p>
            </>
          ),
        },
        {
          h: "Cookies",
          body: (
            <p>
              Only the ones Sovereign needs to work: keeping you signed in, your light or dark choice, and which group
              you&apos;re looking at. No analytics, no advertising cookies, no third-party trackers. Fonts are served
              from Sovereign itself, so loading a page tells no one else you visited.
            </p>
          ),
        },
        {
          h: "Your rights",
          body: (
            <>
              <p>You have the right to:</p>
              <ul>
                <li>
                  <strong className="text-paper">Get a copy</strong> of your data — instantly, from Settings → Your data.
                </li>
                <li>
                  <strong className="text-paper">Delete</strong> your account — instantly, from the same screen.
                </li>
                <li>
                  <strong className="text-paper">Correct</strong> anything wrong — most of it you can edit yourself.
                </li>
                <li>
                  <strong className="text-paper">Withdraw consent</strong>. Because nearly everything in Sovereign is a
                  political opinion or belief, withdrawing means deleting your account.
                </li>
                <li>
                  <strong className="text-paper">Object to or restrict</strong> how we use your data, and take it to
                  another service (the copy is a standard JSON file).
                </li>
              </ul>
              <p>
                For anything you can&apos;t do in the app, email{" "}
                <a href={mail("Data request")} className="text-gold hover:underline">
                  {CONTACT_EMAIL}
                </a>
                . We reply within one month.
              </p>
            </>
          ),
        },
        {
          h: "Complaints",
          body: (
            <p>
              If you&apos;re unhappy with how we&apos;ve handled your data, tell us first at{" "}
              <a href={mail("Complaint")} className="text-gold hover:underline">
                {CONTACT_EMAIL}
              </a>
              . We&apos;ll acknowledge it within 30 days and tell you what we&apos;ve done. If you&apos;re still not
              satisfied, you can complain to the Information Commissioner&apos;s Office at{" "}
              <a href="https://ico.org.uk/make-a-complaint/" className="text-gold hover:underline">
                ico.org.uk/make-a-complaint
              </a>
              .
            </p>
          ),
        },
        {
          h: "Changes",
          body: (
            <p>
              If we change what we collect or why, we&apos;ll update this notice and tell you in the app. If the
              change needs new consent, we&apos;ll ask before going further. See also our{" "}
              <Link href="/explore/terms" className="text-gold hover:underline">
                terms
              </Link>
              .
            </p>
          ),
        },
      ]}
    />
  );
}
