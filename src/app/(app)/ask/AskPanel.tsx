"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { Button, Card, Empty, Pill, Rail, inputClass } from "@/components/ui";
import { ago } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import type { InquiryLens, MineHit, MyInquiry, Position, SearchHit } from "@/lib/types";

import { askStandingQuestion, find, forgetInquiry } from "./actions";

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
  term: "A word here",
};

/**
 * Where a hit goes. Three of the four kinds are all views of a proposal and
 * share its page; a word is not a proposal and has one of its own, so this is a
 * switch rather than one template string. Getting it wrong is how a search
 * result silently stops working.
 */
function hitHref(hit: SearchHit): string {
  return hit.kind === "term"
    ? `/collective/lexicon/${hit.id}`
    : `/collective/proposals/${hit.id}`;
}

const MINE_WORD: Record<MineHit["kind"], string> = {
  entry: "Written",
  concept: "Idea",
};

type Mode = "find" | "ask";

/**
 * Starting points, shown while the field is empty.
 *
 * The Ask tab is the hardest surface in the app to understand from its name,
 * and an empty box teaches nothing. These teach the two halves by example: FIND
 * wants a word you half remember, ASK wants a question somebody could hold
 * several positions on. Every ASK example is deliberately contested — a
 * starting point with one obvious answer would teach people that this is where
 * answers come from, which is the thing rule 29 refuses.
 *
 * Tapping a FIND example runs it, because looking something up costs nothing.
 * Tapping an ASK example only fills the field: the question should be yours
 * before it is sent, and sending one is a real call to the model.
 */
const STARTERS: Record<Mode, string[]> = {
  find: ["ladder", "workshop", "rota", "money", "the alley gate"],
  ask: [
    "Does sharing a tool between households actually work?",
    "What makes a rota fair?",
    "Is it better to own something together or take turns with it?",
    "When should a group decide by consensus rather than a majority?",
    "What do different traditions say about lending between neighbours?",
  ],
};

export function AskPanel({ mine }: { mine: MyInquiry[] }) {
  const [mode, setMode] = useState<Mode>("find");
  const [q, setQ] = useState("");
  const [shared, setShared] = useState<SearchHit[] | null>(null);
  const [mine_, setMine] = useState<MineHit[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [open, setOpen] = useState<string | null>(null);

  const tooShort = mode === "find" ? q.trim().length < 2 : q.trim().length < 12;

  function run() {
    start(async () => {
      setError(null);
      if (mode === "find") {
        const r = await find(q);
        if (!r.ok) setError(r.error);
        else {
          setShared(r.shared);
          setMine(r.mine);
        }
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
        <Pill
          active={mode === "find"}
          onClick={() => { setMode("find"); setShared(null); setMine(null); setError(null); }}
        >
          Find
        </Pill>
        <Pill
          active={mode === "ask"}
          onClick={() => { setMode("ask"); setShared(null); setMine(null); setError(null); }}
        >
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

      {!q.trim() && shared === null && !pending ? (
        <div>
          <p className="smallcaps mb-2 text-[10px] text-paper-faint">
            {mode === "find" ? "Try a word" : "Try a question"}
          </p>
          <div className="flex flex-wrap gap-2">
            {STARTERS[mode].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  setQ(s);
                  if (mode === "find") {
                    start(async () => {
                      setError(null);
                      const r = await find(s);
                      if (!r.ok) setError(r.error);
                      else {
                        setShared(r.shared);
                        setMine(r.mine);
                      }
                    });
                  }
                }}
                className="press rounded-pill border border-line px-3 py-1.5 text-left text-[0.8125rem] leading-snug text-paper-dim hover:border-paper-faint"
              >
                {s}
              </button>
            ))}
          </div>
          {mode === "ask" ? (
            <p className="mt-3 text-[0.8125rem] leading-relaxed text-paper-faint">
              What a word means to your group is not a question for here — the
              people you decide with are the only ones who can answer it.{" "}
              <Link href="/collective/lexicon" className="underline decoration-line">
                Raise it in Words
              </Link>
              .
            </p>
          ) : null}
        </div>
      ) : null}

      {mode === "find" && shared !== null && mine_ !== null ? (
        shared.length || mine_.length ? (
          <div className="space-y-6">
            {/*
              Two lists, two headings, never merged. The difference between
              these is who else can read the thing, and that is not a
              distinction to encode as a badge on a row.
            */}
            {shared.length ? (
              <div>
                <p className="smallcaps text-[10px] text-paper-faint">
                  The collective half — others can see these too
                </p>
                {shared.map((h) => (
                  <Link
                    key={`${h.kind}-${h.id}`}
                    href={hitHref(h)}
                    className="press block border-b border-line-soft py-3"
                  >
                    <p className="smallcaps text-[10px] text-paper-faint">
                      {KIND_WORD[h.kind]}
                      {h.status && h.kind === "proposal"
                        ? ` · ${h.status.replace(/_/g, " ")}`
                        : ""}
                      {h.happened ? ` · ${ago(h.happened)}` : ""}
                    </p>
                    <p className="mt-0.5 text-[0.9375rem] leading-snug text-paper">
                      {h.title}
                    </p>
                    {h.line ? (
                      <p className="mt-0.5 text-sm leading-relaxed text-paper-dim">
                        {h.line}
                      </p>
                    ) : null}
                  </Link>
                ))}
              </div>
            ) : null}

            {mine_.length ? (
              <div>
                <p className="smallcaps text-[10px] text-gold">
                  Your half — nobody else can read any of this
                </p>
                {mine_.map((h) => (
                  <Link
                    key={`${h.kind}-${h.id}`}
                    href={h.kind === "concept" ? `/individual/ideas/${h.id}` : "/individual/journal"}
                    className="press block border-b border-line-soft py-3"
                  >
                    <p className="smallcaps text-[10px] text-paper-faint">
                      {MINE_WORD[h.kind]}
                      {h.state ? ` · ${h.state.replace(/_/g, " ")}` : ""}
                      {h.happened ? ` · ${ago(h.happened)}` : ""}
                    </p>
                    {h.title ? (
                      <p className="mt-0.5 text-[0.9375rem] leading-snug text-paper">
                        {h.title}
                      </p>
                    ) : null}
                    {h.line ? (
                      <p className="mt-0.5 text-sm leading-relaxed text-paper-dim">
                        {h.line}
                      </p>
                    ) : null}
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          <Empty>
            Nothing in either half matches that. The collective side only
            reaches what is addressed to you, so a thing decided somewhere you
            are not will not appear however it is spelled.
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
