"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button, Field, inputClass, Tag } from "@/components/ui";
import { ROLE_COPY, type TeamMember } from "@/lib/business";

import { acceptInvite, inviteMember, leaveVendor, removeMember, setMemberRole } from "../ops";

/** The team as its members see it; the owner can change it. */
export function TeamPanel({
  vendorId,
  members,
  me,
  owner,
}: {
  vendorId: string;
  members: TeamMember[];
  me: string;
  owner: boolean;
}) {
  const router = useRouter();
  const [handle, setHandle] = useState("");
  const [role, setRole] = useState<"manager" | "staff">("staff");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) =>
    start(async () => {
      setError(null);
      const r = await fn();
      if (!r.ok) setError(r.error ?? "That did not work.");
      else after?.();
    });

  return (
    <div className="space-y-5">
      <ul className="space-y-2">
        {members.map((m) => (
          <li key={m.profile_id} className="rounded-card border border-line px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[0.95rem] text-paper">
                {m.profile_id === me ? "You" : m.display_name}
                {m.handle ? <span className="ml-1.5 text-xs text-paper-faint">@{m.handle}</span> : null}
              </span>
              {m.accepted ? <Tag>{m.role}</Tag> : <Tag tone="gold">invited · {m.role}</Tag>}
            </div>
            {owner && m.role !== "owner" ? (
              <div className="mt-2 flex flex-wrap gap-3 text-sm">
                <button
                  type="button"
                  disabled={pending}
                  className="text-gold hover:underline"
                  onClick={() =>
                    run(() => setMemberRole(vendorId, m.profile_id, m.role === "manager" ? "staff" : "manager"))
                  }
                >
                  Make {m.role === "manager" ? "staff" : "manager"}
                </button>
                <button
                  type="button"
                  disabled={pending}
                  className="text-paper-faint hover:text-alarm"
                  onClick={() => run(() => removeMember(vendorId, m.profile_id))}
                >
                  {m.accepted ? "Remove" : "Withdraw invitation"}
                </button>
              </div>
            ) : null}
          </li>
        ))}
      </ul>

      <ul className="space-y-1 text-center text-xs text-paper-faint">
        {(["owner", "manager", "staff"] as const).map((r) => (
          <li key={r}>{ROLE_COPY[r]}</li>
        ))}
      </ul>

      {owner ? (
        <div className="space-y-3 rounded-card border border-line bg-surface-soft p-4">
          <Field label="Invite by handle" hint="Exact handle only. They join when they accept.">
            <input
              className={inputClass}
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              placeholder="@handle"
              autoCapitalize="none"
              autoCorrect="off"
            />
          </Field>
          <Field label="As">
            <select className={inputClass} value={role} onChange={(e) => setRole(e.target.value as typeof role)}>
              <option value="staff">Staff</option>
              <option value="manager">Manager</option>
            </select>
          </Field>
          <Button
            type="button"
            disabled={pending || !handle.trim()}
            onClick={() => run(() => inviteMember(vendorId, handle, role), () => setHandle(""))}
          >
            Invite
          </Button>
        </div>
      ) : (
        <div className="flex justify-center">
          <Button
            type="button"
            tone="quiet"
            disabled={pending}
            onClick={() => run(() => leaveVendor(vendorId), () => router.push("/connection?show=businesses"))}
          >
            Leave this team
          </Button>
        </div>
      )}
      {error ? <p className="text-center text-sm text-alarm">{error}</p> : null}
    </div>
  );
}

/** An invitation to join a business's team, shown in Connection. */
export function InviteCard({
  vendorId,
  vendorName,
  role,
  invitedBy,
}: {
  vendorId: string;
  vendorName: string;
  role: string;
  invitedBy: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [gone, setGone] = useState(false);
  const [pending, start] = useTransition();
  if (gone) return null;
  return (
    <div className="rounded-card border border-gold-dim bg-gold-wash px-4 py-3">
      <p className="text-[0.9375rem] text-paper">
        {invitedBy} asked you to join <span className="font-semibold">{vendorName}</span> as {role}.
      </p>
      <div className="mt-2 flex gap-4 text-sm">
        <button
          type="button"
          disabled={pending}
          className="font-semibold text-gold hover:underline"
          onClick={() =>
            start(async () => {
              const r = await acceptInvite(vendorId);
              if (!r.ok) setError(r.error);
              else router.push(`/market/b/${vendorId}`);
            })
          }
        >
          Join
        </button>
        <button
          type="button"
          disabled={pending}
          className="text-paper-faint hover:text-paper"
          onClick={() =>
            start(async () => {
              const r = await leaveVendor(vendorId);
              if (!r.ok) setError(r.error);
              else setGone(true);
            })
          }
        >
          Decline
        </button>
      </div>
      {error ? <p className="mt-1 text-xs text-alarm">{error}</p> : null}
    </div>
  );
}
