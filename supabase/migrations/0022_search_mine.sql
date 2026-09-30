-- =============================================================================
-- 0022 — SEARCHING YOUR OWN HALF
--
-- Ask searches what the group has proposed, decided and built. It does not
-- search anything you wrote, which makes it a search box that cannot find the
-- thing you are most likely to be looking for — the entry from three weeks ago
-- that you can half remember and cannot place.
--
-- WHY THIS IS A SEPARATE FUNCTION AND NOT A WIDER search_collective()
--
-- Because they are different promises and merging them would blur one into the
-- other. search_collective() returns things other people can also see, through
-- can_reach_proposal(). search_mine() returns things NOBODY else can see, ever,
-- through profile_id = auth.uid() and the owner-only policies underneath.
--
-- One function returning both would have a result set where the difference
-- between "shared" and "yours alone" is a column, and a screen that got that
-- column wrong would be the whole product's promise broken quietly. Two
-- functions, two lists, two headings.
--
-- It is security definer and still filters on auth.uid() itself — the policies
-- underneath are owner-only, but a security definer function does not inherit
-- them, so it carries its own check. Same trap as positions_for() in 0020.
-- =============================================================================

drop function if exists search_mine(text, integer);
create or replace function search_mine(p_query text, p_limit integer default 20)
returns table (
  kind     text,
  id       uuid,
  title    text,
  line     text,
  state    text,
  happened timestamptz
)
language sql security definer stable set search_path = public, extensions as $$
  with q as (select '%' || btrim(coalesce(p_query, '')) || '%' as pat)
  select * from (
    -- Everything written at Launch: journal, questions, ideas, things meant to
    -- be shared. The mode is what decides where it surfaced, and it is worth
    -- showing, because "I wrote that as a question" is often the thing you
    -- remember about it.
    select 'entry'::text, e.id, null::text,
           left(e.body, 180), e.mode::text, e.created_at
      from entries e, q
     where length(btrim(coalesce(p_query, ''))) >= 2
       and e.profile_id = auth.uid()
       and (e.body ilike q.pat or coalesce(e.expanded_body, '') ilike q.pat)

    union all

    select 'concept', c.id, c.title, left(c.body, 180), c.status::text, c.updated_at
      from concepts c, q
     where length(btrim(coalesce(p_query, ''))) >= 2
       and c.profile_id = auth.uid()
       and (c.title ilike q.pat or c.body ilike q.pat
            or coalesce(c.discipline, '') ilike q.pat)

    -- Deliberately absent: drafts, which never leave the author's browser and
    -- are therefore not in this database to be found; and guardian notes,
    -- which are readable but are a conversation rather than a record, and
    -- surfacing them in a search result list would make them feel like one.
  ) hits(kind, id, title, line, state, happened)
  order by happened desc nulls last
  limit greatest(1, least(coalesce(p_limit, 20), 50));
$$;

grant execute on function search_mine(text, integer) to authenticated;

notify pgrst, 'reload schema';
