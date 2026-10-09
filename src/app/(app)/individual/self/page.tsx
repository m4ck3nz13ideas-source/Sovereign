import ValuesPage from "../values/page";
import { KnowSection } from "./KnowSection";
import { MattersSection } from "./MattersSection";

export const metadata = { title: "Self · Sovereign" };

/** Self: what you stand for. Know yourself, what matters to you, then the values you've named. */
export default async function SelfPage() {
  return (
    <>
      <KnowSection />
      <MattersSection />
      <ValuesPage />
    </>
  );
}
