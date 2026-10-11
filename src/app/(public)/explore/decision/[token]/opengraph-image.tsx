import { decisionCard, OG_SIZE, pageCard } from "@/lib/og";

import { getSharedDecision, longDate } from "./data";

export const alt = "A decision made on Sovereign";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const d = await getSharedDecision(token);
  if (!d) {
    return pageCard({ eyebrow: "A decision", title: "This link is no longer shared.", line: "Decisions made together, in the open." });
  }
  return decisionCard({
    title: d.title,
    outcome: d.outcome,
    voices: d.voices,
    alignment: d.alignment,
    split: d.split,
    decidedOn: longDate(d.decided_on),
  });
}
