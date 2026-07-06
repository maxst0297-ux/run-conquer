-- ============================================================================
--  Öffentliche Erfolge & Strecken (server-seitig, für alle sichtbar)
-- ----------------------------------------------------------------------------
--  1) Fehlende Aggregat-Stats öffentlich zu profiles: damit lassen sich ALLE
--     36 Erfolge (feste Schwellen je Kategorie) für jeden Nutzer aus seinen
--     öffentlichen Stats ableiten — kein separater Achievement-Speicher nötig.
--  2) Öffentliche, PATHLOSE Sicht auf die Läufe (public_runs): jeder sieht
--     Distanz/Zeit/Datum/Punkte anderer, aber NICHT die GPS-Route (Wohnort-
--     Schutz). Die Route bleibt über die runs-Tabelle nur dem Besitzer lesbar.
--
--  Idempotent: mehrfach im Supabase-SQL-Editor ausführbar.
-- ============================================================================

-- 1) Fehlende Stat-Spalten (öffentlich lesbar via bestehender profiles-Policy).
alter table public.profiles add column if not exists total_defended  integer default 0;
alter table public.profiles add column if not exists total_discovered integer default 0;
alter table public.profiles add column if not exists total_raids      integer default 0;

-- 2) GPS-Route schützen: runs nur noch für den Besitzer direkt lesbar
--    (die pathlose View unten liefert die öffentlichen Felder für alle).
drop policy if exists "Alle können Runs lesen" on public.runs;
drop policy if exists "runs_select_own" on public.runs;
create policy "runs_select_own"
  on public.runs for select using (auth.uid() = user_id);

-- Öffentliche, pathlose Sicht. security_invoker=off (Default) -> die View läuft
-- mit den Rechten ihres Owners und umgeht damit die owner-only-RLS der
-- Basistabelle; sie gibt bewusst NUR die unkritischen Felder heraus (kein path).
drop view if exists public.public_runs;
create view public.public_runs as
  select id, user_id, player_name, distance, duration, points,
         conquered, defended, created_at
    from public.runs;

grant select on public.public_runs to anon, authenticated;
