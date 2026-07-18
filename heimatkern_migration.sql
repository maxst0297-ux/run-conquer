-- ============================================================================
-- heimatkern_migration.sql  (Pillar #2 — Heimatkern)
-- Einmalig im Supabase SQL-Editor ausführen. Idempotent & gefahrlos wiederholbar.
--
-- Ein als Heimatkern markiertes Gebiet verfällt halb so schnell (4 statt 8/Tag),
-- solange der Besitzer in den letzten 30 Tagen aktiv war (updated_at). Danach
-- greift wieder der volle Verfall (kein „unangreifbarer Dauer-Bunker").
-- ============================================================================

-- 1) Schema: Flag am Gebiet + Zeitstempel der letzten Heimatkern-Wahl am Profil.
alter table public.h3_territories
  add column if not exists is_home_core boolean not null default false;
alter table public.profiles
  add column if not exists home_core_set_at timestamptz;

-- Höchstens 1 Heimatkern pro Spieler (partieller Unique-Index).
create unique index if not exists h3_territories_one_home_per_owner
  on public.h3_territories(owner) where is_home_core;

-- View neu erzeugen, damit die neue Spalte (t.*) für den Client sichtbar wird
-- (Views frieren ihre Spaltenliste beim Erstellen ein).
drop view if exists public.h3_territories_full;
create view public.h3_territories_full as
  select t.*,
         coalesce(array_agg(c.cell) filter (where c.cell is not null), '{}') as cells
    from public.h3_territories t
    left join public.h3_cells c on c.territory_id = t.id
   group by t.id;
grant select on public.h3_territories_full to anon, authenticated;

-- 2) RPC: setzt EIN eigenes Gebiet als Heimatkern. Prüft Eigentum + 7-Tage-
--    Cooldown (verhindert „wanderndes" Schützen), hebt den alten Heimatkern auf.
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
