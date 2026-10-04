# Design system

Black, white, one hot accent, on a phone. The feel is borrowed from the apps
everybody already knows how to use — full-bleed rows, sticky translucent bars,
a press that answers the finger — and none of the machinery those apps use to
keep people there.

That distinction is the whole brief and it is worth stating plainly, because
the two halves look contradictory written down. Rule 1 of the overview is
*"calm over noise — slow-thinking, not dopamine-driven"*, and it rules out
engagement algorithms by name. The craft came across. The mechanics did not:
no counts on things, no streaks, no badges as pressure, nothing ranked by
attention, no follower count anywhere, no read receipts.

## Tokens

Defined once in `src/app/globals.css` under `@theme`. Nothing anywhere uses a
raw hex value.

Every token is `light-dark(light, dark)`, which resolves against
`color-scheme` — so the whole palette flips by changing one property on
`<html>`, and there is no second copy of the palette to drift out of step.

| Token | Light | Dark | Used for |
|---|---|---|---|
| `ink` | `#ffffff` | `#000000` | The ground. Full-bleed content sits on nothing. |
| `ink-raised` | `#ffffff` | `#0c0c0c` | Raised surfaces |
| `surface` | `#f2f2f2` | `#161616` | Chips, pills, bar tracks |
| `surface-soft` | `#f8f8f8` | `#0f0f0f` | Cards |
| `surface-lift` | `#e6e6e6` | `#212121` | Pressed states |
| `line` | `#e3e3e3` | `#262626` | Every border |
| `line-soft` | `#ededed` | `#1a1a1a` | Hairlines between rows |
| `veil` | `#ffffffd4` | `#000000d9` | The two bars that blur what passes under them |
| `paper` | `#000000` | `#ffffff` | Primary text |
| `paper-dim` | `#575757` | `#a8a8a8` | Body copy |
| `paper-faint` | `#8a8a8a` | `#737373` | Metadata, small caps |
| `gold` | `#b25c00` | `#ff9500` | **The** accent — one meaning: this is yours to act on |
| `gold-dim` | `#e2a96a` | `#8a5200` | Gold borders |
| `gold-wash` | `#b25c001f` | `#ff950014` | Tinted surfaces for what deserves attention |
| `alarm` | `#c8102e` | `#ff453a` | Critical flags, failure, overspend |
| `calm` | `#1d7a35` | `#32d74b` | Passed, completed, verified |

**The amber is not the same amber in both.** `#ff9500` on white is around 2:1 —
a colour you can see but not read. The light theme burns it down to a hotter,
darker orange that still reads as the same signal. An accent that only works on
black is a dark-mode app with a light-mode setting.

`alarm` and `calm` are the only colours besides the accent, and they carry
meaning rather than decoration. A green tick for "saved" would be a misuse;
`calm` is for a proposal that passed and a chain that verified.

`veil` exists as a token rather than a `bg-ink/85` opacity modifier because
white needs a different alpha from black to blur convincingly, and writing it
once per theme beats mixing it at the point of use.

### Theme selection

`:root` is `color-scheme: light dark`, so with no choice made the device
decides and keeps deciding — a phone that switches at dusk takes the app with
it. An explicit choice becomes `data-theme` on `<html>`, set on the **server**
from a cookie read in the root layout. A theme applied by script after paint is
a white flash on a black app, which is the thing dark mode exists to stop.

The control is three pills in Settings: System, Light, Dark.

## Type

**Playfair Display** for headings, **Inter** for body and UI, both self-hosted
via `@fontsource-variable` rather than loaded from Google — partly speed, and
partly that a product whose first claim is that your data is yours should not
make every reader's browser announce itself to a third party to render a
heading.

| Use | Class |
|---|---|
| Screen title | `.display text-[1.75rem]` |
| Card title | `.display text-[1.125rem]` |
| Body | `text-[0.9375rem] leading-relaxed` |
| Metadata | `smallcaps text-[10px] text-paper-faint` |

`.display` is the serif with tightened letterspacing and line-height.
`.smallcaps` is `font-variant-caps: all-small-caps` with letterspacing — for
labels and metadata, never for content a person is meant to read closely.

## Navigation

**Four tabs, bottom, always visible.** Three come straight from the overview's
architecture diagram — `SOVEREIGN APP → HOME / INDIVIDUAL / COLLECTIVE` — with
Home left of centre because it is the one you sit in. Ask is the fourth.

```
Individual  ·  Home  ·  Ask  ·  Collective
```

Ask sits beside Home rather than raised in the middle. Rule 2 is understanding
before opinion, and a surface for going and finding something out earns a place
at this level; a raised centre button does not, because that is the shape of an
app whose whole purpose is posting.

Four is the ceiling. A fifth would start the argument about which of these
matters least, and the answer would be whichever one was added last.

Icons are outline when idle and filled when active, the one convention every
phone app shares, so nobody has to learn it.

**Nothing else lives in the tab bar.** Writing is a `+` in the Home top bar. A
raised centre button is the shape of an app whose whole purpose is posting, and
that is not what this is.

Each tab has its own strip of sub-tabs underneath it, rendered as a horizontal
rail of pills rather than a fixed row — seven does not fit across a phone, and
a dropdown hides where you are.

| Tab | Sub-tabs |
|---|---|
| Individual | Profile · AI · Values · Chats · Journal · Ideas · Drafts · Vault |
| Home | *(none — Home is the feed)* |
| Ask | *(none — Find and Ask are two modes of one field)* |
| Collective | Proposals · Debate · Projects · Impact · Decisions · People |

The scale selector sits in the Home top bar, as Rule 6 requires: local,
regional, national, continental, global should always be obvious.

## Components

`src/components/ui.tsx`. Spare on purpose.

**`Screen`** — a full-bleed screen. Content runs to the edges and each section
decides its own gutter, which is what lets rows, rails and media go edge to
edge while prose stays readable.

**`Gutter`** — the standard side gutter, for anything inside a `Screen` that
needs one.

**`Page`** — the older boxed layout, still used by the settings screens.

**`TopBar`** — sticky, translucent, backdrop-blurred. The title is small and
the screen is what you look at — the opposite of a document, where the title is
the first thing and takes a third of the page.

**`Rail`** / **`Pill`** / **`PillLink`** — the horizontal scrolling strip and
its contents. Active is solid `paper` on `ink`; idle is `surface`.

**`Row`** — a full-bleed tappable row separated by a hairline rather than
boxed, which is what lets a list of forty read as one surface instead of forty
cards.

**`Card`** — a bordered surface. `border-line bg-surface-soft`.

**`Banner`** — a thin horizontal card. It must read as a gentle pull, not a
task: no badge, no counter on the row, and no way to mark it done without
opening it.

**`ScoreBar`** — a 0–1 value as a thin bar with the number beside it.
Deliberately not a gauge or a dial: this is a reading, not a verdict, and it
should not look more precise than it is.

**`Empty`** — a dashed border and a sentence that says what would make content
appear here. Never "No items found."

**`Readers`** — one greyscale line, "Who can read this · …", under a screen's
heading. It states the policy in force for what is on that screen, in plain
words, and must never promise more than the RLS gives. Not amber: it is the
room you are in, not something to act on.

**`Button`** — four tones. `gold` for the primary action on a screen, `quiet`
for secondary, `ghost` for dismissal, `danger` for destruction. One gold button
per screen; two means the screen has not decided what it is for. Pill-shaped,
`min-h-11`, and every one carries `.press`.

## Motion

Short, springy, and tied to touch — a press should answer.

- `.press` — `scale(0.975)` on `:active`, on everything tappable.
- `rise` — a sheet arriving from the bottom.
- `settle-in` — a card appearing in place.
- `lift-away` — text lifts and dissolves upward after sending. The confirmation
  *is* the disappearance.

All disabled under `prefers-reduced-motion`. Nothing else moves: no page
transitions, no skeleton shimmer, no hover lift.

`body` is `user-select: none`, because nothing on a phone should be able to
select-drag by accident. Text people might want to copy — proposal bodies,
answers, messages — opts back in with `data-selectable`.

## Accessibility

- `:focus-visible` is a 2px accent outline, defined globally and never removed.
- Interactive elements are 44px minimum in the vertical rhythm.
- Every icon is `aria-hidden` with a text label beside it or an `aria-label`.
- The tab bar marks the current page with `aria-current`.
- Colour never carries meaning alone: a critical flag is red *and* says
  "answer this"; a passed decision is `calm` *and* says "Passed".
- The light palette is not a tint of the dark one. Every accent and state
  colour was rechosen for contrast on white.

## Adding a screen

1. Wrap in `<Screen>`, and give each section its own `<Gutter>`.
2. `<TopBar>` or a `.display` heading once, with one line saying what the
   screen is for in plain words.
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
  *not* prove; reviews written without a model say so; the personhood screen
  says the browser step is not connected rather than showing a button that
  looks like it works.
- Say what is absent and why, where the absence is the design. The chats screen
  says there are no read receipts; the people screen says a follow gives you
  nothing but their public record; the mirror says neither direction is the
  good one. In this product the absences are most of the argument.
- No manufactured urgency, no counts framed as debts, nothing that implies the
  person is behind.

`ResonancePanel.tsx` and `FlagList.tsx` are the reference for tone.
