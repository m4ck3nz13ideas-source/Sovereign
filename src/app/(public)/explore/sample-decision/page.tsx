import { CtaBand, PageHero, Section } from "../_site/blocks";
import { pageMeta } from "../_site/site";
import { Walkthrough } from "./Walkthrough";

export const metadata = pageMeta("sample-decision");

/**
 * A guided, illustrative decision (brief of 13 October 2026, §3.4).
 *
 * Everything on this page is invented and says so: no real place, people or
 * responses, and nothing is sent or saved. It follows the stages a proposal
 * really goes through in the app, with the rules that apply at each one, and
 * it shows a split and a disappointing outcome rather than a clean win.
 */
export default function SampleDecisionPage() {
  return (
    <>
      <PageHero
        eyebrow="Sample decision"
        title="One decision, start to finish."
        lead="A neighbourhood with £12,000 and two things it needs. Step through how Sovereign takes it from a problem to a decision, to action, to an honest review."
      />
      <Section>
        <Walkthrough />
      </Section>
      <CtaBand title="Bring a real decision." lead="Your group, your rules, the same process." />
    </>
  );
}
