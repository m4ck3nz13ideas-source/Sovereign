import { Gutter, Screen } from "@/components/ui";
import { requireSession } from "@/lib/session";

import { KnowForm } from "./KnowForm";

export const metadata = { title: "Know yourself · Sovereign" };

/** The assessment itself: needs, values, beliefs, goals. About ten minutes. */
export default async function KnowPage() {
  await requireSession();
  return (
    <Screen>
      <Gutter className="pt-6">
        <KnowForm />
      </Gutter>
    </Screen>
  );
}
