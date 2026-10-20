"use client";

import Link from "next/link";
import { useMemo, useState, useTransition, type ReactNode } from "react";

import { Empty, Gutter, Tag } from "@/components/ui";
import { ago } from "@/lib/format";

import { setMark, type MarkKind } from "./actions";
import { DecideButton } from "./DecideButton";

/**
 * Connection's one inbox (Mackenzie, 20 October).
 *
 * Every conversation you are part of — a friend, a circle of friends, each
 * group, each proposal you wrote or back, each business you run — in one list.
 * Pinned first, then anything with something new, then newest first. The
 * pills filter rather than scroll; the search box narrows your own list by
 * name and never looks beyond it. People sits among the filters (20 October):
 * finding someone by handle, requests, friends and who you follow.
 *
 * Muted conversations stay in the list but their unread count neither lifts
 * them nor adds to a filter's total. Pin and mute are yours alone (0055).
 */

export type InboxItem = {
  key: string;
  kind: MarkKind;
  refId: string;
  href: string;
  title: string;
  preview: string;
  at: string | null;
  unread: number;
  avatar: string | null;
  /** A line under the preview: what is happening in a group, a business's standing. */
  detail: string | null;
  /** A proposal's stage, linking to the proposal itself. */
  stage: { label: string; live: boolean; href: string } | null;
  /** A group's chat, kept a tap away now the row opens the group's page. */
  chatHref: string | null;
};

export type Marks = Record<string, { pinned: boolean; muted: boolean }>;

const FILTERS = [
  { key: "all", label: "All", kinds: null },
  { key: "chats", label: "Chats", kinds: ["person", "circle"] },
  { key: "people", label: "People", kinds: [] },
  { key: "groups", label: "Groups", kinds: ["group"] },
  { key: "proposals", label: "Proposals", kinds: ["proposal"] },
  { key: "businesses", label: "Businesses", kinds: ["business"] },
] as const;

type FilterKey = (typeof FILTERS)[number]["key"];

export const markKey = (kind: string, refId: string) => `${kind}:${refId}`;

export const isFilter = (v: string | undefined): v is FilterKey => FILTERS.some((f) => f.key === v);

export function Inbox({
  items,
  marks: initial,
  show,
  people,
  waiting,
}: {
  items: InboxItem[];
  marks: Marks;
  /** The filter to open on, from ?show=. */
  show: FilterKey;
  /** People — find by handle, requests, friends, following — rendered on the server. */
  people: ReactNode;
  /** Friend requests waiting on you: the People pill's count. */
  waiting: number;
}) {
  const [filter, setFilterState] = useState<FilterKey>(show);
  // A new ?show= from a link (the requests banner, a shared handle) wins.
  const [lastShow, setLastShow] = useState(show);
  if (show !== lastShow) {
    setLastShow(show);
    setFilterState(show);
  }
  const setFilter = (f: FilterKey) => {
    setFilterState(f);
    // Keep the address in step so back, refresh and shared links land here.
    try {
      window.history.replaceState(null, "", f === "all" ? "/connection" : `/connection?show=${f}`);
    } catch {
      /* not fatal */
    }
  };
  const [query, setQuery] = useState("");
  const [marks, setMarks] = useState<Marks>(initial);
  const [menu, setMenu] = useState<string | null>(null);
  const [, start] = useTransition();

  const mark = (i: InboxItem) => marks[markKey(i.kind, i.refId)] ?? { pinned: false, muted: false };
  const live = (i: InboxItem) => (mark(i).muted ? 0 : i.unread);

  const shown = useMemo(() => {
    const f = FILTERS.find((x) => x.key === filter)!;
    const q = query.trim().toLowerCase();
    return items
      .filter((i) => !f.kinds || (f.kinds as readonly string[]).includes(i.kind))
      .filter((i) => !q || i.title.toLowerCase().includes(q))
      .sort((a, b) => {
        const pa = Number(mark(a).pinned), pb = Number(mark(b).pinned);
        if (pa !== pb) return pb - pa;
        const ua = Number(live(a) > 0), ub = Number(live(b) > 0);
        if (ua !== ub) return ub - ua;
        return (b.at ?? "").localeCompare(a.at ?? "") || a.title.localeCompare(b.title);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, filter, query, marks]);

  const unreadIn = (kinds: readonly string[] | null) =>
    kinds && kinds.length === 0
      ? waiting
      : items.filter((i) => !kinds || kinds.includes(i.kind)).reduce((n, i) => n + live(i), 0);

  function toggle(i: InboxItem, field: "pinned" | "muted") {
    const k = markKey(i.kind, i.refId);
    const now = mark(i);
    const next = { ...now, [field]: !now[field] };
    setMarks((m) => ({ ...m, [k]: next }));
    setMenu(null);
    start(async () => {
      const r = await setMark(i.kind, i.refId, { [field]: next[field] });
      if (!r.ok) setMarks((m) => ({ ...m, [k]: now }));
    });
  }

  return (
    <div>
      <Gutter className={filter === "people" ? "hidden" : "pt-3"}>
        <label className="flex items-center gap-2 rounded-pill bg-surface px-3.5 py-2">
          <SearchIcon />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search your chats, groups and businesses"
            aria-label="Search your connections"
            className="w-full bg-transparent text-[0.9375rem] text-paper outline-none placeholder:text-paper-faint"
          />
          {query ? (
            <button type="button" onClick={() => setQuery("")} className="text-paper-faint" aria-label="Clear">
              ×
            </button>
          ) : null}
        </label>
      </Gutter>

      <div className="no-scrollbar overflow-x-auto">
        <div className="flex w-max min-w-full items-center gap-2 px-5 py-3">
          {FILTERS.map((f) => {
            const n = unreadIn(f.kinds as readonly string[] | null);
            const active = f.key === filter;
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                aria-pressed={active}
                className={`press shrink-0 rounded-pill px-3.5 py-1.5 text-[0.8125rem] font-medium whitespace-nowrap ${
                  active ? "bg-paper text-ink" : "bg-surface text-paper-dim"
                }`}
              >
                {f.label}
                {n ? <span className={active ? "ml-1.5" : "ml-1.5 text-gold"}>{n}</span> : null}
              </button>
            );
          })}
        </div>
      </div>

      {filter === "people" ? (
        people
      ) : shown.length ? (
        <ul>
          {shown.map((i) => {
            const m = mark(i);
            const k = markKey(i.kind, i.refId);
            return (
              <li key={i.key} className="relative border-b border-line-soft">
                <div className="flex items-start">
                  <Link href={i.href} className="press flex min-w-0 flex-1 gap-3 py-3.5 pl-5 active:bg-surface-soft">
                    <Avatar item={i} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className={`truncate text-[0.95rem] ${live(i) ? "font-medium text-paper" : "text-paper"}`}>
                          {i.title}
                        </span>
                        <span className="smallcaps flex shrink-0 items-center gap-1.5 text-[10px] text-paper-faint">
                          {m.pinned ? <PinIcon /> : null}
                          {m.muted ? <MuteIcon /> : null}
                          {live(i) ? <Tag tone="gold">{live(i)} new</Tag> : i.at ? ago(i.at) : null}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-[0.875rem] text-paper-dim">{i.preview}</p>
                      {i.detail ? (
                        <p className="smallcaps mt-1 truncate text-[10px] text-paper-faint">{i.detail}</p>
                      ) : null}
                    </div>
                  </Link>
                  {i.stage ? (
                    <Link
                      href={i.stage.href}
                      className={`smallcaps mt-4 shrink-0 rounded-pill border px-2 py-0.5 text-[10px] ${
                        i.stage.live ? "border-gold text-gold" : "border-line text-paper-faint"
                      }`}
                    >
                      {i.stage.label}
                    </Link>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setMenu(menu === k ? null : k)}
                    aria-label={`More for ${i.title}`}
                    aria-expanded={menu === k}
                    className="press shrink-0 px-4 py-4 text-paper-faint"
                  >
                    <DotsIcon />
                  </button>
                </div>

                {menu === k ? (
                  <div className="absolute right-4 top-12 z-20 min-w-[11rem] overflow-hidden rounded-card border border-line bg-surface shadow-lg">
                    <MenuButton onClick={() => toggle(i, "pinned")}>{m.pinned ? "Unpin" : "Pin to top"}</MenuButton>
                    <MenuButton onClick={() => toggle(i, "muted")}>{m.muted ? "Unmute" : "Mute"}</MenuButton>
                    {i.chatHref ? (
                      <Link href={i.chatHref} className="block px-4 py-2.5 text-[0.875rem] text-paper-dim active:bg-surface-lift">
                        Open chat
                      </Link>
                    ) : null}
                    {i.kind === "group" ? (
                      <DecideButton
                        groupId={i.refId}
                        className="block w-full px-4 py-2.5 text-left text-[0.875rem] text-gold active:bg-surface-lift disabled:opacity-60"
                      >
                        Decide together →
                      </DecideButton>
                    ) : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <Gutter className="pt-4">
          <Empty>
            {query
              ? "Nothing in your list by that name."
              : filter === "all"
                ? "Nothing here yet."
                : `No ${FILTERS.find((f) => f.key === filter)!.label.toLowerCase()} yet.`}
          </Empty>
        </Gutter>
      )}

      {menu ? <button type="button" aria-hidden tabIndex={-1} onClick={() => setMenu(null)} className="fixed inset-0 z-10 cursor-default" /> : null}
    </div>
  );
}

function MenuButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="block w-full px-4 py-2.5 text-left text-[0.875rem] text-paper active:bg-surface-lift">
      {children}
    </button>
  );
}

/** A face where there is one, initials where not, and an icon for what is not a person. */
function Avatar({ item }: { item: InboxItem }) {
  const base = "flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full";
  if (item.avatar) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={item.avatar} alt="" className={`${base} object-cover`} />;
  }
  if (item.kind === "person") {
    return <span className={`${base} bg-surface-lift text-[0.875rem] font-medium text-paper`}>{initials(item.title)}</span>;
  }
  const tone =
    item.kind === "group" ? "bg-gold-wash text-gold" : item.kind === "proposal" ? "bg-calm-wash text-calm" : "bg-surface-lift text-paper-dim";
  return (
    <span className={`${base} ${tone}`} aria-hidden>
      <KindIcon kind={item.kind} />
    </span>
  );
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
}

function KindIcon({ kind }: { kind: MarkKind }) {
  const p = { fill: "none", stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5">
      {kind === "circle" ? (
        <>
          <circle cx="9" cy="9" r="3" {...p} />
          <circle cx="16" cy="10" r="2.5" {...p} />
          <path d="M3.5 19c.8-3 3-4.5 5.5-4.5s4.7 1.5 5.5 4.5M14.5 15.2c2.6-.4 4.8.9 5.7 3.8" {...p} />
        </>
      ) : kind === "group" ? (
        <>
          <circle cx="12" cy="7.5" r="2.5" {...p} />
          <circle cx="5.5" cy="12" r="2" {...p} />
          <circle cx="18.5" cy="12" r="2" {...p} />
          <path d="M7.5 19.5c.6-2.6 2.4-4 4.5-4s3.9 1.4 4.5 4M2.5 18c.3-1.4 1.3-2.3 2.8-2.5M21.5 18c-.3-1.4-1.3-2.3-2.8-2.5" {...p} />
        </>
      ) : kind === "proposal" ? (
        <>
          <path d="M7 3.5h7l4 4v13H7z" {...p} />
          <path d="M14 3.5v4h4M10 12h5M10 15.5h5" {...p} />
        </>
      ) : (
        <>
          <path d="M4 9.5 5.5 4.5h13L20 9.5" {...p} />
          <path d="M4 9.5h16v1a2.5 2.5 0 0 1-5 0 2.5 2.5 0 0 1-5 0 2.5 2.5 0 0 1-5 0zM5.5 12.5v7h13v-7M10 19.5v-4h4v4" {...p} />
        </>
      )}
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-paper-faint" fill="none" aria-hidden>
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.75" />
      <path d="m16 16 4 4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

function DotsIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
      <circle cx="5.5" cy="12" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="18.5" cy="12" r="1.6" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-gold" fill="none" aria-label="Pinned">
      <path d="M9 4h6l-1 5 3 3v2H7v-2l3-3zM12 14v6" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function MuteIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" aria-label="Muted">
      <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4zM16 9.5l5 5M21 9.5l-5 5" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
