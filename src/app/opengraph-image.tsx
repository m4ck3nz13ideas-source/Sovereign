import { OG_SIZE, pageCard } from "@/lib/og";

export const alt = "Sovereign — Better decisions. Together.";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image() {
  return pageCard({
    eyebrow: "Better decisions",
    title: "Vote on ideas, not politicians.",
    line: "Propose. Weigh. Act. From your street to the planet — free for people, private by rule.",
  });
}
