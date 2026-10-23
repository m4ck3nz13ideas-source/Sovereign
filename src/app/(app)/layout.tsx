import { AiBubble } from "@/components/ai/AiBubble";
import { TabBar } from "@/components/nav/TabBar";

/**
 * The app shell. Five tabs, always visible; every screen clears them with its
 * own bottom padding. Your AI floats over every page (23 October).
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <main className="min-h-dvh">{children}</main>
      <TabBar />
      <AiBubble />
    </>
  );
}
