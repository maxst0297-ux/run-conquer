-- Run & Conquer – Garmin Integration Schema
-- Im Supabase Dashboard → SQL Editor ausführen.
--
-- Diese Tabellen werden NUR von den Vercel-Serverless-Functions
-- (mit dem Service-Role-Key) beschrieben. Tokens dürfen niemals
-- über den anon-Key lesbar sein → RLS bleibt aktiv, ohne Policies
-- für anon. Aktivitäten darf der Nutzer selbst lesen.

-- ── Verbindung: Garmin-Konto ↔ Supabase-Nutzer + OAuth-Tokens ──
create table if not exists public.garmin_connections (
  user_id        uuid primary key references auth.users(id) on delete cascade,
  garmin_user_id text unique not null,
  access_token   text not null,
  access_secret  text not null,
  connected_at   timestamptz default now()
);
alter table public.garmin_connections enable row level security;
-- keine anon/authenticated Policies → nur Service-Role kommt dran (Tokens geschützt)

-- ── Temporäre Request-Tokens während des OAuth-Flows ──
create table if not exists public.garmin_oauth_pending (
  request_token  text primary key,
  request_secret text not null,
  user_id        uuid not null,
  created_at     timestamptz default now()
);
alter table public.garmin_oauth_pending enable row level security;

-- ── Importierte Garmin-Aktivitäten inkl. GPS-Track ──
create table if not exists public.garmin_activities (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid references auth.users(id) on delete cascade,
  garmin_user_id   text,
  external_id      text not null,
  activity_type    text,
  start_time       timestamptz,
  duration_seconds integer,
  distance_meters  float8,
  track            jsonb,          -- [{lat,lng,ele,time}, …]
  created_at       timestamptz default now(),
  unique (user_id, external_id)
);
create index if not exists garmin_activities_user_idx on public.garmin_activities(user_id);
create index if not exists garmin_activities_time_idx on public.garmin_activities(start_time desc);

alter table public.garmin_activities enable row level security;
-- Nutzer darf seine eigenen Aktivitäten lesen
create policy "Nutzer liest eigene Garmin-Aktivitäten"
  on public.garmin_activities for select
  using (auth.uid() = user_id);

-- Alte Pending-OAuth-Einträge automatisch aufräumen (optional, via pg_cron):
-- delete from public.garmin_oauth_pending where created_at < now() - interval '1 hour';
