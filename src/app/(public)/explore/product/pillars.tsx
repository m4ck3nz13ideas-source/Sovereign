import type { ReactNode } from "react";

/** The five tabs, as the public site names them. One list, used by Home and Product. */

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

export const PILLARS: { id: string; name: string; short: string; icon: ReactNode }[] = [
  {
    id: "individual",
    name: "Individual",
    short: "Journal, ideas, vault and a private AI that knows your values. Only you can read it.",
    icon: <Icon d="M12 12a4 4 0 100-8 4 4 0 000 8zM4 20a8 8 0 0116 0" />,
  },
  {
    id: "connection",
    name: "Connection",
    short: "Friends, group chats, your groups, the proposals you back. No read receipts, no follower counts.",
    icon: <Icon d="M12 8.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM6 20a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM18 20a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM10.8 8.2l-3.6 7M13.2 8.2l3.6 7M8.5 17.5h7" />,
  },
  {
    id: "search",
    name: "Search",
    short: "Search anything, post, and see the feed. Every side of a question, never one verdict.",
    icon: <Icon d="M11 18a7 7 0 100-14 7 7 0 000 14zM21 21l-5-5" />,
  },
  {
    id: "market",
    name: "Market",
    short: "Businesses proven real, checked against ten laws, signed off by a person.",
    icon: <Icon d="M4 7h16l-1.5 12h-13zM9 7V5a3 3 0 016 0v2" />,
  },
  {
    id: "collective",
    name: "Collective",
    short: "Propose. Weigh. Act. From your street to the planet.",
    icon: <Icon d="M8 12a3 3 0 100-6 3 3 0 000 6zM16 12a3 3 0 100-6 3 3 0 000 6zM2 20a6 6 0 0112 0M10 20a6 6 0 0112 0" />,
  },
];
