-- ============================================================================
--  Energie (server-autoritativ): 3 Boosts/Woche, jeder +10% Angriff.
-- ----------------------------------------------------------------------------
--  Die conquer-Edge-Function verwaltet Energie serverseitig: sie setzt sie zu
--  Wochenbeginn auf 3 zurück (energy_week) und zieht bei einem geboosteten Lauf
--  eine ab. Der Verfall der Verteidigung braucht KEINE Migration — er wird lazy
--  aus h3_territories.updated_at berechnet.
--  Idempotent.
-- ============================================================================
alter table public.profiles add column if not exists energy      integer default 3;
alter table public.profiles add column if not exists energy_week  text;

-- Fraktion des Gebiets-Besitzers (für die Anzeige beim Antippen eines Gebiets).
alter table public.h3_territories add column if not exists owner_team text;
