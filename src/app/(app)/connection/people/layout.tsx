import { TopBar } from "@/components/ui";

/**
 * People live in Connection (Mackenzie, 20 October): following and friendship
 * are relationships, and Connection is the We. They used to sit under
 * Collective, which is the systems you decide together, not who you know.
 */
export default function PeopleLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <TopBar title="Connection" back="/connection?show=people" />
      {children}
    </>
  );
}
