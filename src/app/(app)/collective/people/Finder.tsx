"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { Button, Card, inputClass } from "@/components/ui";
import type { Person } from "@/lib/types";

import { findPerson, follow } from "./actions";

/**
 * How you find somebody: their handle, exactly.
 *
 * No prefix search, no suggestions, no people-you-may-know. A governance
 * instance with a browsable index of everyone on it has built a target rather
 * than a feature, and "people you may know" is the mechanic that turns a tool
 * into a network whether anybody wanted that or not.
 *
 * So a handle works like a phone number. If somebody wants you to find them
 * they give you theirs; otherwise you meet the way you would anywhere, by
 * being in the same place.
 */
export function Finder() {
  const [handle, setHandle] = useState("");
  const [pending, start] = useTransition();
  const [result, setResult] = useState<Person | null>(null);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function search() {
    setError(null);
    start(async () => {
      const res = await findPerson(handle);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setResult(res.person);
      setSearched(true);
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input
          value={handle}
          onChange={(e) => {
            setHandle(e.target.value);
            setSearched(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") search();
          }}
          placeholder="their handle"
          aria-label="Handle"
          className={inputClass}
        />
        <Button tone="quiet" disabled={pending} onClick={search}>
          {pending ? "…" : "Find"}
        </Button>
      </div>

      {error ? <p className="text-[0.85rem] text-alarm">{error}</p> : null}

      {searched && !result ? (
        <p className="text-[0.8125rem] leading-relaxed text-paper-faint">
          Nobody here goes by that. Handles are exact — there is no search,
          deliberately.
        </p>
      ) : null}

      {result ? <Found person={result} /> : null}
    </div>
  );
}

function Found({ person }: { person: Person }) {
  const [pending, start] = useTransition();
  const [followed, setFollowed] = useState(false);

  return (
    <Card>
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <Link
            href={`/collective/people/${person.profile_id}`}
            className="text-[0.95rem] text-paper hover:text-gold"
          >
            {person.display_name}
          </Link>
          {person.handle ? (
            <p className="smallcaps text-[10px] text-paper-faint">@{person.handle}</p>
          ) : null}
        </div>

        <Button
          tone={followed ? "quiet" : "gold"}
          disabled={pending || followed}
          onClick={() =>
            start(async () => {
              const res = await follow(person.profile_id);
              if (res.ok) setFollowed(true);
            })
          }
        >
          {followed ? "Following" : "Follow"}
        </Button>
      </div>
    </Card>
  );
}
