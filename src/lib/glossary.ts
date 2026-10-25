/**
 * The governance words a newcomer meets, in one sentence each. Used by the
 * first-run notes on each tab so the same word means the same thing
 * everywhere. Keep them to what the app actually does.
 */
export const GLOSSARY: Record<string, string> = {
  Proposal: "A written change put to a group or a place: the problem, the change, its cost and who it affects. Fixed once submitted.",
  "Universal Laws": "The ten principles every proposal and business is read against. A violation ends a proposal; tension is published for people to weigh.",
  Alignment: "How well a proposal sits with the ten Universal Laws, from 0 to 1, read by the AI. At 0.618 or above it is released to the people it is addressed to. Your own response has an alignment too: how right it feels to you, published without your name once it closes.",
  Conditions: "The requirements set for one proposal before anyone responds: how many voices, who must be reached, which questions must be answered. Once they are met, the proposal passes.",
  Decision: "What a proposal became when it closed, with every response's numbers (no names) and the spread, so a split shows as a split.",
  Activation: "When a passed proposal becomes a project, once every need has someone against it.",
  Reflection: "The written account of what actually happened. A project cannot finish without one.",
  Steward: "A member who looks after a group: its purpose, invitations and needs. A steward cannot see anybody's private space or ballot.",
  Sphere: "An area of life a proposal touches, such as Health or Ecology. You can rate how much each matters to you; others see only the average.",
  SOV: "A record of finished contributions. A simulation, labelled as one — not money and not a token.",
};

export type GlossaryTerm = keyof typeof GLOSSARY;

/** Which words each tab's first-run note explains. */
export const SPACE_TERMS: Record<"individual" | "connection" | "search" | "market" | "collective", string[]> = {
  individual: ["SOV", "Sphere"],
  connection: ["Steward", "Proposal"],
  search: ["Sphere", "Proposal", "Decision"],
  market: ["Universal Laws"],
  collective: ["Proposal", "Universal Laws", "Conditions", "Alignment", "Decision", "Activation", "Reflection"],
};
