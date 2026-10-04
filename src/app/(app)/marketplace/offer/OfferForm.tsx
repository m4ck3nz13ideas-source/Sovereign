"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button, Field, Pill, inputClass } from "@/components/ui";
import { KIND_LABEL, LISTING_LIMITS, offerProblem } from "@/lib/marketplace";
import { LISTING_KINDS, type AttachableProposal, type ListingKind } from "@/lib/types";

import { offerListing } from "../actions";

/**
 * The offer itself. Nothing is saved until it is attached, and once it is
 * attached the words are fixed (`freeze_listing()`), so the button says so.
 */
export function OfferForm({
  proposals,
  initial,
}: {
  proposals: AttachableProposal[];
  initial: string;
}) {
  const [proposalId, setProposalId] = useState(initial);
  const [kind, setKind] = useState<ListingKind>("product");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [terms, setTerms] = useState("");
  const [contact, setContact] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  const draft = { proposalId, kind, name, description, terms, contact };
  const problem = offerProblem(draft);

  function submit() {
    start(async () => {
      setError(null);
      const r = await offerListing(draft);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      router.push(`/marketplace/${r.id}`);
    });
  }

  return (
    <div className="space-y-5 pb-6">
      <Field label="Carried by">
        <select
          value={proposalId}
          onChange={(e) => setProposalId(e.target.value)}
          className={inputClass}
        >
          {proposals.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </select>
      </Field>

      <div>
        <span className="smallcaps mb-1.5 block text-[11px] text-paper-faint">What it is</span>
        <div className="flex gap-2">
          {LISTING_KINDS.map((k) => (
            <Pill key={k} type="button" active={kind === k} onClick={() => setKind(k)}>
              {KIND_LABEL[k]}
            </Pill>
          ))}
        </div>
      </div>

      <Field label="Name">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={LISTING_LIMITS.name.max}
          placeholder="Saturday bread"
          className={inputClass}
        />
      </Field>

      <Field
        label="What it is, plainly"
        hint="Enough for somebody to decide whether it belongs here. Forty characters at least."
      >
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={5}
          maxLength={LISTING_LIMITS.description.max}
          className={inputClass}
        />
      </Field>

      <Field
        label="Terms"
        hint="Price and conditions, in your own words. Nothing is paid through Sovereign."
      >
        <textarea
          value={terms}
          onChange={(e) => setTerms(e.target.value)}
          rows={2}
          maxLength={LISTING_LIMITS.terms.max}
          placeholder="Three pounds a loaf, cash or swap"
          className={inputClass}
        />
      </Field>

      <Field label="How to reach you" hint="Optional, and the one thing you can change later.">
        <input
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          maxLength={LISTING_LIMITS.contact.max}
          placeholder="Knock at number four"
          className={inputClass}
        />
      </Field>

      {error ? <p className="text-sm text-alarm">{error}</p> : null}
      {!error && problem && (name || description || terms) ? (
        <p className="text-sm text-paper-faint">{problem}</p>
      ) : null}

      <Button type="button" disabled={Boolean(problem) || pending} onClick={submit}>
        {pending ? "Attaching" : "Attach to this proposal"}
      </Button>
      <p className="text-[0.8125rem] leading-relaxed text-paper-faint">
        Once attached it cannot be edited. To change what you offer, write a new
        proposal.
      </p>
    </div>
  );
}
