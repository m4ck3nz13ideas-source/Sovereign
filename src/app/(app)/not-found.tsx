import Link from "next/link";

import { Card, Page } from "@/components/ui";

/**
 * Most 404s inside the app shell are not typos — they are a member following a
 * link to something in a group they are not in, which row-level security
 * correctly refuses to return. The copy says so, because "page not found"
 * would leave someone hunting for a broken link that is not broken.
 */
export default function NotFound() {
  return (
    <Page>
      <h1 className="font-serif text-[1.75rem] leading-tight text-paper">
        Not here.
      </h1>

      <Card className="mt-6">
        <p className="text-[0.95rem] leading-relaxed text-paper-dim">
          Either this does not exist, or it belongs to a group you are not in.
          Sovereign does not distinguish between the two on purpose — telling
          you that something exists but is closed to you is itself a disclosure.
        </p>

        <div className="mt-5 flex flex-wrap gap-4">
          <Link href="/launch" className="smallcaps text-[11px] text-gold hover:underline">
            Launch
          </Link>
          <Link href="/connection" className="smallcaps text-[11px] text-gold hover:underline">
            Connection
          </Link>
        </div>
      </Card>
    </Page>
  );
}
