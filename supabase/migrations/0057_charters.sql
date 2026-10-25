-- =============================================================================
-- 0057 — A group has a charter, and from three members it changes by proposal
-- =============================================================================
--
-- Mackenzie, 25 October 2026, agreeing the proposal of the 23rd: replace the
-- three steward-set numbers (alignment, participation, values floor) with a
-- group CHARTER — what the group is for, what it is trying to do, the values
-- it holds, who may invite people in, who may propose, and the context the
-- AI should weigh when it sets each proposal's conditions. A few things stay
-- fixed for every group and are not in any charter: the Universal Laws, the
-- release threshold, critical flags and secret ballots.
--
-- THE CHARTER IS A DECISION, NOT A SETTING
--
-- While a group is just its founders — fewer than three members — its
-- stewards write the charter directly, usually from a template. From three
-- members on, it changes only by a group proposal that carries
-- `charter_change`: read against the laws, released, responded to and passed
-- like anything else, and enacted the moment it passes. `guard_charter()`
-- refuses a direct edit, and every version is kept in `charter_revisions`,
-- append-only, with who and — where there was one — which proposal.
--
-- Why enacted on passing, when rule 9 says passing is not starting? Because
-- rule 9 exists for resources: a project needs people against its needs
-- before it starts. A change to a group's own rules needs nobody to carry
-- anything; waiting for a pledge would only leave the group running on a
-- charter it has already replaced.
--
-- The old threshold columns stay — proposals from before 0039 are still
-- decided by them (0056) — but nothing in the app sets them any more.
--
-- Also closed here: `members_self_insert` let any signed-in person insert
-- themselves into any group, in any role, given its id. Joining has gone
-- through `redeem_invite()` and founding through `create_group()`, both
-- security definer, since 0003; the policy had nothing left to do but be a
-- side door.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- The side door
-- -----------------------------------------------------------------------------

drop policy if exists members_self_insert on group_members;

-- -----------------------------------------------------------------------------
-- The charter's own fields (purpose, goal and group_values already exist)
-- -----------------------------------------------------------------------------

alter table groups add column if not exists inviters  text not null default 'stewards';
alter table groups add column if not exists proposers text not null default 'members';
alter table groups add column if not exists ai_context text;
alter table groups add column if not exists template  text;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'groups_inviters_kind') then
    alter table groups add constraint groups_inviters_kind check (inviters in ('stewards', 'members'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'groups_proposers_kind') then
    alter table groups add constraint groups_proposers_kind check (proposers in ('stewards', 'members'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'groups_ai_context_len') then
    alter table groups add constraint groups_ai_context_len
      check (ai_context is null or length(btrim(ai_context)) between 1 and 1200);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'groups_template_kind') then
    alter table groups add constraint groups_template_kind
      check (template is null or template in ('friends', 'coop', 'neighbourhood', 'project', 'custom'));
  end if;
end $$;

-- The size at which the charter stops being the founders' to write.
create or replace function charter_founding_size()
returns integer language sql immutable set search_path = public, extensions as $$
  select 3
$$;

create or replace function charter_is_founding(p_group uuid)
returns boolean language sql stable security definer set search_path = public, extensions as $$
  select (select count(*) from group_members where group_id = p_group) < charter_founding_size()
$$;

-- -----------------------------------------------------------------------------
-- Every version, kept
-- -----------------------------------------------------------------------------

create table if not exists charter_revisions (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid not null references groups(id) on delete cascade,
  revision    integer not null,
  purpose     text,
  goal        text,
  group_values text[] not null default '{}',
  inviters    text not null,
  proposers   text not null,
  ai_context  text,
  changed_by  uuid references profiles(id) on delete set null,
  proposal_id uuid references proposals(id) on delete set null,
  created_at  timestamptz not null default now(),
  unique (group_id, revision)
);

alter table charter_revisions enable row level security;
revoke insert, update, delete, truncate on charter_revisions from public, anon, authenticated;
drop policy if exists charter_revisions_read on charter_revisions;
create policy charter_revisions_read on charter_revisions
  for select using (is_group_member(group_id));

create or replace function record_charter_revision()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
begin
  if tg_op = 'UPDATE'
     and new.purpose      is not distinct from old.purpose
     and new.goal         is not distinct from old.goal
     and new.group_values is not distinct from old.group_values
     and new.inviters     is not distinct from old.inviters
     and new.proposers    is not distinct from old.proposers
     and new.ai_context   is not distinct from old.ai_context then
    return new;
  end if;

  insert into charter_revisions (group_id, revision, purpose, goal, group_values,
                                 inviters, proposers, ai_context, changed_by, proposal_id)
  values (new.id,
          coalesce((select max(revision) from charter_revisions where group_id = new.id), 0) + 1,
          new.purpose, new.goal, new.group_values, new.inviters, new.proposers, new.ai_context,
          auth.uid(),
          nullif(current_setting('sovereign.charter_proposal', true), '')::uuid);
  return new;
end;
$$;

drop trigger if exists groups_charter_revision on groups;
create trigger groups_charter_revision
  after insert or update on groups
  for each row execute function record_charter_revision();

-- Revision 1 for every group that already exists.
insert into charter_revisions (group_id, revision, purpose, goal, group_values, inviters, proposers, ai_context, changed_by)
select g.id, 1, g.purpose, g.goal, g.group_values, g.inviters, g.proposers, g.ai_context, g.created_by
  from groups g
 where not exists (select 1 from charter_revisions r where r.group_id = g.id);

-- Rule 42: every column that points at a profile is classified.
insert into private.data_map (table_name, column_name, export, erase, erase_where, ord, why) values
  ('charter_revisions', 'changed_by', true, 'keep', null, 100, 'a group''s charter history stays the group''s')
on conflict (table_name, column_name) do nothing;

-- -----------------------------------------------------------------------------
-- From three members, by proposal only
-- -----------------------------------------------------------------------------

create or replace function guard_charter()
returns trigger language plpgsql set search_path = public, extensions as $$
begin
  if new.purpose      is not distinct from old.purpose
     and new.goal         is not distinct from old.goal
     and new.group_values is not distinct from old.group_values
     and new.inviters     is not distinct from old.inviters
     and new.proposers    is not distinct from old.proposers
     and new.ai_context   is not distinct from old.ai_context then
    return new;
  end if;

  if coalesce(current_setting('sovereign.charter_enact', true), '') = 'on' then
    return new;
  end if;

  if not charter_is_founding(new.id) then
    raise exception 'from % members a group''s charter changes only by a passed proposal', charter_founding_size();
  end if;
  return new;
end;
$$;

drop trigger if exists groups_guard_charter on groups;
create trigger groups_guard_charter
  before update on groups
  for each row execute function guard_charter();

-- -----------------------------------------------------------------------------
-- A proposal that changes the charter
-- -----------------------------------------------------------------------------

alter table proposals add column if not exists charter_change jsonb;
alter table proposals add column if not exists charter_enacted_at timestamptz;

-- The change is a partial charter: only the fields it changes, each valid.
create or replace function charter_change_problem(p jsonb)
returns text language plpgsql immutable set search_path = public, extensions as $$
declare k text;
begin
  if p is null then return null; end if;
  if jsonb_typeof(p) <> 'object' or p = '{}'::jsonb then
    return 'a charter change names at least one thing it changes';
  end if;
  for k in select jsonb_object_keys(p) loop
    if k not in ('purpose', 'goal', 'group_values', 'inviters', 'proposers', 'ai_context') then
      return format('%s is not part of a charter', k);
    end if;
  end loop;
  if p ? 'inviters' and not (p->>'inviters' in ('stewards', 'members')) then
    return 'who may invite is stewards or members';
  end if;
  if p ? 'proposers' and not (p->>'proposers' in ('stewards', 'members')) then
    return 'who may propose is stewards or members';
  end if;
  if p ? 'group_values' and (jsonb_typeof(p->'group_values') <> 'array'
                             or jsonb_array_length(p->'group_values') > 12) then
    return 'a group holds up to twelve values';
  end if;
  if p ? 'goal' and jsonb_typeof(p->'goal') = 'string' and length(btrim(p->>'goal')) > 600 then
    return 'a goal is up to 600 characters';
  end if;
  if p ? 'ai_context' and jsonb_typeof(p->'ai_context') = 'string' and length(btrim(p->>'ai_context')) > 1200 then
    return 'the context for the AI is up to 1,200 characters';
  end if;
  return null;
end;
$$;

create or replace function check_proposal_charter()
returns trigger language plpgsql set search_path = public, extensions as $$
declare v_why text; v_g groups;
begin
  if tg_op = 'UPDATE' then
    if new.charter_change is distinct from old.charter_change then
      raise exception 'a charter change is fixed when the proposal is submitted';
    end if;
    return new;
  end if;

  -- Who may propose (the charter's own rule). A charter change is always
  -- open to every member: otherwise a stewards-only group could never be
  -- asked to stop being one.
  if new.group_id is not null and new.charter_change is null then
    select * into v_g from groups where id = new.group_id;
    if v_g.proposers = 'stewards' and not is_group_steward(new.group_id) then
      raise exception 'in this group only stewards propose, by its charter — any member can propose changing that';
    end if;
  end if;

  if new.charter_change is null then return new; end if;
  if new.group_id is null then
    raise exception 'only a group has a charter to change';
  end if;
  if new.amends_law is not null then
    raise exception 'a proposal amends a law or a charter, not both';
  end if;
  v_why := charter_change_problem(new.charter_change);
  if v_why is not null then raise exception '%', v_why; end if;
  return new;
end;
$$;

drop trigger if exists proposals_check_charter on proposals;
create trigger proposals_check_charter
  before insert or update on proposals
  for each row execute function check_proposal_charter();

-- Enacted when it passes.
create or replace function enact_charter_on_pass()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare c jsonb := new.charter_change; v_was text;
begin
  if new.charter_change is null or new.status <> 'passed' or old.status = 'passed' then
    return new;
  end if;

  v_was := coalesce(current_setting('sovereign.charter_enact', true), '');
  perform set_config('sovereign.charter_enact', 'on', true);
  perform set_config('sovereign.charter_proposal', new.id::text, true);

  update groups set
    purpose      = case when c ? 'purpose'      then nullif(btrim(c->>'purpose'), '') else purpose end,
    goal         = case when c ? 'goal'         then nullif(btrim(c->>'goal'), '') else goal end,
    group_values = case when c ? 'group_values'
                        then coalesce((select array_agg(btrim(v)) from jsonb_array_elements_text(c->'group_values') v
                                        where btrim(v) <> ''), '{}')
                        else group_values end,
    inviters     = case when c ? 'inviters'     then c->>'inviters' else inviters end,
    proposers    = case when c ? 'proposers'    then c->>'proposers' else proposers end,
    ai_context   = case when c ? 'ai_context'   then nullif(btrim(c->>'ai_context'), '') else ai_context end
  where id = new.group_id;

  perform set_config('sovereign.charter_enact', v_was, true);
  perform set_config('sovereign.charter_proposal', '', true);

  update proposals set charter_enacted_at = now() where id = new.id;

  perform record_ledger_event(new.group_id, 'group.charter_changed', 'proposal', new.id,
    jsonb_build_object('fields', (select jsonb_agg(k) from jsonb_object_keys(c) k)));
  return new;
end;
$$;

drop trigger if exists proposals_enact_charter on proposals;
create trigger proposals_enact_charter
  after update of status on proposals
  for each row execute function enact_charter_on_pass();

-- -----------------------------------------------------------------------------
-- Who may invite (the charter's own rule)
-- -----------------------------------------------------------------------------

create or replace function create_invite(p_group_id uuid, p_max_uses integer default 1, p_days integer default 14)
returns text language plpgsql security definer set search_path = public, extensions as $$
declare v_code text; v_inviters text;
begin
  select inviters into v_inviters from groups where id = p_group_id;
  if not (is_group_steward(p_group_id)
          or (v_inviters = 'members' and is_group_member(p_group_id))) then
    raise exception 'only a steward can invite to this group, by its charter';
  end if;

  v_code := lower(
    substr(encode(gen_random_bytes(9), 'base64'), 1, 12)
  );
  v_code := regexp_replace(v_code, '[^a-z0-9]', '', 'g');
  if length(v_code) < 8 then
    v_code := v_code || substr(md5(gen_random_uuid()::text), 1, 8 - length(v_code));
  end if;

  insert into group_invites (group_id, code, created_by, max_uses, expires_at)
  values (p_group_id, v_code, auth.uid(), greatest(p_max_uses, 1), now() + (p_days || ' days')::interval);

  return v_code;
end;
$$;

-- The direct insert path for invites follows the same rule.
drop policy if exists invites_create on group_invites;
create policy invites_create on group_invites for insert
  with check (created_by = auth.uid()
              and (is_group_steward(group_id)
                   or ((select inviters from groups where id = group_id) = 'members'
                       and is_group_member(group_id))));

-- -----------------------------------------------------------------------------
-- Grants (rule 46)
-- -----------------------------------------------------------------------------

revoke all on function charter_founding_size(), charter_is_founding(uuid),
  charter_change_problem(jsonb), record_charter_revision(), guard_charter(),
  check_proposal_charter(), enact_charter_on_pass() from public, anon;
grant execute on function charter_founding_size(), charter_is_founding(uuid),
  charter_change_problem(jsonb) to authenticated;
grant select on charter_revisions to authenticated;

notify pgrst, 'reload schema';
