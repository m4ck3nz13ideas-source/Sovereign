/**
 * For you (0047, rule 43): what is happening at an address that touches the
 * Spheres you rated 4 or 5, newest first, each with the reason it is there.
 *
 * Done here rather than in the database on purpose: no function in Postgres
 * reads a rating to decide what anybody sees (41_sphere_priorities.sql), and
 * this is your own screen choosing from things you can already read. It
 * selects; it never re-orders — time stays the only sort key (rule 32).
 */
import { SPHERE_IDS, sphereName, suggestSpheres, type SphereId } from "./spheres";
import type { WitnessFeedItem } from "./types";

export type Rating = { sphere_id: string; rating: number };

/** The Spheres somebody rated 4 or 5, most important first. */
export function topSpheres(ratings: Rating[]): SphereId[] {
  return ratings
    .filter((r) => r.rating >= 4 && (SPHERE_IDS as readonly string[]).includes(r.sphere_id))
    .sort((a, b) => b.rating - a.rating || SPHERE_IDS.indexOf(a.sphere_id as SphereId) - SPHERE_IDS.indexOf(b.sphere_id as SphereId))
    .map((r) => r.sphere_id as SphereId);
}

/**
 * @param items     everything already readable: Following and Discover together
 * @param tagged    Spheres per act item id (from the proposal it is about)
 * @param top       the Spheres the reader rated 4 or 5
 */
export function forYouFeed(
  items: WitnessFeedItem[],
  tagged: Map<string, string[]>,
  top: SphereId[],
): { items: WitnessFeedItem[]; reasons: Record<string, string> } {
  const want = new Set<string>(top);
  const seen = new Set<string>();
  const out: WitnessFeedItem[] = [];
  const reasons: Record<string, string> = {};

  for (const item of items) {
    if (seen.has(item.item_id)) continue;
    seen.add(item.item_id);

    let hit: string | undefined;
    let how = "";
    if (item.source === "act") {
      hit = (tagged.get(item.item_id) ?? []).find((s) => want.has(s));
      how = "Tagged";
    } else if (item.body) {
      hit = suggestSpheres(item.body, 3).find((s) => want.has(s));
      how = "Mentions";
    }
    if (!hit) continue;
    out.push(item);
    reasons[item.item_id] = `${how} ${sphereName(hit)}`;
  }

  out.sort((a, b) => (a.happened_at < b.happened_at ? 1 : a.happened_at > b.happened_at ? -1 : 0));
  return { items: out, reasons };
}
