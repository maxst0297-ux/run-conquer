-- ============================================================================
--  app_logs — serverseitiges Fehler-Logging für Runners Conquer
-- ----------------------------------------------------------------------------
--  Zweck: Kritische Client-Fehler (fehlgeschlagene RPCs, Sync-Fehler, nicht
--  abgefangene Exceptions) landen nicht mehr nur in der Browser-Konsole des
--  Nutzers, sondern werden best-effort in dieser Tabelle persistiert. So sieht
--  der Betreiber, wo echte Nutzer hängenbleiben, bevor sie die App löschen.
--
--  Idempotent: kann mehrfach im Supabase SQL-Editor ausgeführt werden.
-- ============================================================================

create table if not exists public.app_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references public.profiles(id) on delete set null,
  level       text not null default 'error' check (level in ('error','warn','info')),
  context     text,                       -- z.B. 'rc_claim', 'cloud_load', 'window.onerror'
  message     text not null,
  detail      jsonb,                      -- optionaler Zusatzkontext (Stacktrace-Auszug, RPC-Args …)
  url         text,                       -- location.href zum Zeitpunkt des Fehlers
  ua          text,                       -- navigator.userAgent (Geräteklasse/Browser)
  app_version text,                       -- SW-Cache-Version o.ä. zur Korrelation mit Deploys
  created_at  timestamptz not null default now()
);

-- Längen kappen (Schutz gegen versehentliche Riesen-Payloads / Missbrauch)
alter table public.app_logs
  add constraint app_logs_message_len check (char_length(message) <= 2000) not valid;
do $$ begin
  alter table public.app_logs validate constraint app_logs_message_len;
exception when others then null; end $$;

create index if not exists app_logs_created_idx on public.app_logs (created_at desc);
create index if not exists app_logs_user_idx    on public.app_logs (user_id);
create index if not exists app_logs_level_idx   on public.app_logs (level);

alter table public.app_logs enable row level security;

drop policy if exists "logs_insert_own" on public.app_logs;
drop policy if exists "logs_select_admin" on public.app_logs;
drop policy if exists "logs_update_none" on public.app_logs;
drop policy if exists "logs_delete_admin" on public.app_logs;

-- INSERT: jeder (auch anonym, vor Login) darf Logs schreiben, aber user_id muss
-- NULL-sicher die eigene auth.uid() sein. Admin-Felder existieren hier nicht,
-- also keine Fälschungsgefahr. created_at wird per default gesetzt.
create policy "logs_insert_own"
  on public.app_logs for insert
  with check (auth.uid() is not distinct from user_id);

-- SELECT: nur der Betreiber liest die Logs (kein Nutzer sieht fremde Fehler).
create policy "logs_select_admin"
  on public.app_logs for select
  using ((auth.jwt() ->> 'email') = 'maxst0297@gmail.com');

-- UPDATE: niemand (Logs sind unveränderlich). Bewusst keine Policy => verboten.

-- DELETE: nur Admin (z.B. zum manuellen Aufräumen).
create policy "logs_delete_admin"
  on public.app_logs for delete
  using ((auth.jwt() ->> 'email') = 'maxst0297@gmail.com');

-- ----------------------------------------------------------------------------
--  Aufräum-Helfer: Logs älter als 30 Tage löschen. Manuell ausführbar oder per
--  Supabase-Cron (pg_cron) planbar. SECURITY DEFINER, damit der Aufruf nicht an
--  der DELETE-Policy scheitert.
-- ----------------------------------------------------------------------------
create or replace function public.rc_prune_app_logs(older_than_days int default 30)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer;
begin
  delete from public.app_logs
   where created_at < now() - (older_than_days || ' days')::interval;
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

-- Optional (auskommentiert): tägliche Bereinigung via pg_cron einrichten.
--   select cron.schedule('prune-app-logs','0 4 * * *',
--     $$ select public.rc_prune_app_logs(30); $$);
