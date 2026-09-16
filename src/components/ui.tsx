import Link from "next/link";
import type { ReactNode } from "react";

/**
 * The primitives. Spare on purpose: a card, a banner, a panel, a label, a
 * button, an empty state. Anything more ornamental than this belongs to a
 * particular screen, not to the system.
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
    <div className={cx("mx-auto w-full max-w-2xl px-5 pt-8 pb-32", className)}>
      {children}
    </div>
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
    gold: "border-gold-dim text-gold",
    alarm: "border-alarm/50 text-alarm",
    calm: "border-calm/40 text-calm",
  } as const;

  return (
    <span
      className={cx(
        "smallcaps inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] leading-none",
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
    <div className="rounded-card border border-dashed border-line px-5 py-8 text-center">
      <p className="text-sm leading-relaxed text-paper-faint">{children}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

/* --- controls ------------------------------------------------------------- */

type ButtonTone = "gold" | "quiet" | "ghost" | "danger";

const buttonTones: Record<ButtonTone, string> = {
  gold: "bg-gold text-ink hover:bg-gold/90 disabled:bg-gold-dim disabled:text-ink/60",
  quiet:
    "border border-line bg-surface text-paper hover:border-gold-dim disabled:opacity-50",
  ghost: "text-paper-dim hover:text-paper disabled:opacity-40",
  danger: "border border-alarm/50 text-alarm hover:bg-alarm/10",
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
        "smallcaps inline-flex items-center justify-center gap-2 rounded-md px-4 py-2.5 text-xs transition-colors disabled:cursor-not-allowed",
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
        "smallcaps inline-flex items-center justify-center gap-2 rounded-md px-4 py-2.5 text-xs transition-colors",
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
  "w-full rounded-md border border-line bg-ink-raised px-3 py-2.5 text-[0.95rem] text-paper placeholder:text-paper-faint focus:border-gold-dim focus:outline-none";

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
