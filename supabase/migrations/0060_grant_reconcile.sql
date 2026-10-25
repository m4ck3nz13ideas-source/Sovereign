-- =============================================================================
-- 0060 — Grants reconciled with production; an internal helper stops leaking
-- =============================================================================
--
-- Found in the 25 October 2026 audit, by comparing production's grants with a
-- database built from this repository.
--
-- 1. place_at(profile, scale) returned ANY member's neighbourhood, region,
--    country or continent to any signed-in user who had their profile id.
--    0048 meant it as an internal helper and revoked it from PUBLIC — but
--    Supabase grants every new function to `authenticated` directly, so the
--    revoke never reached the role the API runs as. The same was true of
--    three ad helpers from 0033: vendor_document(), vendor_law_fit() and
--    my_values_query(). Every caller of all four is a security definer
--    function, which runs as the owner, so nothing that should work stops.
--
-- 2. alignment_shape() and verified_voice_count() were granted to
--    `authenticated` by 0009 and 0011 but are not on production. Granted
--    again here so the two agree. Neither leaks anything a member could not
--    already compute: the shape of a closed proposal's responses, and a count.
--
-- 3. Production has a deny-all policy on post_reactions, retired_reactions_all,
--    that no migration made. It is harmless (a permissive policy of `false`
--    adds nothing) and is recorded here so the repository describes what is
--    live rather than the other way round.
--
-- The test shim now gives `authenticated` the same default function grant
-- Supabase does, and 52_internal_helpers.sql fails if an internal helper is
-- callable by a signed-in user.
-- =============================================================================

revoke execute on function place_at(uuid, text) from public, anon, authenticated;
revoke execute on function vendor_document(uuid) from public, anon, authenticated;
revoke execute on function vendor_law_fit(uuid) from public, anon, authenticated;
revoke execute on function my_values_query() from public, anon, authenticated;

grant execute on function alignment_shape(uuid) to authenticated;
grant execute on function verified_voice_count(uuid) to authenticated;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public'
                  and tablename = 'post_reactions' and policyname = 'retired_reactions_all') then
    create policy retired_reactions_all on post_reactions for all using (false) with check (false);
  end if;
end $$;

notify pgrst, 'reload schema';
