"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { Button, Card, Empty, Pill, Rail, inputClass } from "@/components/ui";
import { ago } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import type { InquiryLens, MyInquiry, Position, SearchHit } from "@/lib/types";

import { askStandingQuestion, findInCollective, forgetInquiry } from "./actions";

const LENS_NAME: Record<InquiryLens, string> = {
  empirical: "The literature",
  scripture: "Scripture",
  philosophy: "Philosophy",
  literature: "Books",
  screen: "Film",
  practice: "Practice",
  testimony: "Testimony",
};

const KIND_WORD: Record<SearchHit["kind"], string> = {
  proposal: "Proposal",
  decision: "Decided",
  project: "Project",
};

type Mode = "find" | "ask";

export function AskPanel({ mine }: { mine: MyInquiry[] }) {
  const [mode, setMode] = useState<Mode>("find");
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [open, setOpen] = useState<string | null>(null);

  const tooShort = mode === "find" ? q.trim().length < 2 : q.trim().length < 12;

  function run() {
    start(async () => {
      setError(null);
      if (mode === "find") {
        const r = await findInCollective(q);
        if (!r.ok) setError(r.error);
        else setHits(r.hits);
      } else {
        const r = await askStandingQuestion(q);
        if (!r.ok) setError(r.error);
        else setQ("");
      }
    });
  }

  return (
    <div className="mt-4 space-y-4">
      <Rail>
        <Pill active={mode === "find"} onClick={() => { setMode("find"); setHits(null); setError(null); }}>
          Find
        </Pill>
        <Pill active={mode === "ask"} onClick={() => { setMode("ask"); setHits(null); setError(null); }}>
          Ask
        </Pill>
      </Rail>

      <div className="flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !tooShort && !pending) run(); }}
          placeholder={
            mode === "find"
              ? "ladder, the alley gate, anything you half remember"
              : "Does sharing a tool between households actually work?"
          }
          className={inputClass}
          aria-label={mode === "find" ? "Search" : "Your question"}
        />
        <Button type="button" tone="quiet" disabled={tooShort || pending} onClick={run}>
          {pending ? (mode === "find" ? "Looking" : "Reading") : mode === "find" ? "Find" : "Ask"}
        </Button>
      </div>

      {error ? <p className="text-sm text-alarm">{error}</p> : null}

      {mode === "find" && hits !== null ? (
        hits.length ? (
          <div>
            {hits.map((h) => (
              <Link
                key={`${h.kind}-${h.id}`}
                href={`/collective/proposals/${h.id}`}
                className="press block border-b border-line-soft py-3"
              >
                <p className="smallcaps text-[10px] text-paper-faint">
                  {KIND_WORD[h.kind]}
                  {h.status && h.kind === "proposal" ? ` · ${h.status.replace(/_/g, " ")}` : ""}
                  {h.happened ? ` · ${ago(h.happened)}` : ""}
                </p>
                <p className="mt-0.5 text-[0.9375rem] leading-snug text-paper">{h.title}</p>
                {h.line ? (
                  <p className="mt-0.5 text-sm leading-relaxed text-paper-dim">{h.line}</p>
                ) : null}
              </Link>
            ))}
          </div>
        ) : (
          <Empty>
            Nothing here matches that. Search only reaches what is addressed to
            you, so a thing decided somewhere you are not will not appear
            however it is spelled.
          </Empty>
        )
      ) : null}

      {mine.length ? (
        <div className="pt-2">
          <p className="smallcaps mb-1 text-[10px] text-paper-faint">What you have asked</p>
          <div className="space-y-2">
            {mine.map((inq) => (
              <Asked
                key={inq.id}
                inquiry={inq}
                expanded={open === inq.id}
                onToggle={() => setOpen(open === inq.id ? null : inq.id)}
              />
            ))}
          </div>
        </div>
      ) : (
        <Empty>
          Nothing asked yet. A question you ask here is yours alone — to put one
          in front of the people a decision concerns, ask it on the proposal.
        </Empty>
      )}
    </div>
  );
}

function Asked({
  inquiry,
  expanded,
  onToggle,
}: {
  inquiry: MyInquiry;
  expanded: boolean;
  onToggle: () => void;
}) {
  const [positions, setPositions] = useState<Position[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [pending, start] = useTransition();

  async function toggle() {
    onToggle();
    if (!expanded && positions === null) {
      setLoading(true);
      const supabase = createClient();
      const { data } = await supabase.rpc("positions_for", { p_inquiry_id: inquiry.id });
      setPositions((data ?? []) as Position[]);
      setLoading(false);
    }
  }

  return (
    <Card>
      <button type="button" onClick={toggle} className="press w-full text-left" aria-expanded={expanded}>
        <p className="text-[0.9375rem] leading-relaxed text-paper" data-selectable>
          {inquiry.question}
        </p>
        <p className="smallcaps mt-1 text-[10px] text-paper-faint">
          {inquiry.lenses} ways of knowing ·{" "}
          {inquiry.proposal_id ? `on ${inquiry.proposal_title}` : "yours alone"} ·{" "}
          {ago(inquiry.created_at)} · {expanded ? "hide" : "read"}
        </p>
      </button>

      {expanded ? (
        <div className="mt-4 space-y-4 border-t border-line-soft pt-4">
          {loading ? (
            <p className="text-sm text-paper-faint">Reading…</p>
          ) : (
            <>
              {(positions ?? []).map((pos) => (
                <div key={`${pos.lens}-${pos.ordinal}`}>
                  <p className="smallcaps text-[10px] text-gold">{LENS_NAME[pos.lens]}</p>
                  <p className="mt-1 text-[0.9375rem] leading-relaxed text-paper" data-selectable>
                    {pos.claim}
                  </p>
                  <p className="mt-1 text-[0.9375rem] leading-relaxed text-paper-dim" data-selectable>
                    {pos.reasoning}
                  </p>
                  {pos.source_hint ? (
                    <p className="mt-1 text-sm text-paper-faint">
                      Somewhere to start: {pos.source_hint}
                    </p>
                  ) : null}
                </div>
              ))}

              {inquiry.note ? (
                <p className="border-t border-line-soft pt-4 text-sm leading-relaxed text-paper-dim">
                  {inquiry.note}
                </p>
              ) : null}

              <p className="border-t border-line-soft pt-4 text-sm leading-relaxed text-paper-faint">
                These are {inquiry.model}&rsquo;s account of what each of these
                holds, not a literature review and not verified. A named work is
                somewhere to start reading, not evidence that the claim is true.
                Nothing here has been reconciled into an answer.
              </p>

              <button
                type="button"
                disabled={pending}
                onClick={() => start(async () => { await forgetInquiry(inquiry.id); })}
                className="smallcaps text-[11px] text-paper-faint hover:text-alarm"
              >
                {pending ? "Forgetting" : "Forget this"}
              </button>
            </>
          )}
        </div>
      ) : null}
    </Card>
  );
}
