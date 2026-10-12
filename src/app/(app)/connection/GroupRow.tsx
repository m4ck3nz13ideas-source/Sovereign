"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { chooseAddress } from "@/app/(app)/collective/actions";
import { Row } from "@/components/ui";

/**
 * A group you belong to. Opening it makes it the address in view and goes to
 * Collective, because a group's decisions live there; Connection is how you
 * get to it, not a second copy of it.
 */
export function GroupRow({
  id,
  name,
  role,
}: {
  id: string;
  name: string;
  role: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <Row
      onClick={() =>
        start(async () => {
          await chooseAddress(`group:${id}`);
          router.push("/collective");
        })
      }
      className={pending ? "opacity-60" : undefined}
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[0.95rem] text-paper">{name}</span>
        <span className="smallcaps text-[10px] text-paper-faint">{role}</span>
      </div>
    </Row>
  );
}
