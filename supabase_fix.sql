-- Run & Conquer – Sicherheits- und Schema-Fix
-- Im Supabase Dashboard → SQL Editor ausführen.
-- Dieses Script ist idempotent: es kann mehrfach ohne Fehler ausgeführt werden.

-- ══════════════════════════════════════════════════════════════════════
-- 1. Fehlende Spalten in public.profiles ergänzen
-- ══════════════════════════════════════════════════════════════════════

alter table public.profiles
  add column if not exists user_id      text,
  add column if not exists game_data    text,
  add column if not exists user_team    text,
  add column if not exists club_code    text;

-- Index für Club- und Team-Abfragen
create index if not exists profiles_club_idx  on public.profiles(club_code);
create index if not exists profiles_team_idx  on public.profiles(user_team);

-- ══════════════════════════════════════════════════════════════════════
-- 2. Fehlende Spalten in public.support_messages ergänzen
-- ══════════════════════════════════════════════════════════════════════

alter table public.support_messages
  add column if not exists admin_reply  text,
  add column if not exists replied_at   timestamptz,
  add column if not exists email        text;

-- ══════════════════════════════════════════════════════════════════════
-- 3. Tabelle direct_messages erstellen (Direktnachrichten)
-- ══════════════════════════════════════════════════════════════════════

-- Hinweis: from_uid/to_uid sind text, da die App auth.uid() als String
-- speichert. In den Policies wird auth.uid()::text verglichen, damit es
-- unabhängig vom vorhandenen Spaltentyp funktioniert (uuid oder text).
create table if not exists public.direct_messages (
  id          uuid primary key default gen_random_uuid(),
  from_uid    text not null,
  from_name   text,
  to_uid      text not null,
  to_name     text,
  content     text not null,
  read_at     timestamptz,
  created_at  timestamptz default now()
);

create index if not exists dm_to_uid_idx   on public.direct_messages(to_uid, created_at desc);
create index if not exists dm_from_uid_idx on public.direct_messages(from_uid, created_at desc);

alter table public.direct_messages enable row level security;

-- alte Policies entfernen (falls ein Teil-Lauf bereits welche angelegt hat)
drop policy if exists "Nutzer liest eigene DMs"        on public.direct_messages;
drop policy if exists "Nutzer sendet DMs"              on public.direct_messages;
drop policy if exists "Empfänger aktualisiert read_at" on public.direct_messages;
drop policy if exists "Nutzer löscht eigene DMs"       on public.direct_messages;

-- Nutzer kann eigene gesendeten/empfangenen Nachrichten lesen
create policy "Nutzer liest eigene DMs"
  on public.direct_messages for select
  using (auth.uid()::text = from_uid or auth.uid()::text = to_uid);

-- Nutzer kann Nachrichten senden (from_uid muss eigene uid sein)
create policy "Nutzer sendet DMs"
  on public.direct_messages for insert
  with check (auth.uid()::text = from_uid);

-- Empfänger kann als gelesen markieren
create policy "Empfänger aktualisiert read_at"
  on public.direct_messages for update
  using (auth.uid()::text = to_uid)
  with check (auth.uid()::text = to_uid);

-- Nutzer kann eigene Konversationen löschen
create policy "Nutzer löscht eigene DMs"
  on public.direct_messages for delete
  using (auth.uid()::text = from_uid or auth.uid()::text = to_uid);

-- ══════════════════════════════════════════════════════════════════════
-- 4. RLS auf ALLEN verbleibenden public-Tabellen erzwingen (Sicherheitsnetz)
--    (sicher mehrfach auszuführen)
-- ══════════════════════════════════════════════════════════════════════

do $$
declare
  tbl text;
begin
  for tbl in
    select tablename from pg_tables
    where schemaname = 'public'
  loop
    execute format('alter table public.%I enable row level security', tbl);
  end loop;
end;
$$;
