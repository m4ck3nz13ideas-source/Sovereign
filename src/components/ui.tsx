import Link from "next/link";
import type { ReactNode } from "react";

/**
 * The primitives.
 *
 * Built for a phone held in one hand: full-bleed rows with hairline
 * separators, sticky translucent headers, bottom sheets instead of inline
 * forms, and everything tappable answering the finger.
 *
 * The colour discipline is the whole system. Amber means one thing — this is
 * yours to act on. Red and green are functional state. Everything else is
 * greyscale and weight, because with no photographs anywhere, colour has to be
 * earned rather than sprayed.
 */

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

/* --- page furniture ------------------------------------------------------- */

export function Page({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("mx-auto w-full max-w-2xl px-5 pt-6 pb-32", className)}>
      {children}
    </div>
  );
}

/**
 * A full-bleed screen. Content runs to the edges and each section decides its
 * own gutter, which is what lets rows, rails and media go edge to edge while
 * prose stays readable.
 */
export function Screen({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("mx-auto w-full max-w-2xl pb-32", className)}>
      {children}
    </div>
  );
}

/** The standard side gutter, for anything inside a Screen that needs one. */
export function Gutter({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cx("px-5", className)}>{children}</div>;
}

/**
 * A sticky header that stays out of the way. The title is small and the screen
 * is what you look at — the opposite of a document, where the title is the
 * first thing and takes a third of the page.
 */
export function TopBar({
  title,
  back,
  action,
  children,
}: {
  title: ReactNode;
  /** A href for the back chevron. Omitted on a tab root. */
  back?: string;
  action?: ReactNode;
  /** A rail or tab strip that scrolls with the bar. */
  children?: ReactNode;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-veil backdrop-blur-xl">
      <div className="flex h-12 items-center gap-1 px-2">
        {back ? (
          <Link
            href={back}
            aria-label="Back"
            className="press -ml-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-paper active:bg-surface"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden>
              <path
                d="M15 5l-7 7 7 7"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>
        ) : (
          <span className="w-2" aria-hidden />
        )}
        <h1 className="display min-w-0 flex-1 truncate px-1 text-[1.0625rem] text-paper">
          {title}
        </h1>
        {action ? <div className="shrink-0 pr-1">{action}</div> : null}
      </div>
      {children}
    </header>
  );
}

/**
 * A horizontal rail of pills. The scale selector, and anything else that is a
 * short set of mutually exclusive choices — which on a phone is a rail, not a
 * dropdown.
 */
export function Rail({ children }: { children: ReactNode }) {
  return (
    <div className="no-scrollbar rail overflow-x-auto">
      <div className="flex w-max min-w-full items-center gap-2 px-5 py-2.5">
        {children}
      </div>
    </div>
  );
}

export function Pill({
  active = false,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      {...props}
      aria-current={active ? "true" : undefined}
      className={cx(
        "press shrink-0 rounded-pill px-3.5 py-1.5 text-[0.8125rem] font-medium whitespace-nowrap",
        active
          ? "bg-paper text-ink"
          : "bg-surface text-paper-dim active:bg-surface-lift",
      )}
    >
      {children}
    </button>
  );
}

export function PillLink({
  href,
  active = false,
  children,
}: {
  href: string;
  active?: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cx(
        "press shrink-0 rounded-pill px-3.5 py-1.5 text-[0.8125rem] font-medium whitespace-nowrap",
        active
          ? "bg-paper text-ink"
          : "bg-surface text-paper-dim active:bg-surface-lift",
      )}
    >
      {children}
    </Link>
  );
}

/**
 * A full-bleed tappable row. Separated by a hairline rather than boxed, which
 * is what lets a list of forty read as one surface instead of forty cards.
 */
export function Row({
  href,
  children,
  className,
  onClick,
}: {
  href?: string;
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  const cls = cx(
    "press block w-full border-b border-line-soft px-5 py-4 text-left active:bg-surface-soft",
    className,
  );

  if (href) {
    return (
      <Link href={href} className={cls}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={cls}>
      {children}
    </button>
  );
}

export function PageTitle({
  children,
  sub,
}: {
  children: ReactNode;
  sub?: ReactNode;
}) {
  return (
    <header className="mb-7">
      <h1 className="font-serif text-[1.75rem] leading-tight text-paper">{children}</h1>
      {sub ? <p className="mt-1.5 text-sm text-paper-dim">{sub}</p> : null}
    </header>
  );
}

export function SectionLabel({
  children,
  right,
}: {
  children: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-baseline justify-between">
      <h2 className="smallcaps text-xs text-paper-faint">{children}</h2>
      {right ? <div className="text-xs text-paper-faint">{right}</div> : null}
    </div>
  );
}

/* --- surfaces ------------------------------------------------------------- */

export function Card({
  children,
  className,
  as: As = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "article" | "li" | "section";
}) {
  return (
    <As
      className={cx(
        "rounded-card border border-line bg-surface-soft p-4",
        className,
      )}
    >
      {children}
    </As>
  );
}

/**
 * A banner: a thin horizontal card that should feel like a gentle pull, not a
 * task. Used for unexamined entries, ideas waiting in the inbox, and outputs
 * ready to share.
 */
export function Banner({
  href,
  tag,
  when,
  children,
  action,
}: {
  href?: string;
  tag?: string;
  when?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  const inner = (
    <div className="flex items-start gap-3">
      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[0.95rem] text-paper">{children}</p>
        {(tag || when) && (
          <p className="smallcaps mt-1 text-[10px] text-paper-faint">
            {[tag, when].filter(Boolean).join(" · ")}
          </p>
        )}
      </div>
      {action}
    </div>
  );

  const className =
    "block rounded-card border border-line bg-surface-soft px-4 py-3 transition-colors hover:border-gold-dim";

  return href ? (
    <Link href={href} className={className}>
      {inner}
    </Link>
  ) : (
    <div className={className}>{inner}</div>
  );
}

/** An expandable panel, used for the four living panels on Profile. */
export function Panel({
  title,
  hint,
  children,
  defaultOpen = false,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details
      open={defaultOpen}
      className="group rounded-card border border-line bg-surface-soft open:bg-surface-soft"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3.5 [&::-webkit-details-marker]:hidden">
        <span className="font-serif text-lg text-paper">{title}</span>
        <span className="smallcaps text-[10px] text-paper-faint group-open:hidden">
          {hint ?? "open"}
        </span>
        <span className="smallcaps hidden text-[10px] text-paper-faint group-open:inline">
          close
        </span>
      </summary>
      <div className="border-t border-line px-4 py-4">{children}</div>
    </details>
  );
}

/* --- text ----------------------------------------------------------------- */

export function Tag({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "gold" | "alarm" | "calm";
}) {
  const tones = {
    neutral: "border-line text-paper-dim",
    gold: "border-gold/40 text-gold",
    alarm: "border-alarm/40 text-alarm",
    calm: "border-calm/40 text-calm",
  } as const;

  return (
    <span
      className={cx(
        "inline-flex items-center rounded-pill border px-2 py-[3px] text-[0.6875rem] font-medium leading-none",
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}

export function Prose({ children }: { children: string }) {
  return (
    <div className="space-y-3 text-[0.95rem] leading-relaxed text-paper-dim">
      {children
        .split(/\n{2,}/)
        .filter((p) => p.trim())
        .map((p, i) => (
          <p key={i} className="whitespace-pre-wrap">
            {p.trim()}
          </p>
        ))}
    </div>
  );
}

export function Empty({
  children,
  action,
}: {
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-card border border-dashed border-line px-5 py-10 text-center">
      <p className="text-[0.9375rem] leading-relaxed text-paper-faint">{children}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

/* --- controls ------------------------------------------------------------- */

type ButtonTone = "gold" | "quiet" | "ghost" | "danger";

const buttonTones: Record<ButtonTone, string> = {
  gold: "bg-gold text-ink active:bg-gold/90 disabled:bg-surface disabled:text-paper-faint",
  quiet: "bg-surface text-paper active:bg-surface-lift disabled:opacity-40",
  ghost: "text-paper-dim active:text-paper disabled:opacity-30",
  danger: "bg-alarm/15 text-alarm active:bg-alarm/25",
};

export function Button({
  children,
  tone = "gold",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { tone?: ButtonTone }) {
  return (
    <button
      {...props}
      className={cx(
        "press inline-flex min-h-11 items-center justify-center gap-2 rounded-pill px-5 py-2.5 text-[0.9375rem] font-semibold disabled:cursor-not-allowed",
        buttonTones[tone],
        className,
      )}
    >
      {children}
    </button>
  );
}

export function LinkButton({
  href,
  children,
  tone = "quiet",
  className,
}: {
  href: string;
  children: ReactNode;
  tone?: ButtonTone;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cx(
        "press inline-flex min-h-11 items-center justify-center gap-2 rounded-pill px-5 py-2.5 text-[0.9375rem] font-semibold",
        buttonTones[tone],
        className,
      )}
    >
      {children}
    </Link>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="smallcaps mb-1.5 block text-[11px] text-paper-faint">
        {label}
      </span>
      {children}
      {hint ? <span className="mt-1.5 block text-xs text-paper-faint">{hint}</span> : null}
    </label>
  );
}

export const inputClass =
  "w-full rounded-xl border border-line bg-surface-soft px-3.5 py-3 text-[1rem] text-paper placeholder:text-paper-faint focus:border-gold focus:outline-none";

/* --- data display --------------------------------------------------------- */

/**
 * A 0–1 score as a thin bar. Deliberately not a gauge or a dial: this is a
 * reading, not a verdict, and it should not look more precise than it is.
 */
export function ScoreBar({
  label,
  value,
  critical = false,
  hint,
}: {
  label: string;
  value: number | null;
  critical?: boolean;
  hint?: string;
}) {
  const pct = value === null ? 0 : Math.round(value * 100);
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <span className={cx("text-sm", critical ? "text-alarm" : "text-paper-dim")}>
          {label}
        </span>
        <span
          className={cx(
            "tabular-nums text-sm",
            critical ? "text-alarm" : value === null ? "text-paper-faint" : "text-paper",
          )}
        >
          {value === null ? "—" : value.toFixed(2)}
        </span>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-surface">
        <div
          className={cx("h-full rounded-full", critical ? "bg-alarm" : "bg-gold")}
          style={{ width: `${pct}%` }}
        />
      </div>
      {hint ? <p className="mt-1 text-xs text-paper-faint">{hint}</p> : null}
    </div>
  );
}

export function Divider() {
  return <hr className="my-7 border-line" />;
}

/**
 * A screen heading, for a page that already sits under a TopBar.
 *
 * Small, quiet, and it does not take a third of the viewport the way a
 * document title does. The bar says where you are; this says what this
 * particular screen is for.
 */
export function ScreenHead({
  children,
  sub,
}: {
  children: ReactNode;
  sub?: ReactNode;
}) {
  return (
    <header className="mb-5">
      <h2 className="display text-[1.5rem] text-paper">{children}</h2>
      {sub ? (
        <p className="mt-1 text-[0.9375rem] text-paper-dim">{sub}</p>
      ) : null}
    </header>
  );
}
