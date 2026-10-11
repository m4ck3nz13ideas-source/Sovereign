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
    id: "home",
    name: "Home",
    short: "True or useful posts, in time order. Likes that never rank. Chats without read receipts.",
    icon: <Icon d="M3 11l9-7 9 7v9H3z" />,
  },
  {
    id: "search",
    name: "Search",
    short: "Ask anything. Contested questions return every side, never one verdict.",
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
