-- =============================================================================
-- 0017 — THE MIRROR: where you and the audit differ
--
-- The Values screen has been promising this since the redesign and showing a
-- paragraph explaining that it does not exist. This is it.
--
--   "Sovereign does not measure moral alignment or score individuals against
--    the Universal Laws."           §Alignment System (Final Design)
--   "You can see how your actions align with your values and improve over
--    time."                          §Individual, Learning & Reflection
--
-- Those two are reconcilable in exactly one way, and the way is this: a
-- PRIVATE MIRROR, computed from your own actions, that describes a pattern and
-- draws no conclusion from it. Nobody else can read it, it is not stored, it
-- weights nothing, and there is no number anywhere that says whether you are
-- good.
--
-- WHAT IT ACTUALLY MEASURES
--
-- For each law: across the proposals YOU responded to where the audit found
-- that law in tension or violation, how did you respond — compared with how
-- you respond generally?
--
-- If you are consistently cooler on proposals that carried a stewardship
-- tension, that is a real fact about what you weight, and it came out of what
-- you did rather than what you said. If there is no difference, that is also a
-- real finding and the screen should say so rather than manufacture a signal.
--
-- WHY IT IS NOT A SCORE
--
-- It has no sign. Backing something the audit flagged is not a failing —
-- sometimes the audit is wrong, and a tension is explicitly not a violation.
-- Holding back from something clean is not virtue. What the number says is
-- "this law moves you", not "you are aligned with this law", and the copy on
-- the screen has to keep saying that because the difference is the whole
-- reason this is permissible at all.
--
-- AND IT REFUSES TO READ NOISE
--
-- Below mirror_floor() responses on a law, it reports the count and nothing
-- else. Four proposals is not a pattern, and a system that drew a line through
-- two points and showed it to somebody as a fact about themselves would be
-- doing real harm quietly.
-- =============================================================================

-- The smallest number of responses that can carry a reading. Deliberately a
-- function rather than a literal, so the one place it is decided is findable.
create or replace function mirror_floor()
returns integer language sql immutable as $$ select 4 $$;

grant execute on function mirror_floor() to authenticated;

-- -----------------------------------------------------------------------------
-- Your own, and there is no version of this that takes somebody else's id
--
-- That absence is the feature. A function with a profile parameter would be
-- one RLS mistake away from being a tool for sorting people, and somebody
-- would eventually write a screen for it.
-- -----------------------------------------------------------------------------

drop function if exists my_law_mirror();
create or replace function my_law_mirror()
returns table (
  law_id      text,
  -- Proposals you responded to where this law was in tension or violation.
  responses   integer,
  -- Your mean alignment on those.
  your_mean   numeric,
  -- Your mean alignment across everything you have responded to.
  your_baseline numeric,
  -- The difference. No sign is good or bad; see the header.
  divergence  numeric,
  -- False below the floor, and then the numbers above are null.
  enough      boolean
)
language sql security definer stable set search_path = public, extensions as $$
  with mine as (
    select v.proposal_id, v.alignment
      from resonance_votes v
     where v.profile_id = auth.uid()
  ),
  baseline as (
    select round(avg(alignment), 3) as m from mine
  ),
  flagged as (
    select distinct a.law_id, m.proposal_id, m.alignment
      from law_assessments a
      join mine m on m.proposal_id = a.proposal_id
     where a.superseded_at is null
       and a.verdict in ('tension', 'violation')
  )
  select
    f.law_id,
    count(*)::int,
    case when count(*) >= mirror_floor() then round(avg(f.alignment), 3) end,
    case when count(*) >= mirror_floor() then b.m end,
    case when count(*) >= mirror_floor() then round(avg(f.alignment) - b.m, 3) end,
    count(*) >= mirror_floor()
  from flagged f
  cross join baseline b
  group by f.law_id, b.m
  order by f.law_id;
$$;

grant execute on function my_law_mirror() to authenticated;

-- How much there is to read at all, so the screen can say "four more" rather
-- than showing an empty section and leaving somebody to guess.
drop function if exists my_mirror_standing();
create or replace function my_mirror_standing()
returns table (
  responses integer,
  laws_read integer,
  floor_at  integer
)
language sql security definer stable set search_path = public, extensions as $$
  select
    (select count(*)::int from resonance_votes where profile_id = auth.uid()),
    (select count(*)::int from my_law_mirror() where enough),
    mirror_floor();
$$;

grant execute on function my_mirror_standing() to authenticated;
