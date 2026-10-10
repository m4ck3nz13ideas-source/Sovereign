"use client";

import { useState, useTransition } from "react";

import { Button, inputClass } from "@/components/ui";
import { POST_KINDS, type MediaKind, type PostAudience, type PostKind } from "@/lib/types";

import { publishPost } from "../collective/actions";

/**
 * Writing something.
 *
 * Also the one place in the product where a member is refused and told why, so
 * the refusal gets the room: the witness's verdict and the specific lines it
 * could not vouch for, with the text still in the box. The score is not shown,
 * before or after — it is a judgement about a draft, and putting a number on
 * screen invites people to write for the number.
 *
 * `kind` is declared by the author and never inferred. It is what the reader's
 * own filter works on, which only holds if it means what the author said it
 * meant.
 */

const SAYS: Record<PostKind, string> = {
  made: "I made",
  saw: "I saw",
  asked: "I'm asking",
  thanks: "Grateful for",
  learned: "I learned",
};

/** The places somebody has named, so the audience picker can say "Wessex". */
export type Places = { regional: string | null; national: string | null; continental: string | null };

export function Compose({
  entryId,
  initialBody = "",
  when,
  hasGroup,
  places = { regional: null, national: null, continental: null },
}: {
  entryId?: string;
  initialBody?: string;
  when?: string;
  hasGroup: boolean;
  places?: Places;
}) {
  const [audience, setAudience] = useState<PostAudience>("people");
  const [text, setText] = useState(initialBody);
  const [kind, setKind] = useState<PostKind>(entryId ? "learned" : "saw");
  const [link, setLink] = useState("");
  const [linkKind, setLinkKind] = useState<MediaKind>("page");
  const [showLink, setShowLink] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [concerns, setConcerns] = useState<string[]>([]);
  const [pending, start] = useTransition();

  function post() {
    start(async () => {
      setError(null);
      setConcerns([]);
      const r = await publishPost({
        body: text,
        kind,
        mediaUrl: showLink ? link : undefined,
        mediaKind: showLink ? linkKind : null,
        entryId,
        groupOnly: Boolean(entryId),
        audience: entryId ? "people" : audience,
      });
      if (!r.ok) {
        setError(r.error);
        setConcerns("concerns" in r && Array.isArray(r.concerns) ? r.concerns : []);
        return;
      }
      if (!entryId) {
        setText("");
        setLink("");
        setShowLink(false);
      }
    });
  }

  return (
    <div className="rounded-card border border-line bg-surface-soft px-4 py-3.5">
      <div className="flex flex-wrap gap-1.5">
        {POST_KINDS.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            aria-pressed={kind === k}
            className={`smallcaps rounded-full border px-2.5 py-1 text-[10px] transition-colors ${
              kind === k
                ? "border-gold/40 bg-gold/10 text-gold"
                : "border-line text-paper-faint hover:text-paper-dim"
            }`}
          >
            {SAYS[k]}
          </button>
        ))}
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={entryId ? 4 : 3}
        maxLength={2000}
        placeholder="Something of your own. It does not have to be interesting."
        className={`${inputClass} mt-3 resize-y leading-relaxed`}
      />

      {showLink ? (
        <div className="mt-2 flex flex-wrap gap-2">
          <input
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="https://"
            className={`${inputClass} flex-1`}
          />
          <select
            value={linkKind}
            onChange={(e) => setLinkKind(e.target.value as MediaKind)}
            className={`${inputClass} w-auto`}
          >
            <option value="page">a page</option>
            <option value="image">an image</option>
            <option value="video">a video</option>
            <option value="audio">audio</option>
          </select>
        </div>
      ) : null}

      {when ? (
        <p className="smallcaps mt-1.5 text-[10px] text-paper-faint">Output · {when}</p>
      ) : null}

      {entryId ? null : <AudiencePicker value={audience} onChange={setAudience} places={places} />}

      {error ? (
        <div className="mt-3 border-l-2 border-alarm pl-3">
          <p className="text-sm text-paper-dim">{error}</p>
          {concerns.length ? (
            <ul className="mt-2 space-y-1">
              {concerns.map((c) => (
                <li key={c} className="text-sm text-paper-faint">
                  {c}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" onClick={post} disabled={pending || !text.trim()}>
          {pending ? "Reading it" : "Post"}
        </Button>
        <Button type="button" tone="quiet" onClick={() => setShowLink((v) => !v)}>
          {showLink ? "No link" : "Add a link"}
        </Button>
      </div>

      {entryId && !hasGroup ? (
        <p className="mt-2 text-xs text-paper-faint">
          This one goes to your group, and you are not in one yet. It will post
          to the people you share a place with instead.
        </p>
      ) : null}
    </div>
  );
}

/**
 * Who a post is for (0048, rule 44). The default is the people around you —
 * your groups, your street, followers and friends. A wider choice includes
 * them and adds everybody at that scale. Fixed once posted.
 */
function AudiencePicker({
  value,
  onChange,
  places,
}: {
  value: PostAudience;
  onChange: (a: PostAudience) => void;
  places: Places;
}) {
  const options: { id: PostAudience; label: string; place: string | null | undefined }[] = [
    { id: "people", label: "People around you", place: "ok" },
    { id: "regional", label: places.regional ?? "Your region", place: places.regional },
    { id: "national", label: places.national ?? "Your nation", place: places.national },
    { id: "continental", label: places.continental ?? "Your continent", place: places.continental },
    { id: "global", label: "Everyone", place: "ok" },
  ];
  const reads: Record<PostAudience, string> = {
    people: "Your groups, your street, people who follow you and your friends.",
    regional: `Everyone in ${places.regional ?? "your region"}, as well as the people around you.`,
    national: `Everyone in ${places.national ?? "your nation"}, as well as the people around you.`,
    continental: `Everyone in ${places.continental ?? "your continent"}, as well as the people around you.`,
    global: "Everyone on Sovereign.",
  };
  return (
    <div className="mt-3">
      <p className="smallcaps text-[10px] text-paper-faint">Who it&apos;s for</p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            disabled={!o.place}
            title={o.place ? undefined : "Say where you are in Settings first"}
            onClick={() => onChange(o.id)}
            aria-pressed={value === o.id}
            className={`rounded-full border px-2.5 py-1 text-xs transition-colors disabled:opacity-40 ${
              value === o.id ? "border-gold/40 bg-gold/10 text-gold" : "border-line text-paper-faint hover:text-paper-dim"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
      <p className="mt-1.5 text-xs text-paper-faint">{reads[value]} Fixed once posted.</p>
    </div>
  );
}
