-- Test scaffolding.
--
-- Submitting a proposal is now two writes: the sharpening the author ran on
-- the draft, and the proposal itself, which the database refuses without one.
-- `test_propose()` does exactly what the server action does, so the suites can
-- go on reading as tests of the rule they are about rather than as sixteen
-- copies of the submission path.
--
-- The one thing it must NOT be used for is testing the gate itself. Those
-- cases are written out by hand in 05_readiness.sql, because a helper that
-- always satisfies a rule cannot show the rule refusing.
--
-- It is deliberately NOT security definer: the suites exist to prove the
-- row-level policies work, and a helper that bypassed them would quietly
-- disarm every test that uses it.
--
-- Test-only. Not applied to a real project, and dropped at the end of a run by
-- `drop function test_propose;` if you care.

create or replace function test_propose(
  p_author   uuid,
  p_group    uuid,
  p_scope    group_scope,
  p_place    text,
  p_title    text,
  p_summary  text,
  p_seed     text,
  p_budget   numeric default null,
  p_term     integer default null,
  p_readiness numeric default 0.820
) returns uuid
language plpgsql set search_path = public, extensions as $$
declare
  v_intent       text;
  v_change       text;
  v_constraints  text;
  v_risks        text;
  v_alternatives text;
  v_body         text;
  v_id           uuid;
begin
  -- Built from the seed so every suite's proposal is distinct, and long enough
  -- to clear the section constraints the way real text would.
  v_intent       := p_seed || ' This is the problem as it stands, and who it affects right now.';
  v_change       := 'Afterwards: ' || p_seed || ' would no longer be the case, and the first step happens this month.';
  v_constraints  := 'It takes about 12 hours of one person''s time and £240, and depends on nobody else.';
  v_risks        := 'It may cost more than budgeted, or nobody may take it on. Three months of no take-up would say it is not working.';
  v_alternatives := 'Doing nothing was considered and rejected, because the problem recurs every week.';

  v_body := '## What this is solving' || chr(10) || v_intent || chr(10) || chr(10)
         || '## What would change'    || chr(10) || v_change || chr(10) || chr(10)
         || '## What it takes'        || chr(10) || v_constraints || chr(10) || chr(10)
         || '## What could go wrong'  || chr(10) || v_risks || chr(10) || chr(10)
         || '## What else was considered' || chr(10) || v_alternatives;

  insert into proposal_readiness (author_id, body_sha256, readiness, verdict,
                                  sections, prompt_id, prompt_version, model)
  values (p_author, proposal_body_hash(v_body), p_readiness,
          'Sharpened in a test.', '[]'::jsonb, 'proposal.sharpen', '1.0.0', 'test');

  insert into proposals (group_id, author_id, title, summary, body,
                         intent, change, constraints, risks, alternatives,
                         scope, place, budget_amount, term_days)
  values (p_group, p_author, p_title, p_summary, v_body,
          v_intent, v_change, v_constraints, v_risks, v_alternatives,
          p_scope, p_place, p_budget, p_term)
  returning id into v_id;

  return v_id;
end;
$$;
