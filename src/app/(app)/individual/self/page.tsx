import { requireSession } from "@/lib/session";

import ValuesPage from "../values/page";
import { KnowSection } from "./KnowSection";
import { MattersSection } from "./MattersSection";
import { RecordSection } from "./RecordSection";

export const metadata = { title: "Self · Sovereign" };

/**
 * Self: what you stand for, and what you have done. Know yourself, what
 * matters to you, your record (the personal dashboard), then the values
 * you've named.
 */
export default async function SelfPage() {
  const { userId } = await requireSession();
  return (
    <>
      <KnowSection />
      <MattersSection />
      <RecordSection userId={userId} />
      <ValuesPage />
    </>
  );
}
