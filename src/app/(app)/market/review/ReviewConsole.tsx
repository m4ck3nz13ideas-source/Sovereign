"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button, Card, Empty, inputClass, Prose, SectionLabel, Tag } from "@/components/ui";
import type { Vendor, Verification, Vetting } from "@/lib/marketplace";

import { checkCompany, checkWebsite, closeConcern, liftSuspension, signOff, suspendVendor } from "../actions";

type Res = { ok: true; id?: string } | { ok: false; error: string };

export function ReviewConsole({
  queue,
  concerns,
  suspensions,
  laws,
}: {
  queue: (Vetting & { vendors: Vendor; verification: Verification })[];
  concerns: { id: string; vendor_id: string; law_id: string; reason: string; vendors: { name: string } | null }[];
  suspensions: { vendor_id: string; reason: string; vendors: { name: string } | null }[];
  laws: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const lawName = (id: string) => laws.find((l) => l.id === id)?.name ?? id;
  const note = (k: string) => notes[k] ?? "";
  const setNote = (k: string, v: string) => setNotes((n) => ({ ...n, [k]: v }));

  const run = (fn: () => Promise<Res>) =>
    start(async () => {
      setError(null);
      const r = await fn();
      if (!r.ok) setError(r.error);
      else router.refresh();
    });

  return (
    <div className="space-y-10">
      {error ? <p className="text-sm text-alarm">{error}</p> : null}

      <section>
        <SectionLabel>To sign off</SectionLabel>
        <p className="mb-3 text-sm leading-relaxed text-paper-faint">
          The AI found no violation in these. Check the evidence against what you can verify — their
          website, certifications, anything the reading flags as a tension — then approve or refuse.
          You can refuse what the AI passed; nobody can pass what it refused.
        </p>
        {queue.length ? (
          <div className="space-y-4">
            {queue.map((v) => (
              <Card key={v.id}>
                <p className="font-serif text-lg text-paper">{v.vendors.name}</p>
                <p className="mt-1 text-xs text-paper-faint">{v.vendors.website}</p>
                <div className="mt-3">
                  <Prose>{v.vendors.description}</Prose>
                </div>
                <p className="mt-3 smallcaps text-[11px] text-paper-faint">Evidence</p>
                <div className="mt-1">
                  <Prose>{v.vendors.evidence}</Prose>
                </div>
                <details className="mt-3" open={v.tensions > 0}>
                  <summary className="cursor-pointer text-sm text-paper-faint">
                    The reading — {v.tensions} tension{v.tensions === 1 ? "" : "s"}
                    {v.model === "mock" ? " · offline reader, unexamined" : ""}
                  </summary>
                  <ul className="mt-2 space-y-2">
                    {v.readings
                      .filter((r) => r.verdict !== "aligned" || v.tensions === 0)
                      .map((r) => (
                        <li key={r.law_id} className="text-sm">
                          <span className="text-paper">{lawName(r.law_id)}</span>{" "}
                          <Tag tone={r.verdict === "tension" ? "gold" : "calm"}>{r.verdict}</Tag>
                          <p className="mt-1 text-paper-dim">{r.reasoning}</p>
                        </li>
                      ))}
                  </ul>
                </details>
                <div className="mt-3 space-y-2 rounded-2xl border border-line px-3 py-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-paper">Website</span>
                    <span className="flex items-center gap-2">
                      <Tag tone={v.verification.website ? "calm" : "gold"}>
                        {v.verification.website ? "verified" : "not verified"}
                      </Tag>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => run(() => checkWebsite(v.vendor_id))}
                        className="text-gold hover:underline disabled:opacity-40"
                      >
                        Check
                      </button>
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-paper">
                      Company{v.vendors.company_number ? ` · ${v.vendors.company_number}` : ""}
                    </span>
                    <span className="flex items-center gap-2">
                      {v.verification.company ? (
                        <Tag tone={v.verification.company.verified ? "calm" : "alarm"}>
                          {v.verification.company.verified ? "active" : "not active"}
                        </Tag>
                      ) : (
                        <Tag>{v.vendors.company_number ? "unchecked" : "none given"}</Tag>
                      )}
                      {v.vendors.company_number ? (
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => run(() => checkCompany(v.vendor_id))}
                          className="text-gold hover:underline disabled:opacity-40"
                        >
                          Check
                        </button>
                      ) : null}
                    </span>
                  </div>
                  {v.verification.company ? (
                    <p className="text-xs text-paper-faint">{v.verification.company.detail}</p>
                  ) : null}
                </div>
                <textarea
                  className={`${inputClass} mt-3 min-h-20`}
                  placeholder="Your note — what you checked, or what they need to change"
                  value={note(v.id)}
                  onChange={(e) => setNote(v.id, e.target.value)}
                />
                <div className="mt-3 flex gap-2">
                  <Button
                    type="button"
                    disabled={pending || !v.verification.website}
                    title={v.verification.website ? undefined : "Check the website first"}
                    onClick={() => run(() => signOff(v.id, "approved", note(v.id)))}
                  >
                    Approve
                  </Button>
                  <Button type="button" tone="danger" disabled={pending} onClick={() => run(() => signOff(v.id, "refused", note(v.id)))}>
                    Refuse
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Empty>Nothing waiting.</Empty>
        )}
      </section>

      <section>
        <SectionLabel>Concerns raised</SectionLabel>
        {concerns.length ? (
          <div className="space-y-4">
            {concerns.map((c) => (
              <Card key={c.id}>
                <p className="text-[0.95rem] text-paper">
                  {c.vendors?.name ?? "A business"} <Tag tone="gold">{lawName(c.law_id)}</Tag>
                </p>
                <p className="mt-2 text-sm leading-relaxed text-paper-dim">{c.reason}</p>
                <textarea
                  className={`${inputClass} mt-3 min-h-20`}
                  placeholder="What you found, or why you are suspending"
                  value={note(c.id)}
                  onChange={(e) => setNote(c.id, e.target.value)}
                />
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button type="button" tone="quiet" disabled={pending} onClick={() => run(() => closeConcern(c.id, note(c.id)))}>
                    Close concern
                  </Button>
                  <Button type="button" tone="danger" disabled={pending} onClick={() => run(() => suspendVendor(c.vendor_id, note(c.id)))}>
                    Suspend business
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Empty>No open concerns.</Empty>
        )}
      </section>

      <section className="pb-4">
        <SectionLabel>Suspended</SectionLabel>
        {suspensions.length ? (
          <div className="space-y-4">
            {suspensions.map((s) => (
              <Card key={s.vendor_id}>
                <p className="text-[0.95rem] text-paper">{s.vendors?.name ?? "A business"}</p>
                <p className="mt-2 text-sm text-paper-dim">{s.reason}</p>
                <textarea
                  className={`${inputClass} mt-3 min-h-16`}
                  placeholder="Why it can come back"
                  value={note(`s-${s.vendor_id}`)}
                  onChange={(e) => setNote(`s-${s.vendor_id}`, e.target.value)}
                />
                <Button
                  type="button"
                  tone="quiet"
                  className="mt-3"
                  disabled={pending}
                  onClick={() => run(() => liftSuspension(s.vendor_id, note(`s-${s.vendor_id}`)))}
                >
                  Lift suspension
                </Button>
              </Card>
            ))}
          </div>
        ) : (
          <Empty>None.</Empty>
        )}
      </section>
    </div>
  );
}
