/**
 * The journal files itself (0063).
 *
 * Every entry goes in one FOLDER — the five Know yourself areas — or none,
 * shown as "Other", and gets up to three LABELS for what it is about. The
 * filing is done here, from the words written, in the app: it needs no model
 * and no key, it is the same every time, and it never leaves the device's
 * session. A person can move or relabel any entry; once they have, it is
 * theirs (`filed_by = 'you'`) and nothing here refiles it.
 */

import { AREAS } from "./know";

export const FOLDERS = AREAS;
export type Folder = (typeof FOLDERS)[number];

export const MAX_LABELS = 8;
const AUTO_LABELS = 3;

/** Each label belongs to one folder and is suggested by the starts of words. */
const THEMES: { label: string; folder: Folder; cues: string[] }[] = [
  { label: "sleep", folder: "Health", cues: ["sleep", "slept", "tired", "exhaust", "insomnia", "nap ", "rest "] },
  { label: "exercise", folder: "Health", cues: ["gym", "workout", "exercise", "run ", "running", "ran ", "walk", "yoga", "train", "swim"] },
  { label: "food", folder: "Health", cues: ["ate ", "eat", "food", "diet", "meal", "cook", "drink", "alcohol"] },
  { label: "mood", folder: "Health", cues: ["anxi", "stress", "sad", "low ", "anger", "depress", "overwhelm", "calm", "happy", "angry", "lonely", "mood"] },
  { label: "body", folder: "Health", cues: ["ill ", "sick", "pain ", "painful", "doctor", "headache", "injur", "health", "hospital"] },

  { label: "family", folder: "Relationships", cues: ["mum", "mom", "dad", "mother", "father", "brother", "sister", "family", "parent", "son ", "sons ", "daughter", "kids", "child", "nan ", "grandma", "grandad", "grandparent"] },
  { label: "partner", folder: "Relationships", cues: ["wife", "husband", "girlfriend", "boyfriend", "partner", "dating", "relationship", "marri"] },
  { label: "friends", folder: "Relationships", cues: ["friend", "mate ", "mates "] },
  { label: "conflict", folder: "Relationships", cues: ["argu", "fight", "fell out", "upset with", "row with"] },

  { label: "spending", folder: "Money", cues: ["spent", "spend", "bought", "shopping", "purchase"] },
  { label: "saving", folder: "Money", cues: ["save", "saving", "invest", "pension"] },
  { label: "bills", folder: "Money", cues: ["bill", "rent", "mortgage", "debt", "loan", "overdraft", "tax "] },
  { label: "income", folder: "Money", cues: ["salary", "paid", "income", "invoice", "money", "earn", "wage"] },

  { label: "career", folder: "Work", cues: ["job", "career", "boss", "promotion", "interview", "work", "office", "hired", "fired"] },
  { label: "focus", folder: "Work", cues: ["focus", "procrastinat", "distract", "productive", "deadline"] },
  { label: "business", folder: "Work", cues: ["business", "launch", "customer", "startup", "client", "pitch", "investor", "funding"] },
  { label: "team", folder: "Work", cues: ["colleague", "team", "meeting", "manager"] },
  { label: "project", folder: "Work", cues: ["project", "build", "built", "ship", "app "] },

  { label: "faith", folder: "Purpose", cues: ["god ", "pray", "church", "faith", "spiritual", "bible", "mosque", "meditat"] },
  { label: "gratitude", folder: "Purpose", cues: ["grateful", "thankful", "gratitude", "blessed"] },
  { label: "goals", folder: "Purpose", cues: ["goal", "plan ", "plans ", "planning", "dream", "vision", "ambition", "resolution"] },
  { label: "meaning", folder: "Purpose", cues: ["purpose", "meaning", "values", "why i"] },
  { label: "growth", folder: "Purpose", cues: ["learn", "growth", "grow", "read ", "reading", "book", "habit", "improv", "change myself"] },
];

export interface Filing {
  folder: Folder | null;
  labels: string[];
}

/** Count how often a cue begins a word (or matches a phrase) in the text. */
function hits(text: string, cue: string): number {
  const escaped = cue.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const tail = cue.endsWith(" ") ? "\\b" : "";
  const re = new RegExp(`\\b${escaped}${tail}`, "g");
  return text.match(re)?.length ?? 0;
}

/**
 * File one entry: the folder with the most cues, and its strongest labels
 * (from any folder). An entry with no cues at all goes in no folder — "Other"
 * — rather than a guess.
 */
export function fileEntry(body: string): Filing {
  const text = ` ${body.toLowerCase()} `;
  const scored = THEMES.map((t) => ({ ...t, n: t.cues.reduce((a, c) => a + hits(text, c), 0) })).filter((t) => t.n > 0);
  if (!scored.length) return { folder: null, labels: [] };

  const byFolder = new Map<Folder, number>();
  for (const t of scored) byFolder.set(t.folder, (byFolder.get(t.folder) ?? 0) + t.n);
  const folder = [...FOLDERS].sort((a, b) => (byFolder.get(b) ?? 0) - (byFolder.get(a) ?? 0))[0];

  const labels = scored
    .sort((a, b) => b.n - a.n || THEMES.indexOf(a) - THEMES.indexOf(b))
    .slice(0, AUTO_LABELS)
    .map((t) => t.label);
  return { folder, labels };
}

/** A label as stored: lower case, single spaces, no #, at most 24 characters. */
export function cleanLabel(raw: string): string {
  return raw.replace(/#/g, "").trim().toLowerCase().replace(/\s+/g, " ").slice(0, 24);
}

/** Clean, de-duplicate and cap a set of labels. */
export function cleanLabels(raw: string[]): string[] {
  return [...new Set(raw.map(cleanLabel).filter(Boolean))].slice(0, MAX_LABELS);
}

export function isFolder(v: unknown): v is Folder {
  return typeof v === "string" && (FOLDERS as readonly string[]).includes(v);
}

/** Folder name for display: none is "Other". */
export function folderName(folder: string | null): string {
  return folder ?? "Other";
}
