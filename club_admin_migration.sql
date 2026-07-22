-- ============================================================================
-- club_admin_migration.sql — Klub-Anführer (Founder)
-- Einmalig im Supabase-SQL-Editor ausführen. Idempotent & gefahrlos wiederholbar.
--
-- Nur der Anführer darf (a) die Beschreibung ändern, (b) das Wappen ändern,
-- (c) Mitglieder aus dem Klub entfernen.
--
-- Modell: clubs.founder_uid hält den Anführer. Gesetzt per "first-come"-Claim —
-- der erste, der (als Mitglied) Beschreibung/Wappen setzt, wird Anführer, sofern
-- noch keiner existiert. Bei Neugründung setzt der Client sofort das Wappen ->
-- der Gründer wird direkt Anführer. Alle Schreibpfade laufen ausschließlich über
-- security-definer-RPCs; direkte INSERT/UPDATE bleiben gesperrt.
-- ============================================================================

-- clubs-Tabelle anlegen, falls noch nicht vorhanden (früheres club_desc_migration
-- evtl. nie eingespielt). Lesen für alle; Schreiben ausschließlich über die RPCs.
create table if not exists public.clubs (
  code        text primary key,
  name        text,
  description text,
  updated_at  timestamptz not null default now()
);
alter table public.clubs enable row level security;
drop policy if exists "clubs_select_all" on public.clubs;
create policy "clubs_select_all" on public.clubs for select using (true);
grant select on public.clubs to anon, authenticated;

alter table public.clubs add column if not exists founder_uid uuid;
alter table public.clubs add column if not exists wappen      jsonb;

-- ── Beschreibung setzen — nur Anführer (bzw. erster Claim, wenn noch keiner). ──
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

-- ── Wappen setzen — nur Anführer (bzw. erster Claim = Gründer bei Neugründung). ──
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

-- Normalisierung für den serverseitigen Klubnamen-Filter (Umlaute/ß, Leetspeak,
-- Sonderzeichen weg) — spiegelt _rcNormalizeName im Client.
create or replace function public._rc_norm_name(s text) returns text
language sql immutable as $$
  select regexp_replace(
    translate(
      translate(replace(lower(coalesce(s,'')), 'ß','ss'), 'äöü','aou'),
      '43105@','aeiosa'),
    '[^a-z0-9]','','g');
$$;

-- ── Name setzen — nur Anführer (erster Claim = Gründer). Damit erscheint in der
--    Klub-Entdeckung/Top-Liste immer der NAME statt des Codes. Serverseitiger
--    Wortfilter gegen verfassungsfeindliche/extremistische Begriffe (autoritativ,
--    da der Client-Filter umgehbar ist). ──
create or replace function public.rc_set_club_name(new_name text)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_uid     uuid := auth.uid();
  v_code    text;
  v_founder uuid;
begin
  if v_uid is null then return 'unauthenticated'; end if;
  if public._rc_norm_name(new_name) ~ '(heilhitler|siegheil|hakenkreuz|hitler|nsdap|hitlerjugend|hitlergruss|schutzstaffel|sturmabteilung|drittesreich|blutundehre|blutundboden|judenfrei|judensau|untermensch|herrenrasse|whitepower|whitepride|combat18|hessdivision|fuhrer)'
    then return 'forbidden_name'; end if;
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

-- ── Mitglied entfernen — nur Anführer, Ziel muss Mitglied desselben Klubs sein. ──
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
