"use client";

import { useState, useTransition } from "react";

import { Button, Card, Field, Tag, inputClass } from "@/components/ui";
import { money } from "@/lib/format";
import type { CommitmentKind, NeedStanding } from "@/lib/types";

import {
  activateProposal,
  addNeed,
  pledge,
  withdrawPledge,
} from "../../actions";

/**
 * Activate — the stage between "the group agreed" and "it is happening".
 *
 *   "Activate — If supported, resources and people flow to make it real."
 *
 * A ratified proposal sits here until named people have actually committed
 * what it needs. That gap is the honest one: agreeing costs nothing, and the
 * money and the hands are the part that usually does not appear. A proposal
 * with no needs is ready immediately, which is a real answer rather than a
 * loophole — some things can simply be done.
 */

const KINDS: { value: CommitmentKind; label: string; unit: string }[] = [
  { value: "money", label: "Money", unit: "GBP" },
  { value: "time", label: "Time", unit: "hours" },
  { value: "skill", label: "A person who can", unit: "person" },
  { value: "material", label: "Materials", unit: "items" },
];

export function Activation({
  proposalId,
  needs,
  ready,
  isAuthorOrSteward,
  myPledges,
  pledgesByNeed,
}: {
  proposalId: string;
  needs: NeedStanding[];
  ready: boolean;
  isAuthorOrSteward: boolean;
  myPledges: Record<string, { id: string; quantity: number }>;
  pledgesByNeed: Record<string, { name: string; quantity: number; mine: boolean }[]>;
}) {
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="space-y-4">
      {ready ? (
        <Card className="border-calm/40">
          <p className="text-[0.95rem] leading-relaxed text-paper">
            {needs.length
              ? "Everything this needs has been committed by someone."
              : "This needs nothing it does not already have."}
          </p>
          <Button
            type="button"
            className="mt-3"
            disabled={pending}
            onClick={() =>
              start(async () => {
                setError(null);
                const r = await activateProposal(proposalId);
                if (!r.ok) setError(r.error);
              })
            }
          >
            {pending ? "Activating" : "Activate it"}
          </Button>
          <p className="mt-3 text-xs leading-relaxed text-paper-faint">
            This turns it into a project and starts the clock. The pledges below
            become what the group is holding each other to.
          </p>
        </Card>
      ) : (
        <Card className="border-gold-dim bg-gold-wash">
          <p className="text-[0.95rem] leading-relaxed text-paper">
            The group agreed to this. It is not happening yet.
          </p>
          <p className="mt-2 text-sm leading-relaxed text-paper-dim">
            {needs.length
              ? `${needs.filter((n) => n.met).length} of ${needs.length} needs are covered. Until every one has someone's name against it, this stays a decision rather than a project.`
              : "Nobody has said what it would take. Add what it needs and people can commit to it."}
          </p>
        </Card>
      )}

      {needs.length ? (
        <ul className="space-y-2">
          {needs.map((need) => (
            <li key={need.need_id}>
              <NeedRow
                need={need}
                proposalId={proposalId}
                mine={myPledges[need.need_id]}
                pledges={pledgesByNeed[need.need_id] ?? []}
              />
            </li>
          ))}
        </ul>
      ) : null}

      {error ? <p className="text-sm text-alarm">{error}</p> : null}

      {isAuthorOrSteward ? (
        adding ? (
          <AddNeed
            proposalId={proposalId}
            onDone={() => setAdding(false)}
          />
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="smallcaps text-[11px] text-gold hover:underline"
          >
            + What else does this need?
          </button>
        )
      ) : null}
    </div>
  );
}

function NeedRow({
  need,
  proposalId,
  mine,
  pledges,
}: {
  need: NeedStanding;
  proposalId: string;
  mine?: { id: string; quantity: number };
  pledges: { name: string; quantity: number; mine: boolean }[];
}) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const required = Number(need.required);
  const pledged = Number(need.pledged);
  const short = Math.max(required - pledged, 0);
  const pct = required > 0 ? Math.min(100, (pledged / required) * 100) : 100;

  const show = (n: number) =>
    need.kind === "money" ? money(n) : `${n} ${need.unit}`;

  return (
    <Card className={need.met ? "border-calm/30" : ""}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[0.95rem] leading-snug text-paper">
          {need.description}
        </p>
        <Tag tone={need.met ? "calm" : "gold"}>
          {need.met ? "covered" : `${show(short)} short`}
        </Tag>
      </div>

      <div className="mt-3 h-1 overflow-hidden rounded-full bg-surface">
        <div
          className={`h-full rounded-full ${need.met ? "bg-calm" : "bg-gold"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="smallcaps mt-1.5 text-[10px] text-paper-faint">
        {show(pledged)} of {show(required)}
      </p>

      {pledges.length ? (
        <ul className="mt-3 space-y-1 border-t border-line pt-3">
          {pledges.map((p, i) => (
            <li key={i} className="flex justify-between text-sm">
              <span className="text-paper-dim">{p.mine ? "you" : p.name}</span>
              <span className="tabular-nums text-paper">{show(p.quantity)}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {error ? <p className="mt-2 text-sm text-alarm">{error}</p> : null}

      {mine ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => start(async () => { await withdrawPledge(mine.id, proposalId); })}
          className="smallcaps mt-3 text-[10px] text-paper-faint hover:text-alarm"
        >
          {pending ? "withdrawing" : "withdraw my pledge"}
        </button>
      ) : open ? (
        <div className="mt-3 space-y-3 border-t border-line pt-3">
          <div className="flex flex-wrap items-end gap-2">
            <div className="w-32">
              <Field label={need.kind === "money" ? "Amount" : need.unit}>
                <input
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  inputMode="decimal"
                  autoFocus
                  placeholder={String(short)}
                  className={inputClass}
                />
              </Field>
            </div>
            <div className="min-w-[10rem] flex-1">
              <Field label="Note" hint="Optional.">
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className={inputClass}
                />
              </Field>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              disabled={pending || !amount.trim()}
              onClick={() =>
                start(async () => {
                  setError(null);
                  const r = await pledge(need.need_id, proposalId, amount, note);
                  if (!r.ok) setError(r.error);
                  else setOpen(false);
                })
              }
            >
              {pending ? "Committing" : "Commit"}
            </Button>
            <Button type="button" tone="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : need.met ? null : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="smallcaps mt-3 text-[11px] text-gold hover:underline"
        >
          I&rsquo;ll cover some of this
        </button>
      )}
    </Card>
  );
}

function AddNeed({
  proposalId,
  onDone,
}: {
  proposalId: string;
  onDone: () => void;
}) {
  const [kind, setKind] = useState<CommitmentKind>("money");
  const [description, setDescription] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("GBP");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <Card>
      <div className="space-y-3">
        <Field label="What kind">
          <select
            value={kind}
            onChange={(e) => {
              const k = e.target.value as CommitmentKind;
              setKind(k);
              setUnit(KINDS.find((x) => x.value === k)?.unit ?? "");
            }}
            className={inputClass}
          >
            {KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="What exactly" hint="Specific enough that someone knows what they are agreeing to.">
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Someone to open up each week"
            className={inputClass}
          />
        </Field>

        <div className="flex gap-2">
          <div className="w-32">
            <Field label="How much">
              <input
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                inputMode="decimal"
                className={inputClass}
              />
            </Field>
          </div>
          <div className="w-32">
            <Field label="Unit">
              <input
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className={inputClass}
              />
            </Field>
          </div>
        </div>

        {error ? <p className="text-sm text-alarm">{error}</p> : null}

        <div className="flex gap-2">
          <Button
            type="button"
            disabled={pending || !description.trim() || !quantity.trim()}
            onClick={() =>
              start(async () => {
                setError(null);
                const r = await addNeed(proposalId, kind, description, quantity, unit);
                if (!r.ok) setError(r.error);
                else onDone();
              })
            }
          >
            {pending ? "Adding" : "Add it"}
          </Button>
          <Button type="button" tone="ghost" onClick={onDone}>
            Cancel
          </Button>
        </div>
      </div>
    </Card>
  );
}
