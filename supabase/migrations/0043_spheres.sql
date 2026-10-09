-- 0043 — Spheres (rule 40).
--
-- Mackenzie's direction: categories for proposals, the way a government
-- splits its work and its tax between ministries. The whitepaper already
-- names them: the Spheres of Civilization — Health, Education, Ecology,
-- Justice, Economy, Culture, Infrastructure and Tech. Each Sphere carries a
-- handful of areas named the way ministries and departments are, so "Health ·
-- Mental health" reads the way people already think about public work.
--
-- He chose tags now and budget envelopes later. So, for now:
--
--   * A proposal has ONE main Sphere, optionally an area within it, and up to
--     two more Spheres it also touches. Most real proposals cross Spheres (a
--     heat pump for the hall is Infrastructure, Ecology and Economy), so one
--     box would be a lie; three is enough to say where it lives.
--   * The author tags it, and may re-tag it until anybody has responded.
--     After that it is fixed, like the conditions, so nobody re-files a
--     proposal mid-vote into a Sphere where it reads better.
--   * A person can follow Spheres. Who follows what is theirs alone: no
--     policy lets anybody read another person's follows, and nothing counts
--     them. A follower count per Sphere would be a popularity board for
--     ministries, and the first thing anybody would do with one is campaign.
--
-- What a Sphere is not, deliberately:
--
--   * Not a rule. We have just moved away from fixed rules by scale; a Sphere
--     must not bring them back by the side door ("Health proposals need 60%").
--     No decision, condition, law or resonance function reads a Sphere —
--     `37_spheres.sql` reads every function in the schema and fails if one
--     outside this migration mentions it. The Sphere informs the AI (it is in
--     the proposal text the review reads) and informs people. That is all.
--   * Not yet money. Budget envelopes — deciding how shared money splits
--     between Spheres, then proposals competing within their envelope — are
--     the next step, and will have to break that test on purpose.

------------------------------------------------------------------- the spheres

create table if not exists spheres (
  id          text primary key check (id ~ '^[a-z]+$'),
  ordinal     int  not null unique,
  name        text not null,
  description text not null
);

create table if not exists sphere_areas (
  id         text primary key check (id ~ '^[a-z]+\.[a-z_]+$'),
  sphere_id  text not null references spheres(id),
  ordinal    int  not null,
  name       text not null,
  unique (sphere_id, ordinal),
  check (split_part(id, '.', 1) = sphere_id)
);

insert into spheres (id, ordinal, name, description) values
  ('health',         1, 'Health',         'Bodies and minds: care, prevention, food and wellbeing.'),
  ('education',      2, 'Education',      'Learning at every age, from first words to new trades.'),
  ('ecology',        3, 'Ecology',        'The living world: climate, nature, water, land and animals.'),
  ('justice',        4, 'Justice',        'Rights, safety, fairness, and repairing harm.'),
  ('economy',        5, 'Economy',        'Work, trade, shared money and making ends meet.'),
  ('culture',        6, 'Culture',        'Arts, heritage, sport, faith and how we gather.'),
  ('infrastructure', 7, 'Infrastructure', 'Homes, transport, utilities and shared spaces.'),
  ('tech',           8, 'Tech',           'Digital services, data, AI and research.')
on conflict (id) do update set ordinal = excluded.ordinal, name = excluded.name, description = excluded.description;

insert into sphere_areas (id, sphere_id, ordinal, name) values
  ('health.public_health',      'health', 1, 'Public health'),
  ('health.mental_health',      'health', 2, 'Mental health'),
  ('health.care',               'health', 3, 'Hospitals and clinics'),
  ('health.social_care',        'health', 4, 'Social care'),
  ('health.food',               'health', 5, 'Food and nutrition'),

  ('education.early_years',     'education', 1, 'Early years'),
  ('education.schools',         'education', 2, 'Schools'),
  ('education.higher',          'education', 3, 'Further and higher education'),
  ('education.skills',          'education', 4, 'Skills and lifelong learning'),
  ('education.libraries',       'education', 5, 'Libraries'),

  ('ecology.climate',           'ecology', 1, 'Climate and energy'),
  ('ecology.nature',            'ecology', 2, 'Nature and biodiversity'),
  ('ecology.water',             'ecology', 3, 'Water'),
  ('ecology.waste',             'ecology', 4, 'Waste and recycling'),
  ('ecology.land',              'ecology', 5, 'Farming and land'),
  ('ecology.animals',           'ecology', 6, 'Animal welfare'),

  ('justice.rights',            'justice', 1, 'Rights and equality'),
  ('justice.safety',            'justice', 2, 'Safety and policing'),
  ('justice.courts',            'justice', 3, 'Courts and disputes'),
  ('justice.restoration',       'justice', 4, 'Prisons and restoration'),

  ('economy.work',              'economy', 1, 'Work and wages'),
  ('economy.trade',             'economy', 2, 'Business and trade'),
  ('economy.public_money',      'economy', 3, 'Tax and public money'),
  ('economy.welfare',           'economy', 4, 'Welfare and support'),
  ('economy.cost_of_living',    'economy', 5, 'Cost of living'),

  ('culture.arts',              'culture', 1, 'Arts'),
  ('culture.heritage',          'culture', 2, 'Heritage'),
  ('culture.sport',             'culture', 3, 'Sport and recreation'),
  ('culture.faith',             'culture', 4, 'Faith and community'),
  ('culture.media',             'culture', 5, 'Media'),

  ('infrastructure.housing',    'infrastructure', 1, 'Housing and planning'),
  ('infrastructure.transport',  'infrastructure', 2, 'Transport'),
  ('infrastructure.utilities',  'infrastructure', 3, 'Utilities'),
  ('infrastructure.spaces',     'infrastructure', 4, 'Public spaces'),
  ('infrastructure.connectivity','infrastructure', 5, 'Digital connectivity'),

  ('tech.services',             'tech', 1, 'Digital services'),
  ('tech.data',                 'tech', 2, 'Data and privacy'),
  ('tech.ai',                   'tech', 3, 'AI'),
  ('tech.research',             'tech', 4, 'Research and science'),
  ('tech.online_safety',        'tech', 5, 'Online safety')
on conflict (id) do update set sphere_id = excluded.sphere_id, ordinal = excluded.ordinal, name = excluded.name;

alter table spheres enable row level security;
alter table sphere_areas enable row level security;

-- Readable by anybody, signed in or not (the public site lists them too).
-- No insert, update or delete policy: the list changes with a migration.
drop policy if exists spheres_read on spheres;
create policy spheres_read on spheres for select using (true);
drop policy if exists sphere_areas_read on sphere_areas;
create policy sphere_areas_read on sphere_areas for select using (true);

------------------------------------------------------------ a proposal's tags

alter table proposals add column if not exists sphere text references spheres(id);
alter table proposals add column if not exists sphere_area text references sphere_areas(id);
alter table proposals add column if not exists spheres_also text[] not null default '{}';

alter table proposals drop constraint if exists proposals_spheres_also_len;
alter table proposals add constraint proposals_spheres_also_len
  check (cardinality(spheres_also) <= 2);
alter table proposals drop constraint if exists proposals_sphere_needed;
alter table proposals add constraint proposals_sphere_needed
  check (sphere is not null or (sphere_area is null and cardinality(spheres_also) = 0));

create index if not exists proposals_sphere_idx on proposals (sphere, status, submitted_at desc);
create index if not exists proposals_spheres_also_idx on proposals using gin (spheres_also);

-- Whether anybody has responded. Security definer because a responder's row
-- is not visible to the author (rule 3) — the count is not the author's to
-- read, only whether there is one.
create or replace function proposal_has_responses(p_proposal uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from resonance_votes where proposal_id = p_proposal);
$$;

-- The shape a check constraint cannot see: the area belongs to the main
-- Sphere, the others are real Spheres, distinct, and not the main one again.
-- And the timing: re-tagging is the author's, and only until anybody has
-- responded.
create or replace function check_proposal_spheres()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_owner name;
begin
  if new.sphere_area is not null
     and not exists (select 1 from sphere_areas where id = new.sphere_area and sphere_id = new.sphere) then
    raise exception 'that area belongs to a different Sphere';
  end if;
  if exists (select 1 from unnest(new.spheres_also) s where s not in (select id from spheres)) then
    raise exception 'not a Sphere';
  end if;
  if new.sphere = any (new.spheres_also) then
    raise exception 'the main Sphere is already the main one';
  end if;
  if cardinality(new.spheres_also) <> (select count(distinct s) from unnest(new.spheres_also) s) then
    raise exception 'each Sphere once';
  end if;

  if tg_op = 'UPDATE'
     and (new.sphere is distinct from old.sphere
          or new.sphere_area is distinct from old.sphere_area
          or new.spheres_also is distinct from old.spheres_also) then
    select pg_get_userbyid(relowner) into v_owner from pg_class where oid = tg_relid;
    if current_user <> v_owner then
      if auth.uid() is distinct from old.author_id then
        raise exception 'only the author tags a proposal';
      end if;
      if proposal_has_responses(old.id) then
        raise exception 'people have responded, so where this proposal sits is fixed';
      end if;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists proposals_check_spheres on proposals;
create trigger proposals_check_spheres before insert or update on proposals
  for each row execute function check_proposal_spheres();

------------------------------------------------------------- following one

create table if not exists sphere_follows (
  profile_id uuid not null default auth.uid() references profiles(id) on delete cascade,
  sphere_id  text not null references spheres(id),
  created_at timestamptz not null default now(),
  primary key (profile_id, sphere_id)
);

alter table sphere_follows enable row level security;

-- Yours alone. No policy reads anybody else's, and nothing counts them.
drop policy if exists sphere_follows_own_read on sphere_follows;
create policy sphere_follows_own_read on sphere_follows
  for select using (profile_id = auth.uid());
drop policy if exists sphere_follows_own_insert on sphere_follows;
create policy sphere_follows_own_insert on sphere_follows
  for insert with check (profile_id = auth.uid());
drop policy if exists sphere_follows_own_delete on sphere_follows;
create policy sphere_follows_own_delete on sphere_follows
  for delete using (profile_id = auth.uid());

grant select on spheres, sphere_areas to anon, authenticated;
grant select, insert, delete on sphere_follows to authenticated;

comment on table spheres is
  'The Spheres of Civilization (rule 40). Tags that inform people and the AI; no decision function reads them.';
comment on table sphere_follows is
  'Which Spheres a person follows. Private to them; never counted.';
