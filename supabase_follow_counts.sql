-- ============================================================================
--  Follower-/Following-Zähler für beliebige Spieler
-- ----------------------------------------------------------------------------
--  Die RLS auf follow_requests gibt bewusst nur die EIGENEN Beziehungen frei,
--  damit niemand fremde Follow-Listen auslesen kann. Für die öffentliche
--  Profil-Anzeige braucht es aber die reinen ZAHLEN. Diese SECURITY-DEFINER-
--  Funktion liefert nur die Anzahl (keine Namen/Beziehungen) und ist damit
--  datenschutzkonform. Idempotent.
--
--  Follower  = wie viele Leute folgen dieser Person (target_uid = uid)
--  Following = wem diese Person folgt              (requester_uid = uid)
--  (jeweils nur angenommene Anfragen)
--
--  Ausführen: Supabase → SQL Editor → einfügen → Run.
-- ============================================================================

create or replace function public.rc_follow_counts(uid uuid)
returns table(followers integer, following integer)
language sql
security definer
set search_path = public
stable
as $$
  select
    (select count(*)::int from public.follow_requests where target_uid    = uid and status = 'accepted'),
    (select count(*)::int from public.follow_requests where requester_uid = uid and status = 'accepted');
$$;

revoke all on function public.rc_follow_counts(uuid) from public;
grant execute on function public.rc_follow_counts(uuid) to authenticated, anon;
