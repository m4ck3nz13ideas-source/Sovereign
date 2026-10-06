#!/usr/bin/env python3
"""
The concurrency suite.

Everything else in supabase/tests runs in one psql session, which cannot
overlap anything with anything. These are the rules that only break when two
people act at the same moment, so they need real connections acting at once.

HOW THESE TESTS OVERLAP, AND WHY IT IS NOT FAKED

Two shapes, and both are here on purpose.

  Interleaved. Two connections hold open transactions and the harness decides
  the order of the statements between them. Under READ COMMITTED, a transaction
  does not see another's uncommitted rows — so "A reads, B reads, A writes, B
  writes" is reproducible rather than a matter of luck, and every one of these
  races fails on every run before the fix. This is the shape that proves the
  bug.

  Thrashed. N connections wait on a barrier and go at once, repeatedly. It
  cannot say which interleaving it hit, so it can only ever be evidence — but
  it is the shape that catches the interleaving nobody thought to write down.

A test that serialises the operations and then asserts the answer is right is
not a concurrency test. None of these do that: in every interleaved case both
transactions are open at once and the second statement is issued before the
first has committed.

WHAT IS ASSERTED

Outcomes, never lock mechanics. "uses never exceeds max_uses" stays true
whether the fix is a row lock, a constraint or a redesign; "redeem_invite takes
FOR UPDATE" would have to be rewritten by anybody who found a better answer.

Run:  python3 supabase/tests/concurrency/run.py
Env:  PGHOST PGPORT PGUSER PGPASSWORD PGDATABASE (or PGDSN)
"""

from __future__ import annotations

import os
import sys
import threading

import psycopg

DSN = os.environ.get("PGDSN") or psycopg.conninfo.make_conninfo(
    host=os.environ.get("PGHOST", "localhost"),
    port=os.environ.get("PGPORT", "5432"),
    user=os.environ.get("PGUSER", "postgres"),
    password=os.environ.get("PGPASSWORD") or None,
    dbname=os.environ.get("PGDATABASE", "sovereign_test"),
)

PASSED = 0
FAILED = 0


def check(ok: bool, what: str, detail: str = "") -> None:
    global PASSED, FAILED
    if ok:
        PASSED += 1
    else:
        FAILED += 1
        print(f"FAIL: {what}" + (f" — {detail}" if detail else ""), file=sys.stderr)


def owner() -> psycopg.Connection:
    """A connection that is not `app`, for setting up and for assertions.

    Assertions run here deliberately: a check that reads through the same
    policies it is testing can pass because a row is invisible rather than
    because it is absent.
    """
    c = psycopg.connect(DSN, autocommit=True)
    c.execute("set statement_timeout = '30s'")
    return c


def member(uid: str) -> psycopg.Connection:
    """A connection acting as one signed-in person, with RLS applying."""
    c = psycopg.connect(DSN, autocommit=False)
    with c.cursor() as cur:
        cur.execute("set role app")
        cur.execute("select set_config('test.uid', %s, false)", (uid,))
        # Nothing here should ever wait this long. A hang is a deadlock and a
        # deadlock is a failure, not a reason for CI to sit for ten minutes.
        cur.execute("set statement_timeout = '15s'")
    c.commit()
    return c


def verify_chain(gid: str) -> tuple[bool, int, int | None]:
    """Replay the chain as a member.

    `verify_ledger()` is security definer and asks whether the caller is in the
    group, so the owner connection — which has no `auth.uid()` at all — cannot
    call it. The assertion still reads the rows as owner; only the replay needs
    somebody signed in.
    """
    c = member(U[0])
    c.autocommit = True
    try:
        row = c.execute("select ok, checked, broken_at from verify_ledger(%s)", (gid,)).fetchone()
        return bool(row[0]), int(row[1]), row[2]
    finally:
        c.close()


def fixture_ids(o: psycopg.Connection) -> dict[str, str]:
    rows = o.execute("select k, v from race_fixture").fetchall()
    return {k: str(v) for k, v in rows}


U = [f"c0c0000{i}-0000-0000-0000-000000000000" for i in range(1, 10)] + [
    "c0c0000a-0000-0000-0000-000000000000"
]


# ---------------------------------------------------------------------------
# 1. An invite with one seat left, and two people taking it at once
# ---------------------------------------------------------------------------


def invite_interleaved(o: psycopg.Connection) -> None:
    """Both read the invite before either writes it.

    The read of `uses` and the write of `uses + 1` are separated by an insert,
    and nothing in between stops a second caller reading the same number.
    """
    a, b = member(U[3]), member(U[4])
    err_b: list[str] = []

    try:
        with a.cursor() as ca:
            ca.execute("select redeem_invite('one-seat-left-b')")

        # B goes while A is still open and uncommitted. If B blocks, it blocks
        # on something A holds — which is the fix working, not the test
        # cheating, and B then finds the invite spent.
        def run_b() -> None:
            try:
                with b.cursor() as cb:
                    cb.execute("select redeem_invite('one-seat-left-b')")
                b.commit()
            except Exception as e:  # noqa: BLE001 — the refusal is the result
                err_b.append(str(e).strip().splitlines()[0])
                b.rollback()

        t = threading.Thread(target=run_b)
        t.start()
        # Long enough that B has certainly issued its statement and is either
        # through or waiting.
        t.join(timeout=2)
        a.commit()
        t.join(timeout=20)
        check(not t.is_alive(), "the second redemption finished rather than hanging")
    finally:
        for c in (a, b):
            try:
                c.close()
            except Exception:  # noqa: BLE001
                pass

    row = o.execute(
        "select uses, max_uses from group_invites where code = 'one-seat-left-b'"
    ).fetchone()
    check(row is not None and row[0] <= row[1], "uses never exceeded max_uses", f"{row}")

    gid = fixture_ids(o)["group"]
    n = o.execute(
        "select count(*) from group_members where group_id = %s and profile_id = any(%s)",
        (gid, [U[3], U[4]]),
    ).fetchone()[0]
    check(n == 1, "exactly one of the two got in", f"{n} joined")
    check(len(err_b) == 1, "the one who lost was told why", f"errors: {err_b}")


def invite_thrash(o: psycopg.Connection) -> None:
    """Eight people, one seat, all at once.

    Says nothing about which interleaving it hit; it is here to catch the one
    nobody wrote down.
    """
    people = U[2:10]
    # Some of these are already members (the fixture and the interleaved case
    # above put them there), and redeem_invite returns early for a member
    # without taking a seat. So count new memberships, not successful calls.
    before = o.execute(
        "select count(*) from group_members gm join group_invites gi on gi.group_id = gm.group_id "
        "where gi.code = 'one-seat-left'"
    ).fetchone()[0]
    start = threading.Barrier(len(people))
    results: list[str] = []
    lock = threading.Lock()

    def go(uid: str) -> None:
        c = member(uid)
        c.autocommit = True
        try:
            start.wait(timeout=20)
            with c.cursor() as cur:
                cur.execute("select redeem_invite('one-seat-left')")
            with lock:
                results.append("in")
        except Exception:  # noqa: BLE001
            with lock:
                results.append("refused")
        finally:
            try:
                c.close()
            except Exception:  # noqa: BLE001
                pass

    threads = [threading.Thread(target=go, args=(u,)) for u in people]
    for t in threads:
        t.start()
    for t in threads:
        t.join(timeout=30)

    check(all(not t.is_alive() for t in threads), "nothing deadlocked")

    row = o.execute(
        "select uses, max_uses from group_invites where code = 'one-seat-left'"
    ).fetchone()
    check(row[0] <= row[1], "eight at once did not exceed max_uses", f"uses={row[0]}")
    after = o.execute(
        "select count(*) from group_members gm join group_invites gi on gi.group_id = gm.group_id "
        "where gi.code = 'one-seat-left'"
    ).fetchone()[0]
    check(after - before <= 1, "at most one of the eight got in", f"{after - before} new members; {results}")


# ---------------------------------------------------------------------------
# 2. The hash chain
# ---------------------------------------------------------------------------


def ledger_interleaved(o: psycopg.Connection) -> None:
    """Two writers reading the same previous hash.

    record_ledger_event() reads the latest hash, computes the next from it, and
    inserts. Two open transactions both see the chain as it was, so without
    serialisation they commit two rows claiming the same parent — and the chain
    verifies as broken, which is exactly what a tamper-evident record must not
    do for an untampered one.
    """
    ids = fixture_ids(o)
    gid = ids["group"]
    a, b = member(U[0]), member(U[1])

    try:
        with a.cursor() as ca:
            ca.execute(
                "select record_ledger_event(%s, 'project.started', 'project', gen_random_uuid())",
                (gid,),
            )

        done = threading.Event()

        def run_b() -> None:
            try:
                with b.cursor() as cb:
                    cb.execute(
                        "select record_ledger_event(%s, 'project.started', 'project', gen_random_uuid())",
                        (gid,),
                    )
                b.commit()
            except Exception:  # noqa: BLE001
                b.rollback()
            finally:
                done.set()

        t = threading.Thread(target=run_b)
        t.start()
        t.join(timeout=2)
        a.commit()
        t.join(timeout=20)
        check(done.is_set(), "the second ledger write finished rather than hanging")
    finally:
        for c in (a, b):
            try:
                c.close()
            except Exception:  # noqa: BLE001
                pass

    ok, checked, broken = verify_chain(gid)
    check(ok, "the chain still verifies after two concurrent writes", f"broke at {broken} of {checked}")

    dupes = o.execute(
        """
        select count(*) from (
          select prev_hash from ledger_events
           where group_id = %s and prev_hash is not null
           group by prev_hash having count(*) > 1
        ) x
        """,
        (gid,),
    ).fetchone()[0]
    check(dupes == 0, "no two events claim the same parent", f"{dupes} shared parents")


def ledger_thrash(o: psycopg.Connection) -> None:
    ids = fixture_ids(o)
    gid = ids["group"]
    people = U[0:6]
    start = threading.Barrier(len(people))

    def go(uid: str) -> None:
        c = member(uid)
        c.autocommit = True
        try:
            start.wait(timeout=20)
            for _ in range(4):
                with c.cursor() as cur:
                    cur.execute(
                        "select record_ledger_event(%s, 'project.started', 'project', gen_random_uuid())",
                        (gid,),
                    )
        except Exception:  # noqa: BLE001
            pass
        finally:
            try:
                c.close()
            except Exception:  # noqa: BLE001
                pass

    threads = [threading.Thread(target=go, args=(u,)) for u in people]
    for t in threads:
        t.start()
    for t in threads:
        t.join(timeout=60)

    check(all(not t.is_alive() for t in threads), "twenty-four concurrent writes did not deadlock")
    ok, checked, broken = verify_chain(gid)
    check(ok, "the chain verifies after twenty-four concurrent writes", f"broke at {broken} of {checked}")


# ---------------------------------------------------------------------------
# 3. Two people closing the same proposal
# ---------------------------------------------------------------------------


def close_interleaved(o: psycopg.Connection) -> None:
    """Both stewards close at once.

    `on conflict (proposal_id) do nothing` already keeps a second decision row
    out. What it does not stop is the second caller computing its own outcome
    from a stale snapshot and then writing that outcome onto `proposals.status`
    and onto the ledger — leaving a decision that says one thing and a status
    that says another, and two `proposal.decided` events for one decision.
    """
    ids = fixture_ids(o)
    pid = ids["closeable"]
    a, b = member(U[0]), member(U[0])
    err_b: list[str] = []

    try:
        with a.cursor() as ca:
            ca.execute("select close_proposal(%s)", (pid,))

        def run_b() -> None:
            try:
                with b.cursor() as cb:
                    cb.execute("select close_proposal(%s)", (pid,))
                b.commit()
            except Exception as e:  # noqa: BLE001
                err_b.append(str(e).strip().splitlines()[0])
                b.rollback()

        t = threading.Thread(target=run_b)
        t.start()
        t.join(timeout=2)
        a.commit()
        t.join(timeout=20)
        check(not t.is_alive(), "the second close finished rather than hanging")
    finally:
        for c in (a, b):
            try:
                c.close()
            except Exception:  # noqa: BLE001
                pass

    n = o.execute("select count(*) from decisions where proposal_id = %s", (pid,)).fetchone()[0]
    check(n == 1, "exactly one decision exists", f"{n} decisions")

    events = o.execute(
        "select count(*) from ledger_events where subject_id = %s and kind = 'proposal.decided'",
        (pid,),
    ).fetchone()[0]
    check(events == 1, "exactly one decision reached the ledger", f"{events} events")

    row = o.execute(
        """
        select p.status::text, d.outcome::text
          from proposals p join decisions d on d.proposal_id = p.id
         where p.id = %s
        """,
        (pid,),
    ).fetchone()
    check(
        row is not None and row[0] == row[1],
        "the proposal's status agrees with its decision",
        f"status={row[0] if row else None} decision={row[1] if row else None}",
    )
    check(len(err_b) == 1, "the second closer was told it was already closed", f"{err_b}")


# ---------------------------------------------------------------------------
# 4. A vote arriving while the close is being calculated
# ---------------------------------------------------------------------------


def vote_vs_close(o: psycopg.Connection) -> None:
    """The rule: a vote racing a close is REJECTED.

    A decision is a statement about what the group had said by the moment it
    closed. If a vote can land after the averages are computed but before the
    status changes, the decision records a `voter_count` that the rows
    contradict — and whichever way that is resolved has to be a decision rather
    than an accident, because both answers are defensible and only one can be
    true of any given decision.

    Rejected is the answer: the snapshot is fixed when closing begins, and the
    voter is told the proposal closed rather than having their vote silently
    not count. Accepting it instead would mean the close had to re-read after
    taking the lock, which is a different and larger change.
    """
    ids = fixture_ids(o)
    qid = ids["vote_race"]
    closer = member(U[0])
    voter = member(U[2])
    err_v: list[str] = []

    try:
        with closer.cursor() as cc:
            cc.execute("select close_proposal(%s)", (qid,))

        def run_v() -> None:
            try:
                with voter.cursor() as cv:
                    cv.execute("select cast_resonance(%s, 0.10, 0.10, 0.10, null)", (qid,))
                voter.commit()
            except Exception as e:  # noqa: BLE001
                err_v.append(str(e).strip().splitlines()[0])
                voter.rollback()

        t = threading.Thread(target=run_v)
        t.start()
        t.join(timeout=2)
        closer.commit()
        t.join(timeout=20)
        check(not t.is_alive(), "the racing vote finished rather than hanging")
    finally:
        for c in (closer, voter):
            try:
                c.close()
            except Exception:  # noqa: BLE001
                pass

    counted, actual = o.execute(
        """
        select d.voter_count,
               (select count(*) from resonance_votes where proposal_id = %s)
          from decisions d where d.proposal_id = %s
        """,
        (qid, qid),
    ).fetchone()
    check(
        counted == actual,
        "the decision's voter count matches the votes on the record",
        f"decision says {counted}, there are {actual}",
    )
    check(len(err_v) == 1, "the racing vote was refused, not silently dropped", f"{err_v}")


# ---------------------------------------------------------------------------

# ---------------------------------------------------------------------------
# 5. One holding, spent twice at once (0034)
# ---------------------------------------------------------------------------


def give_sov(o: psycopg.Connection, uid: str, n_projects: int = 1) -> None:
    """Mint SOV to somebody the only way it can be minted: off a ledger act."""
    for _ in range(n_projects):
        o.execute("select set_config('test.uid', %s, false)", (uid,))
        o.execute(
            "select record_ledger_event(null, 'project.completed', 'project', gen_random_uuid())"
        )


def balance(o: psycopg.Connection, uid: str) -> float:
    return float(
        o.execute(
            "select coalesce(sum(amount), 0) from sov_entries where account_profile = %s", (uid,)
        ).fetchone()[0]
    )


def sov_double_spend_interleaved(o: psycopg.Connection) -> None:
    """Both sends read the same balance before either writes.

    100 held, two sends of 80. Each alone is affordable; together they are not.
    """
    spender, to = U[7], U[8]
    give_sov(o, spender)
    start = balance(o, spender)
    a, b = member(spender), member(spender)
    err_b: list[str] = []

    try:
        with a.cursor() as ca:
            ca.execute("select send_sov(%s, 80, 'first of two sends racing each other')", (to,))

        def run_b() -> None:
            try:
                with b.cursor() as cb:
                    cb.execute("select send_sov(%s, 80, 'second of two sends racing each other')", (to,))
                b.commit()
            except Exception as e:  # noqa: BLE001 — the refusal is the result
                err_b.append(str(e).strip().splitlines()[0])
                b.rollback()

        t = threading.Thread(target=run_b)
        t.start()
        t.join(timeout=2)
        a.commit()
        t.join(timeout=20)
        check(not t.is_alive(), "the second send finished rather than hanging")
    finally:
        for c in (a, b):
            try:
                c.close()
            except Exception:  # noqa: BLE001
                pass

    end = balance(o, spender)
    check(end >= 0, "a holding never went below nothing", f"started {start}, ended {end}")
    check(abs((start - end) - 80) < 1e-9, "exactly one send of 80 went through", f"sent {start - end}")
    check(len(err_b) == 1, "the send that lost was told why", f"errors: {err_b}")


def sov_double_spend_thrash(o: psycopg.Connection) -> None:
    """Eight sends of 30 from a holding of 100, all at once."""
    spender, to = U[9], U[8]
    give_sov(o, spender)
    start = balance(o, spender)
    barrier = threading.Barrier(8)
    ok: list[int] = []
    lock = threading.Lock()

    def go(i: int) -> None:
        c = member(spender)
        try:
            barrier.wait(timeout=10)
            with c.cursor() as cur:
                cur.execute("select send_sov(%s, 30, %s)", (to, f"thrash send number {i} of eight"))
            c.commit()
            with lock:
                ok.append(i)
        except Exception:  # noqa: BLE001
            c.rollback()
        finally:
            c.close()

    threads = [threading.Thread(target=go, args=(i,)) for i in range(8)]
    for t in threads:
        t.start()
    for t in threads:
        t.join(timeout=30)

    end = balance(o, spender)
    check(end >= 0, "eight simultaneous sends never overdrew", f"started {start}, ended {end}")
    check(len(ok) == int(start // 30), "as many sends went through as the holding could cover",
          f"{len(ok)} of 8 from {start}")


TESTS = [
    ("an invite with one seat, taken twice", invite_interleaved),
    ("eight people, one seat, at once", invite_thrash),
    ("two ledger writes on the same parent", ledger_interleaved),
    ("twenty-four ledger writes at once", ledger_thrash),
    ("two people closing one proposal", close_interleaved),
    ("a vote arriving mid-close", vote_vs_close),
    ("one holding, two sends", sov_double_spend_interleaved),
    ("one holding, eight sends at once", sov_double_spend_thrash),
]


def main() -> int:
    o = owner()
    try:
        o.execute("select 1 from race_fixture limit 1")
    except Exception:  # noqa: BLE001
        print("No fixture. Apply supabase/tests/concurrency/fixture.sql first.", file=sys.stderr)
        return 2

    for name, fn in TESTS:
        try:
            fn(o)
        except Exception as e:  # noqa: BLE001
            check(False, f"{name} raised", repr(e))

    print()
    print(f"  Concurrency: {PASSED} passed, {FAILED} failed")
    print()
    return 1 if FAILED else 0


if __name__ == "__main__":
    sys.exit(main())
