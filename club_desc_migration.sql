-- ============================================================================
-- club_desc_migration.sql — Klub-Beschreibung (serverseitig, für alle sichtbar)
-- Einmalig im Supabase-SQL-Editor ausführen. Idempotent & gefahrlos wiederholbar.
--
-- Klubs existierten bisher nur clientseitig (localStorage). Diese Tabelle hält
-- eine kurze Beschreibung pro Klub-Code, lesbar für alle, änderbar nur von
-- Mitgliedern — über die RPC (Insert-or-Update, legt die Zeile bei Bedarf an).
-- ============================================================================

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

-- RPC: setzt die Beschreibung des Klubs des aufrufenden Mitglieds. Legt die
-- clubs-Zeile bei Bedarf an (Insert-or-Update). security definer.
create or replace function public.rc_set_club_description(desc_text text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  v_code text;
begin
  if v_uid is null then return 'unauthenticated'; end if;
  select club_code into v_code from public.profiles where id = v_uid;
  if v_code is null or v_code = '' then return 'no_club'; end if;
  insert into public.clubs(code, description, updated_at)
    values (v_code, left(coalesce(desc_text,''), 500), now())
  on conflict (code) do update
    set description = left(coalesce(excluded.description,''), 500), updated_at = now();
  return 'ok';
end;
$$;
revoke all on function public.rc_set_club_description(text) from public;
grant execute on function public.rc_set_club_description(text) to authenticated;
