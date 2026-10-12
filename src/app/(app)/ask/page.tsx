import { redirect } from "next/navigation";

/**
 * Search moved into the centre tab with the feed (12 October). The panel
 * itself still lives in this folder, with its actions; only the page went.
 */
export default function AskPage() {
  redirect("/home");
}
