import { redirect } from "next/navigation";

/** Every chat — with one friend or many — is listed in Connection. */
export default function ChatsPage() {
  redirect("/connection");
}
