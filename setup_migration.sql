-- ============================================================================
-- Runners Conquer — Sammel-Migration (Rivalen + Privatsphäre + Profil-Läufe)
--
-- Einmalig im Supabase SQL-Editor ausführen. Idempotent & gefahrlos wiederholbar
-- (alles `if not exists` / `create or replace`). Fasst die zuvor einzeln
-- gelieferten Migrationen zusammen und ersetzt insbesondere die ältere
-- hexagon_migration.sql (deren rc_profile_runs hier in der neueren, zusätzlich
-- auf show_runs gegateten Fassung enthalten ist).
--
-- Schaltet frei:
--   • Rivalen (v191): benannte Bot-Angriffe erscheinen in den Benachrichtigungen.
--   • Privatsphäre (v194): Toggles „Läufe/Gebiete sichtbar" greifen serverseitig.
--   • Follower-Läufe/-Gebiete (v183): Läufe im Profil laden über rc_profile_runs.
-- ============================================================================

-- 1) RIVALEN (v191): Bot-Angriffs-Log. Nur der betroffene Spieler liest seine
--    Angriffe; schreiben darf ausschließlich der Server (bot_tick / service_role).
create table if not exists public.bot_attacks (
  id         uuid primary key default gen_random_uuid(),
  target_uid uuid not null references public.profiles(id) on delete cascade,
  bot_id     uuid,
  bot_name   text,
  bot_color  text,
  cells      integer not null default 1,
  created_at timestamptz not null default now()
);
create index if not exists bot_attacks_target_idx
  on public.bot_attacks(target_uid, created_at desc);
alter table public.bot_attacks enable row level security;
drop policy if exists "bot_attacks_select_own" on public.bot_attacks;
create policy "bot_attacks_select_own" on public.bot_attacks
  for select using (auth.uid() = target_uid);
-- INSERT: bewusst KEINE Policy -> nur service_role (bot_tick) darf schreiben.
grant select on public.bot_attacks to authenticated;

-- 2) PRIVATSPHÄRE (v194): zwei Sichtbarkeits-Flags (Standard: sichtbar).
alter table public.profiles
  add column if not exists show_runs        boolean not null default true;
alter table public.profiles
  add column if not exists show_territories boolean not null default true;

-- 3) PROFIL-LÄUFE (v183) + Privatsphäre-Gate: Läufe inkl. grober Hexagon-Zellen
--    (Standortbezug) nur an Besitzer / öffentliche Profile / AKZEPTIERTE Follower,
--    und nur wenn show_runs = true. security definer + fixer search_path.
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

-- Hinweis zu GEBIETEN: Gebiete bleiben Teil des Karten-Spielprinzips und für alle
-- auf der Karte sichtbar (man muss gegnerische Reviere sehen, um sie anzugreifen).
-- Der Schalter „Gebiete sichtbar" blendet gezielt die GEBIETS-LISTE im Profil für
-- Follower aus (clientseitig über profiles.show_territories) – die Karte bleibt
-- fürs Gameplay unverändert.
