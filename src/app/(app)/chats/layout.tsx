import { TopBar } from "@/components/ui";

/** Chats live in Connection: talking to people you know is the We, not the feed. */
export default function ChatsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <TopBar title="Chats" back="/connection" />
      {children}
    </>
  );
}
