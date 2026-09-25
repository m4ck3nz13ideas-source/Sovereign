import { redirect } from "next/navigation";

/** Home is where you land: what is waiting on you, and what just happened. */
export default function Root() {
  redirect("/home");
}
