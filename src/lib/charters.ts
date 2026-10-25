/**
 * A group's charter (0057): what it is for, what it is trying to do, the
 * values it holds, who may invite, who may propose, and what the AI should
 * weigh when it sets each proposal's conditions.
 *
 * While a group has fewer than CHARTER_FOUNDING_SIZE members its stewards
 * write it directly. From then on it changes only by a passed proposal that
 * carries a `charter_change` — the fields it changes, nothing else — and is
 * enacted the moment it passes. Mirrors `charter_founding_size()` and
 * `charter_change_problem()` in Postgres, which are the copies that decide.
 *
 * Not in any charter, because they are the constitution: the ten Universal
 * Laws, release at 0.618, critical flags, secret ballots and the floors on
 * conditions. `FIXED_FOR_EVERY_GROUP` says so on the charter page.
 */

export const CHARTER_FOUNDING_SIZE = 3;

export type Who = "stewards" | "members";

export interface Charter {
  purpose: string;
  goal: string;
  group_values: string[];
  inviters: Who;
  proposers: Who;
  ai_context: string;
}

export type CharterField = keyof Charter;
export type CharterChange = Partial<Charter>;

export const CHARTER_FIELDS: CharterField[] = [
  "purpose",
  "goal",
  "group_values",
  "inviters",
  "proposers",
  "ai_context",
];

export const FIELD_LABEL: Record<CharterField, string> = {
  purpose: "What it is for",
  goal: "What it is trying to do",
  group_values: "Its values",
  inviters: "Who can invite people in",
  proposers: "Who can propose",
  ai_context: "What the AI should weigh",
};

export const WHO_LABEL: Record<Who, string> = {
  stewards: "Stewards only",
  members: "Any member",
};

export const FIXED_FOR_EVERY_GROUP = [
  "The ten Universal Laws. A violation ends a proposal.",
  "Released only at 0.618 alignment with the laws.",
  "Each proposal passes on its own conditions, set by the AI and public.",
  "Responses are secret; tallies are published with their spread.",
  "Critical flags and law tensions are answered in writing, never dismissed.",
];

export type TemplateId = "friends" | "coop" | "neighbourhood" | "project" | "custom";

export interface Template {
  id: TemplateId;
  name: string;
  /** One line, for the picker. */
  line: string;
  charter: Omit<Charter, "purpose" | "goal" | "group_values"> & {
    purposeHint: string;
    goalHint: string;
    values: string[];
  };
}

export const TEMPLATES: Template[] = [
  {
    id: "friends",
    name: "Friends",
    line: "A few people deciding things together, informally.",
    charter: {
      purposeHint: "Plan trips, share costs and decide things without one person carrying it.",
      goalHint: "Two trips a year that everyone can afford.",
      values: ["Fairness", "Honesty", "Fun"],
      inviters: "members",
      proposers: "members",
      ai_context:
        "Small group of friends. Keep conditions light: most decisions are small and reversible. Money matters to some of us more than others — weigh cost fairly.",
    },
  },
  {
    id: "coop",
    name: "Co-op or business",
    line: "Shared money, shared work, decisions with consequences.",
    charter: {
      purposeHint: "Run the business together and share what it earns.",
      goalHint: "Break even by the end of the year without cutting anyone's pay.",
      values: ["Craft", "Fairness", "Transparency"],
      inviters: "stewards",
      proposers: "members",
      ai_context:
        "Members share money and liability. Anything that spends shared money or commits us to a contract should need most members and an answered cost question.",
    },
  },
  {
    id: "neighbourhood",
    name: "Neighbourhood",
    line: "A street, estate or village looking after shared space.",
    charter: {
      purposeHint: "Look after the street and the spaces we share.",
      goalHint: "A tidier street and a garden everyone can use by spring.",
      values: ["Care", "Respect", "Stewardship"],
      inviters: "members",
      proposers: "members",
      ai_context:
        "Neighbours of different ages and means. Anything that affects homes nearby — noise, parking, shared spaces — should reach the households affected before it passes.",
    },
  },
  {
    id: "project",
    name: "Project team",
    line: "A team with a goal and a deadline.",
    charter: {
      purposeHint: "Deliver one project well and on time.",
      goalHint: "Launch by the date we agreed, within budget.",
      values: ["Ownership", "Candour", "Pace"],
      inviters: "stewards",
      proposers: "members",
      ai_context:
        "Time matters. Prefer short windows and clear owners. Changes to scope or budget should be answered by whoever would do the work.",
    },
  },
  {
    id: "custom",
    name: "Start blank",
    line: "Write your own.",
    charter: {
      purposeHint: "",
      goalHint: "",
      values: [],
      inviters: "stewards",
      proposers: "members",
      ai_context: "",
    },
  },
];

export function templateById(id: string | null | undefined): Template | null {
  return TEMPLATES.find((t) => t.id === id) ?? null;
}

/** A group row as the charter sees it. */
export function charterOf(g: {
  purpose?: string | null;
  goal?: string | null;
  group_values?: string[] | null;
  inviters?: string | null;
  proposers?: string | null;
  ai_context?: string | null;
}): Charter {
  return {
    purpose: g.purpose ?? "",
    goal: g.goal ?? "",
    group_values: g.group_values ?? [],
    inviters: g.inviters === "members" ? "members" : "stewards",
    proposers: g.proposers === "stewards" ? "stewards" : "members",
    ai_context: g.ai_context ?? "",
  };
}

const norm = (v: unknown) =>
  Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean).join("|") : String(v ?? "").trim();

/** Only the fields that differ from the charter as it stands. */
export function diffCharter(current: Charter, next: Charter): CharterChange {
  const out: CharterChange = {};
  for (const f of CHARTER_FIELDS) {
    if (norm(current[f]) !== norm(next[f])) {
      (out as Record<string, unknown>)[f] = f === "group_values"
        ? [...new Set((next[f] as string[]).map((x) => x.trim()).filter(Boolean))].slice(0, 12)
        : typeof next[f] === "string"
          ? (next[f] as string).trim()
          : next[f];
    }
  }
  return out;
}

/** Why a change cannot be proposed, or null. Mirrors `charter_change_problem()`. */
export function charterChangeProblem(c: unknown): string | null {
  if (!c || typeof c !== "object" || Array.isArray(c) || !Object.keys(c).length) {
    return "A charter change names at least one thing it changes.";
  }
  const o = c as Record<string, unknown>;
  for (const k of Object.keys(o)) {
    if (!(CHARTER_FIELDS as string[]).includes(k)) return `${k} is not part of a charter.`;
  }
  if ("inviters" in o && o.inviters !== "stewards" && o.inviters !== "members") return "Who may invite is stewards or members.";
  if ("proposers" in o && o.proposers !== "stewards" && o.proposers !== "members") return "Who may propose is stewards or members.";
  if ("group_values" in o && (!Array.isArray(o.group_values) || o.group_values.length > 12)) return "A group holds up to twelve values.";
  if (typeof o.goal === "string" && o.goal.trim().length > 600) return "A goal is up to 600 characters.";
  if (typeof o.ai_context === "string" && o.ai_context.trim().length > 1200) return "The context for the AI is up to 1,200 characters.";
  return null;
}

function show(f: CharterField, v: unknown): string {
  if (f === "inviters" || f === "proposers") return WHO_LABEL[(v as Who) ?? "stewards"];
  if (f === "group_values") return (v as string[]).length ? (v as string[]).join(", ") : "(none)";
  const s = String(v ?? "").trim();
  return s || "(blank)";
}

/**
 * The change in words, one line per field: what it says now, and what it
 * would say. This is written into the proposal's body (draftBody), so the
 * sharpening, the law audit and every reader see exactly what would be
 * enacted.
 */
export function charterChangeLines(current: Charter, change: CharterChange): string[] {
  return CHARTER_FIELDS.filter((f) => f in change).map(
    (f) => `${FIELD_LABEL[f]}: from "${show(f, current[f])}" to "${show(f, change[f])}"`,
  );
}

/** Pack a change into a URL-safe string, for the step from charter to composer. */
export function packChange(c: CharterChange): string {
  const bytes = new TextEncoder().encode(JSON.stringify(c));
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function unpackChange(s: string | undefined | null): CharterChange | null {
  if (!s) return null;
  try {
    const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
    const bytes = Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
    const v = JSON.parse(new TextDecoder().decode(bytes));
    return charterChangeProblem(v) ? null : (v as CharterChange);
  } catch {
    return null;
  }
}
