-- Run & Conquer – Garmin Health API Schema
-- Im Supabase Dashboard → SQL Editor ausführen (nach supabase_garmin.sql).

-- ── Tägliche Health-Zusammenfassungen (Steps, HR, Schlaf, Stress) ──
create table if not exists public.garmin_health_summaries (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid references auth.users(id) on delete cascade,
  garmin_user_id   text,
  summary_date     date not null,
  steps            integer,
  distance_meters  float8,
  active_calories  integer,
  total_calories   integer,
  avg_stress       integer,
  resting_hr       integer,
  max_hr           integer,
  sleep_seconds    integer,
  deep_sleep_secs  integer,
  rem_sleep_secs   integer,
  created_at       timestamptz default now(),
  unique (user_id, summary_date)
);

create index if not exists garmin_health_user_date_idx
  on public.garmin_health_summaries(user_id, summary_date desc);

alter table public.garmin_health_summaries enable row level security;

create policy "Nutzer liest eigene Health-Summaries"
  on public.garmin_health_summaries for select
  using (auth.uid() = user_id);
