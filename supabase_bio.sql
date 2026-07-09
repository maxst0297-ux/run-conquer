-- ============================================================================
--  Profil-Bio / Zitat — öffentlich sichtbare Kurzbeschreibung
-- ----------------------------------------------------------------------------
--  Spieler können eine kurze Beschreibung („obsessed with running") setzen, die
--  im eigenen Profil und beim Ansehen fremder Profile erscheint. Die profiles-
--  SELECT-Policy ist bereits öffentlich (Rangliste), daher ist die Bio damit
--  automatisch für andere sichtbar. Idempotent.
--
--  Ausführen: Supabase → SQL Editor → einfügen → Run.
-- ============================================================================

alter table public.profiles
  add column if not exists bio text;
