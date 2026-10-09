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
        a: "One app for your private thinking, an honest social feed, a market of verified businesses and a fair way for groups to decide and act. Instead of voting for people every few years, you respond to ideas as they come up — at the scale they belong to, from your street to the planet.",
      },
      {
        q: "Who is it for?",
        a: "Anyone who wants a say in what happens around them, and any group that has to decide something together — a street, a club, a co-op, a team. Before it opens to everyone in 2027, it is being made ready for a founding group of fifty.",
      },
      {
        q: "How much does it cost?",
        a: "Nothing, for people. Sovereign is paid for by aligned businesses, who pay per click to advertise. Paying never buys approval or the top slot.",
      },
      {
        q: "Is it a political party?",
        a: "No. There are no candidates and nobody to elect. Sovereign is a way of deciding, bound by ten Universal Laws that apply to everyone equally.",
      },
    ],
  },
  {
    title: "Privacy and trust",
    items: [
      {
        q: "Who can read what I write?",
        a: "Your journal, ideas, drafts and to-dos are readable by you alone — that is a rule in the database, not a setting. Drafts of proposals never leave your device until you submit. Every screen says who can read it.",
      },
      {
        q: "Do you sell my data?",
        a: "No. Advertisers see clicks and spend. They never see who clicked, what you value, or why an ad was shown to you.",
      },
      {
        q: "Why would I trust the AI?",
        a: "You don't have to. Every AI reading that decides something is signed by the server, published with its reasons, and can be challenged by anyone. A challenge re-runs the reading; nobody can quietly edit one.",
      },
      {
        q: "How do you know I'm a real person?",
        a: "At the widest scales — national and up — each voice must belong to a distinct living person. The check proves that and stores one opaque code. No name, document, photo or biometric is kept. It is never needed to read, write or take part in a group.",
      },
    ],
  },
  {
    title: "Deciding",
    items: [
      {
        q: "How does a proposal pass?",
        a: "It is read against the ten laws first; a violation ends it. The AI then sets what this proposal needs — how many voices, which groups must be reached, what must be answered on the record. People respond with how aligned, confident and urgent they are. It passes when those conditions are met and alignment clears the threshold.",
      },
      {
        q: "Why can't I see how others voted?",
        a: "Because a live tally makes people follow the crowd. You see how many have responded; the lean is shown when it closes, along with how split it was.",
      },
      {
        q: "Can one person block a proposal?",
        a: "No. Concerns are answered in writing and challenges are for debate. Neither can stall a decision. Only a broken law can stop one.",
      },
      {
        q: "What happens after something passes?",
        a: "It becomes a project with the people who said they'd help. When it's done, what actually happened is recorded against what was predicted, so the next decision is better.",
      },
    ],
  },
  {
    title: "Market and business",
    items: [
      {
        q: "Which businesses are in the Market?",
        a: "Only ones that proved they own their website, were read against all ten laws with no violation, and were signed off by a person. Change your listing and approval lapses until it's read again.",
      },
      {
        q: "How does advertising work?",
        a: "Pay per click. The one sponsored slot goes to the business that best fits the person looking, using the values they wrote for themselves. Your bid only breaks ties.",
      },
      {
        q: "What is SOV?",
        a: "Sovereign's contribution record. It is minted for finished acts — a project completed, a question answered, a prediction marked — not for posting or scrolling. Today it is a simulation, and every screen that shows it says so.",
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
