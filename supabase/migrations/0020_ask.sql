-- =============================================================================
-- 0020 — ASK: the search surface as a place of its own
--
-- 0019 hung an inquiry off a proposal, on the reasoning that research nobody
-- can find is research somebody repeats. That is still right when you are
-- reading a proposal. It is wrong as the only way in, because the question
-- that matters most often arrives before there is anything to attach it to —
-- you wonder whether shared tools work, and only then write the proposal.
--
-- So proposal_id becomes nullable, and the two cases are genuinely different
-- objects rather than one with a hole in it:
--
--   attached    readable by everyone the proposal is addressed to. It is part
--               of the group's understanding of a decision they are making.
--   standing    readable by its asker alone. Nobody has been asked to read it
--               and nothing is being decided on it, so publishing it to a
--               place would be publishing somebody's curiosity.
--
-- The rule of the product holds either way: the individual half never becomes
-- the collective half unless you send it there.
--
-- WHAT IS DELIBERATELY NOT HERE
--
-- No way to promote a standing inquiry onto a proposal after the fact. It
-- would be a small function and a plausible feature, and it would mean the
-- words "readable by its asker alone" are true only until somebody changes
-- their mind. Ask the question again with the proposal in front of you; the
-- model is cheap and the promise is not.
-- =============================================================================

alter table inquiries alter column proposal_id drop not null;

comment on column inquiries.proposal_id is
  'The proposal this was asked about, or null for a question asked on its own. '
  'Null means owner-only, permanently: there is no path that attaches one later.';

-- -----------------------------------------------------------------------------
-- Policies, rewritten for the two cases
--
-- can_reach_proposal(null) is null rather than false, so the old policy would
-- have quietly hidden every standing inquiry from its own author — the kind of
-- bug that looks like nothing happening.
-- -----------------------------------------------------------------------------

drop policy if exists inquiries_read on inquiries;
create policy inquiries_read on inquiries for select
  using (
    asked_by = auth.uid()
    or (proposal_id is not null and can_reach_proposal(proposal_id))
  );

drop policy if exists positions_read on positions;
create policy positions_read on positions for select
  using (exists (
    select 1 from inquiries i
     where i.id = positions.inquiry_id
       and (
         i.asked_by = auth.uid()
         or (i.proposal_id is not null and can_reach_proposal(i.proposal_id))
       )
  ));

-- -----------------------------------------------------------------------------
-- Recording, with the proposal optional
-- -----------------------------------------------------------------------------

drop function if exists record_inquiry(uuid, text, text, text, text, text, jsonb);
create or replace function record_inquiry(
  p_proposal_id    uuid,
  p_question       text,
  p_note           text,
  p_prompt_id      text,
  p_prompt_version text,
  p_model          text,
  p_positions      jsonb
)
returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_id uuid;
  v_lenses integer;
begin
  if auth.uid() is null then
    raise exception 'only a signed-in person can ask';
  end if;

  -- Only checked when there is one. A question asked on its own is nobody's
  -- business but the asker's, so there is no address to be eligible for.
  if p_proposal_id is not null and not can_reach_proposal(p_proposal_id) then
    raise exception 'this proposal is not addressed to you';
  end if;

  select count(distinct (x->>'lens')) into v_lenses
    from jsonb_array_elements(coalesce(p_positions, '[]'::jsonb)) as x;

  if coalesce(v_lenses, 0) < 2 then
    raise exception 'an inquiry needs at least two ways of knowing and this one has % — a survey of one is an answer',
      coalesce(v_lenses, 0);
  end if;

  insert into inquiries (proposal_id, question, asked_by, note,
                         prompt_id, prompt_version, model)
  values (p_proposal_id, btrim(p_question), auth.uid(),
          nullif(btrim(coalesce(p_note, '')), ''),
          p_prompt_id, p_prompt_version, p_model)
  returning id into v_id;

  insert into positions (inquiry_id, lens, claim, reasoning, source_hint, ordinal)
  select v_id,
         (x->>'lens')::inquiry_lens,
         btrim(x->>'claim'),
         btrim(x->>'reasoning'),
         nullif(btrim(coalesce(x->>'source_hint', '')), ''),
         (n - 1)::int
    from jsonb_array_elements(p_positions) with ordinality as t(x, n);

  return v_id;
end;
$$;

grant execute on function record_inquiry(uuid, text, text, text, text, text, jsonb)
to authenticated;

-- inquiries_for() is unchanged in shape but must now exclude standing ones,
-- which have no proposal to be listed under.
drop function if exists inquiries_for(uuid);
create or replace function inquiries_for(p_proposal_id uuid)
returns table (
  id uuid, question text, note text, asked_by uuid, asked_by_name text,
  model text, lenses integer, created_at timestamptz
)
language sql security definer stable set search_path = public, extensions as $$
  select i.id, i.question, i.note, i.asked_by, p.display_name, i.model,
         (select count(distinct po.lens)::int from positions po where po.inquiry_id = i.id),
         i.created_at
    from inquiries i
    join profiles p on p.id = i.asked_by
   where i.proposal_id = p_proposal_id
     and can_reach_proposal(i.proposal_id)
   order by i.created_at desc;
$$;

grant execute on function inquiries_for(uuid) to authenticated;

-- Everything you have asked, wherever you asked it.
drop function if exists my_inquiries(integer);
create or replace function my_inquiries(p_limit integer default 30)
returns table (
  id uuid, question text, note text, model text, lenses integer,
  proposal_id uuid, proposal_title text, created_at timestamptz
)
language sql security definer stable set search_path = public, extensions as $$
  select i.id, i.question, i.note, i.model,
         (select count(distinct po.lens)::int from positions po where po.inquiry_id = i.id),
         i.proposal_id, p.title, i.created_at
    from inquiries i
    left join proposals p on p.id = i.proposal_id
   where i.asked_by = auth.uid()
   order by i.created_at desc
   limit greatest(1, least(coalesce(p_limit, 30), 100));
$$;

grant execute on function my_inquiries(integer) to authenticated;

-- -----------------------------------------------------------------------------
-- Finding what is already here
--
-- Deliberately plain: a case-insensitive match over the text somebody would
-- actually remember, newest first, through the same eligibility question as
-- everything else. No ranking by relevance, no popularity, nothing weighted by
-- how many people looked at a thing.
--
-- It is a sequential scan and will stay fast to a few thousand proposals,
-- which is well past the size this is for. Writing a tsvector column and a GIN
-- index before anybody has more than fifty would be optimising a screen nobody
-- has opened.
-- -----------------------------------------------------------------------------

drop function if exists search_collective(text, integer);
create or replace function search_collective(p_query text, p_limit integer default 20)
returns table (
  kind     text,
  id       uuid,
  title    text,
  line     text,
  status   text,
  happened timestamptz
)
language sql security definer stable set search_path = public, extensions as $$
  with q as (select '%' || btrim(coalesce(p_query, '')) || '%' as pat)
  select * from (
    select 'proposal'::text, p.id, p.title, p.summary, p.status::text,
           coalesce(p.submitted_at, p.created_at)
      from proposals p, q
     where length(btrim(coalesce(p_query, ''))) >= 2
       and can_reach_proposal(p.id)
       and (p.title ilike q.pat or p.summary ilike q.pat or p.body ilike q.pat)

    union all

    select 'decision', d.proposal_id, p.title, d.rationale_summary, 'decided',
           d.decided_at
      from decisions d
      join proposals p on p.id = d.proposal_id, q
     where length(btrim(coalesce(p_query, ''))) >= 2
       and can_reach_proposal(d.proposal_id)
       and (p.title ilike q.pat or coalesce(d.rationale_summary, '') ilike q.pat)

    union all

    select 'project', pr.proposal_id, p.title, pr.status::text, pr.status::text,
           pr.created_at
      from projects pr
      join proposals p on p.id = pr.proposal_id, q
     where length(btrim(coalesce(p_query, ''))) >= 2
       and can_reach_proposal(pr.proposal_id)
       and p.title ilike q.pat
  ) hits(kind, id, title, line, status, happened)
  order by happened desc nulls last
  limit greatest(1, least(coalesce(p_limit, 20), 50));
$$;

grant execute on function search_collective(text, integer) to authenticated;

-- positions_for() is security definer, so the policy above does not apply to
-- it — its own where clause is the gate, and it still asked
-- can_reach_proposal(i.proposal_id), which is NULL for a standing inquiry and
-- therefore not true. The effect was that the one person entitled to read
-- their own private research got an empty list, silently. Same two cases as
-- the policy, spelled out again here because a security definer function has
-- to carry its own check.
drop function if exists positions_for(uuid);
create or replace function positions_for(p_inquiry_id uuid)
returns table (
  lens inquiry_lens, claim text, reasoning text, source_hint text, ordinal integer
)
language sql security definer stable set search_path = public, extensions as $$
  select po.lens, po.claim, po.reasoning, po.source_hint, po.ordinal
    from positions po
    join inquiries i on i.id = po.inquiry_id
   where po.inquiry_id = p_inquiry_id
     and (
       i.asked_by = auth.uid()
       or (i.proposal_id is not null and can_reach_proposal(i.proposal_id))
     )
   order by po.ordinal;
$$;

grant execute on function positions_for(uuid) to authenticated;
