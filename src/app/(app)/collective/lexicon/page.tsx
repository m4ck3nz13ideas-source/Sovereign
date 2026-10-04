import Link from "next/link";

import { ScaleSelector } from "@/components/nav/ScaleSelector";
import { Empty, Page, Readers, ScreenHead, Tag } from "@/components/ui";
import { addressOptions, requireAddress } from "@/lib/address";
import { ago } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { Term } from "@/lib/types";

import { RaiseWord } from "./RaiseWord";

export const metadata = { title: "Words · Sovereign" };

/**
 * The words a group holds, and how many people have said what they mean.
 *
 * This is the collective interior — the one quadrant the app had nothing for.
 * Everything else under Collective records what the group DECIDED. None of it
 * can show that two members read the same sentence differently, because
 * `alignment_shape()` measures the spread of numbers and the two numbers here
 * are identical. The disagreement is upstream of anything the ledger holds.
 *
 * WHY IT SHOWS NO AGREEMENT FIGURE
 *
 * `voices` is how many people have written a reading. It is not a measure of
 * how close those readings are, and there is no measure of that anywhere in
 * the schema, on purpose. A similarity number over two people's sentences
 * would put a figure on meaning; it would be wrong in ways nobody could audit;
 * and on a screen it would look exactly like a fact. So the readings sit next
 * to each other and the members read them. See rule 30.
 *
 * WHY IT IS GROUPS ONLY
 *
 * A place has no register and no members (rule 15), so there is nobody for a
 * word at a place to belong to and nothing that would make one person's
 * reading of it visible to another. The screen says that rather than showing an
 * empty list that looks broken.
 */
export default async function LexiconPage() {
  const session = await requireAddress();
  const { address } = session;

  const supabase = await createClient();

  const terms: Term[] =
    address.kind === "group"
      ? (((
          await supabase.rpc("group_lexicon", { p_group_id: address.group.id })
        ).data ?? []) as Term[])
      : [];

  return (
    <Page>
      <ScreenHead sub={address.label}>Words</ScreenHead>
      <ScaleSelector
        options={addressOptions(session)}
        current={
          address.kind === "group"
            ? `group:${address.group.id}`
            : `scope:${address.scope}`
        }
      />

      <p className="mb-5 mt-4 text-[0.9375rem] leading-relaxed text-paper-dim">
        Words this group uses where it is worth knowing what each person takes
        them to mean. Nothing here decides anything and nothing here is settled
        — there is no agreed definition, because the useful thing to find out is
        usually that there isn&rsquo;t one.
      </p>
      {address.kind === "group" ? (
        <Readers className="-mt-2 mb-5">
          Everyone in {address.group.name}, and nobody outside it.
        </Readers>
      ) : null}

      {address.kind !== "group" ? (
        <Empty>
          A word belongs to the people who use it, and a place has no members —
          nobody is on a register for a street, which is the same reason a
          proposal here passes on a floor of voices rather than a share of them.
          Switch to a group above.
        </Empty>
      ) : (
        <>
          <RaiseWord groupId={address.group.id} />

          {terms.length ? (
            <ul className="space-y-0">
              {terms.map((t) => (
                <li key={t.id}>
                  <Link
                    href={`/collective/lexicon/${t.id}`}
                    className="press flex items-baseline justify-between gap-3 border-b border-line-soft py-3"
                  >
                    <div className="min-w-0">
                      <p className="text-[1.0625rem] leading-snug text-paper">
                        {t.term}
                      </p>
                      <p className="smallcaps mt-1 text-[10px] text-paper-faint">
                        {t.voices === 0
                          ? "nobody has written what this means"
                          : t.voices === 1
                            ? "one person has written what this means"
                            : `${t.voices} people have written what this means`}
                        {t.last_read ? ` · ${ago(t.last_read)}` : ""}
                      </p>
                    </div>
                    {t.yours ? null : <Tag tone="gold">not you</Tag>}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>
              No words yet. The ones worth raising are the ones a proposal turned
              on and nobody defined — &ldquo;shared&rdquo;,
              &ldquo;urgent&rdquo;, &ldquo;the fund&rdquo;, &ldquo;ours&rdquo;.
            </Empty>
          )}
        </>
      )}
    </Page>
  );
}
