# Design system

From `life_OS.pdf`: *"Dark background, off-white text, a single warm gold
accent, and a muted slate for cards. A serif for headings, clean sans for body.
The aesthetic is contemplative and serious, not productivity-tool clinical.
Minimal animation, high intentionality."*

## Tokens

Defined once in `src/app/globals.css` under `@theme`. Nothing anywhere uses a
raw hex value.

| Token | Value | Used for |
|---|---|---|
| `ink` | `#0d0d0f` | Page background |
| `ink-raised` | `#141418` | Inputs, code blocks |
| `surface` | `#2a2a30` | Bar tracks, chips |
| `surface-soft` | `#1e1e23` | Cards, banners |
| `line` | `#33333b` | Every border |
| `paper` | `#f0ede8` | Primary text |
| `paper-dim` | `#a7a49f` | Secondary text, body copy |
| `paper-faint` | `#6f6d69` | Metadata, small caps |
| `gold` | `#c9a84c` | Active states, key actions — **one accent only** |
| `gold-dim` | `#8d7534` | Gold borders, disabled gold |
| `gold-wash` | `#c9a84c1a` | Tinted surfaces for what deserves attention |
| `alarm` | `#c4664e` | Critical flags, failure, overspend |
| `calm` | `#7d9b8a` | Passed, completed, verified |

`alarm` and `calm` are the only colours besides gold, and they carry meaning
rather than decoration. A green tick for "saved" would be a misuse; `calm` is
for a proposal that passed and a chain that verified.

## Type

**Playfair Display** for headings, **Inter** for body and UI, both via
`next/font`.

| Use | Class |
|---|---|
| Page title | `font-serif text-[1.75rem] leading-tight` |
| Card title | `font-serif text-lg` |
| Body | `text-[0.95rem] leading-relaxed` |
| Metadata | `smallcaps text-[10px] text-paper-faint` |

`.smallcaps` is `font-variant-caps: all-small-caps` with letterspacing. It is
for labels and metadata — never for content a person is meant to read closely.

The 0.95rem body size is deliberate: 16px reads as an interface, 15.2px reads
as a document, and Profile is meant to feel like opening a personal document.

## Navigation

**Bottom nav, always visible.** Five items, exactly as specified:

```
Connection · Pipeline · [Launch] · Reflection · Profile
```

Launch sits above the baseline, always gold, always raised. The four flanking
it are gold only when active. Labels are small caps beneath each icon.

Inside Connection, a second tab row carries the collective chain: Feed →
Proposals → Decisions → Projects → Impact. That is the structure from
`Sovereign Overview (2)` laid out left to right — each tab is the next stage of
the same loop, which is why they are tabs rather than separate destinations.

## Components

`src/components/ui.tsx`. Spare on purpose.

**`Banner`** — a thin horizontal card with a gold dot. Used for unexamined
entries, ideas in the inbox, faith entries on Profile. It must read as a gentle
pull, not a task: no badge, no counter on the row, and no way to mark it done
without opening it.

**`Card`** — the default surface. `border-line bg-surface-soft`.

**`Panel`** — a `<details>` element with a serif summary. The four living
panels on Profile.

**`ScoreBar`** — a 0–1 value as a thin bar with the number beside it.
Deliberately not a gauge or a dial: this is a reading, not a verdict, and it
should not look more precise than it is. `critical` switches it to `alarm`.

**`Empty`** — a dashed border and a sentence that says what would make content
appear here. Never "No items found."

**`Button`** — four tones. `gold` for the primary action on a screen, `quiet`
for secondary, `ghost` for dismissal, `danger` for destruction. One gold button
per screen; two means the screen has not decided what it is for.

## Motion

Two animations, both under a second:

- `lift-away` — text lifts and dissolves upward after sending from Launch. The
  confirmation *is* the disappearance.
- `settle-in` — a card appearing in place.

Both are disabled under `prefers-reduced-motion`. Nothing else moves. No page
transitions, no skeleton shimmer, no hover lift.

## Accessibility

- `:focus-visible` is a 2px gold outline, defined globally and never removed.
- Interactive elements are 44px minimum in the vertical rhythm.
- Every icon is `aria-hidden` with a text label beside it or an `aria-label`.
- The bottom nav marks the current page with `aria-current`.
- Colour never carries meaning alone: a critical flag is red *and* says
  "answer this"; a passed decision is `calm` *and* says "Passed".

## Adding a screen

1. Wrap in `<Page>` — max-width, gutters, and the bottom padding that clears
   the nav.
2. `<PageTitle>` once, with a `sub` that says what the screen is for in plain
   words.
3. `<SectionLabel>` for each section, with an optional right-hand count.
4. Use the primitives. If you need something new, it probably belongs to that
   screen rather than to the system — put it in the screen's folder.
5. Every list has an `<Empty>` state whose copy says what would make content
   appear.

## Copy

The voice is the product.

- Plain words. No exclamation marks, no "oops", no congratulation.
- Where a constraint exists, say what it is and why. "The sliders unlock once
  you have read the review above" — then the reason, in one more sentence.
- Never claim more than is true. The Impact page says what the hash chain does
  *not* prove; reviews written without a model say so in red.
- No manufactured urgency, no counts framed as debts, nothing that implies the
  person is behind.

`ResonancePanel.tsx` and `FlagList.tsx` are the reference for tone.
