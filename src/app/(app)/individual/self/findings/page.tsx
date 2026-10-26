import { Screen } from "@/components/ui";
import { requireSession } from "@/lib/session";

import { BackToSelf } from "../BackToSelf";
import { KnowSection } from "../KnowSection";

export const metadata = { title: "Know yourself · Sovereign" };

/** Your Know yourself findings in full. */
export default async function FindingsPage() {
  await requireSession();
  return (
    <Screen>
      <BackToSelf />
      <KnowSection />
    </Screen>
  );
}
