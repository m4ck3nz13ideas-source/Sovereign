import Link from "next/link";

import { Gutter, Readers, SectionLabel } from "@/components/ui";
import { SphereRatings } from "@/components/spheres/SphereRatings";
import { createClient } from "@/lib/supabase/server";

/**
 * What matters to you (0047, rule 43): how much each Sphere matters, 1 to 5.
 * Shapes your For you feed, your AI and Learn. Nobody else sees your ratings;
 * your group or place sees only the combined tally.
 */
export async function MattersSection() {
  const supabase = await createClient();
  const { data } = await supabase.from("sphere_priorities").select("sphere_id, rating");
  const initial = Object.fromEntries(((data ?? []) as { sphere_id: string; rating: number }[]).map((r) => [r.sphere_id, r.rating]));

  return (
    <Gutter className="pt-8">
      <section id="matters" className="scroll-mt-20">
        <SectionLabel right={<Link href="/home?feed=foryou" className="text-gold">for you</Link>}>
          What matters to you
        </SectionLabel>
        <div className="rounded-card border border-line bg-surface-soft px-4 pb-2 pt-1">
          <SphereRatings initial={initial} />
        </div>
        <Readers className="mt-2">
          Only you. Your group and place see the combined tally, once five people have rated, and never whose.
        </Readers>
      </section>
    </Gutter>
  );
}
