import { Gutter, Screen } from "@/components/ui";
import { requireSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import type { PostKind } from "@/lib/types";

import { Controls } from "./Controls";

export const metadata = { title: "Your feed · Sovereign" };

/**
 * What arrives, and what it costs you.
 *
 * Everything on this screen is the reader's own and affects nobody else's
 * view. That is the whole argument for putting it here: the gate on the way in
 * asks whether a post is first-hand, which is a question with an answer, and
 * everything after that — whether you want questions today, whether you meant
 * to be here this long, whether it is Sunday — is a question only the person
 * reading can answer.
 */
export default async function FeedSettingsPage() {
  const { userId } = await requireSession();
  const supabase = await createClient();

  const [{ data: settings }, { data: mutes }] = await Promise.all([
    supabase
      .from("feed_settings")
      .select("shows, minutes, quiet_days")
      .eq("profile_id", userId)
      .maybeSingle(),
    supabase
      .from("feed_mutes")
      .select("muted_id, profiles!feed_mutes_muted_id_fkey(id, display_name, handle)")
      .eq("profile_id", userId),
  ]);

  const muted = ((mutes ?? []) as unknown as {
    muted_id: string;
    profiles: { display_name: string; handle: string | null } | null;
  }[]).map((m) => ({
    profile_id: m.muted_id,
    display_name: m.profiles?.display_name ?? "Somebody",
    handle: m.profiles?.handle ?? null,
  }));

  return (
    <Screen>
      <Gutter className="space-y-8 pt-6">
        <div>
          <h2 className="display text-[1.75rem] text-paper">Your feed</h2>
          <p className="mt-2 text-[0.9375rem] leading-relaxed text-paper-dim">
            The feed is what people around you wrote and did, in the order it
            happened. Nothing is ranked and there is no score to rank by. What
            you can change is what reaches you.
          </p>
        </div>

        <Controls
          initialShows={((settings?.shows ?? []) as PostKind[]) ?? []}
          initialMinutes={settings?.minutes ?? null}
          initialQuietDays={(settings?.quiet_days ?? []) as number[]}
          muted={muted}
        />
      </Gutter>
    </Screen>
  );
}
