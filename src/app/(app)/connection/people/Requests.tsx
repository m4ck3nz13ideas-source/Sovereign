"use client";

import { useState, useTransition } from "react";

import { Button, Card } from "@/components/ui";
import type { FriendshipRequest } from "@/lib/types";

import { acceptFriend, endFriendship } from "./actions";

/**
 * Who has asked, and who you asked and forgot about.
 *
 * Both directions on one list, because a request you sent three weeks ago is
 * something you should be able to see and take back. There is no separate
 * "declined" state and no notification of a refusal: ending is one verb, and
 * from the other side a withdrawal and a refusal are the same event. Making
 * them look different would only turn a quiet no into a statement.
 */
export function Requests({ requests }: { requests: FriendshipRequest[] }) {
  return (
    <ul className="space-y-2">
      {requests.map((r) => (
        <li key={r.profile_id}>
          <RequestRow request={r} />
        </li>
      ))}
    </ul>
  );
}

function RequestRow({ request }: { request: FriendshipRequest }) {
  const [pending, start] = useTransition();
  const [gone, setGone] = useState(false);

  if (gone) return null;

  const theirs = request.direction === "they asked";

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[0.95rem] text-paper">{request.display_name}</p>
          <p className="smallcaps text-[10px] text-paper-faint">
            {request.handle ? `@${request.handle} · ` : ""}
            {theirs ? "asked to be friends" : "you asked"}
          </p>
        </div>

        <div className="flex gap-2">
          {theirs ? (
            <Button
              tone="gold"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const res = await acceptFriend(request.profile_id);
                  if (res.ok) setGone(true);
                })
              }
            >
              Accept
            </Button>
          ) : null}
          <Button
            tone="quiet"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const res = await endFriendship(request.profile_id);
                if (res.ok) setGone(true);
              })
            }
          >
            {theirs ? "No" : "Take it back"}
          </Button>
        </div>
      </div>
    </Card>
  );
}
