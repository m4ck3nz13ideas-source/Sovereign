import ValuesPage from "../values/page";
import { KnowSection } from "./KnowSection";

export const metadata = { title: "Self · Sovereign" };

/** Self: what you stand for. Know yourself first, then the values you've named. */
export default async function SelfPage() {
  return (
    <>
      <KnowSection />
      <ValuesPage />
    </>
  );
}
