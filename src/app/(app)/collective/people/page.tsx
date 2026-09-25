import { Empty, Gutter, Screen, SectionLabel, Tag } from "@/components/ui";
import { requireAddress } from "@/lib/address";

export const metadata = { title: "People · Sovereign" };

/**
 * Public profiles.
 *
 *   §2.1: values map, proposals created, contributions, reputation.
 *   "No follower count. No vanity metrics."
 *
 * Not built yet. Right now people are near-invisible to each other — a display
 * name on a comment and, if they opted in, their values. This is the screen
 * where that changes, and it is deliberately the last of the public surfaces
 * to be built, because a directory of people is the point at which a
 * governance tool starts becoming a network.
 */
export default async function PeoplePage() {
  await requireAddress();

  return (
    <Screen>
      <Gutter className="pt-6">
        <h2 className="display text-[1.75rem] text-paper">People</h2>
        <p className="mt-2 text-[0.9375rem] leading-relaxed text-paper-dim">
          What someone values, what they have proposed, what they committed to
          and whether they delivered. A record of what a person did, not a score
          of what they are worth.
        </p>

        <div className="mt-8">
          <SectionLabel right={<Tag>not built</Tag>}>Next</SectionLabel>
          <Empty>
            No follower count, no vanity metrics, and nothing here weights
            anybody&rsquo;s resonance. A directory of people is where a
            governance tool starts turning into a network, so this one gets
            built carefully or not at all.
          </Empty>
        </div>
      </Gutter>
    </Screen>
  );
}

export const dynamic = "force-dynamic";
