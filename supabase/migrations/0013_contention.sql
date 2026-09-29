-- =============================================================================
-- 0013 — CONTENTION: two good answers to one question
--
-- Everything here so far judges a proposal on its own. Is it coherent, is it
-- lawful, does it hold up to the group's own values, do people resonate with
-- it. All necessary, and all blind to the thing that actually decides most
-- real questions: there is one budget, one Saturday, one hall, and two
-- perfectly good proposals want it.
--
-- Today both can pass. Then activation discovers there is not enough for both,
-- and the group has the argument it thought it had already had — except now
-- two sets of people have been told yes.
--
-- A CONTENTION is a named set of proposals that cannot all happen. Anyone who
-- can reach them can say so, because noticing the clash is not a privilege.
-- Inside one, each person names a FIRST CHOICE, separately from how they
-- resonated on each.
--
-- THE LINE THAT MAKES THIS SAFE: a preference orders, it never passes.
--
-- A proposal that failed its own resonance does not become activatable by
-- winning a preference count. A proposal that violated Universal Law is not
-- rescued by being popular. The thresholds are untouched — all a contention
-- decides is the ORDER in which proposals that already passed on their own
-- merits get to go looking for resources. If the first cannot gather what it
-- needs, the second becomes activatable, which is the real prize here: the
-- fallback was chosen in advance, by everybody, calmly, instead of in the
-- wreckage of the first one failing.
--
-- Preferences stay hidden until every member of the set has closed. Live
-- counts would be a bandwagon for the same reason live resonance averages are
-- one, and a poll that shows its running total is not measuring a preference,
-- it is manufacturing one.
-- =============================================================================

create table if not exists contentions (
  id         uuid primary key default gen_random_uuid(),
  -- What the set is about, in the group's own words. "The hall on Saturdays."
  question   text not null check (length(btrim(question)) between 8 and 160),
  note       text,

  -- The address the whole set shares. Every member has to match it, which is
  -- also what stops somebody quietly contending a proposal on another street
  -- against one on theirs.
  group_id   uuid references groups on delete cascade,
  scope      group_scope not null,
  place      text,

  created_by uuid not null references profiles on delete cascade,
  created_at timestamptz not null default now(),
  -- Set when the last member closes. Until then, no preference is readable.
  resolved_at timestamptz
);

create table if not exists contention_members (
  contention_id uuid not null references contentions on delete cascade,
  proposal_id   uuid not null references proposals on delete cascade,
  added_by      uuid not null references profiles on delete cascade,
  created_at    timestamptz not null default now(),
  primary key (contention_id, proposal_id)
);

-- A proposal belongs to at most one contention. Two overlapping sets would
-- make "which is the group's first choice" unanswerable, and the honest fix
-- for a proposal that clashes with two different things is a bigger set.
create unique index if not exists contention_members_one_set
  on contention_members (proposal_id);

create table if not exists preferences (
  contention_id uuid not null references contentions on delete cascade,
  profile_id    uuid not null references profiles on delete cascade,
  proposal_id   uuid not null references proposals on delete cascade,
  updated_at    timestamptz not null default now(),
  primary key (contention_id, profile_id)
);

comment on table contentions is
  'A named set of proposals that cannot all happen. Decides the order passed proposals go looking for resources — never whether any of them passed.';
comment on table preferences is
  'One first choice per person per set. Hidden from everyone until every member proposal has closed.';

-- -----------------------------------------------------------------------------
-- Declaring one
-- -----------------------------------------------------------------------------

create or replace function open_contention(
  p_question    text,
  p_proposal_a  uuid,
  p_proposal_b  uuid,
  p_note        text default null
)
returns uuid language plpgsql security definer
set search_path = public, extensions as $$
declare v_a record; v_b record; v_id uuid;
begin
  select * into v_a from proposals where id = p_proposal_a;
  if not found then raise exception 'no such proposal'; end if;
  select * into v_b from proposals where id = p_proposal_b;
  if not found then raise exception 'no such proposal'; end if;

  if p_proposal_a = p_proposal_b then
    raise exception 'a proposal does not contend with itself';
  end if;

  if not can_reach_proposal(p_proposal_a) or not can_reach_proposal(p_proposal_b) then
    raise exception 'one of these is not addressed to you';
  end if;

  -- Same address, or it is not the same question.
  if v_a.group_id is distinct from v_b.group_id
     or v_a.scope <> v_b.scope
     or place_key(v_a.place) is distinct from place_key(v_b.place) then
    raise exception 'these are addressed to different people — they cannot be alternatives';
  end if;

  if v_a.closed_at is not null or v_b.closed_at is not null then
    raise exception 'both have to still be open — a contention decided after the fact is a retelling';
  end if;

  insert into contentions (question, note, group_id, scope, place, created_by)
  values (btrim(p_question), nullif(btrim(coalesce(p_note, '')), ''),
          v_a.group_id, v_a.scope, v_a.place, auth.uid())
  returning id into v_id;

  insert into contention_members (contention_id, proposal_id, added_by)
  values (v_id, p_proposal_a, auth.uid()), (v_id, p_proposal_b, auth.uid());

  perform record_ledger_event(v_a.group_id, 'contention.opened', 'proposal', p_proposal_a,
    jsonb_build_object('contention', v_id, 'question', btrim(p_question),
                       'with', p_proposal_b));

  return v_id;
end;
$$;

create or replace function add_to_contention(p_contention_id uuid, p_proposal_id uuid)
returns void language plpgsql security definer
set search_path = public, extensions as $$
declare v_c record; v_p record;
begin
  select * into v_c from contentions where id = p_contention_id;
  if not found then raise exception 'no such contention'; end if;
  if v_c.resolved_at is not null then raise exception 'that set has already resolved'; end if;

  select * into v_p from proposals where id = p_proposal_id;
  if not found then raise exception 'no such proposal'; end if;
  if not can_reach_proposal(p_proposal_id) then
    raise exception 'this proposal is not addressed to you';
  end if;

  if v_p.group_id is distinct from v_c.group_id
     or v_p.scope <> v_c.scope
     or place_key(v_p.place) is distinct from place_key(v_c.place) then
    raise exception 'that is addressed to different people';
  end if;

  if v_p.closed_at is not null then
    raise exception 'that one has already closed';
  end if;

  insert into contention_members (contention_id, proposal_id, added_by)
  values (p_contention_id, p_proposal_id, auth.uid())
  on conflict do nothing;
end;
$$;

-- -----------------------------------------------------------------------------
-- Naming a first choice
--
-- Separate from resonance, and it does not replace it: you still say how each
-- one sits with you on its own terms. This answers a different question —
-- given that we cannot do both, which one first.
-- -----------------------------------------------------------------------------

create or replace function set_preference(p_contention_id uuid, p_proposal_id uuid)
returns void language plpgsql security definer
set search_path = public, extensions as $$
declare v_c record;
begin
  select * into v_c from contentions where id = p_contention_id;
  if not found then raise exception 'no such contention'; end if;
  if v_c.resolved_at is not null then
    raise exception 'that set has resolved — the order is already settled';
  end if;

  if not exists (
    select 1 from contention_members
     where contention_id = p_contention_id and proposal_id = p_proposal_id
  ) then
    raise exception 'that proposal is not in this set';
  end if;

  if not can_reach_proposal(p_proposal_id) then
    raise exception 'this is not addressed to you';
  end if;

  -- The same floor as resonance: you have read the thing you are ranking.
  -- Naming a favourite among proposals you have not read is the cheapest
  -- possible opinion and it would be the loudest signal on the screen.
  if not exists (
    select 1 from proposal_reads
     where proposal_id = p_proposal_id and profile_id = auth.uid()
  ) then
    raise exception 'read it before you rank it';
  end if;

  insert into preferences (contention_id, profile_id, proposal_id)
  values (p_contention_id, auth.uid(), p_proposal_id)
  on conflict (contention_id, profile_id) do update
    set proposal_id = excluded.proposal_id, updated_at = now();
end;
$$;

create or replace function clear_preference(p_contention_id uuid)
returns void language sql security definer
set search_path = public, extensions as $$
  delete from preferences
   where contention_id = p_contention_id and profile_id = auth.uid();
$$;

-- -----------------------------------------------------------------------------
-- Resolving
--
-- Runs itself: the moment the last member closes, the set resolves. Nobody
-- picks the moment, for the same reason nobody picks when a place proposal
-- closes — a human holding the stopwatch is a human with a thumb on the scale.
-- -----------------------------------------------------------------------------

create or replace function resolve_contention_if_ready(p_contention_id uuid)
returns void language plpgsql security definer
set search_path = public, extensions as $$
declare v_open integer; v_group uuid;
begin
  select count(*)::int into v_open
    from contention_members m
    join proposals p on p.id = m.proposal_id
   where m.contention_id = p_contention_id
     and p.closed_at is null;

  if v_open > 0 then return; end if;

  update contentions set resolved_at = now()
   where id = p_contention_id and resolved_at is null;

  if found then
    select group_id into v_group from contentions where id = p_contention_id;
    perform record_ledger_event(v_group, 'contention.resolved', 'proposal',
      (select proposal_id from contention_members
        where contention_id = p_contention_id limit 1),
      jsonb_build_object('contention', p_contention_id));
  end if;
end;
$$;

create or replace function close_contention_on_proposal_close()
returns trigger language plpgsql security definer
set search_path = public, extensions as $$
declare v_c uuid;
begin
  if new.closed_at is null or old.closed_at is not null then return new; end if;

  select contention_id into v_c from contention_members where proposal_id = new.id;
  if v_c is not null then perform resolve_contention_if_ready(v_c); end if;
  return new;
end;
$$;

drop trigger if exists proposals_resolve_contention on proposals;
create trigger proposals_resolve_contention after update of closed_at on proposals
  for each row execute function close_contention_on_proposal_close();

-- -----------------------------------------------------------------------------
-- Where a set stands
--
-- Before it resolves: the question, the members, and how many people have
-- named a choice. Never which choice. After it resolves: the order.
-- -----------------------------------------------------------------------------

drop function if exists contention_standing(uuid);
create or replace function contention_standing(p_contention_id uuid)
returns table (
  proposal_id  uuid,
  title        text,
  status       proposal_status,
  passed       boolean,
  preferences  integer,
  order_position integer,
  revealed     boolean,
  mine         boolean
)
language sql security definer stable set search_path = public, extensions as $$
  with c as (select * from contentions where id = p_contention_id),
  m as (
    select cm.proposal_id, p.title, p.status,
           p.status in ('passed', 'executing', 'completed') as passed,
           (select count(*)::int from preferences pf
             where pf.contention_id = p_contention_id
               and pf.proposal_id = cm.proposal_id) as votes,
           exists (
             select 1 from preferences pf
              where pf.contention_id = p_contention_id
                and pf.proposal_id = cm.proposal_id
                and pf.profile_id = auth.uid()
           ) as mine
    from contention_members cm
    join proposals p on p.id = cm.proposal_id
    where cm.contention_id = p_contention_id
  )
  select
    m.proposal_id,
    m.title,
    m.status,
    m.passed,
    -- Hidden until the whole set has closed. A running total is a bandwagon.
    case when c.resolved_at is not null then m.votes end,
    case when c.resolved_at is not null and m.passed
         then rank() over (
                partition by (c.resolved_at is not null and m.passed)
                order by m.votes desc, m.title
              )::int
    end,
    c.resolved_at is not null,
    m.mine
  from m cross join c
  where exists (select 1 from c where can_reach_proposal(m.proposal_id))
  order by m.votes desc, m.title;
$$;

grant execute on function contention_standing(uuid) to authenticated;

-- The contention a proposal is in, if any — for the panel on its own page.
drop function if exists contention_for(uuid);
create or replace function contention_for(p_proposal_id uuid)
returns table (
  contention_id uuid,
  question      text,
  note          text,
  members       integer,
  responded     integer,
  resolved_at   timestamptz
)
language sql security definer stable set search_path = public, extensions as $$
  select
    c.id, c.question, c.note,
    (select count(*)::int from contention_members where contention_id = c.id),
    -- How many people have named a choice. A count is fine; rule 3 draws the
    -- line at the averages, not at knowing whether anybody has turned up.
    (select count(*)::int from preferences where contention_id = c.id),
    c.resolved_at
  from contention_members m
  join contentions c on c.id = m.contention_id
  where m.proposal_id = p_proposal_id
    and can_reach_proposal(p_proposal_id);
$$;

grant execute on function contention_for(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Policies
--
-- The sets and their membership are readable by anyone the proposals are
-- addressed to. The preferences are not readable at all: every question worth
-- asking about them is answered by the two functions above, which withhold the
-- counts until the set has closed. A select policy that let a client read the
-- rows would make that withholding decorative.
-- -----------------------------------------------------------------------------

alter table contentions enable row level security;
alter table contention_members enable row level security;
alter table preferences enable row level security;

drop policy if exists contentions_read on contentions;
create policy contentions_read on contentions for select
  using (
    exists (
      select 1 from contention_members m
       where m.contention_id = contentions.id
         and can_reach_proposal(m.proposal_id)
    )
  );

drop policy if exists contention_members_read on contention_members;
create policy contention_members_read on contention_members for select
  using (can_reach_proposal(proposal_id));

-- Your own, and only ever your own.
drop policy if exists preferences_own on preferences;
create policy preferences_own on preferences for select
  using (profile_id = auth.uid());

grant select on contentions, contention_members, preferences to authenticated;

grant execute on function
  open_contention(text, uuid, uuid, text),
  add_to_contention(uuid, uuid),
  set_preference(uuid, uuid),
  clear_preference(uuid),
  resolve_contention_if_ready(uuid)
to authenticated;

-- -----------------------------------------------------------------------------
-- Activation takes its turn
--
-- The whole point, and the only place a preference has any force at all.
--
-- A passed proposal in a resolved contention waits until everything the group
-- preferred over it has either been activated, withdrawn or failed. So the
-- group's second choice is not a consolation — it is the thing that happens
-- when the first choice cannot gather what it needs, chosen in advance by
-- everybody, rather than argued about in the wreckage.
--
-- Note what is NOT here: nothing consults a preference to decide whether a
-- proposal passed. That was settled by close_proposal() on its own terms and
-- a contention cannot reach back into it.
-- -----------------------------------------------------------------------------

create or replace function activate_proposal(p_proposal_id uuid)
returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare
  v_p       record;
  v_ready   boolean;
  v_project uuid;
  v_c       record;
  v_ahead   integer;
begin
  select * into v_p from proposals where id = p_proposal_id;
  if not found then raise exception 'no such proposal'; end if;
  if not can_reach_proposal(p_proposal_id) then
    raise exception 'this proposal is not addressed to you';
  end if;

  if v_p.status <> 'passed' then
    raise exception 'only a proposal that has passed can be activated';
  end if;

  -- Is anything the group preferred over this still waiting for its turn?
  select c.* into v_c
    from contention_members m
    join contentions c on c.id = m.contention_id
   where m.proposal_id = p_proposal_id;

  if found and v_c.resolved_at is not null then
    with mine as (
      select count(*)::int as votes from preferences
       where contention_id = v_c.id and proposal_id = p_proposal_id
    )
    select count(*)::int into v_ahead
      from contention_members m
      join proposals p on p.id = m.proposal_id
      cross join mine
     where m.contention_id = v_c.id
       and m.proposal_id <> p_proposal_id
       -- Still holding its place, or already taken it. A sibling that has
       -- activated does not release the others: the nine hundred is spent and
       -- the question is answered. Only standing down releases them.
       and p.status in ('passed', 'executing', 'completed')
       and (select count(*)::int from preferences pf
             where pf.contention_id = v_c.id and pf.proposal_id = m.proposal_id)
           > mine.votes;

    if v_ahead > 0 then
      raise exception 'the group preferred another answer to this question — it goes first, and this becomes activatable if it stands down';
    end if;
  end if;

  select ready into v_ready from activation_standing(p_proposal_id);
  if not coalesce(v_ready, false) then
    raise exception 'this proposal still needs resources or people that nobody has committed';
  end if;

  insert into projects (proposal_id, group_id, title, expected_outcome,
                        budget_committed, status, started_at)
  select p.id, p.group_id, p.title, p.summary,
         coalesce((select sum(c2.quantity) from commitments c2
                    join proposal_needs pn on pn.id = c2.need_id
                   where c2.proposal_id = p.id and pn.kind = 'money'
                     and c2.status in ('pledged','honoured')), 0),
         'executing', now()
    from proposals p where p.id = p_proposal_id
  on conflict (proposal_id) do nothing
  returning id into v_project;

  if v_project is null then
    select id into v_project from projects where proposal_id = p_proposal_id;
  end if;

  update proposals set status = 'executing' where id = p_proposal_id;

  perform record_ledger_event(v_p.group_id, 'project.started', 'project', v_project,
    jsonb_build_object('activated_from', p_proposal_id, 'scope', v_p.scope, 'place', v_p.place));

  return v_project;
end;
$$;

grant execute on function activate_proposal(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Standing down
--
-- A proposal that passed and then could not gather what it needed has no way
-- to say so. It sits at `passed` indefinitely, and inside a contention it
-- holds everything behind it there too.
--
-- So: the author or a steward can stand it down, in writing. Not a deletion
-- and not a failure — it passed, and the record keeps saying it passed. What
-- changes is that it stops waiting, which is the signal the next answer needs.
--
-- Twenty characters and attributed, like every other thing here that closes a
-- door on somebody. "Could not raise the money by the summer" is a reason;
-- silence is how a group loses track of what it decided.
-- -----------------------------------------------------------------------------

create or replace function stand_down_proposal(p_proposal_id uuid, p_reason text)
returns void language plpgsql security definer
set search_path = public, extensions as $$
declare v_p record; v_c uuid;
begin
  select * into v_p from proposals where id = p_proposal_id;
  if not found then raise exception 'no such proposal'; end if;

  if v_p.status <> 'passed' then
    raise exception 'only something that passed and is still waiting can stand down';
  end if;

  if not can_steward_proposal(p_proposal_id) then
    raise exception 'only the author, or a steward of the group, can stand a proposal down';
  end if;

  if length(btrim(coalesce(p_reason, ''))) < 20 then
    raise exception 'say why it is not going ahead — the group decided this and is owed a reason';
  end if;

  update proposals set status = 'withdrawn' where id = p_proposal_id;

  perform record_ledger_event(v_p.group_id, 'proposal.stood_down', 'proposal', p_proposal_id,
    jsonb_build_object('reason', btrim(p_reason)));

  select contention_id into v_c from contention_members where proposal_id = p_proposal_id;
  if v_c is not null then
    perform record_ledger_event(v_p.group_id, 'contention.advanced', 'proposal', p_proposal_id,
      jsonb_build_object('contention', v_c));
  end if;
end;
$$;

grant execute on function stand_down_proposal(uuid, text) to authenticated;
