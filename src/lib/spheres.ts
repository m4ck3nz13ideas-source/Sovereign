/**
 * The Spheres of Civilization (0043, rule 40).
 *
 * Mirrors the `spheres` and `sphere_areas` rows. The database's copies are the
 * ones that decide what a valid tag is; this one exists so the compose screen
 * and the filters render without a round trip, and `spheres.test.ts` keeps
 * the two in step.
 *
 * A Sphere describes a proposal. It never decides one: nothing that counts
 * voices, sets conditions or reads the laws looks at it.
 */

export const SPHERE_IDS = [
  "health",
  "education",
  "ecology",
  "justice",
  "economy",
  "culture",
  "infrastructure",
  "tech",
] as const;
export type SphereId = (typeof SPHERE_IDS)[number];

export interface Sphere {
  id: SphereId;
  name: string;
  description: string;
  /** Ministry-style areas. Ids are `<sphere>.<area>`, as in the database. */
  areas: { id: string; name: string }[];
  /** Words that suggest this Sphere in a draft. A suggestion only. */
  cues: string[];
}

export const SPHERES: Sphere[] = [
  {
    id: "health",
    name: "Health",
    description: "Bodies and minds: care, prevention, food and wellbeing.",
    areas: [
      { id: "health.public_health", name: "Public health" },
      { id: "health.mental_health", name: "Mental health" },
      { id: "health.care", name: "Hospitals and clinics" },
      { id: "health.social_care", name: "Social care" },
      { id: "health.food", name: "Food and nutrition" },
    ],
    cues: ["health", "doctor", "gp", "clinic", "hospital", "nurse", "mental", "wellbeing", "care home", "carer", "disease", "vaccine", "food bank", "nutrition", "meal", "exercise", "nhs"],
  },
  {
    id: "education",
    name: "Education",
    description: "Learning at every age, from first words to new trades.",
    areas: [
      { id: "education.early_years", name: "Early years" },
      { id: "education.schools", name: "Schools" },
      { id: "education.higher", name: "Further and higher education" },
      { id: "education.skills", name: "Skills and lifelong learning" },
      { id: "education.libraries", name: "Libraries" },
    ],
    cues: ["school", "teacher", "pupil", "student", "nursery", "university", "college", "course", "tutor", "library", "learning", "apprentice", "skills", "classroom", "lesson"],
  },
  {
    id: "ecology",
    name: "Ecology",
    description: "The living world: climate, nature, water, land and animals.",
    areas: [
      { id: "ecology.climate", name: "Climate and energy" },
      { id: "ecology.nature", name: "Nature and biodiversity" },
      { id: "ecology.water", name: "Water" },
      { id: "ecology.waste", name: "Waste and recycling" },
      { id: "ecology.land", name: "Farming and land" },
      { id: "ecology.animals", name: "Animal welfare" },
    ],
    cues: ["climate", "carbon", "solar", "heat pump", "emissions", "tree", "wildlife", "biodiversity", "river", "pollution", "recycling", "waste", "compost", "garden", "allotment", "farm", "animal", "nature", "green"],
  },
  {
    id: "justice",
    name: "Justice",
    description: "Rights, safety, fairness, and repairing harm.",
    areas: [
      { id: "justice.rights", name: "Rights and equality" },
      { id: "justice.safety", name: "Safety and policing" },
      { id: "justice.courts", name: "Courts and disputes" },
      { id: "justice.restoration", name: "Prisons and restoration" },
    ],
    cues: ["justice", "rights", "equality", "discrimination", "police", "crime", "safety", "court", "dispute", "mediation", "prison", "victim", "harassment", "fair"],
  },
  {
    id: "economy",
    name: "Economy",
    description: "Work, trade, shared money and making ends meet.",
    areas: [
      { id: "economy.work", name: "Work and wages" },
      { id: "economy.trade", name: "Business and trade" },
      { id: "economy.public_money", name: "Tax and public money" },
      { id: "economy.welfare", name: "Welfare and support" },
      { id: "economy.cost_of_living", name: "Cost of living" },
    ],
    cues: ["wage", "job", "employ", "business", "shop", "trade", "tax", "budget", "fund", "grant", "benefit", "welfare", "rent", "price", "cost of living", "money", "income", "debt"],
  },
  {
    id: "culture",
    name: "Culture",
    description: "Arts, heritage, sport, faith and how we gather.",
    areas: [
      { id: "culture.arts", name: "Arts" },
      { id: "culture.heritage", name: "Heritage" },
      { id: "culture.sport", name: "Sport and recreation" },
      { id: "culture.faith", name: "Faith and community" },
      { id: "culture.media", name: "Media" },
    ],
    cues: ["art", "music", "festival", "theatre", "museum", "heritage", "history", "sport", "football", "club", "church", "mosque", "temple", "faith", "community event", "gathering", "media"],
  },
  {
    id: "infrastructure",
    name: "Infrastructure",
    description: "Homes, transport, utilities and shared spaces.",
    areas: [
      { id: "infrastructure.housing", name: "Housing and planning" },
      { id: "infrastructure.transport", name: "Transport" },
      { id: "infrastructure.utilities", name: "Utilities" },
      { id: "infrastructure.spaces", name: "Public spaces" },
      { id: "infrastructure.connectivity", name: "Digital connectivity" },
    ],
    cues: ["housing", "home", "planning", "road", "bus", "train", "cycle", "bike", "parking", "pavement", "bridge", "hall", "park", "playground", "building", "boiler", "electricity", "broadband", "street light"],
  },
  {
    id: "tech",
    name: "Tech",
    description: "Digital services, data, AI and research.",
    areas: [
      { id: "tech.services", name: "Digital services" },
      { id: "tech.data", name: "Data and privacy" },
      { id: "tech.ai", name: "AI" },
      { id: "tech.research", name: "Research and science" },
      { id: "tech.online_safety", name: "Online safety" },
    ],
    cues: ["app", "software", "website", "digital", "data", "privacy", "ai", "algorithm", "online", "internet", "research", "science", "open source"],
  },
];

const BY_ID = new Map(SPHERES.map((s) => [s.id, s]));
const AREA_BY_ID = new Map(SPHERES.flatMap((s) => s.areas.map((a) => [a.id, { ...a, sphere: s.id }])));

export function isSphere(id: string | null | undefined): id is SphereId {
  return !!id && BY_ID.has(id as SphereId);
}

export function sphereName(id: string | null | undefined): string | null {
  return id && isSphere(id) ? BY_ID.get(id)!.name : null;
}

export function areaName(id: string | null | undefined): string | null {
  return id ? (AREA_BY_ID.get(id)?.name ?? null) : null;
}

export function sphereOf(id: SphereId): Sphere {
  return BY_ID.get(id)!;
}

/**
 * The tag as one line: "Infrastructure · Public spaces · also Ecology, Economy".
 * This is also what the AI review reads in the category slot, so it sees
 * where the author says the proposal lives.
 */
export function sphereLine(
  sphere: string | null | undefined,
  area?: string | null,
  also?: readonly string[] | null,
): string | null {
  const main = sphereName(sphere);
  if (!main) return null;
  const parts = [main];
  const a = areaName(area);
  if (a) parts.push(a);
  const others = (also ?? []).map(sphereName).filter(Boolean);
  let line = parts.join(" · ");
  if (others.length) line += ` · also ${others.join(", ")}`;
  return line;
}

export type SphereTags = { sphere: SphereId; area: string | null; also: SphereId[] };

/** The same shape the database enforces, so the form can say so first. */
export function validateSpheres(
  sphere: string,
  area: string | null,
  also: readonly string[],
): { ok: true; value: SphereTags } | { ok: false; error: string } {
  if (!isSphere(sphere)) return { ok: false, error: "Choose the Sphere this proposal mainly sits in." };
  if (area && AREA_BY_ID.get(area)?.sphere !== sphere) {
    return { ok: false, error: "That area belongs to a different Sphere." };
  }
  if (also.length > 2) return { ok: false, error: "Two other Spheres at most." };
  if (also.some((s) => !isSphere(s))) return { ok: false, error: "Not a Sphere." };
  if (also.includes(sphere)) return { ok: false, error: "The main Sphere is already the main one." };
  if (new Set(also).size !== also.length) return { ok: false, error: "Each Sphere once." };
  return { ok: true, value: { sphere, area: area || null, also: also as SphereId[] } };
}

/**
 * A first guess from the words of a draft — counted cues, best first. A
 * suggestion for the author to accept or ignore, never a tag on its own.
 */
export function suggestSpheres(text: string, max = 3): SphereId[] {
  const t = ` ${text.toLowerCase().replace(/[^a-z0-9 ]+/g, " ")} `;
  const scored = SPHERES.map((s) => ({
    id: s.id,
    n: s.cues.reduce((acc, c) => {
      const re = new RegExp(`\\b${c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "g");
      return acc + (t.match(re)?.length ?? 0);
    }, 0),
  }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n || SPHERE_IDS.indexOf(a.id) - SPHERE_IDS.indexOf(b.id));
  return scored.slice(0, max).map((x) => x.id);
}
