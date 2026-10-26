import { Screen } from "@/components/ui";
import { requireSession } from "@/lib/session";

import { BackToSelf } from "../BackToSelf";
import { MattersSection } from "../MattersSection";

export const metadata = { title: "What matters · Sovereign" };

/** Rate how much each Sphere matters to you. */
export default async function MattersPage() {
  await requireSession();
  return (
    <Screen>
      <BackToSelf />
      <MattersSection />
    </Screen>
  );
}
