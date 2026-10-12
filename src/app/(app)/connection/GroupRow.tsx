"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { chooseAddress } from "@/app/(app)/collective/actions";
import { Tag } from "@/components/ui";

/**
 * A group you belong to: tap it for the group's chat, or "decide" to make it
 * the address in view and go to Collective, where its proposals are.
 */
export function GroupRow({
  id,
  name,
  preview,
  unread,
}: {
  id: string;
  name: string;
  preview: string;
  unread: number;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <div className="flex items-center border-b border-line-soft">
      <Link href={`/chats/group/${id}`} className="press block min-w-0 flex-1 px-5 py-4 active:bg-surface-soft">
        <div className="flex items-baseline justify-between gap-3">
          <span className="truncate text-[0.95rem] text-paper">{name}</span>
          {unread ? <Tag tone="gold">{unread} new</Tag> : null}
        </div>
        <p className="mt-1 truncate text-[0.875rem] text-paper-dim">{preview}</p>
      </Link>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            await chooseAddress(`group:${id}`);
            router.push("/collective");
          })
        }
        className="smallcaps shrink-0 px-5 py-4 text-[10px] text-gold disabled:opacity-60"
      >
        decide →
      </button>
    </div>
  );
}
