import Link from "next/link";

import { Card, Empty, Gutter, Screen, SectionLabel, Tag, TopBar } from "@/components/ui";
import {
  CHARTER_FOUNDING_SIZE,
  FIELD_LABEL,
  FIXED_FOR_EVERY_GROUP,
  WHO_LABEL,
  charterOf,
} from "@/lib/charters";
import { shortDate } from "@/lib/format";
import { requireSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import type { Group } from "@/lib/types";

import { InvitePanel } from "../InvitePanel";
import { CharterEditor, RenameGroup } from "./CharterEditor";

export const metadata = { title: "Manage group · Sovereign" };

/**
 * A group's charter, members and invitations (0057), moved here from
 * Settings: the group is managed where the group is. Every member can read
 * the charter and its history; stewards of a founding group edit it
 * directly; everyone else changes it by proposal. Invitations follow the
 * charter's own rule.
 */
export default async function ManageGroupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { groups } = await requireSession();
  const mine = groups.find((g) => g.id === id);

  if (!mine) {
    return (
      <>
        <TopBar title="Group" back="/connection" />
        <Screen>
          <Gutter className="pt-6">
            <Empty>This page is for the group&rsquo;s members.</Empty>
          </Gutter>
        </Screen>
      </>
    );
  }

  const supabase = await createClient();
  const [{ data: groupRow }, { data: memberRows }, { data: revisionRows }] = await Promise.all([
    supabase.from("groups").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("group_members")
      .select("profile_id, role, joined_at")
      .eq("group_id", id)
      .order("joined_at", { ascending: true }),
    supabase
      .from("charter_revisions")
      .select("revision, created_at, proposal_id")
      .eq("group_id", id)
      .order("revision", { ascending: false })
      .limit(12),
  ]);

  const group = (groupRow ?? mine) as Group;
  const members = (memberRows ?? []) as { profile_id: string; role: string; joined_at: string }[];
  const { data: names } = members.length
    ? await supabase
        .from("public_profiles")
        .select("id, display_name")
        .in("id", members.map((m) => m.profile_id).slice(0, 100))
    : { data: [] };
  const nameOf = new Map(((names ?? []) as { id: string; display_name: string }[]).map((n) => [n.id, n.display_name]));

  const steward = mine.role === "owner" || mine.role === "steward";
  const founding = members.length < CHARTER_FOUNDING_SIZE;
  const charter = charterOf(group);
  const canInvite = steward || charter.inviters === "members";
  const revisions = (revisionRows ?? []) as { revision: number; created_at: string; proposal_id: string | null }[];

  const rows: [string, string][] = [
    [FIELD_LABEL.purpose, charter.purpose || "—"],
    [FIELD_LABEL.goal, charter.goal || "—"],
    [FIELD_LABEL.group_values, charter.group_values.join(", ") || "—"],
    [FIELD_LABEL.inviters, WHO_LABEL[charter.inviters]],
    [FIELD_LABEL.proposers, WHO_LABEL[charter.proposers]],
    [FIELD_LABEL.ai_context, charter.ai_context || "—"],
  ];

  return (
    <>
      <TopBar title={group.name} back={`/connection/g/${id}`} />
      <Screen>
        <Gutter className="space-y-8 pt-6 pb-8">
          {/* ---------------------------------------------------- CHARTER */}
          <section id="charter" className="scroll-mt-20">
            <SectionLabel right={<Tag tone={founding ? "gold" : "neutral"}>{founding ? "founding" : "by proposal"}</Tag>}>
              Charter
            </SectionLabel>
            <Card>
              <dl className="space-y-3">
                {rows.map(([k, v]) => (
                  <div key={k}>
                    <dt className="smallcaps text-[10px] text-paper-faint">{k}</dt>
                    <dd className="mt-0.5 whitespace-pre-wrap text-[0.95rem] leading-relaxed text-paper">{v}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-4 border-t border-line pt-3 text-sm leading-relaxed text-paper-dim">
                {founding
                  ? `Until it has ${CHARTER_FOUNDING_SIZE} members, its stewards can change this directly. After that, only a passed proposal can — and it takes effect the moment it passes.`
                  : "It changes only by a passed proposal, which takes effect the moment it passes. Any member can propose a change, whoever may propose anything else."}
              </p>
              <div className="mt-4">
                <CharterEditor groupId={id} charter={charter} direct={founding && steward} />
              </div>
            </Card>
          </section>

          <section>
            <SectionLabel>Fixed for every group</SectionLabel>
            <ul className="space-y-1.5 text-center text-[0.9rem] leading-relaxed text-paper-dim">
              {FIXED_FOR_EVERY_GROUP.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          </section>

          {revisions.length ? (
            <section>
              <SectionLabel right={`${revisions.length}`}>Every version</SectionLabel>
              <ul className="space-y-1.5 text-center text-[0.875rem] text-paper-dim">
                {revisions.map((r) => (
                  <li key={r.revision}>
                    Version {r.revision} · {shortDate(r.created_at)}
                    {r.proposal_id ? (
                      <>
                        {" · "}
                        <Link href={`/collective/proposals/${r.proposal_id}`} className="text-gold hover:underline">
                          by proposal
                        </Link>
                      </>
                    ) : r.revision === 1 ? (
                      " · founded"
                    ) : (
                      " · by a steward, while founding"
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {/* ---------------------------------------------------- NAME */}
          {steward ? (
            <section>
              <SectionLabel>Name</SectionLabel>
              <RenameGroup groupId={id} name={group.name} />
            </section>
          ) : null}

          {/* --------------------------------------------------- MEMBERS */}
          <section>
            <SectionLabel right={`${members.length}`}>Members</SectionLabel>
            <Card>
              <ul className="space-y-2.5">
                {members.map((m) => (
                  <li key={m.profile_id} className="flex items-baseline justify-between gap-3">
                    <span className="text-[0.95rem] text-paper">{nameOf.get(m.profile_id) ?? "A member"}</span>
                    <span className="smallcaps text-[10px] text-paper-faint">
                      {m.role} · {shortDate(m.joined_at)}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          </section>

          {/* ---------------------------------------------------- INVITE */}
          {canInvite ? (
            <section>
              <SectionLabel>Invite someone</SectionLabel>
              <InvitePanel groupId={id} />
            </section>
          ) : (
            <p className="text-center text-sm text-paper-faint">By its charter, only stewards invite people in.</p>
          )}
        </Gutter>
      </Screen>
    </>
  );
}

export const dynamic = "force-dynamic";
