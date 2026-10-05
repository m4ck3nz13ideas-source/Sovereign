import { TabActions } from "@/components/nav/TabActions";
import { TopBar } from "@/components/ui";
import { COLLECTIVE_TABS, SubTabs } from "@/components/nav/SubTabs";

/**
 * Collective — the public half, as the governance cycle runs:
 * Proposals → Debate → Projects → Impact.
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
        <SubTabs tabs={COLLECTIVE_TABS} />
      </TopBar>
      {children}
    </>
  );
}
