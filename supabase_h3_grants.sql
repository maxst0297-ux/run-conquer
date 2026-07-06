-- ============================================================================
--  Nachzieh-Migration: Lesezugriffe für den Client auf die H3-Tabellen/View.
-- ----------------------------------------------------------------------------
--  Grund: In der ersten supabase_h3.sql fehlten die GRANT-SELECT. Ohne sie kann
--  die App (Rolle authenticated/anon) h3_territories_full nicht lesen — die
--  Abfrage schlägt still fehl und die Karte bleibt leer, obwohl die Edge
--  Function Gebiete korrekt anlegt. Einmal im Supabase-SQL-Editor ausführen.
--  Idempotent.
-- ============================================================================
grant select on public.h3_territories      to anon, authenticated;
grant select on public.h3_cells            to anon, authenticated;
grant select on public.h3_territories_full to anon, authenticated;
