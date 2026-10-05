import Link from "next/link";

/**
 * The top-right of every tab: "+" to start whatever that tab is for, and
 * settings. Same two buttons in the same place everywhere, so nobody has to
 * learn a tab before they can begin in it.
 */
export function TabActions({ plus, plusLabel }: { plus: string; plusLabel: string }) {
  return (
    <div className="flex items-center">
      <Link
        href={plus}
        aria-label={plusLabel}
        title={plusLabel}
        className="press flex h-10 w-10 items-center justify-center rounded-full text-gold active:bg-surface"
      >
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden>
          <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" />
        </svg>
      </Link>
      <Link
        href="/settings"
        aria-label="Settings"
        title="Settings"
        className="press flex h-10 w-10 items-center justify-center rounded-full text-paper-dim active:bg-surface"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden>
          <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.75" />
          <path
            d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </svg>
      </Link>
    </div>
  );
}

/** A chat-bubble link, for Home's way into chats. */
export function ChatsLink() {
  return (
    <Link
      href="/individual/chats"
      aria-label="Chats"
      title="Chats"
      className="press flex h-10 w-10 items-center justify-center rounded-full text-paper-dim active:bg-surface"
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden>
        <path
          d="M4 5.5h16v10H9l-5 4v-14z"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinejoin="round"
        />
      </svg>
    </Link>
  );
}
