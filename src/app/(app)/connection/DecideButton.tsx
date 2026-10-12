"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { chooseAddress } from "@/app/(app)/collective/actions";

/** Make this group the address in view and open Collective, where its decisions are. */
export function DecideButton({ groupId, className, children }: { groupId: string; className?: string; children: React.ReactNode }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await chooseAddress(`group:${groupId}`);
          router.push("/collective");
        })
      }
      className={className}
    >
      {children}
    </button>
  );
}
