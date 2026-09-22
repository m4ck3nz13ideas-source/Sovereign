/**
 * The Ten Universal Laws.
 *
 * From "Individual Collectivism & Sovereign — Heaven on Earth":
 *
 *   "Moral law precedes legal code and forms the guiding constitution of all
 *    human creation."
 *
 *   "All software logic, consensus rules, and token mechanics must operate
 *    within the boundaries of Universal Law. Law constrains computation;
 *    computation enforces law."
 *
 * These are not a rubric. A rubric scores; a law invalidates. A proposal that
 * violates one of these cannot pass whatever the resonance says — enforcement
 * is "logical invalidation of non-aligned actions", not a vote that can be won.
 *
 * WHY THIS FILE IS CONSTANTS AND NOT DATA
 *
 * The laws are protocol invariants. Putting them in a table would imply a
 * steward could edit them, and the paper is explicit that amending one requires
 * the agreement of ALL users — not a threshold, not a majority, all. Until that
 * mechanism exists, the honest representation is code that ships with the
 * build, visible to every member at /settings/law and changeable only by
 * changing the build.
 *
 * The `clause` on several laws matters. Sanctity of Life is not "never harm" —
 * it is "no system may knowingly destroy it WITHOUT URGENT CAUSE to preserve
 * greater life". The exception is part of the law, so the audit applies it
 * rather than a human overriding the verdict afterwards.
 */

export type LawId =
  | "sanctity_of_life"
  | "truth_and_transparency"
  | "sovereignty_of_the_individual"
  | "equity_and_justice"
  | "subsidiarity"
  | "reciprocity_and_mutual_care"
  | "stewardship_of_earth"
  | "harmony_of_diversity"
  | "right_use_of_power"
  | "continuous_evolution";

/** A proposal is aligned, in tension, or in violation. Only the last is fatal. */
export type LawVerdict = "aligned" | "tension" | "violation";

export interface UniversalLaw {
  id: LawId;
  /** Position in the constitution, 1–10. Not a priority order. */
  ordinal: number;
  name: string;
  /** The law as written, verbatim. Do not paraphrase. */
  text: string;
  /**
   * What a violation of this law looks like in a proposal, for the audit.
   * This is interpretation and may be refined; the `text` above may not.
   */
  violationLooksLike: string;
}

export const UNIVERSAL_LAWS: UniversalLaw[] = [
  {
    id: "sanctity_of_life",
    ordinal: 1,
    name: "Sanctity of Life",
    text: "All life — human, animal, ecological — is sacred. No system may knowingly destroy it without urgent cause to preserve greater life.",
    violationLooksLike:
      "The proposal knowingly destroys life, and no urgent cause preserving greater life is offered. Note the clause: destruction with such a cause is not a violation. Ordinary risk is not destruction.",
  },
  {
    id: "truth_and_transparency",
    ordinal: 2,
    name: "Truth & Transparency",
    text: "All governance must operate in truth. No hidden power, no manipulation. Citizens have the right to clear, honest, and accessible information.",
    violationLooksLike:
      "The proposal conceals who benefits, misstates a fact, withholds information the group needs to judge it, or depends on people not understanding it. Incompleteness is tension; concealment is violation.",
  },
  {
    id: "sovereignty_of_the_individual",
    ordinal: 3,
    name: "Sovereignty of the Individual",
    text: "Every being is free to choose their path, so long as it does not harm the freedom and dignity of others.",
    violationLooksLike:
      "The proposal binds someone who did not consent, removes a choice they currently hold, or conditions their dignity on compliance. Note the clause: a constraint that prevents harm to others is not a violation.",
  },
  {
    id: "equity_and_justice",
    ordinal: 4,
    name: "Equity & Justice",
    text: "All are equal in value. No law, system, or institution may privilege one group at the expense of another.",
    violationLooksLike:
      "The proposal advantages one group by disadvantaging another. Redress of an existing imbalance is not privilege; entrenchment of one is.",
  },
  {
    id: "subsidiarity",
    ordinal: 5,
    name: "Subsidiarity (Right Scale of Action)",
    text: "Decisions must be made at the lowest scale possible, but with solidarity at higher scales when challenges are shared.",
    violationLooksLike:
      "The proposal decides at a higher scope something the scope below could decide for itself, or pushes a shared burden downward onto a scope that cannot carry it alone.",
  },
  {
    id: "reciprocity_and_mutual_care",
    ordinal: 6,
    name: "Reciprocity & Mutual Care",
    text: "Each has a duty of care to one another and the earth. What is taken must be replenished. What is given in service returns in kind.",
    violationLooksLike:
      "The proposal takes without replenishing, or relies on someone's service with no return. Unpaid labour assumed rather than offered is the common case.",
  },
  {
    id: "stewardship_of_earth",
    ordinal: 7,
    name: "Stewardship of Earth",
    text: "Humanity holds the earth in trust for all beings and future generations. Every action must consider its impact on the web of life.",
    violationLooksLike:
      "The proposal has an ecological cost it does not account for, or trades a durable harm for a short-term gain. Not every proposal has an ecological dimension; say so rather than inventing one.",
  },
  {
    id: "harmony_of_diversity",
    ordinal: 8,
    name: "Harmony of Diversity",
    text: "Diversity (of culture, thought, nature) is not a threat but a strength. Systems must honor and protect it.",
    violationLooksLike:
      "The proposal flattens difference, excludes a way of doing things because it is unfamiliar, or requires uniformity where variety costs nothing.",
  },
  {
    id: "right_use_of_power",
    ordinal: 9,
    name: "Right Use of Power",
    text: "Power exists only to serve the common good. Any power that harms, coerces, or extracts without consent is illegitimate.",
    violationLooksLike:
      "The proposal concentrates authority without accountability, or uses an existing asymmetry to get agreement that would not otherwise be given.",
  },
  {
    id: "continuous_evolution",
    ordinal: 10,
    name: "Continuous Evolution",
    text: "No law is final. Systems must remain open to refinement, learning, and growth — as humanity matures, so must governance.",
    violationLooksLike:
      "The proposal forecloses its own revision — no end date, no review, no way to undo it, no measure by which it could be judged to have failed.",
  },
];

export const LAWS_BY_ID: Record<LawId, UniversalLaw> = Object.fromEntries(
  UNIVERSAL_LAWS.map((l) => [l.id, l]),
) as Record<LawId, UniversalLaw>;

/**
 * The golden-ratio threshold, from the paper:
 *
 *   "Proposals are ratified when collective resonance exceeds a golden-ratio
 *    threshold (≥0.618), ensuring consensus through harmony rather than
 *    dominance."
 *
 * This is specified, not chosen, which is why it lives here rather than in the
 * per-group settings a steward can edit.
 */
export const RESONANCE_THRESHOLD = 0.618;

/** Amending a law requires the agreement of every user. Stated, not inferred. */
export const AMENDMENT_RULE =
  "To change or add a Universal Law, all users must agree with the proposal and vote.";
