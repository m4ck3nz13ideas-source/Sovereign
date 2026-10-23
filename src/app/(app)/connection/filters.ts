/**
 * Connection's filters and mark keys, shared by the page (server) and the
 * Inbox (client). They live here, not in Inbox.tsx, because anything exported
 * from a "use client" file becomes a client reference on the server and
 * cannot be called there.
 */

export const FILTERS = [
  { key: "all", label: "All", kinds: null },
  { key: "chats", label: "Chats", kinds: ["person", "circle"] },
  { key: "people", label: "People", kinds: [] },
  { key: "groups", label: "Groups", kinds: ["group"] },
  { key: "proposals", label: "Proposals", kinds: ["proposal"] },
  { key: "businesses", label: "Businesses", kinds: ["business"] },
] as const;

export type FilterKey = (typeof FILTERS)[number]["key"];

export const markKey = (kind: string, refId: string) => `${kind}:${refId}`;

export const isFilter = (v: string | undefined): v is FilterKey => FILTERS.some((f) => f.key === v);
