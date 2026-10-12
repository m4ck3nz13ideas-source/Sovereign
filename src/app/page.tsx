import { redirect } from "next/navigation";

/** Search is where you land: look something up, say something, see the feed. */
export default function Root() {
  redirect("/home");
}
