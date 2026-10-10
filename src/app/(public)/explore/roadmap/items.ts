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
      { title: "Proposals checked against the ten laws", detail: "Every proposal is read against all ten before anyone responds. A violation ends it." },
      { title: "Conditions set per proposal", detail: "How many voices, which groups must be reached and what must be answered — set for each proposal, in public, with reasons." },
      { title: "Know yourself", detail: "Needs, values, beliefs and goals, at the centre of your private AI." },
      { title: "Verified Market", detail: "Businesses prove their website, are read against the laws and signed off by a person. Ads go to the best fit." },
      { title: "Home feed, likes and chats", detail: "Time order, posts checked at the door, chats with no read receipts." },
      { title: "SOV simulation", detail: "Balances, transfers and minting for finished acts. A simulation, and labelled as one." },
      { title: "For you, Following, Discover", detail: "Three feeds at every scale. For you shows what touches the Spheres you rated most important, newest first, with the reason it's there." },
      { title: "You choose who a post is for", detail: "People around you by default, or your region, nation, continent or everyone. Fixed once posted." },
      { title: "Secret ballots, open tallies", detail: "Everyone sees every response's numbers and notes once a proposal closes. Nobody sees whose is whose." },
      { title: "Your data, yours to take or delete", detail: "Explicit consent before anything sensitive is collected. A full copy, or deleting your account, at any time." },
    ],
  },
  {
    stage: "Next",
    live: false,
    lead: "Being built for the founding 50.",
    items: [
      { title: "Spheres", detail: "Proposals tagged by the areas of life they touch — health, education, ecology and more — with follows and filters." },
      { title: "Learn", detail: "Courses on how Sovereign works and the ten laws, plus lessons shaped by your Know yourself results." },
      { title: "Payments held until work is approved", detail: "Pay a business in the app; the money is released when you confirm the work." },
      { title: "Proof of personhood", detail: "One person, one voice at the widest scales — proving you're a distinct human without storing who you are." },
    ],
  },
  {
    stage: "Later",
    live: false,
    lead: "On the way to opening in 2027.",
    items: [
      { title: "Encrypted private space", detail: "Your journal, ideas and values encrypted on your device. Sovereign stores what it cannot read." },
      { title: "Ballots secret from us too", detail: "Proof that an eligible person responded once, with nothing linking the response to who." },
      { title: "Your own data vault", detail: "Identity and data held by you and shared by consent — the whitepaper's Individual Chain." },
      { title: "Open to 16 and 17 year olds", detail: "With stronger privacy defaults for them, after a proper risk assessment." },
      { title: "Budget envelopes", detail: "Say where shared money goes, sphere by sphere, the way tax could be allocated." },
      { title: "Sovereign-run escrow", detail: "Held payments moved onto Sovereign's own ledger." },
      { title: "Open to everyone", detail: "After the founding 50 have shaped it." },
    ],
  },
];
