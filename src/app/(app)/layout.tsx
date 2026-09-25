import { TabBar } from "@/components/nav/TabBar";

/**
 * The app shell. Three tabs, always visible; every screen clears them with its
 * own bottom padding.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <main className="min-h-dvh">{children}</main>
      <TabBar />
    </>
  );
}
