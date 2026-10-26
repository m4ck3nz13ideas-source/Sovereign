/**
 * The map of the signed-in app, for the AI that helps people find their way
 * around (23 October). Each place is a page anybody can open, what it is for
 * in a line, and the words people are likely to use when looking for it.
 *
 * Only pages with a fixed address are here — a particular proposal, chat or
 * business is reached from its list. If a page is added or moved, add or move
 * it here too, or the AI will keep sending people to the old address.
 */

export interface Place {
  path: string;
  name: string;
  what: string;
  words: string[];
}

export const PLACES: Place[] = [
  // Individual — the I
  { path: "/individual", name: "Individual", what: "Your private space and profile.", words: ["me", "my profile", "private", "individual"] },
  { path: "/individual/self", name: "Self", what: "What you know about yourself, at a glance: Know yourself, what matters to you, your record and your values.", words: ["self", "about me"] },
  { path: "/individual/self/findings", name: "Know yourself results", what: "Your focus, what drives you, beliefs to change and goals.", words: ["my results", "findings", "my focus", "what drives me"] },
  { path: "/individual/self/matters", name: "What matters", what: "Rate how much each Sphere matters to you.", words: ["spheres", "matters", "ratings", "priorities"] },
  { path: "/individual/self/record", name: "Your record", what: "Your personal dashboard: notes, to dos, responses and proposals.", words: ["my record", "my stats", "dashboard", "my activity"] },
  { path: "/individual/self/know", name: "Know yourself", what: "The beliefs, values and goals test. Your AI builds on what it finds.", words: ["know yourself", "test", "beliefs", "goals", "needs", "quiz", "tony robbins", "assessment"] },
  { path: "/individual/vault/journal", name: "Journal", what: "Write a private note; it files itself into folders and labels in your Vault. Only you can read it.", words: ["journal", "write", "note", "diary", "entry", "entries", "my journal"] },
  { path: "/individual/ideas", name: "Ideas", what: "Your ideas and proposal drafts.", words: ["ideas", "idea", "drafts", "draft"] },
  { path: "/individual/todo", name: "To do", what: "Your private to-do list.", words: ["to do", "todo", "tasks", "task", "list"] },
  { path: "/individual/learn", name: "Learn", what: "The library, the Universal Laws, how Sovereign works, and lessons shaped by your answers.", words: ["learn", "lessons", "education", "library", "how sovereign works", "course"] },
  { path: "/individual/vault", name: "Vault", what: "Your private vault, including SOV.", words: ["vault", "saved", "private files"] },
  { path: "/individual/sov", name: "SOV", what: "Your SOV balance and how you earned it. A simulation, not money.", words: ["sov", "balance", "token", "tokens", "coins", "earn", "rewards"] },
  { path: "/individual/profile", name: "Edit profile", what: "Your name, handle, photo and bio.", words: ["edit profile", "profile", "photo", "avatar", "bio", "name", "handle", "username"] },

  // Connection — the We
  { path: "/connection", name: "Connection", what: "One inbox: friends, chats, groups, proposal chats and your businesses.", words: ["connection", "inbox", "messages", "chats", "chat", "dm", "friends", "groups"] },
  { path: "/connection?show=people", name: "People", what: "Find someone by handle, friend requests, friends and who you follow.", words: ["people", "find someone", "find a person", "friend", "add friend", "follow", "following", "requests", "handle"] },
  { path: "/onboarding/group", name: "Start or join a group", what: "Start a group from a template and write its charter, or join one with a code.", words: ["start a group", "new group", "create group", "join a group", "invite code", "charter", "template"] },
  { path: "/chats/new", name: "New chat", what: "Start a chat with a friend or a small circle.", words: ["new chat", "start a chat", "message someone", "circle"] },

  // Search — the lens, and where you land
  { path: "/home", name: "Search", what: "Search anything, post, and the feed: For you, Following and Discover.", words: ["search", "home", "feed", "post", "posts", "look up", "ask", "for you", "discover"] },
  { path: "/home#compose", name: "New post", what: "Write a post and choose who it is for.", words: ["new post", "share", "publish", "compose"] },
  { path: "/home/words", name: "Words", what: "The words Sovereign uses and what they mean.", words: ["words", "glossary", "definitions", "meaning", "terms", "lexicon"] },

  // Market — the It
  { path: "/market", name: "Market", what: "Verified businesses, products and services that passed the Universal Laws.", words: ["market", "marketplace", "shop", "buy", "businesses", "products", "services"] },
  { path: "/market/sell", name: "Sell", what: "Apply to list your business.", words: ["sell", "list my business", "list a business", "add a business", "apply", "vendor"] },

  // Collective — the Its
  { path: "/collective/proposals", name: "Proposals", what: "Proposals open to you. Read one before you respond.", words: ["proposals", "proposal", "vote", "voting", "respond", "resonance", "decide"] },
  { path: "/collective/proposals/new", name: "New proposal", what: "Write a proposal for a group or a place.", words: ["new proposal", "make a proposal", "propose", "submit"] },
  { path: "/collective/debate", name: "Debate", what: "Discussion and challenges on live proposals.", words: ["debate", "discussion", "challenge", "argue"] },
  { path: "/collective/projects", name: "Projects", what: "What passed and is being done, with its impact.", words: ["projects", "project", "impact", "progress"] },
  { path: "/collective/decisions", name: "Decisions", what: "Closed decisions, with their numbers and never names.", words: ["decisions", "results", "outcomes", "history", "record"] },

  // Settings
  { path: "/settings", name: "Settings", what: "Account, place, feed and privacy settings.", words: ["settings", "account", "preferences", "sign out", "log out", "logout"] },
  { path: "/settings/place", name: "Your place", what: "Where you live, which sets what you can decide on.", words: ["place", "address", "location", "where i live", "postcode", "move"] },
  { path: "/settings/feed", name: "Feed settings", what: "What your feed shows, and who you muted.", words: ["feed settings", "mute", "muted", "hide"] },
  { path: "/settings/data", name: "Your data", what: "Download everything, or delete your account.", words: ["data", "download", "export", "delete account", "delete my account", "close my account", "gdpr", "privacy", "my data"] },
  { path: "/settings/personhood", name: "Proof of personhood", what: "Prove you are one living person, for wide-scale proposals.", words: ["personhood", "verify", "verification", "identity", "human", "proof"] },
  { path: "/settings/law", name: "Universal Laws", what: "The ten laws every proposal and business is read against.", words: ["law", "laws", "universal law", "universal laws", "rules", "constitution"] },
  { path: "/settings/prompts", name: "AI prompts", what: "Every prompt the AI runs on, with its version.", words: ["prompts", "how the ai works", "ai rules"] },
];

/** The map as plain lines, for the AI. */
export function placesForAi(): string {
  return PLACES.map((p) => `${p.path} — ${p.name}: ${p.what}`).join("\n");
}

/** The place a path is in, by longest matching prefix. */
export function placeOf(pathname: string): Place | null {
  const clean = pathname.split(/[?#]/)[0];
  let best: Place | null = null;
  for (const p of PLACES) {
    const base = p.path.split(/[?#]/)[0];
    if ((clean === base || clean.startsWith(`${base}/`)) && (!best || base.length > best.path.split(/[?#]/)[0].length)) best = p;
  }
  return best;
}

/**
 * The places that best match what somebody typed, best first. Whole-word
 * matches on the words and name, longer phrases counting for more. Used when
 * no AI model is connected, so finding your way around still works.
 */
export function findPlaces(text: string, limit = 3): Place[] {
  const q = ` ${text.toLowerCase().replace(/[^a-z0-9#?\s-]/g, " ").replace(/\s+/g, " ")} `;
  const scored = PLACES.map((p) => {
    let score = 0;
    for (const w of [...p.words, p.name.toLowerCase()]) {
      if (q.includes(` ${w} `) || q.includes(` ${w}s `)) score += w.split(" ").length * 2 + 1;
    }
    return { p, score };
  }).filter((s) => s.score > 0);
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.p);
}
