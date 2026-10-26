import Link from "next/link";

import { Gutter } from "@/components/ui";

/** The way back from one of Self's full pages to the at-a-glance cards. */
export function BackToSelf() {
  return (
    <Gutter className="pt-4">
      <Link href="/individual/self" className="text-sm text-paper-dim hover:text-paper">
        ← Self
      </Link>
    </Gutter>
  );
}
