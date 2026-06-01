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
