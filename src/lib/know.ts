/**
 * Know yourself — the assessment's content (0041, rule 39).
 *
 * Built on Tony Robbins' frameworks: the six human needs, a values hierarchy
 * (what you move toward and what you move away from), limiting and empowering
 * beliefs, and goals written as a result, a purpose and the first actions.
 * The statements and lists are written for Sovereign; nothing is quoted.
 */

export const NEEDS = ["certainty", "variety", "significance", "connection", "growth", "contribution"] as const;
export type Need = (typeof NEEDS)[number];

export const NEED_LABEL: Record<Need, string> = {
  certainty: "Certainty",
  variety: "Variety",
  significance: "Significance",
  connection: "Connection",
  growth: "Growth",
  contribution: "Contribution",
};

export const NEED_MEANING: Record<Need, string> = {
  certainty: "feeling safe, stable and in control",
  variety: "change, surprise and new experiences",
  significance: "feeling important, unique and recognised",
  connection: "closeness, love and belonging",
  growth: "learning, improving and being stretched",
  contribution: "giving beyond yourself",
};

/** Three statements per need, shuffled into a fixed order so needs are not grouped. */
export const STATEMENTS: { need: Need; text: string }[] = [
  { need: "certainty", text: "I feel uneasy when I don't know what's coming next." },
  { need: "growth", text: "If I'm not learning, I feel like I'm going backwards." },
  { need: "connection", text: "Feeling close to people matters more to me than what I achieve." },
  { need: "variety", text: "I get restless when every day looks the same." },
  { need: "contribution", text: "Helping others satisfies me more than helping myself." },
  { need: "significance", text: "It matters to me to be seen as good at what I do." },
  { need: "certainty", text: "I stick with routines that work, even when they're dull." },
  { need: "variety", text: "I'd rather try something new than perfect something old." },
  { need: "growth", text: "I go looking for challenges that stretch me." },
  { need: "significance", text: "I want my life to stand out from the ordinary." },
  { need: "connection", text: "I go out of my way to stay in touch with people I care about." },
  { need: "contribution", text: "I want what I do to make life better for people I'll never meet." },
  { need: "certainty", text: "I need to feel in control of how things turn out." },
  { need: "significance", text: "I notice when others don't recognise my effort." },
  { need: "variety", text: "Surprises energise me more than they worry me." },
  { need: "connection", text: "I feel most like myself when I'm with people I love." },
  { need: "growth", text: "I'd rather be uncomfortable and improving than comfortable and stuck." },
  { need: "contribution", text: "I feel restless if what I do only benefits me." },
];

export const TOWARD = [
  "Love", "Health", "Freedom", "Security", "Adventure", "Growth", "Contribution", "Family",
  "Friendship", "Honesty", "Achievement", "Creativity", "Peace", "Passion", "Respect", "Wisdom",
  "Faith", "Fun", "Comfort", "Success", "Justice", "Nature", "Courage", "Independence",
];

export const AWAY = [
  "Rejection", "Failure", "Humiliation", "Loneliness", "Anger", "Frustration", "Overwhelm",
  "Boredom", "Guilt", "Worry", "Being controlled", "Money trouble", "Conflict", "Uncertainty",
];

export const AREAS = ["Health", "Relationships", "Money", "Work", "Purpose"] as const;

export interface Belief {
  area: string;
  limiting: string;
  empowering: string;
}

export interface Goal {
  result: string;
  purpose: string;
  actions: string[];
}

export type NeedScores = Record<Need, number>;

/** 1–5 answers (by statement index) → 0–1 per need. */
export function scoreNeeds(answers: Record<number, number>): NeedScores {
  const out = {} as NeedScores;
  for (const need of NEEDS) {
    const idx = STATEMENTS.map((s, i) => (s.need === need ? i : -1)).filter((i) => i >= 0);
    const vals = idx.map((i) => answers[i] ?? 3);
    out[need] = Math.round(((vals.reduce((a, b) => a + b, 0) / vals.length - 1) / 4) * 100) / 100;
  }
  return out;
}

/** The two needs that drive this person most. */
export function topNeeds(scores: NeedScores, n = 2): Need[] {
  return [...NEEDS].sort((a, b) => scores[b] - scores[a]).slice(0, n);
}
