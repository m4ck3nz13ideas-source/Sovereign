-- 0034 — Two holes, closed.
--
-- 1. ONE HOLDING, SPENT TWICE (rule 34). `send_sov()` and `back_project()`
--    read a balance and then write entries. Two calls at once both read the
--    same balance, both pass the check, both write. The concurrency suite
--    proved it: eight simultaneous sends of 30 from a holding of 100 all went
--    through and left it at -140. The fix is a transaction-scoped advisory
--    lock per spender, taken before the balance is read, in both functions —
--    so a send and a backing from the same person also queue behind each
--    other. Receiving takes no lock: money arriving cannot overdraw anybody.
--
-- 2. A CHALLENGE THAT COULD NEVER CLEAR ANYTHING (rule 8). A re-audit after a
--    challenge was meant to supersede the old readings and record new ones.
--    The superseding was a direct UPDATE, which no policy has allowed since
--    0029 (and which never worked before it), and its error was ignored — so
--    the new readings sat beside the old ones and the old violation still
--    counted. `record_challenge_audit()` now does the whole thing in one
--    transaction: checks the challenge, supersedes the readings in force,
--    records the new ten, and marks the challenge answered. If any part
--    fails, none of it happens — in particular, the old readings are never
--    superseded without new ones taking their place, because a proposal with
--    no readings at all would look as though it had no violations.

-------------------------------------------------------------------------- 1

create or replace function lock_sov_holder(p_profile uuid)
returns void
language sql
as $$
  select pg_advisory_xact_lock(hashtextextended('sov-holding:' || p_profile::text, 0));
$$;

create or replace function send_sov(p_to uuid, p_amount numeric, p_reason text)
returns void language plpgsql security definer
set search_path = public, extensions as $$
declare v_balance numeric; v_me uuid := auth.uid();
begin
  if v_me is null then raise exception 'not signed in'; end if;
  if p_to = v_me then raise exception 'you already have it'; end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'an amount to send has to be more than nothing';
  end if;
  if length(btrim(coalesce(p_reason, ''))) < 20 then
    raise exception 'say what it is for — twenty characters at least, on the record for both of you';
  end if;
  if not exists (select 1 from profiles where id = p_to) then
    raise exception 'no such person';
  end if;

  -- Before the balance is read, so a second spend waits and then reads the
  -- balance this one leaves behind.
  perform lock_sov_holder(v_me);

  select coalesce(sum(amount), 0) into v_balance
    from sov_entries where account_profile = v_me;

  if v_balance < p_amount then
    raise exception 'you hold % and this would send %', v_balance, p_amount;
  end if;

  insert into sov_entries (account_profile, amount, kind, reason, counterparty_profile)
  values (v_me, -p_amount, 'transfer', btrim(p_reason), p_to),
         (p_to,  p_amount, 'transfer', btrim(p_reason), v_me);
end;
$$;

create or replace function back_project(p_project_id uuid, p_amount numeric, p_reason text)
returns void language plpgsql security definer
set search_path = public, extensions as $$
declare v_balance numeric; v_me uuid := auth.uid();
begin
  if v_me is null then raise exception 'not signed in'; end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'an amount to put behind something has to be more than nothing';
  end if;
  if length(btrim(coalesce(p_reason, ''))) < 20 then
    raise exception 'say what it is for — twenty characters at least';
  end if;
  if not coalesce(can_reach_project(p_project_id), false) then
    raise exception 'that project is not addressed to you';
  end if;

  perform lock_sov_holder(v_me);

  select coalesce(sum(amount), 0) into v_balance
    from sov_entries where account_profile = v_me;

  if v_balance < p_amount then
    raise exception 'you hold % and this would put % behind it', v_balance, p_amount;
  end if;

  insert into sov_entries (account_profile, amount, kind, reason, counterparty_project)
  values (v_me, -p_amount, 'backing', btrim(p_reason), p_project_id);

  insert into sov_entries (account_project, amount, kind, reason, counterparty_profile)
  values (p_project_id, p_amount, 'backing', btrim(p_reason), v_me);
end;
$$;

-------------------------------------------------------------------------- 2

create or replace function record_challenge_audit(
  p_challenge_id   uuid,
  p_readings       jsonb,
  p_prompt_id      text,
  p_prompt_version text,
  p_model          text
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  c         law_challenges;
  p         proposals;
  v_viol    int;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;

  select * into c from law_challenges where id = p_challenge_id for update;
  if not found then raise exception 'challenge not found'; end if;
  if c.challenger_id is distinct from auth.uid() then
    raise exception 'only the person who raised a challenge can have it re-audited';
  end if;
  if c.answered_at is not null then
    raise exception 'that challenge has already been answered';
  end if;

  select * into p from proposals where id = c.proposal_id for update;
  if not can_reach_proposal(p.id) then raise exception 'proposal not found'; end if;
  if p.status not in ('in_review', 'in_deliberation', 'voting') then
    raise exception 'the proposal has been decided: its readings are part of what was decided on';
  end if;

  if jsonb_typeof(p_readings) <> 'array' or jsonb_array_length(p_readings) <> 10 then
    raise exception 'a re-audit reads all ten laws';
  end if;
  if (select count(distinct r->>'law_id') from jsonb_array_elements(p_readings) r) <> 10 then
    raise exception 'a re-audit gives one reading per law';
  end if;

  update law_assessments
     set superseded_at = now()
   where proposal_id = p.id and superseded_at is null;

  insert into law_assessments (proposal_id, law_id, verdict, reasoning, law_revision,
                               prompt_id, prompt_version, model)
  select p.id, r->>'law_id', (r->>'verdict')::law_verdict, r->>'reasoning',
         coalesce((select max(lr.revision) from law_revisions lr where lr.law_id = r->>'law_id'), 1),
         p_prompt_id, p_prompt_version, p_model
    from jsonb_array_elements(p_readings) r;

  update law_challenges set answered_at = now() where id = c.id;

  select count(*) into v_viol from jsonb_array_elements(p_readings) r
   where r->>'verdict' = 'violation';
  return v_viol;
end;
$$;

grant execute on function record_challenge_audit(uuid, jsonb, text, text, text) to authenticated;
