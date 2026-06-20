-- Run & Conquer – Supabase Schema
-- Im Supabase Dashboard → SQL Editor ausführen

-- Profiles Tabelle
create table if not exists public.profiles (
  id           uuid primary key,
  player_name  text not null,
  user_avatar  text default '🏃',
  user_color   text default '#e8ff47',
  points       integer default 0,
  total_km     float8  default 0,
  total_conquered integer default 0,
  streak_days  integer default 0,
  updated_at   timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "Alle können Profile lesen"
  on public.profiles for select using (true);

create policy "Nutzer verwalten eigenes Profil"
  on public.profiles for all using (auth.uid() = id);

-- Runs Tabelle
create table if not exists public.runs (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references public.profiles(id) on delete cascade,
  player_name  text,
  distance     float8,
  duration     integer,
  points       integer,
  kcal         integer,
  conquered    boolean default false,
  defended     boolean default false,
  path         jsonb,
  created_at   timestamptz default now()
);

alter table public.runs enable row level security;

create policy "Alle können Runs lesen"
  on public.runs for select using (true);

create policy "Nutzer fügen eigene Runs ein"
  on public.runs for insert with check (auth.uid() = user_id);

-- Support Messages Tabelle
create table if not exists public.support_messages (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references public.profiles(id) on delete set null,
  player_name  text,
  subject      text default 'Kein Betreff',
  message      text not null,
  admin_reply  text,
  replied_at   timestamptz,
  created_at   timestamptz default now()
);

alter table public.support_messages enable row level security;

-- INSERT: user_id muss (NULL-sicher) der eigene auth.uid() sein, Admin-Felder
-- duerfen beim Einfuegen nicht vorbelegt werden (verhindert Identitaets- und
-- Antwort-Faelschung, z.B. bei DSGVO-Loeschantraegen)
create policy "Nutzer senden eigene Support-Nachrichten"
  on public.support_messages for insert
  with check (
    auth.uid() is not distinct from user_id
    and admin_reply is null
    and replied_at is null
  );

create policy "Nutzer lesen eigene Nachrichten, Admin liest alle"
  on public.support_messages for select
  using (
    (auth.jwt() ->> 'email') = 'maxst0297@gmail.com'
    or auth.uid() = user_id
  );

create policy "Admin aktualisiert Nachrichten"
  on public.support_messages for update
  using ((auth.jwt() ->> 'email') = 'maxst0297@gmail.com')
  with check ((auth.jwt() ->> 'email') = 'maxst0297@gmail.com');

create policy "Admin löscht Nachrichten"
  on public.support_messages for delete
  using ((auth.jwt() ->> 'email') = 'maxst0297@gmail.com');
