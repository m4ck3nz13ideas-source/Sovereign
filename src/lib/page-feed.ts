import "server-only";

import type { Counts } from "@/app/(app)/home/Feed";
import { createClient } from "@/lib/supabase/server";
import type { MediaKind, WitnessFeedItem } from "@/lib/types";

/**
 * The posts on one page — a group's (0053) or a business's — in the shape the
 * feed already draws, so likes, comments and keeps work the same everywhere.
 * Time order and nothing else, like every feed here. Who can read them is the
 * database's question (posts_read), not this function's.
 */
export async function pageFeed(
  by: { groupId: string } | { vendorId: string },
  viewer: string,
  limit = 40,
) {
  const supabase = await createClient();
  let q = supabase
    .from("posts")
    .select("id, author_id, body, kind, media_url, media_kind, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  q = "groupId" in by ? q.eq("group_id", by.groupId) : q.eq("vendor_id", by.vendorId);
  const { data: rows } = await q;

  type Row = {
    id: string;
    author_id: string;
    body: string;
    kind: string | null;
    media_url: string | null;
    media_kind: MediaKind | null;
    created_at: string;
  };
  const posts = (rows ?? []) as Row[];
  const authorIds = [...new Set(posts.map((p) => p.author_id))];
  const ids = posts.map((p) => p.id);

  const [{ data: people }, { data: countRows }, { data: keeps }] = await Promise.all([
    authorIds.length
      ? supabase.from("public_profiles").select("id, display_name, handle").in("id", authorIds)
      : Promise.resolve({ data: [] }),
    ids.length ? supabase.rpc("post_counts", { p_ids: ids }) : Promise.resolve({ data: [] }),
    ids.length
      ? supabase.from("post_reactions").select("post_id").eq("profile_id", viewer).in("post_id", ids)
      : Promise.resolve({ data: [] }),
  ]);
  const who = new Map(
    ((people ?? []) as { id: string; display_name: string; handle: string | null }[]).map((p) => [p.id, p]),
  );

  const items: WitnessFeedItem[] = posts.map((p) => ({
    item_id: p.id,
    source: "post",
    actor_id: p.author_id,
    actor_name: who.get(p.author_id)?.display_name ?? "Someone",
    actor_handle: who.get(p.author_id)?.handle ?? null,
    kind: p.kind ?? "saw",
    body: p.body,
    media_url: p.media_url,
    media_kind: p.media_kind,
    subject_type: null,
    subject_id: null,
    title: null,
    tie: "here",
    happened_at: p.created_at,
  }));

  const counts: Counts = {};
  for (const c of (countRows ?? []) as { post_id: string; likes: number; comments: number; i_liked: boolean }[]) {
    counts[c.post_id] = { likes: c.likes, comments: c.comments, i_liked: c.i_liked };
  }
  const kept = new Set(((keeps ?? []) as { post_id: string }[]).map((k) => k.post_id));
  const media = items.filter((i) => i.media_url && i.media_kind === "image");

  return { items, counts, kept, media };
}
