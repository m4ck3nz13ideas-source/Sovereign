import Link from "next/link";

import { Tag } from "@/components/ui";

import { DecideButton } from "./DecideButton";

/**
 * A group you belong to: tap it for its page (rundown, values, media, feed),
 * "chat" for its chat, or "decide" to open its proposals in Collective.
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
  return (
    <div className="flex items-center border-b border-line-soft">
      <Link href={`/connection/g/${id}`} className="press block min-w-0 flex-1 px-5 py-4 active:bg-surface-soft">
        <div className="flex items-baseline justify-between gap-3">
          <span className="truncate text-[0.95rem] text-paper">{name}</span>
          {unread ? <Tag tone="gold">{unread} new</Tag> : null}
        </div>
        <p className="mt-1 truncate text-[0.875rem] text-paper-dim">{preview}</p>
      </Link>
      <Link href={`/chats/group/${id}`} className="smallcaps shrink-0 px-2 py-4 text-[10px] text-paper-dim">
        chat
      </Link>
      <DecideButton groupId={id} className="smallcaps shrink-0 py-4 pr-5 pl-2 text-[10px] text-gold disabled:opacity-60">
        decide →
      </DecideButton>
    </div>
  );
}
