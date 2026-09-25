import { requireSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { greeting } from "@/lib/format";

import { LaunchGrid } from "./LaunchGrid";

export const metadata = { title: "Launch · Sovereign" };

/**
 * Launch — the intake point for everything. One page, four modes.
 *
 * Nothing is listed here and nothing is reviewed here. What you send leaves
 * the page. That emptiness is the design: this is the only screen in Sovereign
 * with no backlog on it.
 */
export default async function LaunchPage() {
  const { profile } = await requireSession();
  const supabase = await createClient();

  // A quiet count of what is waiting elsewhere. Not a notification badge —
  // it sits under the grid, in small caps, and says where things went.
  const { count: unexamined } = await supabase
    .from("entries")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", profile.id)
    .eq("state", "unexamined");

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col px-5 pt-16 pb-32">
      <h1 className="font-serif text-[1.9rem] leading-snug text-paper">
        {greeting(profile.display_name)}
      </h1>

      <LaunchGrid />

      <p className="smallcaps mt-auto pt-10 text-center text-[11px] text-paper-faint">
        {unexamined
          ? `${unexamined} ${unexamined === 1 ? "entry is" : "entries are"} waiting to be examined`
          : "nothing is waiting"}
      </p>
    </div>
  );
}
