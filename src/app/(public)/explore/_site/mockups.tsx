import type { ReactNode } from "react";

/**
 * Drawn screens for the public site. No screenshots: these are made from the
 * same tokens as the app, so they follow the theme and never go stale in a
 * way a picture would. Every name and number on them is an example.
 */

/** `active` is the lit tab: 0 Individual, 1 Home, 2 Search, 3 Market, 4 Collective. */
export function PhoneFrame({ children, active = 4, className = "" }: { children: ReactNode; active?: number; className?: string }) {
  return (
    <div
      className={`relative mx-auto w-full max-w-[300px] rounded-[2.6rem] border border-line bg-ink-raised p-2.5 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.45)] ${className}`}
      aria-hidden="true"
    >
      <div className="overflow-hidden rounded-[2.1rem] border border-line-soft bg-ink">
        <div className="flex items-center justify-between px-6 pt-3 pb-1 text-[10px] font-semibold text-paper">
          <span>9:41</span>
          <span className="h-4 w-16 rounded-full bg-surface" />
          <span className="tabular-nums">100%</span>
        </div>
        <div className="h-[520px] overflow-hidden px-4 pb-4">{children}</div>
        <TabBar active={active} />
      </div>
    </div>
  );
}

function TabBar({ active }: { active: number }) {
  return (
    <div className="flex justify-around border-t border-line-soft py-3">
      {["M12 12a4 4 0 100-8 4 4 0 000 8zM4 20a8 8 0 0116 0", "M3 11l9-7 9 7v9H3z", "M11 18a7 7 0 100-14 7 7 0 000 14zM21 21l-5-5", "M4 7h16l-1.5 12h-13zM9 7V5a3 3 0 016 0v2", "M8 12a3 3 0 100-6 3 3 0 000 6zM16 12a3 3 0 100-6 3 3 0 000 6zM2 20a6 6 0 0112 0M10 20a6 6 0 0112 0"].map(
        (d, i) => (
          <svg key={i} viewBox="0 0 24 24" className={`h-5 w-5 ${i === active ? "text-gold" : "text-paper-faint"}`} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round">
            <path d={d} />
          </svg>
        ),
      )}
    </div>
  );
}

function Chip({ children, tone = "plain" }: { children: ReactNode; tone?: "plain" | "gold" | "calm" }) {
  const cls =
    tone === "gold" ? "bg-gold-wash text-gold" : tone === "calm" ? "bg-calm-wash text-calm" : "bg-surface text-paper-dim";
  return <span className={`rounded-pill px-2 py-0.5 text-[10px] font-semibold ${cls}`}>{children}</span>;
}

/** Collective: a proposal after the law review, with its own conditions. */
export function ProposalScreen() {
  return (
    <div className="space-y-3 pt-2">
      <p className="smallcaps text-[9px] text-paper-faint">Elm Street · Local</p>
      <p className="font-serif text-[1.35rem] leading-tight text-paper">Plant 200 fruit trees on the verges, free to pick.</p>
      <div className="flex flex-wrap gap-1.5">
        <Chip>Ecology</Chip>
        <Chip>Food</Chip>
        <Chip tone="calm">10 / 10 laws aligned</Chip>
      </div>
      <div className="flex items-center gap-1.5 pt-1" >
        {["Propose", "Check", "Decide", "Act", "Learn"].map((s, i) => (
          <div key={s} className="flex-1">
            <div className={`h-1 rounded-full ${i < 3 ? "bg-gold" : "bg-surface-lift"}`} />
            <p className={`mt-1 text-[8px] ${i === 2 ? "text-paper" : "text-paper-faint"}`}>{s}</p>
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-line bg-surface-soft p-3">
        <p className="smallcaps text-[9px] text-paper-faint">What this one needs</p>
        <ul className="mt-2 space-y-1.5 text-[11px] text-paper-dim">
          <li className="flex justify-between"><span>Voices</span><span className="text-paper">12 of 15</span></li>
          <li className="flex justify-between"><span>Council verge consent</span><span className="text-calm">answered</span></li>
          <li className="flex justify-between"><span>Who waters year one</span><span className="text-gold">open</span></li>
        </ul>
      </div>
      <div className="rounded-xl border border-line p-3">
        <p className="smallcaps text-[9px] text-paper-faint">Your response</p>
        {[
          ["Aligned", 78],
          ["Confident", 64],
          ["Urgent", 40],
        ].map(([l, v]) => (
          <div key={l as string} className="mt-2">
            <div className="flex justify-between text-[10px] text-paper-dim">
              <span>{l}</span>
              <span className="tabular-nums">{((v as number) / 100).toFixed(2)}</span>
            </div>
            <div className="mt-1 h-1.5 rounded-full bg-surface">
              <div className="h-1.5 rounded-full bg-gold" style={{ width: `${v}%` }} />
            </div>
          </div>
        ))}
        <p className="mt-3 text-[10px] text-paper-faint">The lean stays hidden until it closes.</p>
      </div>
    </div>
  );
}

/** Home: posts in time order, likes shown but never ranked by. */
export function FeedScreen() {
  const posts = [
    ["Amara", "Repair café: 14 things fixed, 0 to landfill.", "2h", 23],
    ["Josh", "Week three of the community fridge. Nothing wasted yet.", "5h", 41],
    ["Elm Street", "Passed: fruit trees on the verges. Planting starts in March.", "1d", 88],
  ] as const;
  return (
    <div className="space-y-3 pt-2">
      <div className="flex gap-1.5">
        <Chip tone="gold">Following</Chip>
        <Chip>Local</Chip>
        <Chip>Regional</Chip>
      </div>
      {posts.map(([who, text, when, likes]) => (
        <div key={text} className="border-b border-line-soft pb-3">
          <div className="flex items-center gap-2">
            <span className="h-6 w-6 rounded-full bg-surface-lift" />
            <span className="text-[11px] font-semibold text-paper">{who}</span>
            <span className="text-[10px] text-paper-faint">{when}</span>
          </div>
          <p className="mt-2 text-[12px] leading-snug text-paper">{text}</p>
          <div className="mt-2 h-20 rounded-lg bg-surface" />
          <p className="mt-2 text-[10px] text-paper-faint">♡ {likes} · Reply</p>
        </div>
      ))}
    </div>
  );
}

/** Market: verified businesses, the sponsored slot chosen by fit. */
export function MarketScreen() {
  return (
    <div className="space-y-3 pt-2">
      <div className="flex gap-1.5">
        <Chip tone="gold">Buy</Chip>
        <Chip>Sell</Chip>
      </div>
      <div className="rounded-xl border border-gold-dim bg-gold-wash p-3">
        <p className="smallcaps text-[9px] text-gold">Sponsored · matches your value “local”</p>
        <p className="mt-1 text-[12px] font-semibold text-paper">Root & Row</p>
        <p className="text-[11px] text-paper-dim">Veg boxes from farms within 30 miles</p>
      </div>
      {[
        ["Refill Room", "Bring your own jars", "£"],
        ["Fixwell", "Phone and laptop repair", "££"],
        ["Loom & Co", "Clothes from recycled fibre", "££"],
      ].map(([n, d, p]) => (
        <div key={n} className="flex items-center gap-3 border-b border-line-soft pb-3">
          <span className="h-12 w-12 shrink-0 rounded-lg bg-surface" />
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 text-[12px] font-semibold text-paper">
              {n} <span className="text-calm">✓</span>
            </p>
            <p className="truncate text-[11px] text-paper-dim">{d}</p>
          </div>
          <span className="text-[11px] text-paper-faint">{p}</span>
        </div>
      ))}
      <p className="text-[10px] text-paper-faint">✓ Website proven · ten laws read · signed off by a person</p>
    </div>
  );
}

/** Individual: the profile header and your private tabs. */
export function SelfScreen() {
  return (
    <div className="space-y-4 pt-2">
      <div className="flex items-center gap-3">
        <span className="h-14 w-14 rounded-full bg-surface-lift" />
        <div>
          <p className="font-serif text-lg text-paper">Sam</p>
          <p className="text-[11px] text-paper-dim">Only you can see this space</p>
        </div>
      </div>
      <div className="flex gap-3 border-b border-line-soft pb-2 text-[11px]">
        {["Self", "Ideas", "To do", "Learn", "Vault"].map((t, i) => (
          <span key={t} className={i === 0 ? "font-semibold text-paper" : "text-paper-faint"}>
            {t}
          </span>
        ))}
      </div>
      <div className="rounded-xl border border-line bg-surface-soft p-3">
        <p className="smallcaps text-[9px] text-paper-faint">Know yourself · your focus</p>
        <p className="mt-1.5 text-[12px] leading-snug text-paper">
          Growth and contribution lead. Certainty is what you trade away first — plan for it.
        </p>
      </div>
      <div className="space-y-2">
        {["Values", "Beliefs", "Goals"].map((t, i) => (
          <div key={t}>
            <div className="flex justify-between text-[10px] text-paper-dim">
              <span>{t}</span>
              <span>{["5 named", "3 to rework", "2 active"][i]}</span>
            </div>
            <div className="mt-1 h-1.5 rounded-full bg-surface">
              <div className="h-1.5 rounded-full bg-paper-faint" style={{ width: `${[80, 45, 60][i]}%` }} />
            </div>
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-line p-3">
        <p className="text-[11px] text-paper-faint">Ask your AI anything…</p>
      </div>
    </div>
  );
}
