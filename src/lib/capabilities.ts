/**
 * What Sovereign can do today, said once.
 *
 * Three states, and only three:
 *
 *   current  — in the app now, for anyone signed in, working as described.
 *   testing  — built, but not yet doing everything the description promises
 *              in production (switched off, waiting on a deploy, or running
 *              on a stand-in). The `note` says which.
 *   planned  — not built. A plan, not a feature.
 *
 * The public site (home, roadmap, trust), and the first-run notes in the app
 * read this list, so they cannot disagree. Move an item to `current` only in
 * the commit that makes it true in production, and say how you checked.
 */

export type CapabilityStatus = "current" | "testing" | "planned";

export const STATUS_LABEL: Record<CapabilityStatus, string> = {
  current: "Current",
  testing: "In testing",
  planned: "Planned",
};

export const STATUS_MEANING: Record<CapabilityStatus, string> = {
  current: "In the app today, working as described.",
  testing: "Built, but not yet fully switched on in production. The note says what is missing.",
  planned: "Not built yet. A plan, not a promise.",
};

export interface Capability {
  title: string;
  detail: string;
  status: CapabilityStatus;
  /** For `testing`: exactly what is not yet true in production. */
  note?: string;
}

/** The five spaces, as a first-time visitor would ask about them. */
export interface Space {
  id: "individual" | "connection" | "search" | "market" | "collective";
  name: string;
  /** One line: what the space is for. */
  purpose: string;
  /** The one thing to do first. */
  firstAction: string;
  /** Where that first action lives in the app. */
  href: string;
  can: Capability[];
}

export const SPACES: Space[] = [
  {
    id: "individual",
    name: "Individual",
    purpose: "Your private space: journal, ideas, to-dos, values and what you are learning. Readable by you alone.",
    firstAction: "Write one private note. Nobody else can read it.",
    href: "/write",
    can: [
      { title: "Private journal, ideas and to-dos", detail: "Owner-only, by database rule. You choose what, if anything, to share.", status: "current" },
      { title: "Know yourself and Learn", detail: "Needs, values, beliefs and goals, with lessons shaped by your answers. Optional.", status: "current" },
      {
        title: "Your private AI guardian",
        detail: "Talks through your own notes with you, when you ask.",
        status: "testing",
        note: "No AI model is connected yet. Answers come from an offline stand-in and say so.",
      },
      { title: "SOV", detail: "A record of finished contributions. A simulation, labelled as one. Not money, not a token.", status: "current" },
    ],
  },
  {
    id: "connection",
    name: "Connection",
    purpose: "The people you are joined to: friends, group chats, your groups, the proposals you back and businesses you follow.",
    firstAction: "Start a chat with a friend, or open one of your groups.",
    href: "/connection",
    can: [
      { title: "Chats with friends and circles", detail: "One to one and small circles. No read receipts, no online status.", status: "current" },
      { title: "Group and proposal chats", detail: "Members of a group, or the author and backers of a proposal.", status: "current" },
      { title: "Group pages", detail: "Purpose, the values members share, and the group's feed, visible to members.", status: "current" },
    ],
  },
  {
    id: "search",
    name: "Search",
    purpose: "Look things up, post, and see what people near you are proposing, deciding and saying — each item with the reason it is there.",
    firstAction: "Rate which Spheres matter to you, so For you fills with what touches them.",
    href: "/home?feed=foryou",
    can: [
      { title: "Three feeds", detail: "For you, Following and Discover. Time order; likes never rank anything.", status: "current" },
      { title: "Posts, likes and comments", detail: "You choose who each post is for, and it cannot be widened afterwards.", status: "current" },
      {
        title: "Search answered from different ways of knowing",
        detail: "Positions from several perspectives, not one answer.",
        status: "testing",
        note: "Runs on the offline stand-in until an AI model is connected.",
      },
      { title: "Find a person", detail: "By their exact handle only. There is no directory of people, on purpose.", status: "current" },
    ],
  },
  {
    id: "market",
    name: "Market",
    purpose: "Businesses that proved their website is theirs and passed the ten laws, signed off by a person. Buying links out to their site.",
    firstAction: "Browse the listed businesses, or apply to list your own.",
    href: "/market",
    can: [
      { title: "Verified listings", detail: "Website proven, read against the ten laws, signed off by a person.", status: "current" },
      {
        title: "Reviews of businesses by AI",
        detail: "Each listing is read against the laws before a person signs it off.",
        status: "testing",
        note: "The reading is from the offline stand-in until an AI model is connected; the human sign-off is real.",
      },
      { title: "One sponsored slot, chosen by fit", detail: "The best-aligned business for you; bids only break ties.", status: "current" },
      { title: "Pay in the app, held until work is approved", detail: "Escrowed payments.", status: "planned" },
    ],
  },
  {
    id: "collective",
    name: "Collective",
    purpose: "Decide together: propose, align against the laws, respond in secret, act on what passes, and reflect on how it went.",
    firstAction: "Open a proposal and read it. You can respond only after reading.",
    href: "/collective/proposals",
    can: [
      { title: "Proposals with their own conditions", detail: "How many voices, which groups must be reached, which questions answered — public, with reasons. Meeting them lets a proposal be decided; the responses decide whether it passes.", status: "current" },
      { title: "Secret ballots, open tallies", detail: "After close, every response's numbers without names. A split is reported as a split.", status: "current" },
      { title: "Projects and reflections", detail: "What passes becomes a project; it cannot complete without a written reflection.", status: "current" },
      { title: "Shareable decisions", detail: "One public link per decision: outcome and numbers, never names.", status: "current" },
      {
        title: "Universal Law reading of every proposal",
        detail: "Each proposal is read against the ten laws before anyone responds. A violation ends it.",
        status: "testing",
        note: "Readings come from the offline stand-in, which judges structure, not meaning, and says so on every reading.",
      },
      {
        title: "Proof of personhood at wide scales",
        detail: "National scale and above: one living person, one voice. One opaque code stored.",
        status: "testing",
        note: "Built. Not confirmed switched on in production, so wide-scale proposals may not be able to pass yet.",
      },
    ],
  },
];

/** The safeguards a visitor can check, with honest states. */
export const SAFEGUARDS: Capability[] = [
  {
    title: "Private by database rule",
    detail: "Your journal, ideas, values and to-dos have owner-only row-level security. Other members cannot read them, whatever the screen does.",
    status: "current",
  },
  {
    title: "Secret ballots",
    detail: "Only you can read your own response. After close the group sees every response's numbers and notes without names.",
    status: "current",
  },
  {
    title: "Understanding before action",
    detail: "The database refuses a response from anyone who has not opened the proposal.",
    status: "current",
  },
  {
    title: "Tamper-evident record",
    detail: "Decisions are written to a hash-chained record in Postgres, so an edited or deleted entry shows. It is not a blockchain and not trustless: whoever runs the database could still rewrite it, but not silently.",
    status: "current",
  },
  {
    title: "Your data, exportable and deletable",
    detail: "Settings → Your data: a full JSON copy, or a full deletion, any time.",
    status: "current",
  },
  {
    title: "Signed Universal Law audits",
    detail: "Every law reading signed by the server, exactly ten readings of the current text, and a fresh audit required when the text changes. Unsigned or stale readings refused.",
    status: "testing",
    note: "Built and tested, not yet deployed to the live database. Until it is, readings are not signed.",
  },
  {
    title: "A real AI model reading proposals",
    detail: "Assessments by an AI model, published with reasons and open to challenge.",
    status: "testing",
    note: "Switched off. An offline stand-in runs instead and every reading says no model read it.",
  },
  {
    title: "An encrypted private space",
    detail: "Your private writing encrypted on your device, with a key only you hold.",
    status: "planned",
  },
  {
    title: "Ballots secret from Sovereign too",
    detail: "A response recorded with proof it was cast once, and nothing linking it to who.",
    status: "planned",
  },
];
