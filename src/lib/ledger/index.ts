import "server-only";

import { createClient } from "@/lib/supabase/server";

/**
 * The ledger seam.
 *
 * Sovereign's whitepaper puts vote recording, identity and treasury on a chain.
 * This build does none of that — see docs/architecture.md for why. What it does
 * instead is route every governance act through these three interfaces, so that
 * adding a chain later is an adapter, not a rewrite.
 *
 * The default implementation writes to an append-only, hash-chained Postgres
 * table. Each event commits to the hash of the previous one, so a removed or
 * edited row is detectable by replaying the chain — verifiable without being
 * distributed. That is the honest version of the whitepaper's claim at this
 * scale: tamper-evident, not trustless.
 *
 * WHAT A CHAIN ADAPTER WOULD REPLACE
 *
 *   VoteRecorder    BallotBox.submitVote(proposalId, proof)
 *   IdentityProver  IdentityAnchor — today: an invited member in a group;
 *                   later: a DID with a ZK eligibility proof
 *   Treasury        Treasury.approveDisbursement / releaseMilestone
 *
 * The rule for anything added here: the application layer must never learn
 * whether it is talking to Postgres or to a contract.
 */

export type LedgerKind =
  | "group.created"
  | "member.joined"
  | "proposal.submitted"
  | "proposal.reviewed"
  | "proposal.decided"
  | "flag.answered"
  | "resonance.recorded"
  | "project.started"
  | "project.spend"
  | "project.completed";

export interface LedgerRecorder {
  record(args: {
    groupId: string | null;
    kind: LedgerKind;
    subjectType: "group" | "proposal" | "project" | "profile";
    subjectId: string;
    payload?: Record<string, unknown>;
  }): Promise<void>;

  /** Replay the chain. `ok: false` means the record has been altered. */
  verify(groupId: string | null): Promise<{ ok: boolean; checked: number; brokenAt: number | null }>;
}

/**
 * Postgres implementation. Writes go through a SECURITY DEFINER function so the
 * client cannot forge, reorder or backdate an event — the table itself has no
 * insert policy at all.
 */
class PostgresLedger implements LedgerRecorder {
  async record({
    groupId,
    kind,
    subjectType,
    subjectId,
    payload = {},
  }: {
    groupId: string | null;
    kind: LedgerKind;
    subjectType: string;
    subjectId: string;
    payload?: Record<string, unknown>;
  }) {
    const supabase = await createClient();
    const { error } = await supabase.rpc("record_ledger_event", {
      p_group_id: groupId,
      p_kind: kind,
      p_subject_type: subjectType,
      p_subject_id: subjectId,
      p_payload: payload,
    });

    // A failed ledger write must not swallow the action that caused it, but it
    // must be visible: an unrecorded decision is worse than a noisy log.
    if (error) {
      console.error("[ledger] failed to record", kind, subjectId, error.message);
    }
  }

  async verify(groupId: string | null) {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("verify_ledger", { p_group_id: groupId });
    if (error) throw new Error(error.message);
    const row = Array.isArray(data) ? data[0] : data;
    return {
      ok: Boolean(row?.ok),
      checked: Number(row?.checked ?? 0),
      brokenAt: row?.broken_at ?? null,
    };
  }
}

let instance: LedgerRecorder | null = null;

export function ledger(): LedgerRecorder {
  if (!instance) instance = new PostgresLedger();
  return instance;
}

/* ---------------------------------------------------------------------------
   Identity
--------------------------------------------------------------------------- */

export interface IdentityProver {
  /**
   * Is this person entitled to take part in this group's decisions?
   *
   * Today: they were invited and they joined. That is the whole claim, and the
   * app should not pretend otherwise anywhere in its copy.
   *
   * A ZK implementation would verify a proof of eligibility and uniqueness
   * without learning who they are. The signature stays the same.
   */
  canParticipate(groupId: string, profileId: string): Promise<boolean>;
  /** How identity is being established, in words a member can read. */
  describe(): string;
}

class InviteTrustIdentity implements IdentityProver {
  async canParticipate(groupId: string, profileId: string) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("group_members")
      .select("profile_id")
      .eq("group_id", groupId)
      .eq("profile_id", profileId)
      .maybeSingle();
    return Boolean(data);
  }

  describe() {
    return "Invite-based. A member is someone a steward invited and who signed in with that email. There are no identity proofs and no uniqueness guarantee: one person could hold two invited accounts. For a group of five to fifty who know each other, that is the honest level of assurance.";
  }
}

let identityInstance: IdentityProver | null = null;

export function identity(): IdentityProver {
  if (!identityInstance) identityInstance = new InviteTrustIdentity();
  return identityInstance;
}

/* ---------------------------------------------------------------------------
   Treasury
--------------------------------------------------------------------------- */

export interface Treasury {
  /** Money the group has committed to a project, and what it has recorded spending. */
  position(projectId: string): Promise<{ committed: number; spent: number; remaining: number }>;
  /** Record spend against a project. Book-keeping, not a payment rail. */
  recordSpend(projectId: string, amount: number, note: string): Promise<void>;
  describe(): string;
}

class BookkeepingTreasury implements Treasury {
  async position(projectId: string) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("projects")
      .select("budget_committed, budget_spent")
      .eq("id", projectId)
      .single();
    const committed = Number(data?.budget_committed ?? 0);
    const spent = Number(data?.budget_spent ?? 0);
    return { committed, spent, remaining: committed - spent };
  }

  async recordSpend(projectId: string, amount: number, note: string) {
    const supabase = await createClient();
    const { data: me } = await supabase.auth.getUser();
    if (!me.user) throw new Error("not signed in");

    await supabase.from("project_updates").insert({
      project_id: projectId,
      author_id: me.user.id,
      body: note,
      spend_delta: amount,
    });

    const { data: project } = await supabase
      .from("projects")
      .select("budget_spent, group_id")
      .eq("id", projectId)
      .single();

    if (project) {
      await supabase
        .from("projects")
        .update({ budget_spent: Number(project.budget_spent) + amount })
        .eq("id", projectId);

      await ledger().record({
        groupId: project.group_id,
        kind: "project.spend",
        subjectType: "project",
        subjectId: projectId,
        payload: { amount },
      });
    }
  }

  describe() {
    return "A contribution ledger, not a wallet. It records what the group committed and what it spent, in ordinary money, and moves nothing. There is no token and no balance to hold.";
  }
}

let treasuryInstance: Treasury | null = null;

export function treasury(): Treasury {
  if (!treasuryInstance) treasuryInstance = new BookkeepingTreasury();
  return treasuryInstance;
}
