-- =============================================================================
-- Sovereign — the worked example
--
-- One complete loop, so the shape is legible on first open and so the
-- retrieval step has something to retrieve: a proposal with a real review, a
-- values flag answered by halving the term, a three-comment deliberation,
-- three resonance votes, a decision, a project with a budget, and a reflection
-- in which the group's core assumption turned out to be wrong.
--
-- HOW TO RUN IT
--
--   1. Sign in to your Sovereign install at least once, so you have a profile.
--   2. Paste this whole file into the Supabase SQL editor and run it.
--
-- It attaches the example to the oldest profile in the database, which is you
-- if you have just set this up. To attach it to a specific account instead,
-- run this first in the same session:
--
--   select set_config('sovereign.owner', '<your-profile-uuid>', false);
--
-- Your ids are in:  select id, display_name from profiles;
--
-- Three fictional members are created as auth users with no password and an
-- unroutable @example.invalid address, so nobody can ever sign in as them.
-- They exist to make the deliberation and the resonance spread legible.
--
-- TO REMOVE IT ALL AGAIN
--
--   delete from groups where slug = 'thursday-studio-example';
--   delete from auth.users where email like '%@example.invalid';
--
-- Everything else cascades: profiles, proposals, votes, the project and its
-- reflection all go with them.
--
-- Everything else cascades.
-- =============================================================================

-- pgcrypto lives in the extensions schema on Supabase, and the ledger block
-- below calls digest(). Without this the seed fails two thirds of the way in,
-- after it has already written the group and the proposal.
set search_path = public, extensions;

do $$
declare
  v_owner    uuid := nullif(current_setting('sovereign.owner', true), '')::uuid;
  v_group    uuid;
  v_nadia    uuid := gen_random_uuid();
  v_tom      uuid := gen_random_uuid();
  v_ruth     uuid := gen_random_uuid();
  v_proposal uuid;
  v_review   uuid;
  v_project  uuid;
  v_flag     uuid;
begin
  -- Fall back to the first real profile if no owner was supplied.
  if v_owner is null then
    select id into v_owner from profiles order by created_at asc limit 1;
  end if;

  if v_owner is null then
    raise exception 'No profile to attach the example to. Sign in once first.';
  end if;

  -- ---------------------------------------------------------------- members
  -- profiles.id references auth.users, so the auth rows come first. No
  -- password is set and .invalid is reserved by RFC 2606 and can never be
  -- routed, so these accounts cannot be signed into or password-reset.
  insert into auth.users (id, email, raw_user_meta_data) values
    (v_nadia, 'nadia@example.invalid', '{"display_name":"Nadia Okonjo"}'::jsonb),
    (v_tom,   'tom@example.invalid',   '{"display_name":"Tom Bright"}'::jsonb),
    (v_ruth,  'ruth@example.invalid',  '{"display_name":"Ruth Adeyemi"}'::jsonb)
  on conflict (id) do nothing;

  -- The trigger on auth.users has already created the profile rows.
  update profiles set handle = 'example-nadia', display_name = 'Nadia Okonjo',
         bio = 'Runs the Thursday session. Example member.', share_values = true
   where id = v_nadia;
  update profiles set handle = 'example-tom', display_name = 'Tom Bright',
         bio = 'Keeps the books. Example member.', share_values = true
   where id = v_tom;
  update profiles set handle = 'example-ruth', display_name = 'Ruth Adeyemi',
         bio = 'Been coming longest. Example member.', share_values = true
   where id = v_ruth;

  insert into profile_values (profile_id, name, definition, position) values
    (v_nadia, 'Hospitality',
     'Nobody who wants to be here is turned away over money.', 0),
    (v_nadia, 'Craft',
     'We do the thing properly or we do not do it.', 1),
    (v_tom, 'Restraint',
     'We do not commit to what we cannot sustain for a year.', 0),
    (v_tom, 'Fairness',
     'The people who pay and the people who benefit should overlap.', 1),
    (v_ruth, 'Patience',
     'A decision that can wait a month usually should.', 0)
  on conflict do nothing;

  -- ----------------------------------------------------------------- group
  insert into groups (name, slug, purpose, scope, created_by,
                      threshold_alignment, threshold_participation, threshold_values_floor)
  values (
    'Thursday Studio (example)',
    'thursday-studio-example',
    'A weekly making session. We decide together how it runs and who pays for what.',
    'local',
    v_owner,
    0.600, 0.600, 0.300
  )
  returning id into v_group;

  insert into group_members (group_id, profile_id, role) values
    (v_group, v_owner, 'owner'),
    (v_group, v_nadia, 'steward'),
    (v_group, v_tom,   'member'),
    (v_group, v_ruth,  'member');

  -- -------------------------------------------------------------- proposal
  insert into proposals (
    group_id, author_id, title, summary, body, category, scope,
    budget_amount, budget_currency, term_days, status,
    created_at, submitted_at, closed_at
  ) values (
    v_group, v_nadia,
    'Move the Thursday session to a paid room',
    'Rent the room above the Kings Arms for Thursdays, 12 weeks, £480 total.',
    E'The church hall has been double-booked three times since March and we have lost two sessions entirely. People stop coming when they cannot rely on it being there.\n\nThe room above the Kings Arms is £40 a week, holds fourteen comfortably, and has a lockable cupboard we could keep tools in. I have asked and they will hold Thursdays for us if we commit to a term.\n\nI am proposing twelve weeks at £480 total. Split across the eleven of us that is about £44 each, or we could take it from what is left of the workshop fund.\n\nWhat I am unsure about: whether people will actually pay, and whether a pub room feels like the same thing. The hall is free and it is ours in a way a rented room will not be.',
    'Space', 'local',
    480.00, 'GBP', 84, 'completed',
    now() - interval '94 days', now() - interval '94 days', now() - interval '88 days'
  )
  returning id into v_proposal;

  -- ------------------------------------------------------------- the review
  insert into proposal_reviews (
    proposal_id, prompt_id, prompt_version, model,
    clarity, evidence, feasibility, reversibility,
    values_alignment, risks, questions, memory_used, summary, created_at, created_by
  ) values (
    v_proposal, 'proposal.review', '1.2.0', 'example',
    0.810, 0.640, 0.720, 0.380,
    jsonb_build_object(
      'Hospitality', 0.280,
      'Craft',       0.740,
      'Restraint',   0.410,
      'Fairness',    0.520,
      'Patience',    0.660
    ),
    jsonb_build_array(
      jsonb_build_object(
        'title', 'A twelve-week commitment before anyone has paid',
        'severity', 'high',
        'note', 'The £480 is committed to the venue up front but collected from members afterwards. If four people do not pay, the shortfall falls on whoever signed.'
      ),
      jsonb_build_object(
        'title', 'The £44 figure assumes everyone stays',
        'severity', 'medium',
        'note', 'Eleven members is the current count, not a commitment. Attendance has already been unreliable, which is the problem this is solving.'
      )
    ),
    jsonb_build_array(
      'Who is liable if the collection falls short, and has that person agreed?',
      'What happens at week thirteen — does this renew by default?',
      'Has anyone asked the four people who stopped coming whether the venue was the reason?'
    ),
    '[]'::jsonb,
    'Renting a reliable room for twelve weeks at £480, to replace a free hall that has been double-booked three times. The problem is real and documented. The proposal is clear about cost and specific about the venue. Two things are not resolved: the money is committed before it is collected, and the £44 per head assumes a membership that has already proven unstable. It scores low on Hospitality by its own group''s definition — "nobody who wants to be here is turned away over money" is difficult to hold when attendance now costs £44. Reversibility is low: twelve weeks is a term you cannot exit halfway.',
    now() - interval '94 days', v_nadia
  )
  returning id into v_review;

  -- ----------------------------------------------- the Universal Law audit
  -- Nine aligned and one tension, answered below — the example exists to show
  -- the mechanism, and a clean sheet would show nothing.
  insert into law_assessments (proposal_id, review_id, law_id, verdict, reasoning,
                               prompt_id, prompt_version, model, created_at)
  values
    (v_proposal, v_review, 'sanctity_of_life', 'aligned',
     'Renting a room engages this law only distantly. Nothing here destroys life or risks it.',
     'law.audit', '1.0.0', 'example', now() - interval '94 days'),
    (v_proposal, v_review, 'truth_and_transparency', 'aligned',
     'The cost, the venue and the term are all stated plainly, and the author names what she is unsure about rather than hiding it.',
     'law.audit', '1.0.0', 'example', now() - interval '94 days'),
    (v_proposal, v_review, 'sovereignty_of_the_individual', 'aligned',
     'Nobody is bound by this. Attendance stays a choice, and the proposal does not condition anyone''s standing in the group on paying.',
     'law.audit', '1.0.0', 'example', now() - interval '94 days'),
    (v_proposal, v_review, 'equity_and_justice', 'tension',
     'The 44 pounds per head falls equally on people whose means are not equal, which advantages those who can absorb it. That is not privilege by design, but it is an unequal effect the proposal does not address. Answer it or change it.',
     'law.audit', '1.0.0', 'example', now() - interval '94 days'),
    (v_proposal, v_review, 'subsidiarity', 'aligned',
     'A decision about where this group meets, made by this group. This is the right scale.',
     'law.audit', '1.0.0', 'example', now() - interval '94 days'),
    (v_proposal, v_review, 'reciprocity_and_mutual_care', 'aligned',
     'What is taken in fees is returned in a reliable room and a lockable cupboard. Tom fronting the money is offered, not assumed.',
     'law.audit', '1.0.0', 'example', now() - interval '94 days'),
    (v_proposal, v_review, 'stewardship_of_earth', 'aligned',
     'A room above a pub rather than a hall two streets away. No ecological dimension worth reporting.',
     'law.audit', '1.0.0', 'example', now() - interval '94 days'),
    (v_proposal, v_review, 'harmony_of_diversity', 'aligned',
     'Nothing here requires uniformity or excludes a way of doing things. One member''s reasons for not coming turn out to matter, but the proposal does not cause that.',
     'law.audit', '1.0.0', 'example', now() - interval '94 days'),
    (v_proposal, v_review, 'right_use_of_power', 'aligned',
     'The author is a steward proposing something she will pay for like everyone else. No asymmetry is being used to get agreement.',
     'law.audit', '1.0.0', 'example', now() - interval '94 days'),
    (v_proposal, v_review, 'continuous_evolution', 'aligned',
     'A fixed term with an explicit decision point at the end. The group has written in its own chance to change its mind.',
     'law.audit', '1.0.0', 'example', now() - interval '94 days');

  update law_assessments
     set resolution = 'Two places come out of the workshop fund, unnamed, so nobody has to ask. Halving the term to six weeks takes it from 44 pounds to 22.',
         resolved_at = now() - interval '91 days',
         resolved_by = v_ruth
   where proposal_id = v_proposal and law_id = 'equity_and_justice';

  -- ------------------------------------------------- the flags, and answers
  insert into proposal_flags (
    proposal_id, review_id, kind, label, severity, detail,
    resolution, resolved_at, resolved_by, created_at
  ) values (
    v_proposal, v_review, 'values',
    'Scores 0.28 against Hospitality', 'high',
    'The group''s floor is 0.30. This has to be answered — what changed, or why is it acceptable here?',
    'Answered by halving the term. Six weeks at £240 is £22 a head, and we are covering two people from the workshop fund without naming them, so nobody has to ask. If it works we decide again in six weeks with real numbers instead of a guess.',
    now() - interval '91 days', v_nadia,
    now() - interval '94 days'
  )
  returning id into v_flag;

  insert into proposal_flags (
    proposal_id, review_id, kind, label, severity, detail,
    resolution, resolved_at, resolved_by, created_at
  ) values (
    v_proposal, v_review, 'risk',
    'A twelve-week commitment before anyone has paid', 'high',
    'The £480 is committed to the venue up front but collected from members afterwards. If four people do not pay, the shortfall falls on whoever signed.',
    'Tom is fronting it and the group has agreed in the thread that the workshop fund covers any shortfall up to £80. At six weeks the exposure is £240, not £480, which he is comfortable with.',
    now() - interval '91 days', v_tom,
    now() - interval '94 days'
  );

  -- ---------------------------------------------------------- deliberation
  insert into deliberation_comments (proposal_id, author_id, body, created_at) values
    (v_proposal, v_tom,
     E'I will front it, but not for twelve weeks. Six and we look again. £240 I can absorb if it goes wrong; £480 I cannot, and I would rather say that now than discover it in March.',
     now() - interval '93 days'),
    (v_proposal, v_ruth,
     E'The Hospitality score is right and we should not argue with it. The hall being free is not incidental — it is why Marcus comes, and he will not say so.\n\nIf we do this, two places come out of the fund and we do not announce whose.',
     now() - interval '92 days'),
    (v_proposal, v_nadia,
     E'Both taken. Six weeks, £240, two places from the fund, unnamed. I have amended the flags rather than the proposal so the change is on the record.',
     now() - interval '92 days');

  -- ------------------------------------------------------------- resonance
  insert into proposal_reads (proposal_id, profile_id, read_at) values
    (v_proposal, v_nadia, now() - interval '93 days'),
    (v_proposal, v_tom,   now() - interval '93 days'),
    (v_proposal, v_ruth,  now() - interval '92 days');

  insert into resonance_votes (proposal_id, profile_id, alignment, confidence, urgency, note, created_at, updated_at) values
    (v_proposal, v_nadia, 0.890, 0.760, 0.820,
     'It is the only option that keeps Thursdays reliable.',
     now() - interval '91 days', now() - interval '91 days'),
    (v_proposal, v_tom, 0.740, 0.680, 0.550,
     'Yes at six weeks. Would have been a no at twelve.',
     now() - interval '91 days', now() - interval '91 days'),
    (v_proposal, v_ruth, 0.710, 0.520, 0.410,
     'Going along with it. I still think we could have asked the hall for a standing booking first.',
     now() - interval '90 days', now() - interval '90 days');

  -- -------------------------------------------------------------- decision
  insert into decisions (
    proposal_id, outcome, avg_alignment, avg_confidence, avg_urgency,
    participation, voter_count, member_count, values_invoked,
    rationale_summary, prompt_version, decided_at, decided_by
  ) values (
    v_proposal, 'passed', 0.780, 0.653, 0.593,
    0.750, 3, 4,
    array['Hospitality','Craft','Restraint','Fairness','Patience'],
    'Passed: six weeks in the Kings Arms room at £240, with two places covered from the workshop fund and Tom fronting the cost. Mean alignment 0.78 against a 0.60 threshold, three of four members responding. The proposal only reached this shape because both critical flags were answered rather than argued away — the term halved and the exposure with it. The strongest objection was Ruth''s, and it was not about money: the hall being free is why one member comes, and a paid room changes what the group is even when nobody is turned away. That objection was not resolved, only mitigated. This will have been the wrong call if attendance drops among the people who were never going to mention the cost.',
    '1.1.0',
    now() - interval '88 days', v_nadia
  );

  -- --------------------------------------------------------------- project
  insert into projects (
    proposal_id, group_id, title, expected_outcome, status,
    budget_committed, budget_spent, started_at, completed_at, created_at
  ) values (
    v_proposal, v_group,
    'Move the Thursday session to a paid room',
    'Six reliable Thursdays in the Kings Arms room at £240, with attendance holding at eleven.',
    'completed',
    240.00, 240.00,
    now() - interval '87 days', now() - interval '3 days', now() - interval '88 days'
  )
  returning id into v_project;

  insert into project_tasks (project_id, title, assignee_id, status, created_at) values
    (v_project, 'Confirm the booking and pay the deposit', v_tom, 'done', now() - interval '87 days'),
    (v_project, 'Tell everyone, including the four who stopped coming', v_nadia, 'done', now() - interval '87 days'),
    (v_project, 'Move the tools into the cupboard', v_ruth, 'done', now() - interval '80 days'),
    (v_project, 'Collect from whoever is paying', v_tom, 'done', now() - interval '70 days');

  insert into project_updates (project_id, author_id, body, spend_delta, created_at) values
    (v_project, v_tom, 'Paid the six weeks up front. £240 out.', 240.00, now() - interval '86 days'),
    (v_project, v_nadia, E'Week one: fourteen people. Four of them had not been since March. The cupboard is the thing everyone commented on, not the room.', 0, now() - interval '79 days'),
    (v_project, v_ruth, E'Week four: down to nine. Marcus has not been since week two and has not said why.', 0, now() - interval '58 days'),
    (v_project, v_tom, E'All collected except two, which came out of the fund as agreed. No shortfall.', 0, now() - interval '40 days');

  -- ------------------------------------------------------------ reflection
  insert into reflections (
    project_id, actual_outcome, assumption_wrong, lesson, created_by, created_at
  ) values (
    v_project,
    E'Six Thursdays ran without a single cancellation, which is what we wanted and what we got. Attendance started at fourteen and settled at nine — higher than the worst months in the hall, lower than the eleven we budgeted against.\n\nThe cupboard turned out to matter more than the room. Being able to leave work in progress is what brought back three of the four people who had drifted, not the reliability of the booking.\n\nMarcus stopped coming in week two. Ruth asked him in week five and it was not the money — he had assumed the pub meant everyone would go to the bar afterwards and he does not drink. Nobody had thought to say that we do not.',
    E'We assumed the problem was reliability, and that paying for it was the risk. Both were wrong. The reliability was worth less than the cupboard, and the cost was never what pushed anyone away — an unstated assumption about what a pub room implies did that, and no amount of covering people''s fees would have touched it.',
    E'Ask the people who left why they left, before proposing the fix. We ran a whole term on a guess about Marcus that one conversation would have corrected in week one.',
    v_ruth,
    now() - interval '3 days'
  );

  -- ------------------------------------------------------------------ feed
  insert into posts (author_id, group_id, body, source_tag, created_at) values
    (v_nadia, v_group,
     E'Six weeks in the new room, no cancellations. Worth reading Ruth''s reflection on it — the thing we were solving turned out not to be the thing that was wrong.',
     'Thursday Studio', now() - interval '2 days');

  -- ---------------------------------------------------------------- ledger
  -- The rows above were written directly rather than through the functions,
  -- so the chain has to be built here to match. The digest formula is the one
  -- in record_ledger_event(); if you change it there, change it here too.
  -- Without this, the example's Impact page would verify an empty chain,
  -- which is true but tells the reader nothing.
  declare
    r        record;
    v_prev   text := null;
    v_hash   text;
  begin
    for r in
      select * from (values
        ('group.created',      'group',    v_group,    v_owner, jsonb_build_object('name','Thursday Studio (example)','scope','local'), now() - interval '120 days'),
        ('member.joined',      'profile',  v_nadia,    v_nadia, '{}'::jsonb,                                    now() - interval '119 days'),
        ('member.joined',      'profile',  v_tom,      v_tom,   '{}'::jsonb,                                    now() - interval '119 days'),
        ('member.joined',      'profile',  v_ruth,     v_ruth,  '{}'::jsonb,                                    now() - interval '118 days'),
        ('proposal.submitted', 'proposal', v_proposal, v_nadia, jsonb_build_object('title','Move the Thursday session to a paid room'), now() - interval '94 days'),
        ('proposal.reviewed',  'proposal', v_proposal, v_nadia, jsonb_build_object('prompt_version','1.2.0','model','example','flags',2), now() - interval '94 days'),
        ('flag.answered',      'proposal', v_proposal, v_nadia, jsonb_build_object('flag_id', v_flag),           now() - interval '91 days'),
        ('flag.answered',      'proposal', v_proposal, v_tom,   '{}'::jsonb,                                    now() - interval '91 days'),
        ('resonance.recorded', 'proposal', v_proposal, v_nadia, '{}'::jsonb,                                    now() - interval '91 days'),
        ('resonance.recorded', 'proposal', v_proposal, v_tom,   '{}'::jsonb,                                    now() - interval '91 days'),
        ('resonance.recorded', 'proposal', v_proposal, v_ruth,  '{}'::jsonb,                                    now() - interval '90 days'),
        ('proposal.decided',   'proposal', v_proposal, v_nadia, jsonb_build_object('outcome','passed','alignment',0.780,'participation',0.750,'open_flags',0), now() - interval '88 days'),
        ('project.started',    'project',  v_project,  v_tom,   '{}'::jsonb,                                    now() - interval '87 days'),
        ('project.spend',      'project',  v_project,  v_tom,   jsonb_build_object('amount',240.00),            now() - interval '86 days'),
        ('project.completed',  'project',  v_project,  v_ruth,  '{}'::jsonb,                                    now() - interval '3 days')
      ) as t(kind, subject_type, subject_id, actor_id, payload, created_at)
    loop
      v_hash := encode(
        digest(
          coalesce(v_prev, 'genesis') || '|' ||
          v_group::text || '|' ||
          r.actor_id::text || '|' ||
          r.kind || '|' || r.subject_type || '|' ||
          r.subject_id::text || '|' ||
          r.payload::text || '|' || r.created_at::text,
          'sha256'
        ),
        'hex'
      );

      insert into ledger_events (group_id, actor_id, kind, subject_type, subject_id,
                                 payload, prev_hash, hash, created_at)
      values (v_group, r.actor_id, r.kind, r.subject_type, r.subject_id,
              r.payload, v_prev, v_hash, r.created_at);

      v_prev := v_hash;
    end loop;
  end;

  raise notice 'Example seeded. Group: Thursday Studio (example).';
end $$;
