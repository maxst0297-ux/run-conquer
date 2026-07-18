-- ============================================================================
-- privacy_migration.sql  (v194)
-- Privatsphäre-Schalter: Nutzer entscheiden, ob Follower ihre LÄUFE bzw.
-- GEBIETE im Profil sehen dürfen. Einmalig im Supabase SQL-Editor ausführen.
--
-- Idempotent & nicht-brechend: bis zum Ausführen respektiert der Client die
-- Schalter bereits clientseitig; danach werden die Lauf-Daten (mit groben
-- Hexagon-Zellen = Standortbezug) zusätzlich SERVERSEITIG gegated.
-- ============================================================================

-- 1) Zwei Sichtbarkeits-Flags auf profiles (Standard: sichtbar).
alter table public.profiles
  add column if not exists show_runs        boolean not null default true;
alter table public.profiles
  add column if not exists show_territories boolean not null default true;

-- 2) rc_profile_runs zusätzlich auf show_runs gaten.
--    Läufe enthalten grobe Hexagon-Zellen (Standortbezug) -> die sensibelste
--    Freigabe, daher serverseitig erzwungen. Der Besitzer sieht sich immer selbst.
create or replace function public.rc_profile_runs(target uuid)
returns table(id uuid, distance float8, duration integer, points integer, cells jsonb, created_at timestamptz)
language sql
security definer
stable
set search_path = public
as $$
  select r.id, r.distance, r.duration, r.points, r.cells, r.created_at
  from public.runs r
  where r.user_id = target
    and (
      auth.uid() = target
      or (
        coalesce((select p.show_runs from public.profiles p where p.id = target), true) = true
        and (
          exists (select 1 from public.profiles p where p.id = target and coalesce(p.profile_public, true) = true)
          or exists (
            select 1 from public.follow_requests f
            where f.requester_uid = auth.uid() and f.target_uid = target and f.status = 'accepted'
          )
        )
      )
    )
  order by r.created_at desc
  limit 20;
$$;
revoke all on function public.rc_profile_runs(uuid) from public;
grant execute on function public.rc_profile_runs(uuid) to authenticated, anon;

-- Hinweis zu GEBIETEN: Gebiete sind Teil des Karten-Spielprinzips und für alle
-- auf der Karte sichtbar (man muss gegnerische Reviere sehen, um sie anzugreifen).
-- Der Schalter „Gebiete sichtbar" blendet daher gezielt die GEBIETS-LISTE im
-- Profil für Follower aus (clientseitig über profiles.show_territories) – die
-- Karte selbst bleibt fürs Gameplay unverändert.
