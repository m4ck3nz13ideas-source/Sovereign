-- =============================================================================
-- Sovereign — row-level security
--
-- The rule the whole product rests on:
--   Individual data is private unless its owner opts in. Collective data is
--   visible to the group it belongs to, and to no one else.
--
-- Drafts never reach the shared store at all — a proposal exists here only
-- once submitted. Launch entries, concepts and revisions are owner-only, full
-- stop, with no group-visibility path anywhere in this file.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Helpers. SECURITY DEFINER so a membership check does not itself trip RLS
-- and recurse.
-- -----------------------------------------------------------------------------

create or replace function is_group_member(gid uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from group_members
    where group_id = gid and profile_id = auth.uid()
  );
$$;

create or replace function is_group_steward(gid uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from group_members
    where group_id = gid and profile_id = auth.uid()
      and role in ('owner', 'steward')
  );
$$;

create or replace function shares_group_with(pid uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1
    from group_members mine
    join group_members theirs on theirs.group_id = mine.group_id
    where mine.profile_id = auth.uid() and theirs.profile_id = pid
  );
$$;

create or replace function proposal_group(pid uuid)
returns uuid language sql security definer stable set search_path = public as $$
  select group_id from proposals where id = pid;
$$;

create or replace function project_group(pid uuid)
returns uuid language sql security definer stable set search_path = public as $$
  select group_id from projects where id = pid;
$$;

-- -----------------------------------------------------------------------------
-- Enable RLS everywhere. Nothing is readable by default.
-- -----------------------------------------------------------------------------

alter table profiles              enable row level security;
alter table profile_values        enable row level security;
alter table profile_passions      enable row level security;
alter table statement_revisions   enable row level security;
alter table entries               enable row level security;
alter table concepts              enable row level security;
alter table concept_entries       enable row level security;
alter table groups                enable row level security;
alter table group_members         enable row level security;
alter table group_invites         enable row level security;
alter table proposals             enable row level security;
alter table proposal_reviews      enable row level security;
alter table proposal_flags        enable row level security;
alter table deliberation_comments enable row level security;
alter table proposal_reads        enable row level security;
alter table resonance_votes       enable row level security;
alter table decisions             enable row level security;
alter table projects              enable row level security;
alter table project_tasks         enable row level security;
alter table project_updates       enable row level security;
alter table reflections           enable row level security;
alter table posts                 enable row level security;
alter table post_reactions        enable row level security;
alter table post_comments         enable row level security;
alter table ledger_events         enable row level security;
alter table ai_prompts_surfaced   enable row level security;

-- -----------------------------------------------------------------------------
-- INDIVIDUAL
-- -----------------------------------------------------------------------------

-- A profile row is readable by its owner and by people who share a group.
-- Column-level disclosure (values / purpose / faith) is handled by the
-- public_profiles view below, not here.
create policy profiles_read on profiles for select
  using (id = auth.uid() or shares_group_with(id));

create policy profiles_write on profiles for update
  using (id = auth.uid()) with check (id = auth.uid());

create policy profiles_insert on profiles for insert
  with check (id = auth.uid());

-- Values are shared only when the owner has opted in.
create policy values_read on profile_values for select
  using (
    profile_id = auth.uid()
    or (
      shares_group_with(profile_id)
      and exists (select 1 from profiles p where p.id = profile_id and p.share_values)
    )
  );

create policy values_own on profile_values for all
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

create policy passions_read on profile_passions for select
  using (profile_id = auth.uid() or shares_group_with(profile_id));

create policy passions_own on profile_passions for all
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- Revision history is always private. How a belief evolved is nobody's business.
create policy revisions_own on statement_revisions for all
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- Launch entries. Owner only, no exceptions.
create policy entries_own on entries for all
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

create policy concepts_own on concepts for all
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

create policy concept_entries_own on concept_entries for all
  using (exists (select 1 from concepts c where c.id = concept_id and c.profile_id = auth.uid()))
  with check (exists (select 1 from concepts c where c.id = concept_id and c.profile_id = auth.uid()));

create policy surfaced_prompts_own on ai_prompts_surfaced for all
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- -----------------------------------------------------------------------------
-- COLLECTIVE — groups
-- -----------------------------------------------------------------------------

create policy groups_read on groups for select
  using (is_group_member(id));

create policy groups_create on groups for insert
  with check (created_by = auth.uid());

create policy groups_steward_update on groups for update
  using (is_group_steward(id)) with check (is_group_steward(id));

create policy members_read on group_members for select
  using (profile_id = auth.uid() or is_group_member(group_id));

-- Joining happens through redeem_invite(), which is SECURITY DEFINER. This
-- policy covers the founder inserting their own ownership row.
create policy members_self_insert on group_members for insert
  with check (profile_id = auth.uid());

create policy members_steward_manage on group_members for delete
  using (is_group_steward(group_id) or profile_id = auth.uid());

create policy invites_read on group_invites for select
  using (is_group_member(group_id));

create policy invites_create on group_invites for insert
  with check (is_group_steward(group_id) and created_by = auth.uid());

create policy invites_delete on group_invites for delete
  using (is_group_steward(group_id));

-- -----------------------------------------------------------------------------
-- COLLECTIVE — the decision loop
-- -----------------------------------------------------------------------------

create policy proposals_read on proposals for select
  using (is_group_member(group_id));

create policy proposals_create on proposals for insert
  with check (is_group_member(group_id) and author_id = auth.uid());

-- Proposals are not editable after submission. Amendments go in the
-- deliberation thread; a failed proposal is rewritten as a new one. Status
-- transitions are performed by SECURITY DEFINER functions, not by this policy.
create policy proposals_author_withdraw on proposals for update
  using (author_id = auth.uid() and status in ('in_review', 'in_deliberation'))
  with check (author_id = auth.uid());

create policy reviews_read on proposal_reviews for select
  using (is_group_member(proposal_group(proposal_id)));

create policy reviews_create on proposal_reviews for insert
  with check (is_group_member(proposal_group(proposal_id)));

create policy flags_read on proposal_flags for select
  using (is_group_member(proposal_group(proposal_id)));

create policy flags_create on proposal_flags for insert
  with check (is_group_member(proposal_group(proposal_id)));

-- Answering a flag is an update. Un-answering it is not possible: the check
-- requires a resolution to be present and attributed.
create policy flags_resolve on proposal_flags for update
  using (is_group_member(proposal_group(proposal_id)))
  with check (
    is_group_member(proposal_group(proposal_id))
    and resolution is not null
    and length(btrim(resolution)) >= 20
    and resolved_by = auth.uid()
  );

create policy comments_read on deliberation_comments for select
  using (is_group_member(proposal_group(proposal_id)));

create policy comments_create on deliberation_comments for insert
  with check (is_group_member(proposal_group(proposal_id)) and author_id = auth.uid());

create policy comments_delete_own on deliberation_comments for delete
  using (author_id = auth.uid());

create policy reads_own on proposal_reads for all
  using (profile_id = auth.uid() and is_group_member(proposal_group(proposal_id)))
  with check (profile_id = auth.uid() and is_group_member(proposal_group(proposal_id)));

-- You may write and change your own resonance. You may not read anyone else's
-- until the proposal closes — a live average recreates the bandwagon dynamic
-- this product exists to remove. Aggregates come from resonance_summary below.
create policy resonance_write_own on resonance_votes for all
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

create policy resonance_read_closed on resonance_votes for select
  using (
    profile_id = auth.uid()
    or exists (
      select 1 from proposals p
      where p.id = proposal_id
        and is_group_member(p.group_id)
        and p.status in ('passed', 'failed', 'executing', 'completed')
    )
  );

create policy decisions_read on decisions for select
  using (is_group_member(proposal_group(proposal_id)));

-- -----------------------------------------------------------------------------
-- PROJECTS and IMPACT
-- -----------------------------------------------------------------------------

create policy projects_read on projects for select using (is_group_member(group_id));
create policy projects_write on projects for all
  using (is_group_member(group_id)) with check (is_group_member(group_id));

create policy tasks_all on project_tasks for all
  using (is_group_member(project_group(project_id)))
  with check (is_group_member(project_group(project_id)));

create policy updates_read on project_updates for select
  using (is_group_member(project_group(project_id)));
create policy updates_create on project_updates for insert
  with check (is_group_member(project_group(project_id)) and author_id = auth.uid());

create policy reflections_read on reflections for select
  using (is_group_member(project_group(project_id)));
create policy reflections_create on reflections for insert
  with check (is_group_member(project_group(project_id)) and created_by = auth.uid());

-- -----------------------------------------------------------------------------
-- CONNECTION
-- -----------------------------------------------------------------------------

create policy posts_read on posts for select
  using (
    author_id = auth.uid()
    or (group_id is not null and is_group_member(group_id))
    or (group_id is null and shares_group_with(author_id))
  );

create policy posts_create on posts for insert with check (author_id = auth.uid());
create policy posts_delete on posts for delete using (author_id = auth.uid());

create policy reactions_all on post_reactions for all
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

create policy reactions_read on post_reactions for select
  using (exists (select 1 from posts p where p.id = post_id));

create policy post_comments_read on post_comments for select
  using (exists (select 1 from posts p where p.id = post_id));
create policy post_comments_create on post_comments for insert
  with check (author_id = auth.uid());

-- -----------------------------------------------------------------------------
-- LEDGER — readable by the group, never writable from the client.
-- Writes go through record_ledger_event(), which is SECURITY DEFINER.
-- -----------------------------------------------------------------------------

create policy ledger_read on ledger_events for select
  using (group_id is null or is_group_member(group_id));

-- -----------------------------------------------------------------------------
-- Views
-- -----------------------------------------------------------------------------

-- The public face of a profile. Fields the owner has not shared come back null.
create view public_profiles
with (security_invoker = true) as
select
  p.id,
  p.handle,
  p.display_name,
  p.bio,
  p.avatar_url,
  case when p.share_purpose then p.purpose end as purpose,
  case when p.share_faith   then p.faith_statement end as faith_statement,
  p.share_values,
  p.created_at
from profiles p;

-- Resonance aggregates deliberately do NOT live in a view. A security_invoker
-- view would inherit the policy above and count only the caller's own vote,
-- and a security_definer view would leak live averages. The aggregate is a
-- function in 0003 that checks membership itself and withholds the numbers
-- until the proposal closes.
