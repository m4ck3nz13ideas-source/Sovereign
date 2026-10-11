-- 0049 — A decision can be shared (rule 45).
--
-- Mackenzie's direction (10 October 2026): make decisions shareable, so a
-- group can show the world what it decided and how, and a link someone sends
-- is the way most people will first see Sovereign.
--
-- THE SHAPE
--
--   * `decision_shares`: at most one live link per decided proposal. A random
--     token, who made it, when. Revoking deletes the row, so the link stops
--     working at once and a new share gets a new token.
--   * `share_decision(proposal)`: only once it is decided (rule 3 — nothing
--     before close). For a group's proposal, a steward of that group: the
--     decision is the group's, so the group's stewards choose. For a proposal
--     addressed to a place, its author.
--   * `unshare_decision(proposal)`: the same people, or whoever shared it.
--   * `shared_decision(token)`: readable signed out. Returns the proposal's
--     title and summary, the outcome, the date, the scale, the number of
--     voices and the decision's own numbers — and nothing that names anybody.
--     Below `share_floor()` voices the averages and spread are withheld too:
--     an average of three is three people's answers with a thin disguise.
--
-- WHAT IT NEVER DOES
--
--   Return a name, a handle, a group's name, a response, a note, an id or a
--   time anyone acted. `43_shared_decisions.sql` fails if the function's
--   columns grow one. Nothing is public until somebody with the right to
--   share chooses to; nothing undecided can be shared at all.

create table if not exists decision_shares (
  proposal_id uuid primary key references proposals(id) on delete cascade,
  token       text not null unique,
  shared_by   uuid references profiles(id) on delete set null,
  shared_at   timestamptz not null default now()
);

alter table decision_shares enable row level security;

-- The people who could reach the proposal can see that it is shared (and the
-- link). Writes go through the functions below only.
drop policy if exists decision_shares_read on decision_shares;
create policy decision_shares_read on decision_shares
  for select using (can_reach_proposal(proposal_id));

grant select on decision_shares to authenticated;

create or replace function share_floor()
returns int language sql immutable as $$ select 5 $$;

create or replace function may_share_decision(p_proposal_id uuid)
returns boolean language sql stable security definer set search_path = public, extensions as $$
  select exists (
    select 1 from proposals p
     where p.id = p_proposal_id
       and auth.uid() is not null
       and (
         (p.group_id is not null and is_group_steward(p.group_id))
         or (p.group_id is null and p.author_id = auth.uid())
       )
  );
$$;

grant execute on function may_share_decision(uuid) to authenticated;

create or replace function share_decision(p_proposal_id uuid)
returns text language plpgsql volatile security definer set search_path = public, extensions as $$
declare
  v_token text;
begin
  if auth.uid() is null then raise exception 'sign in first'; end if;
  if not may_share_decision(p_proposal_id) then
    raise exception 'only a steward of the group, or the author of a proposal to a place, can share its decision';
  end if;
  if not exists (select 1 from decisions where proposal_id = p_proposal_id) then
    raise exception 'nothing to share until it is decided';
  end if;

  select token into v_token from decision_shares where proposal_id = p_proposal_id;
  if v_token is not null then return v_token; end if;

  v_token := translate(encode(gen_random_bytes(12), 'base64'), '+/', '-_');
  insert into decision_shares (proposal_id, token, shared_by)
  values (p_proposal_id, v_token, auth.uid())
  on conflict (proposal_id) do nothing;

  select token into v_token from decision_shares where proposal_id = p_proposal_id;
  return v_token;
end;
$$;

revoke all on function share_decision(uuid) from public, anon;
grant execute on function share_decision(uuid) to authenticated;

create or replace function unshare_decision(p_proposal_id uuid)
returns void language plpgsql volatile security definer set search_path = public, extensions as $$
begin
  if auth.uid() is null then raise exception 'sign in first'; end if;
  if not (may_share_decision(p_proposal_id)
          or exists (select 1 from decision_shares
                      where proposal_id = p_proposal_id and shared_by = auth.uid())) then
    raise exception 'only the people who can share this decision can stop sharing it';
  end if;
  delete from decision_shares where proposal_id = p_proposal_id;
end;
$$;

revoke all on function unshare_decision(uuid) from public, anon;
grant execute on function unshare_decision(uuid) to authenticated;

create or replace function shared_decision(p_token text)
returns table (
  title          text,
  summary        text,
  rationale      text,
  outcome        text,
  status         text,
  scale          text,
  by_group       boolean,
  decided_on     date,
  voices         int,
  members        int,
  participation  numeric,
  alignment      numeric,
  confidence     numeric,
  urgency        numeric,
  spread         numeric,
  split          boolean
)
language sql stable security definer set search_path = public, extensions as $$
  select p.title, p.summary, d.rationale_summary,
         d.outcome::text, p.status::text, p.scope::text,
         p.group_id is not null,
         d.decided_at::date,
         d.voter_count,
         case when p.group_id is not null then d.member_count end,
         case when p.group_id is not null then d.participation end,
         case when d.voter_count >= share_floor() then d.avg_alignment end,
         case when d.voter_count >= share_floor() then d.avg_confidence end,
         case when d.voter_count >= share_floor() then d.avg_urgency end,
         case when d.voter_count >= share_floor() then d.dispersion end,
         case when d.voter_count >= share_floor() then d.polarized end
    from decision_shares s
    join proposals p on p.id = s.proposal_id
    join decisions d on d.proposal_id = p.id
   where s.token = p_token
     and length(p_token) between 8 and 64;
$$;

revoke all on function shared_decision(text) from public;
grant execute on function shared_decision(text) to anon, authenticated;

-- Rule 42: every column pointing at a profile is classified.
insert into private.data_map (table_name, column_name, export, erase, erase_where, ord, why) values
  ('decision_shares', 'shared_by', true, 'keep', null, 100, 'a link to a group''s decision stays the group''s')
on conflict (table_name, column_name) do nothing;

comment on table decision_shares is
  'Rule 45: one public link per decided proposal, made by a steward (group) or the author (place). shared_decision() returns no names, responses or notes, and no averages below share_floor().';
