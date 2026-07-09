-- ============================================================================
--  Profil-Sichtbarkeit (öffentlich/privat) + Lauf-Zähler
-- ----------------------------------------------------------------------------
--  profile_public = true  -> alle Infos sind auch ohne Follow-Anfrage sichtbar
--  profile_public = false -> nur Name, Follower-Zahl, Fraktion, Club, Läufe und
--                            Anzahl Gebiete sind für Fremde sichtbar
--  Standard: öffentlich (true).
--
--  total_runs = Anzahl gewerteter Läufe (für die reduzierte Privat-Ansicht).
--
--  Die profiles-SELECT-Policy ist bereits öffentlich (Rangliste); die
--  Feld-Reduktion bei privaten Profilen macht der Client. Idempotent.
--
--  Ausführen: Supabase → SQL Editor → einfügen → Run.
-- ============================================================================

alter table public.profiles
  add column if not exists profile_public boolean not null default true,
  add column if not exists total_runs     integer not null default 0;
