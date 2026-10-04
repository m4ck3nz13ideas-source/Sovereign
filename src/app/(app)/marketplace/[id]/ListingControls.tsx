"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button, Field, SectionLabel, inputClass } from "@/components/ui";
import { reasonProblem } from "@/lib/marketplace";
import type { AttachableProposal, ListingState } from "@/lib/types";

import { attachRevocation, setListingContact, withdrawListing } from "../actions";

/**
 * What a reader can do with a listing.
 *
 * The person offering it can change how to reach them and can withdraw it.
 * Anybody else it reaches can propose taking it down — on a proposal of their
 * own, to the same people who admitted it. Nobody can take it down directly,
 * including the person who raised the proposal that admitted it.
 */
export function ListingControls({
  listingId,
  mine,
  state,
  contact,
  attachable,
}: {
  listingId: string;
  mine: boolean;
  state: ListingState;
  contact: string;
  attachable: AttachableProposal[];
}) {
  if (mine && (state === "pending" || state === "listed")) {
    return (
      <>
        <Contact listingId={listingId} initial={contact} />
        <Withdraw listingId={listingId} />
      </>
    );
  }
  if (!mine && state === "listed") {
    return <ProposeRemoval listingId={listingId} attachable={attachable} />;
  }
  return null;
}

function Contact({ listingId, initial }: { listingId: string; initial: string }) {
  const [value, setValue] = useState(initial);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <section className="mt-10">
      <SectionLabel>How to reach you</SectionLabel>
      <div className="flex gap-2">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          maxLength={280}
          aria-label="How to reach you"
          className={inputClass}
        />
        <Button
          type="button"
          tone="quiet"
          disabled={pending || value === initial}
          onClick={() =>
            start(async () => {
              const r = await setListingContact(listingId, value);
              setMsg(r.ok ? "Saved." : r.error);
            })
          }
        >
          Save
        </Button>
      </div>
      {msg ? <p className="mt-2 text-sm text-paper-faint">{msg}</p> : null}
      <p className="mt-2 text-[0.8125rem] text-paper-faint">
        Not part of what was decided, so it can change. Everything else is fixed.
      </p>
    </section>
  );
}

function Withdraw({ listingId }: { listingId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  if (!open) {
    return (
      <div className="mt-8">
        <Button type="button" tone="ghost" onClick={() => setOpen(true)}>
          Withdraw this listing
        </Button>
      </div>
    );
  }

  return (
    <section className="mt-8">
      <SectionLabel>Withdraw</SectionLabel>
      <Field label="Why" hint="On the record, for the people who admitted it. It cannot be undone.">
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={2}
          className={inputClass}
        />
      </Field>
      {error ? <p className="mt-2 text-sm text-alarm">{error}</p> : null}
      <div className="mt-3 flex gap-2">
        <Button
          type="button"
          tone="danger"
          disabled={pending || Boolean(reasonProblem(reason))}
          onClick={() =>
            start(async () => {
              setError(null);
              const r = await withdrawListing(listingId, reason);
              if (!r.ok) return setError(r.error);
              router.refresh();
            })
          }
        >
          {pending ? "Withdrawing" : "Withdraw"}
        </Button>
        <Button type="button" tone="ghost" onClick={() => setOpen(false)}>
          Keep it
        </Button>
      </div>
    </section>
  );
}

function ProposeRemoval({
  listingId,
  attachable,
}: {
  listingId: string;
  attachable: AttachableProposal[];
}) {
  const [proposalId, setProposalId] = useState(attachable[0]?.id ?? "");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  return (
    <section className="mt-10">
      <SectionLabel>Propose taking it down</SectionLabel>
      <p className="mb-4 text-[0.9375rem] leading-relaxed text-paper-dim">
        It goes to the same people who admitted it, on a proposal of yours, and
        comes down only if that proposal passes. Nobody can take it down
        directly.
      </p>
      {attachable.length ? (
        <div className="space-y-4">
          <Field label="Carried by">
            <select
              value={proposalId}
              onChange={(e) => setProposalId(e.target.value)}
              className={inputClass}
            >
              {attachable.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Why" hint="Twenty characters at least. It is shown with the proposal.">
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              className={inputClass}
            />
          </Field>
          {error ? <p className="text-sm text-alarm">{error}</p> : null}
          <Button
            type="button"
            tone="quiet"
            disabled={pending || !proposalId || Boolean(reasonProblem(reason))}
            onClick={() =>
              start(async () => {
                setError(null);
                const r = await attachRevocation({ listingId, proposalId, reason });
                if (!r.ok) return setError(r.error);
                router.refresh();
              })
            }
          >
            {pending ? "Attaching" : "Attach to this proposal"}
          </Button>
        </div>
      ) : (
        <p className="text-sm leading-relaxed text-paper-faint">
          You have no proposal to the same people that nobody has responded to
          yet.{" "}
          <Link href="/collective/proposals/new" className="text-gold hover:underline">
            Write one
          </Link>{" "}
          saying why it should come down, then come back here and attach it.
        </p>
      )}
    </section>
  );
}
