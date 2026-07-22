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

-- 4) HEIMATKERN (Pillar #2): markiertes Gebiet verfällt halb so schnell (4/Tag),
--    solange der Besitzer < 30 Tage aktiv war (updated_at); danach voller Verfall.
alter table public.h3_territories
  add column if not exists is_home_core boolean not null default false;
alter table public.profiles
  add column if not exists home_core_set_at timestamptz;
create unique index if not exists h3_territories_one_home_per_owner
  on public.h3_territories(owner) where is_home_core;
-- View neu erzeugen, damit is_home_core (t.*) für den Client sichtbar wird.
drop view if exists public.h3_territories_full;
create view public.h3_territories_full as
  select t.*,
         coalesce(array_agg(c.cell) filter (where c.cell is not null), '{}') as cells
    from public.h3_territories t
    left join public.h3_cells c on c.territory_id = t.id
   group by t.id;
grant select on public.h3_territories_full to anon, authenticated;
create or replace function public.rc_set_home_core(terr_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_owner uuid;
  v_last  timestamptz;
begin
  if v_uid is null then return 'unauthenticated'; end if;
  select owner into v_owner from public.h3_territories where id = terr_id;
  if v_owner is null then return 'not_found'; end if;
  if v_owner <> v_uid then return 'not_owner'; end if;
  select home_core_set_at into v_last from public.profiles where id = v_uid;
  if v_last is not null and v_last > now() - interval '7 days' then
    return 'cooldown';
  end if;
  update public.h3_territories set is_home_core = false where owner = v_uid and is_home_core;
  update public.h3_territories set is_home_core = true  where id = terr_id;
  update public.profiles set home_core_set_at = now() where id = v_uid;
  return 'ok';
end;
$$;
revoke all on function public.rc_set_home_core(uuid) from public;
grant execute on function public.rc_set_home_core(uuid) to authenticated;

-- 5) KLUB-BESCHREIBUNG (siehe club_desc_migration.sql)

create table if not exists public.clubs (
  code        text primary key,
  name        text,
  description text,
  updated_at  timestamptz not null default now()
);
alter table public.clubs enable row level security;

-- Lesen: für alle (Beschreibung ist öffentlich sichtbar).
drop policy if exists "clubs_select_all" on public.clubs;
create policy "clubs_select_all" on public.clubs for select using (true);
-- Schreiben: bewusst KEINE direkte INSERT/UPDATE-Policy -> nur über die RPC.
grant select on public.clubs to anon, authenticated;

-- KLUB-ANFÜHRER (Founder): siehe club_admin_migration.sql. Nur der Anführer darf
-- Beschreibung/Wappen ändern und Mitglieder entfernen.
alter table public.clubs add column if not exists founder_uid uuid;
alter table public.clubs add column if not exists wappen      jsonb;

-- RPC: setzt die Beschreibung — nur Anführer (bzw. erster Claim). security definer.
create or replace function public.rc_set_club_description(desc_text text)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_uid     uuid := auth.uid();
  v_code    text;
  v_founder uuid;
begin
  if v_uid is null then return 'unauthenticated'; end if;
  select club_code into v_code from public.profiles where id = v_uid;
  if v_code is null or v_code = '' then return 'no_club'; end if;
  insert into public.clubs(code) values (v_code) on conflict (code) do nothing;
  update public.clubs set founder_uid = v_uid where code = v_code and founder_uid is null;
  select founder_uid into v_founder from public.clubs where code = v_code;
  if v_founder is distinct from v_uid then return 'not_leader'; end if;
  update public.clubs set description = left(coalesce(desc_text,''), 500), updated_at = now() where code = v_code;
  return 'ok';
end; $$;
revoke all on function public.rc_set_club_description(text) from public;
grant execute on function public.rc_set_club_description(text) to authenticated;

-- RPC: setzt das Wappen — nur Anführer (erster Claim = Gründer bei Neugründung).
create or replace function public.rc_set_club_wappen(w jsonb)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_uid     uuid := auth.uid();
  v_code    text;
  v_founder uuid;
begin
  if v_uid is null then return 'unauthenticated'; end if;
  select club_code into v_code from public.profiles where id = v_uid;
  if v_code is null or v_code = '' then return 'no_club'; end if;
  insert into public.clubs(code) values (v_code) on conflict (code) do nothing;
  update public.clubs set founder_uid = v_uid where code = v_code and founder_uid is null;
  select founder_uid into v_founder from public.clubs where code = v_code;
  if v_founder is distinct from v_uid then return 'not_leader'; end if;
  update public.clubs set wappen = w, updated_at = now() where code = v_code;
  return 'ok';
end; $$;
revoke all on function public.rc_set_club_wappen(jsonb) from public;
grant execute on function public.rc_set_club_wappen(jsonb) to authenticated;

-- RPC: setzt den Klubnamen — nur Anführer (erster Claim = Gründer).
create or replace function public.rc_set_club_name(new_name text)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_uid     uuid := auth.uid();
  v_code    text;
  v_founder uuid;
begin
  if v_uid is null then return 'unauthenticated'; end if;
  select club_code into v_code from public.profiles where id = v_uid;
  if v_code is null or v_code = '' then return 'no_club'; end if;
  insert into public.clubs(code) values (v_code) on conflict (code) do nothing;
  update public.clubs set founder_uid = v_uid where code = v_code and founder_uid is null;
  select founder_uid into v_founder from public.clubs where code = v_code;
  if v_founder is distinct from v_uid then return 'not_leader'; end if;
  update public.clubs set name = left(coalesce(new_name,''), 40), updated_at = now() where code = v_code;
  return 'ok';
end; $$;
revoke all on function public.rc_set_club_name(text) from public;
grant execute on function public.rc_set_club_name(text) to authenticated;

-- RPC: entfernt ein Mitglied — nur Anführer, Ziel muss Mitglied desselben Klubs sein.
create or replace function public.rc_kick_member(target uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_uid     uuid := auth.uid();
  v_code    text;
  v_founder uuid;
  v_n       int;
begin
  if v_uid is null then return 'unauthenticated'; end if;
  if target is null then return 'bad_target'; end if;
  if target = v_uid then return 'cannot_kick_self'; end if;
  select club_code into v_code from public.profiles where id = v_uid;
  if v_code is null or v_code = '' then return 'no_club'; end if;
  select founder_uid into v_founder from public.clubs where code = v_code;
  if v_founder is distinct from v_uid then return 'not_leader'; end if;
  update public.profiles set club_code = null where id = target and club_code = v_code;
  get diagnostics v_n = row_count;
  if v_n = 0 then return 'not_member'; end if;
  return 'ok';
end; $$;
revoke all on function public.rc_kick_member(uuid) from public;
grant execute on function public.rc_kick_member(uuid) to authenticated;
