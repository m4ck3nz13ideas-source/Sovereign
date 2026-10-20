import { redirect } from "next/navigation";

/**
 * People is a filter inside Connection now, beside Chats and Groups
 * (Mackenzie, 20 October). This address stays so shared links and QR codes
 * keep working: it sends you there, handle and all.
 */
export default async function PeoplePage({
  searchParams,
}: {
  searchParams: Promise<{ handle?: string }>;
}) {
  const { handle } = await searchParams;
  redirect(`/connection?show=people${handle ? `&handle=${encodeURIComponent(handle)}` : ""}`);
}
