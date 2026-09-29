"use client";

import { useState, useTransition } from "react";

import { Button, Card, Empty, Field, Tag, cx, inputClass } from "@/components/ui";
import { markProjection, putOnRecord, runSimulation } from "@/app/(app)/collective/actions";
import type { Projection, ProjectionStanding } from "@/lib/types";

/**
 * Impact simulation, on the proposal page, between the review and the sliders.
 *
 * Two states that must not be confused with each other, which is most of the
 * design here:
 *
 *   ON THE RECORD — frozen, public, and someone will be marked against it.
 *   A CANDIDATE   — a sentence the model just produced, which nobody has
 *                   agreed to yet and which disappears if this page reloads.
 *
 * Candidates are visibly provisional and editable. The moment you change the
 * words, the claim becomes yours rather than the model's, and the panel says
 * so — a model does not get credit for a projection somebody rewrote, and a
 * person does not get to hide behind one they did not touch.
 */

type Candidate = {
  direction: "effect" | "risk";
  statement: string;
  horizon_days: number;
  confidence: number;
  /** Set once the person edits the words. It stops being the model's sentence. */
  edited?: boolean;
};

export function Projections({
  proposalId,
  projections,
  standing,
  open,
  decided,
}: {
  proposalId: string;
  projections: Projection[];
  standing: ProjectionStanding | null;
  /** Still in review or deliberation: new claims can be written. */
  open: boolean;
  /** Closed: nothing can be added, and what is due can be marked. */
  decided: boolean;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [provenance, setProvenance] = useState<{
    id: string;
    version: string;
    model: string;
  } | null>(null);

  const effects = projections.filter((p) => p.direction === "effect");
  const risks = projections.filter((p) => p.direction === "risk");

  function simulate() {
    setError(null);
    start(async () => {
      const res = await runSimulation(proposalId);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setCandidates(res.projections.map((p) => ({ ...p })));
      setNote(res.note || null);
      setProvenance({ ...res.prompt, model: res.model });
    });
  }

  function keep(index: number) {
    const c = candidates[index];
    setError(null);
    start(async () => {
      const res = await putOnRecord({
        proposalId,
        direction: c.direction,
        statement: c.statement,
        horizonDays: c.horizon_days,
        confidence: c.confidence,
        source: c.edited ? "human" : "ai",
        promptId: provenance?.id,
        promptVersion: provenance?.version,
        model: provenance?.model,
      });
      if (!res.ok) setError(res.error);
      else setCandidates((cs) => cs.filter((_, i) => i !== index));
    });
  }

  return (
    <div className="space-y-4">
      {projections.length ? (
        <>
          {standing ? (
            <p className="text-[0.8125rem] leading-relaxed text-paper-faint">
              {standing.total} {standing.total === 1 ? "claim" : "claims"} on the
              record
              {standing.resolved
                ? ` · ${standing.held} held, ${standing.missed} missed${
                    standing.unclear ? `, ${standing.unclear} unclear` : ""
                  }`
                : " · none settled yet"}
              {standing.due_now
                ? ` · ${standing.due_now} come due and waiting to be marked`
                : ""}
            </p>
          ) : null}

          {effects.length ? (
            <Group label="What this is meant to do">
              {effects.map((p) => (
                <Row key={p.id} projection={p} canMark={decided} />
              ))}
            </Group>
          ) : null}

          {risks.length ? (
            <Group label="What it might cost">
              {risks.map((p) => (
                <Row key={p.id} projection={p} canMark={decided} />
              ))}
            </Group>
          ) : null}
        </>
      ) : (
        <Empty>
          Nothing has been predicted about this yet. A claim written here is
          frozen when the proposal closes and marked against what actually
          happened when its date arrives — which is the only thing that makes it
          worth reading before you vote.
        </Empty>
      )}

      {error ? <p className="text-[0.85rem] text-alarm">{error}</p> : null}

      {open ? (
        <>
          {candidates.length ? (
            <div className="space-y-3">
              <p className="smallcaps text-[10px] text-paper-faint">
                candidates — none of this is on the record
              </p>
              {candidates.map((c, i) => (
                <CandidateRow
                  key={i}
                  candidate={c}
                  disabled={pending}
                  onChange={(next) =>
                    setCandidates((cs) => cs.map((x, j) => (j === i ? next : x)))
                  }
                  onKeep={() => keep(i)}
                  onDrop={() => setCandidates((cs) => cs.filter((_, j) => j !== i))}
                />
              ))}
            </div>
          ) : null}

          {note ? (
            <p className="text-[0.8125rem] leading-relaxed text-paper-faint">{note}</p>
          ) : null}

          <Button tone="quiet" disabled={pending} onClick={simulate}>
            {pending
              ? "Simulating…"
              : projections.length || candidates.length
                ? "Simulate again"
                : "Simulate the impact"}
          </Button>

          <WriteYourOwn proposalId={proposalId} disabled={pending} onError={setError} />
        </>
      ) : null}
    </div>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="smallcaps mb-2 text-[10px] text-paper-faint">{label}</p>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

/* --- one claim on the record --------------------------------------------- */

function Row({ projection: p, canMark }: { projection: Projection; canMark: boolean }) {
  const [marking, setMarking] = useState(false);

  return (
    <Card>
      <p className="text-[0.95rem] leading-relaxed text-paper" data-selectable>
        {p.statement}
      </p>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className="smallcaps text-[10px] text-paper-faint">
          within {p.horizon_days} days of the decision
        </span>
        {p.confidence !== null ? (
          <span className="smallcaps text-[10px] text-paper-faint">
            · confidence {p.confidence.toFixed(2)}
          </span>
        ) : null}
        <span className="smallcaps text-[10px] text-paper-faint">
          · {p.source === "ai" ? `written by ${p.model ?? "a model"}` : "written by a member"}
        </span>
      </div>

      {p.verdict ? (
        <div className="mt-3 border-t border-line pt-3">
          <Tag tone={p.verdict === "held" ? "calm" : p.verdict === "missed" ? "alarm" : undefined}>
            {p.verdict}
          </Tag>
          <p
            className="mt-2 text-[0.875rem] leading-relaxed text-paper-dim"
            data-selectable
          >
            {p.verdict_note}
          </p>
        </div>
      ) : canMark ? (
        marking ? (
          <MarkForm id={p.id} onDone={() => setMarking(false)} />
        ) : (
          <button
            type="button"
            onClick={() => setMarking(true)}
            className="smallcaps mt-3 text-[10px] text-gold hover:underline"
          >
            say how it went →
          </button>
        )
      ) : null}
    </Card>
  );
}

function MarkForm({ id, onDone }: { id: string; onDone: () => void }) {
  const [pending, start] = useTransition();
  const [verdict, setVerdict] = useState<"held" | "missed" | "unclear">("held");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="mt-3 space-y-3 border-t border-line pt-3">
      <div className="flex gap-2">
        {(["held", "missed", "unclear"] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setVerdict(v)}
            className={cx(
              "press rounded-pill px-3 py-1.5 text-[0.8125rem] font-medium",
              v === verdict ? "bg-paper text-ink" : "bg-surface text-paper-dim",
            )}
          >
            {v}
          </button>
        ))}
      </div>

      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={3}
        placeholder="What actually happened, in your own words."
        className={inputClass}
      />

      {error ? <p className="text-[0.85rem] text-alarm">{error}</p> : null}

      <p className="text-[0.8125rem] leading-relaxed text-paper-faint">
        This is written once and cannot be changed or removed afterwards. It is
        attributed to you.
      </p>

      <div className="flex gap-2">
        <Button
          tone="gold"
          disabled={pending || note.trim().length < 20}
          onClick={() =>
            start(async () => {
              const res = await markProjection(id, verdict, note);
              if (!res.ok) setError(res.error);
              else onDone();
            })
          }
        >
          {pending ? "Recording…" : "Record it"}
        </Button>
        <Button tone="quiet" disabled={pending} onClick={onDone}>
          Not now
        </Button>
      </div>
    </div>
  );
}

/* --- a candidate, not yet anything --------------------------------------- */

function CandidateRow({
  candidate: c,
  disabled,
  onChange,
  onKeep,
  onDrop,
}: {
  candidate: Candidate;
  disabled: boolean;
  onChange: (next: Candidate) => void;
  onKeep: () => void;
  onDrop: () => void;
}) {
  return (
    <div className="rounded-card border border-dashed border-line bg-surface-soft p-4">
      <textarea
        value={c.statement}
        disabled={disabled}
        onChange={(e) => onChange({ ...c, statement: e.target.value, edited: true })}
        rows={2}
        className={inputClass}
      />

      <div className="mt-3 flex flex-wrap items-end gap-3">
        <div className="flex gap-2">
          {(["effect", "risk"] as const).map((d) => (
            <button
              key={d}
              type="button"
              disabled={disabled}
              onClick={() => onChange({ ...c, direction: d })}
              className={cx(
                "press rounded-pill px-3 py-1.5 text-[0.8125rem] font-medium",
                d === c.direction ? "bg-paper text-ink" : "bg-surface text-paper-dim",
              )}
            >
              {d}
            </button>
          ))}
        </div>

        <Field label="days">
          <input
            type="number"
            min={1}
            max={3650}
            value={c.horizon_days}
            disabled={disabled}
            onChange={(e) =>
              onChange({ ...c, horizon_days: Number(e.target.value) || 1 })
            }
            className={cx(inputClass, "w-24")}
          />
        </Field>

        <Field label="confidence">
          <input
            type="number"
            min={0}
            max={1}
            step={0.05}
            value={c.confidence}
            disabled={disabled}
            onChange={(e) => onChange({ ...c, confidence: Number(e.target.value) })}
            className={cx(inputClass, "w-24")}
          />
        </Field>
      </div>

      <p className="mt-3 text-[0.8125rem] leading-relaxed text-paper-faint">
        {c.edited
          ? "You changed the words, so this goes on the record as yours."
          : "As written by the model. Change anything and it becomes your claim instead."}
      </p>

      <div className="mt-3 flex gap-2">
        <Button
          tone="gold"
          disabled={disabled || c.statement.trim().length < 20}
          onClick={onKeep}
        >
          Put on the record
        </Button>
        <Button tone="quiet" disabled={disabled} onClick={onDrop}>
          Drop it
        </Button>
      </div>
    </div>
  );
}

/* --- your own, with no model involved ------------------------------------ */

function WriteYourOwn({
  proposalId,
  disabled,
  onError,
}: {
  proposalId: string;
  disabled: boolean;
  onError: (e: string | null) => void;
}) {
  const [pending, start] = useTransition();
  const [openForm, setOpenForm] = useState(false);
  const [c, setC] = useState<Candidate>({
    direction: "effect",
    statement: "",
    horizon_days: 90,
    confidence: 0.6,
    edited: true,
  });

  if (!openForm) {
    return (
      <button
        type="button"
        onClick={() => setOpenForm(true)}
        className="smallcaps block text-[10px] text-gold hover:underline"
      >
        write your own →
      </button>
    );
  }

  return (
    <CandidateRow
      candidate={c}
      disabled={disabled || pending}
      onChange={setC}
      onDrop={() => setOpenForm(false)}
      onKeep={() =>
        start(async () => {
          onError(null);
          const res = await putOnRecord({
            proposalId,
            direction: c.direction,
            statement: c.statement,
            horizonDays: c.horizon_days,
            confidence: c.confidence,
            source: "human",
          });
          if (!res.ok) onError(res.error);
          else {
            setOpenForm(false);
            setC({ ...c, statement: "" });
          }
        })
      }
    />
  );
}
