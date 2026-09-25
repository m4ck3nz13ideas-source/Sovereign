import { TopBar } from "@/components/ui";
import { INDIVIDUAL_TABS, SubTabs } from "@/components/nav/SubTabs";

/**
 * Individual — the private half.
 *
 *   "Your digital home. Your personal AI advisor. Your governance control
 *    centre. Your values and contribution record."
 *
 * Nothing under here is visible to anybody else unless it was explicitly sent
 * somewhere. That is rule one of the schema, not a setting.
 */
export default function IndividualLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <TopBar title="Individual">
        <SubTabs tabs={INDIVIDUAL_TABS} />
      </TopBar>
      {children}
    </>
  );
}
