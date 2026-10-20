import { TabActions } from "@/components/nav/TabActions";
import { TopBar } from "@/components/ui";
import { CollectiveTabs } from "@/components/nav/SubTabs";
import { TabIntro } from "@/components/TabIntro";

/**
 * Collective — the public half, as the governance cycle runs, in two halves:
 * Live (Proposals → Debate) and Record (Projects, with their impact → Decisions).
 *
 * The Feed lives in Home rather than here, because it is where you land.
 */
export default function CollectiveLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <TopBar title="Collective" action={<TabActions plus="/collective/proposals/new" plusLabel="New proposal" />}>
        <CollectiveTabs />
      </TopBar>
      <div className="mx-auto w-full max-w-2xl">
        <TabIntro space="collective" />
      </div>
      {children}
    </>
  );
}
