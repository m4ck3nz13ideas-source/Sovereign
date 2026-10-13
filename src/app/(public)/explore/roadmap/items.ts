import type { CapabilityStatus } from "@/lib/capabilities";

/**
 * The public roadmap, in the three states every page uses (lib/capabilities):
 * Current is in the app today and working as described; In testing is built
 * but not yet fully switched on in production, and says what is missing;
 * Planned is a plan. Nothing moves to Current until it is true in production.
 */
export interface RoadmapItem {
  title: string;
  detail: string;
}

export const ROADMAP: { stage: string; status: CapabilityStatus; lead: string; items: RoadmapItem[] }[] = [
  {
    stage: "Current",
    status: "current",
    lead: "In the app today.",
    items: [
      { title: "Conditions per proposal", detail: "Voices needed, groups to reach, questions to answer. Public, with reasons." },
      { title: "Secret ballots, open tallies", detail: "Every response visible after close. Nobody sees whose." },
      { title: "Shareable decisions", detail: "One public link per decision. Outcome and numbers, never names." },
      { title: "For you, Following, Discover", detail: "Three feeds at every scale. Time order, with the reason each item is there." },
      { title: "You choose who a post is for", detail: "People near you, or as far as everyone. Fixed once posted." },
      { title: "Feed, likes and chats", detail: "Chats one to one, with circles, groups and proposal backers. No read receipts." },
      { title: "Group and business pages", detail: "Purpose, shared values and a feed for every group and business." },
      { title: "SOV simulation", detail: "Earned by finished acts, never by posting. Labelled a simulation." },
      { title: "Spheres", detail: "Health, education, ecology and five more. Tag proposals, rate what matters to you." },
      { title: "Know yourself and Learn", detail: "Needs, values, beliefs, goals. Courses shaped by your answers." },
      { title: "Verified Market", detail: "Website proven, ten laws read, signed off by a person." },
      { title: "Your data, yours", detail: "Consent first. A full copy or a full deletion, any time." },
    ],
  },
  {
    stage: "In testing",
    status: "testing",
    lead: "Built. Not yet fully switched on.",
    items: [
      {
        title: "AI readings by a real model",
        detail: "Proposals, posts and businesses are read against the ten laws today by an offline stand-in that judges structure, not meaning — and every reading says so. A model is switched on when funding allows.",
      },
      {
        title: "Signed law audits",
        detail: "Ten signed readings of the exact current text, refused if forged or stale. Built and tested; not yet deployed to the live database.",
      },
      {
        title: "Proof of personhood",
        detail: "One person, one voice at national scale and above. Nothing stored about who. Built; not confirmed switched on.",
      },
    ],
  },
  {
    stage: "Planned",
    status: "planned",
    lead: "For the founding 50, then before opening in 2027.",
    items: [
      { title: "Payments held until work is approved", detail: "Pay in the app. The money moves when you confirm the work." },
      { title: "Budget envelopes", detail: "Say where shared money goes, Sphere by Sphere." },
      { title: "Encrypted private space", detail: "Journal, ideas and values encrypted on your device. We store what we cannot read." },
      { title: "Ballots secret from us too", detail: "Proof you responded once, with nothing linking the response to you." },
      { title: "Your own data vault", detail: "Identity and data held by you, shared by consent." },
      { title: "Open to 16 and 17 year olds", detail: "Stronger privacy defaults, after a risk assessment." },
      { title: "Open to everyone", detail: "Once the founding 50 have shaped it." },
    ],
  },
];
