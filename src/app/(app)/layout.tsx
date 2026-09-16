import { BottomNav } from "@/components/nav/BottomNav";

/**
 * The app shell. The bottom nav is always visible, per life_OS.pdf.
 * Pages add their own bottom padding via <Page> to clear it.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <main className="min-h-dvh">{children}</main>
      <BottomNav />
    </>
  );
}
