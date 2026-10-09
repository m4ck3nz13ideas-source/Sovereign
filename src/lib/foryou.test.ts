import { describe, expect, it } from "vitest";

import { forYouFeed, topSpheres } from "./foryou";
import type { WitnessFeedItem } from "./types";

const item = (id: string, source: "post" | "act", at: string, body: string | null = null): WitnessFeedItem => ({
  item_id: id, source, actor_id: "a", actor_name: "A", actor_handle: null, kind: "saw", body,
  media_url: null, media_kind: null, subject_type: source === "act" ? "proposal" : null,
  subject_id: null, title: null, tie: "here", happened_at: at,
});

describe("topSpheres", () => {
  it("keeps 4s and 5s, most important first", () => {
    expect(topSpheres([
      { sphere_id: "tech", rating: 4 },
      { sphere_id: "ecology", rating: 5 },
      { sphere_id: "health", rating: 3 },
      { sphere_id: "nonsense", rating: 5 },
    ])).toEqual(["ecology", "tech"]);
  });
});

describe("forYouFeed", () => {
  it("selects by tag or mention, keeps time order, de-duplicates, and says why", () => {
    const items = [
      item("p1", "post", "2026-10-09T10:00:00Z", "We planted a tree by the river"),
      item("a1", "act", "2026-10-09T12:00:00Z"),
      item("a2", "act", "2026-10-09T11:00:00Z"),
      item("p2", "post", "2026-10-09T13:00:00Z", "Lovely sunset"),
      item("a1", "act", "2026-10-09T12:00:00Z"),
    ];
    const tagged = new Map([["a1", ["ecology"]], ["a2", ["economy"]]]);
    const { items: out, reasons } = forYouFeed(items, tagged, ["ecology"]);
    expect(out.map((i) => i.item_id)).toEqual(["a1", "p1"]);
    expect(reasons.a1).toBe("Tagged Ecology");
    expect(reasons.p1).toBe("Mentions Ecology");
  });

  it("is empty when nothing is rated highly", () => {
    expect(forYouFeed([item("a1", "act", "2026-10-09T12:00:00Z")], new Map([["a1", ["ecology"]]]), []).items).toEqual([]);
  });
});
