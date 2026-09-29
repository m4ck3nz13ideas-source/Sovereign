"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui";
import type { FriendshipState } from "@/lib/types";

import {
  acceptFriend,
  askToBeFriends,
  endFriendship,
  follow,
  unfollow,
} from "@/app/(app)/collective/people/actions";

/**
 * The two buttons, kept visibly separate.
 *
 * They do different things and it matters that nobody thinks otherwise:
 * following is unilateral and gives you their public record; friendship is
 * asked for, answered, and will carry private conversation. Collapsing them
 * into one "connect" would be tidier and would make the second one arrive
 * without anybody agreeing to it.
 */
export function Tie({
  profileId,
  following,
  friendship,
}: {
  profileId: string;
  following: boolean;
  friendship: FriendshipState;
}) {
  const [pending, start] = useTransition();
  const [isFollowing, setFollowing] = useState(following);
  const [state, setState] = useState<FriendshipState>(friendship);
  const [error, setError] = useState<string | null>(null);

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, after: () => void) {
    setError(null);
    start(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error ?? "That did not work.");
      else after();
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button
          tone={isFollowing ? "quiet" : "gold"}
          disabled={pending}
          onClick={() =>
            isFollowing
              ? run(() => unfollow(profileId), () => setFollowing(false))
              : run(() => follow(profileId), () => setFollowing(true))
          }
        >
          {isFollowing ? "Following" : "Follow"}
        </Button>

        {state === "none" ? (
          <Button
            tone="quiet"
            disabled={pending}
            onClick={() => run(() => askToBeFriends(profileId), () => setState("you asked"))}
          >
            Ask to be friends
          </Button>
        ) : null}

        {state === "you asked" ? (
          <Button
            tone="quiet"
            disabled={pending}
            onClick={() => run(() => endFriendship(profileId), () => setState("none"))}
          >
            Take the request back
          </Button>
        ) : null}

        {state === "they asked" ? (
          <>
            <Button
              tone="gold"
              disabled={pending}
              onClick={() => run(() => acceptFriend(profileId), () => setState("friends"))}
            >
              Accept
            </Button>
            <Button
              tone="quiet"
              disabled={pending}
              onClick={() => run(() => endFriendship(profileId), () => setState("none"))}
            >
              No
            </Button>
          </>
        ) : null}

        {state === "friends" ? (
          <Button
            tone="quiet"
            disabled={pending}
            onClick={() => run(() => endFriendship(profileId), () => setState("none"))}
          >
            End the friendship
          </Button>
        ) : null}
      </div>

      {error ? <p className="text-[0.85rem] text-alarm">{error}</p> : null}

      <p className="text-[0.8125rem] leading-relaxed text-paper-faint">
        {state === "friends"
          ? "Friends here carries conversation and nothing else. It gives neither of you any say in what the other can decide, and no access to anything either of you has not published."
          : "Following is one-way and public. It gives you what they have done, where you will see it, and nothing more."}
      </p>
    </div>
  );
}
