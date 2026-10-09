/**
 * Learn — the lessons (0044, rule 41).
 *
 * Content ships with the build, like the laws: a lesson is not a row anybody
 * can edit. What the database holds is the person's side — what they finished
 * and what they wrote — and only they can read it.
 *
 * Four courses: how Sovereign works, the Universal Laws, knowing yourself
 * more deeply, and the Spheres. "For you" picks from all four using the
 * person's own Know yourself results; that choice happens here, on their
 * request, and is stored nowhere.
 *
 * The voice is the product's: plain, direct, no congratulation.
 */

import { NEED_LABEL, NEEDS, topNeeds, type Need, type NeedScores } from "./know";
import { SPHERES, type SphereId } from "./spheres";
import { UNIVERSAL_LAWS, type LawId } from "./universal-law";

export type CourseId = "start" | "laws" | "self" | "spheres";

export interface Lesson {
  id: string;
  course: CourseId;
  title: string;
  minutes: number;
  /** Paragraphs. */
  body: string[];
  /** The question the reflection box asks: what is true for you. */
  ask: string;
  /** For law lessons, the law itself, quoted verbatim from universal-law.ts. */
  law?: LawId;
  /** For sphere lessons. */
  sphere?: SphereId;
  /** For Know yourself lessons. */
  need?: Need;
}

export interface Course {
  id: CourseId;
  title: string;
  blurb: string;
}

export const COURSES: Course[] = [
  { id: "start", title: "How Sovereign works", blurb: "From an idea to a decision to a finished project, and what keeps it honest." },
  { id: "laws", title: "The Universal Laws", blurb: "The ten laws every proposal is read against, and what they ask of you." },
  { id: "self", title: "Know yourself, deeper", blurb: "Needs, values, beliefs and goals: what drives you, and how to steer it." },
  { id: "spheres", title: "The Spheres", blurb: "Health to Tech: what each covers, and the questions proposals in it tend to miss." },
];

/* --------------------------------------------------------------- how it works */

const START: Lesson[] = [
  {
    id: "start-proposals",
    course: "start",
    title: "A proposal is one specific thing",
    minutes: 3,
    body: [
      "A proposal is not a topic, a complaint or a wish. It is a specific thing you want a group or a place to do: what is going wrong, what would change, what it takes, what could go wrong, and what else you considered — including doing nothing.",
      "Before it can be submitted, a draft is sharpened. The AI points to what is still unanswered, and the draft has to clear a bar before anybody else sees it. Until then it lives only on your device.",
      "Once submitted, the text is fixed. Changes go into the discussion as amendments, and a proposal that fails can be taken up again as a new one that says what it changed.",
    ],
    ask: "What is one thing near you that should be different? Write it as a change, not a complaint.",
  },
  {
    id: "start-review",
    course: "start",
    title: "The AI reads first, and you read before you respond",
    minutes: 3,
    body: [
      "Every proposal is read by the AI before anybody responds: how clear it is, what evidence it rests on, whether it can be done, whether it can be undone, and how it sits with each of the ten Universal Laws.",
      "A violation of a law ends a proposal. Tension does not — it is named, so people can weigh it. Flags the AI raises have to be answered on the record by a person, never dismissed.",
      "You cannot respond to a proposal you have not opened. Understanding before action is enforced by the database, not by good intentions.",
    ],
    ask: "When did you last decide something important before you understood it? What would have changed if you had read first?",
  },
  {
    id: "start-conditions",
    course: "start",
    title: "Each proposal sets its own conditions",
    minutes: 4,
    body: [
      "There are no fixed rules by size. Each proposal gets its own conditions from the AI: how many voices it needs, what has to be answered on the record, and which groups must have had a real chance to take part — tenants of a block, the youth club, the people on a rota.",
      "A time window is optional. A clock can run out while the people affected have never seen the proposal, so where a window would not help, there is none: the proposal is decided when its conditions are met, and nobody can close it before then.",
      "Once anybody has responded, the conditions are fixed. Nobody moves the goalposts mid-vote.",
    ],
    ask: "Think of a decision that affected you without you having a say. Who should have had to reach you, and how?",
  },
  {
    id: "start-challenges",
    course: "start",
    title: "Challenges are for debate, never a stall",
    minutes: 3,
    body: [
      "If you think a proposal's conditions are not enough, challenge them. Anybody it reaches can, as many times as they like, and anybody can reply. It becomes a debate on the record.",
      "Before anybody has responded, a challenge can make the AI read the conditions again with your argument. It can only add — more voices, more requirements, more groups reached, a longer window. Nothing is ever removed.",
      "A challenge never blocks a decision. After people respond, it is an argument others can read, and the way to act on it is an improved proposal that replaces this one.",
    ],
    ask: "What is the difference, for you, between disagreeing to improve something and disagreeing to stop it?",
  },
  {
    id: "start-resonance",
    course: "start",
    title: "Resonance, not yes or no",
    minutes: 3,
    body: [
      "You do not vote yes or no. You say how far a proposal aligns with what matters, how confident you are, and how urgent it is — each on a scale.",
      "Nobody sees the running average until the proposal closes. A live score makes people follow the crowd, which is exactly what resonance exists to stop. You can see how many have responded, never which way it is leaning.",
      "A proposal passes when alignment clears the group's threshold — by default 0.618 — and its own conditions are met.",
    ],
    ask: "When have you changed your answer because you saw what everybody else said?",
  },
  {
    id: "start-projects",
    course: "start",
    title: "After it passes",
    minutes: 3,
    body: [
      "A passed proposal becomes a project with tasks and people. Passing is not the end; doing it is.",
      "A project cannot be marked complete without a reflection: what actually happened, compared with what was promised. That record is what the AI reads back the next time somebody proposes something similar, so the community learns from what it did, not just what it said.",
    ],
    ask: "What is something you finished recently? What happened that you did not expect?",
  },
  {
    id: "start-sov",
    course: "start",
    title: "SOV: earned and held",
    minutes: 3,
    body: [
      "SOV is issued for finished acts — a project completed, a flag answered, a prediction marked. Nothing mints for posting, following, being liked or turning up, and nothing mints for finishing lessons here.",
      "There are two figures. Earned only goes up and cannot be sent or received: it is what you did. Held is what you have now, which can move between people. Holding SOV never buys a say in a decision.",
      "Nobody can read anybody else's holding. There is no league table, by design.",
    ],
    ask: "What would you do here if nothing you did was ever counted?",
  },
  {
    id: "start-market",
    course: "start",
    title: "The Market: for people, not profit",
    minutes: 3,
    body: [
      "The Market is trade bound by the Universal Laws. A business is listed only after the AI has read it against all ten laws, a person has signed that reading off, and its website has been verified as really theirs.",
      "Paying buys visibility, never approval. The one sponsored slot goes to the business that best fits your own values, not the one that bid the most.",
    ],
    ask: "Which business near you would you be proud to see here, and why?",
  },
  {
    id: "start-privacy",
    course: "start",
    title: "What is yours stays yours",
    minutes: 2,
    body: [
      "Individual is private by rule, not by setting: your journal, ideas, to-dos, Know yourself, and everything you write here are readable by you and nobody else — not a group, not a reviewer.",
      "Nothing you write in Learn is used to decide anything, and nothing collective can read it. Every screen tells you who can read it; the eye icon is the answer.",
    ],
    ask: "What would you write if you knew nobody else would ever read it?",
  },
];

/* --------------------------------------------------------------- the laws */

const LAW_NOTES: Record<LawId, { body: string[]; ask: string }> = {
  sanctity_of_life: {
    body: [
      "Life comes first — human, animal and ecological. The law has a clause that matters: harm is not forbidden absolutely, only harm without urgent cause to preserve greater life.",
      "So ordinary risk is not a violation. A proposal that knowingly destroys life with no such cause is, and no amount of support can pass it.",
    ],
    ask: "Where in your own life do you trade a little harm for something you value? Is the cause urgent?",
  },
  truth_and_transparency: {
    body: [
      "Governance runs in the open. Nobody gets hidden power, and everybody has the right to clear, honest information.",
      "In a proposal, incompleteness is tension: something is missing and should be filled in. Concealment is violation: who benefits is hidden, or a fact is misstated, or it only works if people do not understand it.",
    ],
    ask: "Is there something you keep from people because the truth would be inconvenient rather than harmful?",
  },
  sovereignty_of_the_individual: {
    body: [
      "Every person owns themselves: their body, their mind, their data. A collective can decide shared things; it cannot decide you.",
      "This is why Individual is private by rule, and why a proposal that would coerce or surveil people runs into this law.",
    ],
    ask: "Where do you let other people decide things that are yours to decide?",
  },
  equity_and_justice: {
    body: [
      "Everybody gets a fair base start, and harm is repaired rather than simply punished.",
      "Look for who carries the cost of a proposal and who gets the benefit. When they are different people, the law asks whether that is fair and what is owed.",
    ],
    ask: "Where did you get a fairer start than others, or a worse one? What follows from that?",
  },
  subsidiarity: {
    body: [
      "Decisions belong at the smallest scale that can make them well. A street decides its street; the world decides what only the world can.",
      "A proposal that takes a decision away from the people closest to it, without needing to, is in tension with this law.",
    ],
    ask: "What decision in your life is being made further away from you than it needs to be?",
  },
  reciprocity_and_mutual_care: {
    body: [
      "We look after each other, and what we take we give back. Care is not charity; it is how a community keeps working.",
      "A proposal that only ever takes from some people for others, with nothing coming back, sits poorly with this law.",
    ],
    ask: "Who looks after you, and who do you look after? Is it balanced?",
  },
  stewardship_of_earth: {
    body: [
      "We hold the Earth in trust for those who come after us. Today's convenience does not outrank tomorrow's world.",
      "Proposals are read for what they leave behind: waste, damage, and what cannot be undone.",
    ],
    ask: "What will you leave behind that somebody else will have to deal with?",
  },
  harmony_of_diversity: {
    body: [
      "Difference is strength, not a problem to be solved. People can disagree, believe differently and live differently, and still decide together.",
      "A proposal that makes one way of living the only acceptable one is in tension with this law, however good that way looks.",
    ],
    ask: "Whose way of life do you find hardest to respect? What would it take to understand it?",
  },
  right_use_of_power: {
    body: [
      "Power is for serving, not ruling. Whoever holds it answers for it.",
      "This is why stewards cannot close a proposal early, why paying buys visibility and never approval, and why holding SOV never buys a say.",
    ],
    ask: "Where do you hold power over someone, even a little? Are you using it for them?",
  },
  continuous_evolution: {
    body: [
      "Nothing here is finished. Laws can be amended — by everybody, openly, never quietly — and every project ends with a reflection so the next attempt is better.",
      "A failed proposal is information, not shame. The record of what did not work is what makes the next one wiser.",
    ],
    ask: "What did you get wrong recently that taught you something?",
  },
};

const LAWS: Lesson[] = UNIVERSAL_LAWS.map((l) => ({
  id: `law-${l.id.replaceAll("_", "-")}`.slice(0, 64),
  course: "laws",
  title: `${l.ordinal}. ${l.name}`,
  minutes: 2,
  law: l.id,
  body: LAW_NOTES[l.id].body,
  ask: LAW_NOTES[l.id].ask,
}));

/* --------------------------------------------------------------- yourself */

const NEED_NOTES: Record<Need, { body: string[]; ask: string }> = {
  certainty: {
    body: [
      "Certainty is the need to feel safe and in control: to know the rent is paid, the plan will hold, the people around you are steady.",
      "Fed well, it gives you a base to build from. Fed badly, it looks like control, worry and avoiding anything new. The healthiest certainty is trust in yourself to handle what comes, rather than trying to make sure nothing comes.",
    ],
    ask: "What do you do to feel certain that actually makes you smaller?",
  },
  variety: {
    body: [
      "Variety is the need for change, surprise and challenge. Without it life feels flat; with too much of it nothing gets finished.",
      "Fed well, it looks like learning new things, travel, play. Fed badly, it looks like drama, distraction and starting again rather than going deeper.",
    ],
    ask: "Where do you go for variety when you are bored? Does it leave you better or worse?",
  },
  significance: {
    body: [
      "Significance is the need to matter: to be seen, recognised, needed. Everybody has it.",
      "Fed well, it comes from being excellent at something or from what you give. Fed badly, it comes from status, being right, or being the one with the biggest problem.",
    ],
    ask: "When do you feel you matter most? Is that something you do, or something others give you?",
  },
  connection: {
    body: [
      "Connection is the need for closeness and belonging. It is what makes hard things bearable.",
      "Fed well, it comes from honesty and showing up for people. Fed badly, it comes from pleasing, merging into others or staying in something that is not good for you because leaving would be lonely.",
    ],
    ask: "Who do you feel most yourself with? When did you last tell them?",
  },
  growth: {
    body: [
      "Growth is the need to keep improving. If you are not growing, you feel it — even when everything else is fine.",
      "It is one of the two needs that tend to bring lasting fulfilment rather than a quick fix. Pick one thing you want to be better at in a year and do one small part of it this week.",
    ],
    ask: "What would you like to be better at in a year's time?",
  },
  contribution: {
    body: [
      "Contribution is the need to give beyond yourself: to make something better for somebody else, including people you will never meet.",
      "Alongside growth, it is the need most linked to a life that feels worth it. Sovereign is built on it — a proposal is contribution, so is a project, so is answering a flag well.",
    ],
    ask: "Who would be better off if you gave an hour a week to them?",
  },
};

const SELF: Lesson[] = [
  ...NEEDS.map<Lesson>((n) => ({
    id: `self-${n}`,
    course: "self",
    title: `The need for ${NEED_LABEL[n].toLowerCase()}`,
    minutes: 3,
    need: n,
    body: NEED_NOTES[n].body,
    ask: NEED_NOTES[n].ask,
  })),
  {
    id: "self-values",
    course: "self",
    title: "What you move toward, and what you run from",
    minutes: 4,
    body: [
      "You are pulled by some things — love, freedom, growth — and pushed by others — failure, rejection, loneliness. The order matters: when two of your values clash, the higher one wins, usually without you noticing.",
      "Many people find their strongest away-from value runs their life more than any toward value. Fear of failure can quietly outrank achievement. Seeing the order is the first step to choosing it.",
    ],
    ask: "When your top two values clashed recently, which one won? Was that the one you would choose?",
  },
  {
    id: "self-beliefs",
    course: "self",
    title: "The beliefs that hold you back",
    minutes: 4,
    body: [
      "A limiting belief sounds like a fact: \"I'm not a money person\", \"people like me don't\". It was usually learned from one or two experiences and never checked again.",
      "A useful test: what has this belief cost you, and what would it cost to keep it for ten more years? Then write the belief you would rather hold, and one thing you would do this week if it were true.",
    ],
    ask: "Write one belief that holds you back, and the one you would rather have.",
  },
  {
    id: "self-goals",
    course: "self",
    title: "Goals: result, purpose, action",
    minutes: 4,
    body: [
      "A goal written only as a result is easy to drop. Write three things: the result you want, why it matters to you, and the first actions.",
      "The purpose is what keeps you going when the result is far away. The first action should be small enough to do in the next two days. Momentum beats planning.",
    ],
    ask: "Pick one goal. Why does it matter, and what will you do in the next two days?",
  },
];

/* --------------------------------------------------------------- the spheres */

const SPHERE_NOTES: Record<SphereId, { body: string[]; misses: string; ask: string }> = {
  health: {
    body: [
      "Health covers how well people live, not only how they are treated when ill: prevention, mental health, social care, food, and the hospitals and clinics.",
      "Most of what decides a person's health happens outside a clinic — housing, work, food, loneliness. Health proposals often do the most good when they work upstream.",
    ],
    misses: "Who is not reached — people who do not come forward, cannot travel, or do not trust services — and how the effect will be measured.",
    ask: "What one change near you would make people healthier without anybody seeing a doctor?",
  },
  education: {
    body: [
      "Education is learning at every age: early years, schools, colleges, skills for new work, and libraries.",
      "The whitepaper's criticism is that education has rewarded obedience over wisdom. Proposals here are strongest when they help people think, not just pass.",
    ],
    misses: "What the learner actually wants, who is left behind, and what happens after the course ends.",
    ask: "What do you wish you had been taught, and who could you teach it to?",
  },
  ecology: {
    body: [
      "Ecology is the living world: climate and energy, nature, water, land, waste and the animals we share it with.",
      "Ecological effects are slow and spread out, which makes them easy to discount. The Stewardship of Earth law exists so they are not.",
    ],
    misses: "What it leaves behind in ten years, who downstream bears the cost, and whether it can be undone.",
    ask: "What near you is quietly getting worse for the living world?",
  },
  justice: {
    body: [
      "Justice is rights and equality, safety, how disputes are settled, and how harm is repaired.",
      "Sovereign's laws lean toward restoration over punishment: what was harmed, and what would make it right.",
    ],
    misses: "Whose voice is missing from the room, especially the people a rule would be applied to.",
    ask: "When were you treated unfairly? What would have made it right?",
  },
  economy: {
    body: [
      "Economy is work and wages, trade, tax and shared money, support for people who need it, and the cost of living.",
      "Budget envelopes — deciding together how shared money splits between Spheres — will live here next.",
    ],
    misses: "Who pays, who gains, and what it costs over time, not just to start.",
    ask: "If you could direct where £100 of your taxes went, where would it go?",
  },
  culture: {
    body: [
      "Culture is how we live together: arts, heritage, sport, faith, media and the places we gather.",
      "It is easy to treat as optional. It is often what makes a place worth living in, and what holds people together through a hard year.",
    ],
    misses: "Who it is for, who it might exclude, and whether the people it is about were asked.",
    ask: "Where do you feel you belong? What keeps that place going?",
  },
  infrastructure: {
    body: [
      "Infrastructure is the physical base: homes and planning, transport, utilities, public spaces and connectivity.",
      "It lasts decades, so the decision outlives most of the people who make it. Proposals here touch other Spheres almost every time.",
    ],
    misses: "Maintenance — who looks after it in year five — and access for people with disabilities, children and older people.",
    ask: "Which shared space near you would you fix first, and why?",
  },
  tech: {
    body: [
      "Tech covers digital services, data and privacy, AI, research and online safety.",
      "Technology is the one Sphere that reshapes all the others. The whitepaper's warning is that, left alone, it drifts toward control by a few.",
    ],
    misses: "Who controls the data, what happens if it fails, and who cannot use it.",
    ask: "Which piece of technology runs more of your life than you chose?",
  },
};

const SPHERE_LESSONS: Lesson[] = SPHERES.map((s) => ({
  id: `sphere-${s.id}`,
  course: "spheres",
  title: s.name,
  minutes: 3,
  sphere: s.id,
  body: [
    ...SPHERE_NOTES[s.id].body,
    `Areas: ${s.areas.map((a) => a.name).join(", ")}.`,
    `What proposals here tend to miss: ${SPHERE_NOTES[s.id].misses}`,
  ],
  ask: SPHERE_NOTES[s.id].ask,
}));

/* --------------------------------------------------------------- lookups */

export const LESSONS: Lesson[] = [...START, ...LAWS, ...SELF, ...SPHERE_LESSONS];

const BY_ID = new Map(LESSONS.map((l) => [l.id, l]));

export function lesson(id: string): Lesson | null {
  return BY_ID.get(id) ?? null;
}

export function courseLessons(id: CourseId): Lesson[] {
  return LESSONS.filter((l) => l.course === id);
}

export function nextInCourse(id: string): Lesson | null {
  const l = lesson(id);
  if (!l) return null;
  const list = courseLessons(l.course);
  return list[list.indexOf(l) + 1] ?? null;
}

export function sphereLesson(sphere: string | null | undefined): Lesson | null {
  return sphere ? lesson(`sphere-${sphere}`) : null;
}

/* --------------------------------------------------------------- for you */

const SPHERE_LABEL: Record<SphereId, string> = {
  health: "Health",
  education: "Education",
  ecology: "Ecology",
  justice: "Justice",
  economy: "Economy",
  culture: "Culture",
  infrastructure: "Infrastructure",
  tech: "Tech",
};

/** Which Sphere a value someone moves toward points at. */
const VALUE_SPHERE: Record<string, SphereId> = {
  Health: "health",
  Peace: "health",
  Growth: "education",
  Wisdom: "education",
  Nature: "ecology",
  Justice: "justice",
  Honesty: "justice",
  Freedom: "justice",
  Security: "economy",
  Success: "economy",
  Achievement: "economy",
  Independence: "economy",
  Comfort: "infrastructure",
  Family: "infrastructure",
  Creativity: "culture",
  Faith: "culture",
  Fun: "culture",
  Friendship: "culture",
  Adventure: "culture",
  Passion: "culture",
  Contribution: "health",
  Love: "health",
  Respect: "justice",
  Courage: "justice",
};

export interface AssessmentLike {
  needs: NeedScores;
  values_toward: string[];
  values_away: string[];
  beliefs: unknown[];
  goals: unknown[];
}

export interface Pick {
  lesson: Lesson;
  why: string;
}

/**
 * Lessons chosen from the person's own Know yourself results, skipping what
 * they have finished. Worked out on request and stored nowhere.
 */
export function forYou(
  a: AssessmentLike | null,
  done: ReadonlySet<string>,
  max = 4,
  /** The Sphere they rated most important, if any (0047). */
  topSphere: SphereId | null = null,
): Pick[] {
  const picks: Pick[] = [];
  const add = (id: string, why: string) => {
    const l = lesson(id);
    if (l && !done.has(id) && !picks.some((p) => p.lesson.id === id)) picks.push({ lesson: l, why });
  };
  if (topSphere) {
    add(`sphere-${topSphere}`, `You said ${SPHERE_LABEL[topSphere]} matters most to you. This is how it gets decided.`);
  }

  if (!a) {
    for (const l of courseLessons("start")) add(l.id, "Where everyone starts.");
    return picks.slice(0, max);
  }

  const [top] = topNeeds(a.needs, 1);
  const lowest = [...NEEDS].sort((x, y) => a.needs[x] - a.needs[y])[0];
  add(`self-${top}`, `${NEED_LABEL[top]} drives you most. Feed it well.`);
  if (a.beliefs.length) add("self-beliefs", "You named a belief that holds you back.");
  if (a.goals.length) add("self-goals", "You set a goal. Give it a purpose and a first step.");
  if (a.values_away.length) add("self-values", `${a.values_away[0]} may be steering more than you think.`);
  add(`self-${lowest}`, `${NEED_LABEL[lowest]} is the need you feed least.`);

  for (const v of a.values_toward) {
    const s = VALUE_SPHERE[v];
    if (s) {
      add(`sphere-${s}`, `You value ${v}. This is the Sphere where it gets decided.`);
      break;
    }
  }
  const lawFor: Record<string, LawId> = {
    Honesty: "truth_and_transparency",
    Freedom: "sovereignty_of_the_individual",
    Justice: "equity_and_justice",
    Nature: "stewardship_of_earth",
    Family: "reciprocity_and_mutual_care",
    Love: "reciprocity_and_mutual_care",
    Respect: "harmony_of_diversity",
    Growth: "continuous_evolution",
  };
  for (const v of a.values_toward) {
    const law = lawFor[v];
    if (law) {
      add(LAWS.find((l) => l.law === law)!.id, `You value ${v}. This law is how Sovereign protects it.`);
      break;
    }
  }
  for (const l of courseLessons("start")) add(l.id, "How decisions here are made.");
  return picks.slice(0, max);
}
