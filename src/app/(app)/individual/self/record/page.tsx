import { Screen } from "@/components/ui";
import { requireSession } from "@/lib/session";

import { BackToSelf } from "../BackToSelf";
import { RecordSection } from "../RecordSection";

export const metadata = { title: "Your record · Sovereign" };

/** Your record in full: the personal dashboard. */
export default async function RecordPage() {
  const { userId } = await requireSession();
  return (
    <Screen>
      <BackToSelf />
      <RecordSection userId={userId} />
    </Screen>
  );
}
