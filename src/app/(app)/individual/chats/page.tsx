import Link from "next/link";

import { Card, Empty, Gutter, Screen, SectionLabel, Tag } from "@/components/ui";
import { ago } from "@/lib/format";
import { requireSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import type { Conversation } from "@/lib/types";

export const metadata = { title: "Chats · Sovereign" };

/**
 * Conversations.
 *
 * One per friend, whether or not anything has been said — a conversation you
 * have not started is still a conversation you could.
 *
 * The unread count is yours. It exists so the app can show you what is new,
 * and the other person has no way to read it: there are no read receipts, no
 * typing indicators, no last-seen and no online dot anywhere in here. Every
 * one of those is a mechanism for making somebody anxious about not replying,
 * and this is meant to be a calm place.
 */
export default async function ChatsPage() {
  await requireSession();
  const supabase = await createClient();

  const { data } = await supabase.rpc("my_conversations");
  const threads = (data ?? []) as Conversation[];

  return (
    <Screen>
      <Gutter className="space-y-6 pt-6">
        <div>
          <h2 className="display text-[1.75rem] text-paper">Chats</h2>
          <p className="mt-2 text-[0.9375rem] leading-relaxed text-paper-dim">
            With people you are friends with. Nothing said here reaches a
            proposal, a decision or the record — it is a conversation, not
            evidence.
          </p>
        </div>

        {threads.length ? (
          <ul className="space-y-2">
            {threads.map((t) => (
              <li key={t.profile_id}>
                <Link href={`/individual/chats/${t.profile_id}`} className="press block">
                  <Card className={t.unread ? "border-gold-dim" : undefined}>
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-[0.95rem] text-paper">
                        {t.display_name}
                      </span>
                      <span className="smallcaps text-[10px] text-paper-faint">
                        {t.unread ? (
                          <Tag tone="gold">{t.unread} new</Tag>
                        ) : t.last_at ? (
                          ago(t.last_at)
                        ) : null}
                      </span>
                    </div>

                    <p className="mt-1 truncate text-[0.875rem] text-paper-dim">
                      {t.last_body
                        ? `${t.last_was_mine ? "You: " : ""}${t.last_body}`
                        : "Nothing said yet."}
                    </p>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <>
            <SectionLabel>Nobody yet</SectionLabel>
            <Empty>
              A conversation here needs both of you to have agreed to it.
              Following somebody does not open one — that is the difference
              between the two relationships.
            </Empty>
            <Link
              href="/collective/people"
              className="smallcaps inline-block text-[11px] text-gold hover:underline"
            >
              Find someone →
            </Link>
          </>
        )}
      </Gutter>
    </Screen>
  );
}

export const dynamic = "force-dynamic";
