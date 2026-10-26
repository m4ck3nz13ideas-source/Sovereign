import { redirect } from "next/navigation";

/** The journal moved into the Vault (0063). */
export default function OldJournal() {
  redirect("/individual/vault/journal");
}
