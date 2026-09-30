-- =============================================================================
-- RAISING THE FLOOR
--
-- `scope_rules` ships deliberately loose: local passes on one voice with no
-- waiting period, so a fresh install can get through a real decision on its
-- first day rather than staring at a quorum it cannot reach. That is the right
-- setting for an empty instance and the wrong one the moment a second person
-- arrives, because one voice at local scale means one person deciding alone.
--
-- This file is not a migration and is not applied automatically. The numbers
-- below are a judgement about who is actually here, and the database has no
-- way to make that judgement for you — a place has no register (rule 15), so
-- nothing in this schema knows how many people share a street.
--
-- Run it when there is more than one of you. Change the numbers first.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Local — a street, a building, a few households
--
-- Three voices and two days. Three is enough that no single person carries a
-- decision, and small enough to reach on a Thursday. Two days is not
-- deliberation in any grand sense; it is the gap that stops a proposal being
-- written and closed inside one enthusiastic evening.
-- ---------------------------------------------------------------------------
update scope_rules
   set min_voices = 3,
       deliberation_days = 2,
       note = 'Three voices so nobody decides alone; two days so nothing closes the evening it opened.'
 where scope = 'local';

-- ---------------------------------------------------------------------------
-- Regional — a town, a borough
--
-- Seven and four. The jump is deliberate: a regional decision reaches people
-- who will never meet the author, and the thing that makes it legitimate is
-- that enough of them looked.
-- ---------------------------------------------------------------------------
update scope_rules
   set min_voices = 7,
       deliberation_days = 4,
       note = 'Reaches people who will never meet the author, so enough of them have to have looked.'
 where scope = 'regional';

-- ---------------------------------------------------------------------------
-- National and above
--
-- These rise steeply on purpose, and the reason is written into the roadmap:
-- self-declared place is still self-declared. Personhood closes the sybil hole
-- from national scale up, but nothing yet stops somebody typing a country they
-- have never been to. A steep floor makes that harder to forget.
--
-- Until a gazetteer exists, treat any national or global number as an
-- experiment rather than a result.
-- ---------------------------------------------------------------------------
update scope_rules
   set min_voices = 25,
       deliberation_days = 7,
       note = 'Self-declared place is still self-declared. Steep on purpose.'
 where scope = 'national';

update scope_rules
   set min_voices = 60,
       deliberation_days = 10,
       note = 'Self-declared place is still self-declared. Steep on purpose.'
 where scope = 'continental';

update scope_rules
   set min_voices = 150,
       deliberation_days = 14,
       note = 'Self-declared place is still self-declared. Steep on purpose.'
 where scope = 'global';

-- The alignment threshold is not touched anywhere above. 0.618 is specified
-- rather than chosen — it comes from the paper — and it is the one number here
-- that is not a local judgement. Changing a floor is tuning; changing the
-- threshold is changing what ratification means.

select scope, min_voices, deliberation_days, threshold_alignment
  from scope_rules
 order by min_voices;
