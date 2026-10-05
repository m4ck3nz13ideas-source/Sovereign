import { TopBar } from "@/components/ui";

/** Chats live on Home's side: talking to people you know is social, not private. */
export default function ChatsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <TopBar title="Chats" back="/home" />
      {children}
    </>
  );
}
