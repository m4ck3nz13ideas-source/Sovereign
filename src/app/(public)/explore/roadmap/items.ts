/**
 * The public roadmap. "Live" means it is in the app today; nothing moves into
 * that column until it is. "Next" and "Later" are plans, and say so.
 */
export interface RoadmapItem {
  title: string;
  detail: string;
}

export const ROADMAP: { stage: string; live: boolean; lead: string; items: RoadmapItem[] }[] = [
  {
    stage: "Live now",
    live: true,
    lead: "In the app today.",
    items: [
      { title: "Proposals read against ten laws", detail: "Every proposal, before anyone responds. A violation ends it." },
      { title: "Conditions per proposal", detail: "Voices needed, groups to reach, questions to answer. Public, with reasons." },
      { title: "Secret ballots, open tallies", detail: "Every response visible after close. Nobody sees whose." },
      { title: "Shareable decisions", detail: "One public link per decision. Outcome and numbers, never names." },
      { title: "For you, Following, Discover", detail: "Three feeds at every scale. Time order, with the reason each item is there." },
      { title: "You choose who a post is for", detail: "People near you, or as far as everyone. Fixed once posted." },
      { title: "Feed, likes and chats", detail: "Posts checked at the door. Chats one to one, with friends, groups and proposal backers. No read receipts." },
      { title: "SOV simulation", detail: "Earned by finished acts, never by posting. Labelled a simulation." },
      { title: "Spheres", detail: "Health, education, ecology and five more. Tag proposals, rate what matters to you." },
      { title: "Know yourself and Learn", detail: "Needs, values, beliefs, goals. Courses shaped by your answers." },
      { title: "Verified Market", detail: "Website proven, ten laws checked, signed off by a person." },
      { title: "Your data, yours", detail: "Consent first. A full copy or a full deletion, any time." },
    ],
  },
  {
    stage: "Next",
    live: false,
    lead: "For the founding 50.",
    items: [
      { title: "Payments held until work is approved", detail: "Pay in the app. The money moves when you confirm the work." },
      { title: "Proof of personhood", detail: "One person, one voice at the widest scales. Nothing stored about who." },
      { title: "Budget envelopes", detail: "Say where shared money goes, Sphere by Sphere." },
    ],
  },
  {
    stage: "Later",
    live: false,
    lead: "Before opening in 2027.",
    items: [
      { title: "Encrypted private space", detail: "Journal, ideas and values encrypted on your device. We store what we cannot read." },
      { title: "Ballots secret from us too", detail: "Proof you responded once, with nothing linking the response to you." },
      { title: "Your own data vault", detail: "Identity and data held by you, shared by consent." },
      { title: "Open to 16 and 17 year olds", detail: "Stronger privacy defaults, after a risk assessment." },
      { title: "Open to everyone", detail: "Once the founding 50 have shaped it." },
    ],
  },
];
