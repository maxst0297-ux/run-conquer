-- ============================================================================
--  landmark_cache — Server-Cache für Overpass-Wahrzeichen
-- ----------------------------------------------------------------------------
--  Zweck: Statt bei jedem Karten-Pan live die (oft rate-limitierte / langsame)
--  Overpass-API anzufragen, holt die Serverless-Funktion /api/landmarks die
--  Wahrzeichen pro Geo-Kachel einmal und cached sie hier für 24 h. Macht die
--  App unabhängig von Overpass-Ausfällen und entlastet die öffentliche API.
--
--  Zugriff ausschließlich über die Serverless-Funktion mit service_role, die
--  RLS umgeht. Es gibt daher bewusst KEINE Policy => anon/authenticated haben
--  keinerlei Zugriff auf diese Tabelle.
--
--  Idempotent: mehrfach im Supabase SQL-Editor ausführbar.
-- ============================================================================

create table if not exists public.landmark_cache (
  tile_key   text primary key,          -- gerundete Kachel, z.B. "c0.05:1024:153"
  data       jsonb not null,            -- Array von {id,lat,lng,name,type}
  fetched_at timestamptz not null default now()
);

create index if not exists landmark_cache_fetched_idx
  on public.landmark_cache (fetched_at);

alter table public.landmark_cache enable row level security;
-- (keine Policies — nur service_role greift zu)

-- Aufräum-Helfer: Kacheln löschen, die älter als N Tage sind (manuell oder per
-- pg_cron). SECURITY DEFINER, damit der Aufruf nicht an RLS scheitert.
create or replace function public.rc_prune_landmark_cache(older_than_days int default 30)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer;
begin
  delete from public.landmark_cache
   where fetched_at < now() - (older_than_days || ' days')::interval;
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;
