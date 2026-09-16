import { redirect } from "next/navigation";

/** Launch is the intake point for everything, so it is also the front door. */
export default function Home() {
  redirect("/launch");
}
