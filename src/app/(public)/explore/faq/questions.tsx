import type { ReactNode } from "react";

type QA = { q: string; a: ReactNode };

/**
 * Every answer here must be true of the app today, or say plainly that it is
 * planned. If a rule in CLAUDE.md changes, the answer that restates it changes
 * in the same commit.
 */
export const FAQ_GROUPS: { title: string; items: QA[] }[] = [
  {
    title: "The basics",
    items: [
      {
        q: "What is Sovereign?",
        a: "One app to think in private, post honestly and decide together, with a market of verified businesses. You respond to ideas as they come up, at the scale they belong to — not to candidates every few years.",
      },
      {
        q: "Who is it for?",
        a: "Anyone who wants a say, and any group that decides together: a street, a club, a co-op. Fifty founding members first; everyone in 2027.",
      },
      {
        q: "How much does it cost?",
        a: "Nothing, for people. Aligned businesses pay per click to advertise. Money never buys approval or the top slot.",
      },
      {
        q: "Can under-18s join?",
        a: "Not yet. Sovereign is 18+ for now. We plan to open to 16 and 17 year olds in 2027, with stronger privacy defaults.",
      },
      {
        q: "Is it a political party?",
        a: "No. No candidates, nobody to elect. A way of deciding, bound by ten laws that apply to everyone.",
      },
    ],
  },
  {
    title: "Privacy and trust",
    items: [
      {
        q: "Who can read what I write?",
        a: "Your journal, ideas and to-dos: you alone, by database rule, not setting. Proposal drafts stay on your device until you submit. Every screen says who can read it.",
      },
      {
        q: "Can I take my data with me, or delete it?",
        a: "Yes, both, from Settings → Your data. Deleting removes everything that is yours alone. Proposals, responses and debate stay in the record others relied on, credited to a former member, no longer linked to you.",
      },
      {
        q: "Can anyone see how I voted?",
        a: "No. After close, the group sees every response's numbers and notes, without names. That you responded is on the record; how is not.",
      },
      {
        q: "Can Sovereign read my private notes?",
        a: "Other people can't: the database enforces it. Whoever runs the database technically could, and we don't look. An encrypted space, keyed to your device, is on the roadmap to make that impossible, not a promise.",
      },
      {
        q: "Do you sell my data?",
        a: "No. Advertisers see clicks and spend. They never see who clicked, what you value, or why an ad was shown to you.",
      },
      {
        q: "Why would I trust the AI?",
        a: "You don't have to. Every AI reading that decides anything is signed, published with reasons, and open to challenge. A challenge re-runs it; nobody can quietly edit one.",
      },
      {
        q: "How do you know I'm a real person?",
        a: "At national scale and up, each voice must be a distinct living person. The check stores one opaque code: no name, document, photo or biometric. Never needed to read, write or join a group.",
      },
    ],
  },
  {
    title: "Deciding",
    items: [
      {
        q: "How does a proposal pass?",
        a: "Three stages. Checked: read against ten laws; a violation ends it. Conditioned: the AI sets the voices needed, groups to reach and questions to answer. Decided: people respond with alignment, confidence and urgency, and it passes when the conditions are met and alignment clears the threshold.",
      },
      {
        q: "Why can't I see how others voted?",
        a: "A live tally makes people follow the crowd. You see how many responded; the lean appears at close, with how split it was.",
      },
      {
        q: "Can one person block a proposal?",
        a: "No. Concerns get written answers; challenges are debate. Neither stalls a decision. Only a broken law stops one.",
      },
      {
        q: "What happens after something passes?",
        a: "It becomes a project, staffed by the people who offered. When it is done, the outcome is marked against the prediction, so the next decision improves.",
      },
      {
        q: "Can I share a decision?",
        a: "Yes. A steward, or the author of a proposal to a place, can make one public link: outcome, numbers and rationale. Never names, responses or notes. Under five voices, the averages stay private too.",
      },
    ],
  },
  {
    title: "Market and business",
    items: [
      {
        q: "Which businesses are in the Market?",
        a: "Only those that proved their website, passed all ten laws, and were signed off by a person. Edit a listing and approval lapses until it is read again.",
      },
      {
        q: "How does advertising work?",
        a: "Pay per click. The one sponsored slot goes to the best fit for the person looking, by the values they wrote. Bids only break ties.",
      },
      {
        q: "What is SOV?",
        a: "Sovereign's contribution record, minted for finished acts — a project completed, a question answered, a prediction marked. Never for posting. A simulation for now, and labelled as one.",
      },
    ],
  },
];

export const FAQ_HOME: QA[] = [
  FAQ_GROUPS[0].items[2],
  FAQ_GROUPS[1].items[0],
  FAQ_GROUPS[2].items[1],
  FAQ_GROUPS[0].items[3],
];
