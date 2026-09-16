/**
 * Nav icons, drawn to the descriptions in life_OS.pdf.
 *
 * Stroked, not filled, at a consistent 1.4 weight. They are meant to read as
 * drawn marks rather than UI furniture.
 */

type Props = { className?: string; active?: boolean };

const base = "h-[22px] w-[22px]";

/** Two interlocking nodes — Connection. */
export function ConnectionIcon({ className = "" }: Props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={`${base} ${className}`} aria-hidden>
      <circle cx="9" cy="12" r="4.2" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="15" cy="12" r="4.2" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

/** A branching tree or pipe — Pipeline. */
export function PipelineIcon({ className = "" }: Props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={`${base} ${className}`} aria-hidden>
      <path
        d="M12 21V11m0 0c0-2.5 1.6-4 4.2-4.6M12 11c0-2.9-1.7-4.4-4.4-5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <circle cx="17.2" cy="5.8" r="1.7" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="6.8" cy="5.2" r="1.7" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

/** A curved line becoming dots — Reflection. */
export function ReflectionIcon({ className = "" }: Props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={`${base} ${className}`} aria-hidden>
      <path
        d="M3 16c3.4 0 5-7 8.2-7 1.7 0 2.4 1.6 2.9 3"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <circle cx="16.4" cy="13.6" r="0.95" fill="currentColor" />
      <circle cx="19.2" cy="14.8" r="0.8" fill="currentColor" />
      <circle cx="21.4" cy="15.8" r="0.65" fill="currentColor" />
    </svg>
  );
}

/** A simple flame — Profile. */
export function ProfileIcon({ className = "" }: Props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={`${base} ${className}`} aria-hidden>
      <path
        d="M12 3c0 3-3.2 4-3.2 7.4A3.2 3.2 0 0 0 12 13.6a3.2 3.2 0 0 0 3.2-3.2C15.2 7 12 6 12 3Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path
        d="M6.6 12.6c-.4 1-.6 2-.6 3 0 3.2 2.7 5.4 6 5.4s6-2.2 6-5.4c0-1-.2-2-.6-3"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

/* --- Launch mode tiles ---------------------------------------------------- */

export function QuillIcon({ className = "" }: Props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={`h-7 w-7 ${className}`} aria-hidden>
      <path d="M4 20c6-1 9.5-4 12-8.5C18.5 7 19 4.5 19 4.5S16 5 12 7C7.6 9.2 5 13 4 20Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M4 20c2.5-2.6 4.8-4.6 8-6.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export function FlameIcon({ className = "" }: Props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={`h-7 w-7 ${className}`} aria-hidden>
      <path d="M12 2.5c.4 3.6-2.8 4.8-2.8 8.1A2.9 2.9 0 0 0 12 13.5a2.9 2.9 0 0 0 2.8-2.9C14.8 7.3 11.6 6.1 12 2.5Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M6.8 12.2A7 7 0 0 0 6 15.4c0 3.4 2.7 6.1 6 6.1s6-2.7 6-6.1a7 7 0 0 0-.8-3.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export function SparkIcon({ className = "" }: Props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={`h-7 w-7 ${className}`} aria-hidden>
      <path d="M12 3v3.2M12 17.8V21M3 12h3.2M17.8 12H21M5.6 5.6l2.3 2.3M16.1 16.1l2.3 2.3M18.4 5.6l-2.3 2.3M7.9 16.1l-2.3 2.3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="12" cy="12" r="2.6" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

export function BroadcastIcon({ className = "" }: Props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={`h-7 w-7 ${className}`} aria-hidden>
      <path d="M12 20V5.5M12 5.5 7.4 10M12 5.5 16.6 10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 16.5a8 8 0 0 1 14 0" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.55" />
    </svg>
  );
}

/* --- small utility icons -------------------------------------------------- */

export function CheckIcon({ className = "" }: Props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={`h-4 w-4 ${className}`} aria-hidden>
      <path d="m5 12.5 4.5 4.5L19 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function AlertIcon({ className = "" }: Props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={`h-4 w-4 ${className}`} aria-hidden>
      <path d="M12 8.5v5M12 17h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function ChevronIcon({ className = "" }: Props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={`h-4 w-4 ${className}`} aria-hidden>
      <path d="m9 5 7 7-7 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
