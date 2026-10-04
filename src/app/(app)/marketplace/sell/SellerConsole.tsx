"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button, Card, Field, inputClass, SectionLabel, Tag } from "@/components/ui";
import {
  pounds,
  STATUS_COPY,
  type Campaign,
  type Offering,
  type OfferingKind,
  type Vendor,
  type VendorStatus,
  type Vetting,
} from "@/lib/marketplace";

import {
  addOffering,
  createCampaign,
  registerVendor,
  requestVetting,
  setCampaignPaused,
  updateVendor,
  withdrawOffering,
} from "../actions";

type Res = { ok: true; id?: string } | { ok: false; error: string };

export function SellerConsole({
  vendor,
  status,
  vetting,
  offerings,
  campaigns,
  laws,
}: {
  vendor: Vendor | null;
  status: VendorStatus | null;
  vetting: Vetting | null;
  offerings: Offering[];
  campaigns: (Campaign & { clicks: number; spent_pence: number })[];
  laws: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const run = (fn: () => Promise<Res>, after?: () => void) =>
    start(async () => {
      setError(null);
      const r = await fn();
      if (!r.ok) setError(r.error);
      else {
        after?.();
        router.refresh();
      }
    });

  const approved = status === "approved";

  return (
    <div className="space-y-10">
      {error ? <p className="text-sm text-alarm">{error}</p> : null}

      <BusinessForm vendor={vendor} pending={pending} onSave={(v) =>
        run(() => (vendor ? updateVendor(vendor.id, v) : registerVendor(v)))
      } />

      {vendor && status ? (
        <section>
          <SectionLabel right={<Tag tone={STATUS_COPY[status].tone}>{STATUS_COPY[status].label}</Tag>}>
            Vetting
          </SectionLabel>
          <p className="text-sm leading-relaxed text-paper-dim">{STATUS_COPY[status].next}</p>

          {status === "unvetted" || status === "changed" || status === "refused" || status === "refused_by_ai" ? (
            <Button
              type="button"
              className="mt-3"
              disabled={pending}
              onClick={() => run(() => requestVetting(vendor.id))}
            >
              {pending ? "Reading against the laws" : "Ask for vetting"}
            </Button>
          ) : null}

          {vetting?.decision && vetting.sign_note ? (
            <p className="mt-3 text-sm text-paper-faint">Reviewer: {vetting.sign_note}</p>
          ) : null}

          {vetting ? (
            <details className="mt-4">
              <summary className="cursor-pointer text-sm text-paper-faint">
                The latest reading — {vetting.violations} violation{vetting.violations === 1 ? "" : "s"},{" "}
                {vetting.tensions} tension{vetting.tensions === 1 ? "" : "s"}
              </summary>
              <ul className="mt-3 space-y-3">
                {vetting.readings.map((r) => (
                  <li key={r.law_id} className="text-sm leading-relaxed">
                    <span className="text-paper">{laws.find((l) => l.id === r.law_id)?.name ?? r.law_id}</span>{" "}
                    <Tag tone={r.verdict === "violation" ? "alarm" : r.verdict === "tension" ? "gold" : "calm"}>
                      {r.verdict}
                    </Tag>
                    <p className="mt-1 text-paper-dim">{r.reasoning}</p>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </section>
      ) : null}

      {vendor ? (
        <section>
          <SectionLabel>Products and services</SectionLabel>
          {!approved ? (
            <p className="mb-3 text-sm text-paper-faint">
              You can add these now. They appear in the marketplace once your business is approved.
            </p>
          ) : null}
          <ul className="mb-4 space-y-2">
            {offerings.map((o) => (
              <li key={o.id} className="flex items-start justify-between gap-3 rounded-card border border-line px-4 py-3">
                <div>
                  <p className="text-[0.95rem] text-paper">
                    {o.name} <span className="text-paper-faint">· {o.price}</span>
                  </p>
                  {o.removed_at ? (
                    <p className="mt-1 text-xs text-alarm">Removed by a reviewer: {o.remove_note}</p>
                  ) : o.withdrawn_at ? (
                    <p className="mt-1 text-xs text-paper-faint">Withdrawn</p>
                  ) : null}
                </div>
                {!o.withdrawn_at && !o.removed_at ? (
                  <button
                    type="button"
                    className="text-xs text-paper-faint hover:text-alarm"
                    disabled={pending}
                    onClick={() => run(() => withdrawOffering(o.id))}
                  >
                    Withdraw
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
          <OfferingForm pending={pending} onAdd={(o, reset) => run(() => addOffering({ vendorId: vendor.id, ...o }), reset)} />
        </section>
      ) : null}

      {vendor ? (
        <section className="pb-4">
          <SectionLabel>Advertising</SectionLabel>
          <p className="mb-3 text-sm leading-relaxed text-paper-faint">
            Pay per click. The highest live bid takes the one sponsored slot, labelled as an ad.
            Each person is charged once per campaign per day, and never past your budget.
            {approved ? "" : " Only an approved business can advertise — approval cannot be bought, so it comes first."}
          </p>
          {campaigns.length ? (
            <ul className="mb-4 space-y-2">
              {campaigns.map((c) => (
                <li key={c.id} className="rounded-card border border-line px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-[0.95rem] text-paper">{c.headline}</span>
                    <button
                      type="button"
                      className="text-xs text-paper-faint hover:text-paper"
                      disabled={pending}
                      onClick={() => run(() => setCampaignPaused(c.id, !c.paused))}
                    >
                      {c.paused ? "Resume" : "Pause"}
                    </button>
                  </div>
                  <p className="mt-1 text-xs text-paper-faint">
                    {pounds(c.bid_pence)} a click · {c.clicks} click{c.clicks === 1 ? "" : "s"} ·{" "}
                    {pounds(c.spent_pence)} of {pounds(c.budget_pence)} spent{c.paused ? " · paused" : ""}
                  </p>
                </li>
              ))}
            </ul>
          ) : null}
          {approved ? (
            <CampaignForm
              offerings={offerings.filter((o) => !o.withdrawn_at && !o.removed_at)}
              pending={pending}
              onCreate={(c, reset) => run(() => createCampaign({ vendorId: vendor.id, ...c }), reset)}
            />
          ) : null}
          <p className="mt-3 text-xs text-paper-faint">
            Spend is recorded here. Card billing is not switched on yet; until it is, ad spend is invoiced.
          </p>
        </section>
      ) : null}
    </div>
  );
}

function BusinessForm({
  vendor,
  pending,
  onSave,
}: {
  vendor: Vendor | null;
  pending: boolean;
  onSave: (v: { name: string; description: string; evidence: string; website: string; location: string }) => void;
}) {
  const [open, setOpen] = useState(!vendor);
  const [name, setName] = useState(vendor?.name ?? "");
  const [description, setDescription] = useState(vendor?.description ?? "");
  const [evidence, setEvidence] = useState(vendor?.evidence ?? "");
  const [website, setWebsite] = useState(vendor?.website ?? "https://");
  const [location, setLocation] = useState(vendor?.location ?? "");

  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-sm text-gold hover:underline">
        Edit your business
      </button>
    );

  return (
    <section>
      <SectionLabel>{vendor ? "Your business" : "Register your business"}</SectionLabel>
      {vendor ? (
        <p className="mb-3 text-sm text-paper-faint">
          Saving changes to these takes you out of the marketplace until you are read again.
        </p>
      ) : (
        <p className="mb-3 text-sm leading-relaxed text-paper-faint">
          Only businesses aligned with the ten Universal Laws are listed. Tell us what you do and
          give your evidence; the AI reads it against the laws and a reviewer signs it off.
        </p>
      )}
      <div className="space-y-3">
        <Field label="Name">
          <input className={inputClass} value={name} maxLength={120} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="What you do">
          <textarea className={`${inputClass} min-h-24`} value={description} maxLength={2000} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <Field label="Your evidence" hint="How you treat workers, what you use and where it comes from, your impact on nature, any certifications. Specific beats general.">
          <textarea className={`${inputClass} min-h-40`} value={evidence} maxLength={6000} onChange={(e) => setEvidence(e.target.value)} />
        </Field>
        <Field label="Website">
          <input className={inputClass} value={website} maxLength={500} onChange={(e) => setWebsite(e.target.value)} />
        </Field>
        <Field label="Location" hint="Optional.">
          <input className={inputClass} value={location} maxLength={120} onChange={(e) => setLocation(e.target.value)} />
        </Field>
        <div className="flex gap-2">
          <Button type="button" disabled={pending} onClick={() => onSave({ name, description, evidence, website, location })}>
            {vendor ? "Save" : "Register"}
          </Button>
          {vendor ? (
            <Button type="button" tone="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function OfferingForm({
  pending,
  onAdd,
}: {
  pending: boolean;
  onAdd: (o: { kind: OfferingKind; name: string; description: string; price: string; url: string }, reset: () => void) => void;
}) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<OfferingKind>("product");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [url, setUrl] = useState("https://");

  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-sm text-gold hover:underline">
        Add a product or service
      </button>
    );

  const reset = () => {
    setName("");
    setDescription("");
    setPrice("");
    setUrl("https://");
    setOpen(false);
  };

  return (
    <Card>
      <div className="space-y-3">
        <Field label="Kind">
          <select className={inputClass} value={kind} onChange={(e) => setKind(e.target.value as OfferingKind)}>
            <option value="product">Product</option>
            <option value="service">Service</option>
          </select>
        </Field>
        <Field label="Name">
          <input className={inputClass} value={name} maxLength={120} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Description">
          <textarea className={`${inputClass} min-h-20`} value={description} maxLength={2000} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <Field label="Price" hint='Plain words: "£18", "from £45", "£12 a month".'>
          <input className={inputClass} value={price} maxLength={120} onChange={(e) => setPrice(e.target.value)} />
        </Field>
        <Field label="Link to buy it">
          <input className={inputClass} value={url} maxLength={500} onChange={(e) => setUrl(e.target.value)} />
        </Field>
        <div className="flex gap-2">
          <Button type="button" disabled={pending} onClick={() => onAdd({ kind, name, description, price, url }, reset)}>
            Add
          </Button>
          <Button type="button" tone="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
        </div>
      </div>
    </Card>
  );
}

function CampaignForm({
  offerings,
  pending,
  onCreate,
}: {
  offerings: Offering[];
  pending: boolean;
  onCreate: (
    c: { offeringId: string | null; headline: string; body: string; bidPounds: number; budgetPounds: number },
    reset: () => void,
  ) => void;
}) {
  const [open, setOpen] = useState(false);
  const [offeringId, setOfferingId] = useState("");
  const [headline, setHeadline] = useState("");
  const [body, setBody] = useState("");
  const [bid, setBid] = useState("0.20");
  const [budget, setBudget] = useState("20");

  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-sm text-gold hover:underline">
        Start a campaign
      </button>
    );

  return (
    <Card>
      <div className="space-y-3">
        <Field label="Advertise" hint="Your whole business, or one listing.">
          <select className={inputClass} value={offeringId} onChange={(e) => setOfferingId(e.target.value)}>
            <option value="">The business</option>
            {offerings.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Headline">
          <input className={inputClass} value={headline} maxLength={90} onChange={(e) => setHeadline(e.target.value)} />
        </Field>
        <Field label="One line">
          <input className={inputClass} value={body} maxLength={200} onChange={(e) => setBody(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Bid per click (£)">
            <input className={inputClass} inputMode="decimal" value={bid} onChange={(e) => setBid(e.target.value)} />
          </Field>
          <Field label="Total budget (£)">
            <input className={inputClass} inputMode="decimal" value={budget} onChange={(e) => setBudget(e.target.value)} />
          </Field>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            disabled={pending}
            onClick={() =>
              onCreate(
                { offeringId: offeringId || null, headline, body, bidPounds: Number(bid), budgetPounds: Number(budget) },
                () => setOpen(false),
              )
            }
          >
            Start campaign
          </Button>
          <Button type="button" tone="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
        </div>
      </div>
    </Card>
  );
}
