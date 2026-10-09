-- 0046 — Open tallies, secret ballots (rule 3, widened).
--
-- Until now the lean was hidden while a proposal was open, and once it
-- closed every member could read who responded how, by name. The whitepaper
-- asks for the opposite of that last part: "Transparency + Privacy: open
-- tallies, secret ballots." Mackenzie's direction (9 October 2026): data is
-- private, so a response is private too.
--
-- NOW
--
--   * `resonance_votes` is readable by its author and nobody else, open or
--     closed. There is no policy by which anybody can read anybody else's row.
--   * The tally stays open: `resonance_summary()` (counts, then averages
--     after close) is unchanged, and every decision still carries
--     `dispersion` and `polarized` (rule 14).
--   * `closed_responses()` returns, after close, every response's three
--     numbers with no name, no time and no id, sorted by the numbers — so
--     the spread can be seen and checked, and order says nothing about who.
--   * `closed_response_notes()` returns, after close, the notes people left,
--     with no name and no numbers, in an order that is fixed per proposal but
--     unrelated to time or person.
--
-- WHAT IS STILL ON THE RECORD
--
--   That somebody responded (`ledger_events` 'resonance.recorded' names the
--   actor, as a register of who voted does) — never how. A tally of three in a
--   group of three tells each of them a lot whatever we do; that is arithmetic,
--   not a leak.
--
-- LATER
--
--   The database still knows who cast which row, so the people who run it
--   could look. Secret ballots in the strong sense — a proof that an eligible
--   person responded once, with nothing linking the response to the person —
--   are on the roadmap. This migration makes the ballot secret from other
--   members; that one will make it secret from Sovereign.

drop policy if exists resonance_read_closed on resonance_votes;
drop policy if exists resonance_read_own on resonance_votes;
create policy resonance_read_own on resonance_votes for select
  using (profile_id = auth.uid());

create or replace function closed_responses(p_proposal_id uuid)
returns table (alignment numeric, confidence numeric, urgency numeric)
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  if not can_reach_proposal(p_proposal_id) then
    raise exception 'this proposal is not addressed to you';
  end if;
  if not exists (select 1 from proposals
                  where id = p_proposal_id
                    and status in ('passed', 'failed', 'executing', 'completed')) then
    return;  -- nothing until it closes (rule 3)
  end if;
  return query
    select r.alignment, r.confidence, r.urgency
      from resonance_votes r
     where r.proposal_id = p_proposal_id
     order by r.alignment desc, r.confidence desc, r.urgency desc;
end;
$$;

create or replace function closed_response_notes(p_proposal_id uuid)
returns table (note text)
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  if not can_reach_proposal(p_proposal_id) then
    raise exception 'this proposal is not addressed to you';
  end if;
  if not exists (select 1 from proposals
                  where id = p_proposal_id
                    and status in ('passed', 'failed', 'executing', 'completed')) then
    return;
  end if;
  return query
    select r.note
      from resonance_votes r
     where r.proposal_id = p_proposal_id
       and r.note is not null and length(btrim(r.note)) > 0
     order by md5(p_proposal_id::text || r.note);
end;
$$;

revoke all on function closed_responses(uuid) from public;
revoke all on function closed_response_notes(uuid) from public;
grant execute on function closed_responses(uuid) to authenticated;
grant execute on function closed_response_notes(uuid) to authenticated;

comment on policy resonance_read_own on resonance_votes is
  'Rule 3 (0046): a response is readable by its author alone, open or closed. The tally is public through resonance_summary(), closed_responses() and the decision; who said what is not.';
