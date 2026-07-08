-- ============================================================================
--  Backfill: owner_team auf bestehenden H3-Gebieten nachtragen
-- ----------------------------------------------------------------------------
--  Gebiete, die vor Einführung der Fraktions-Spalte (oder ohne gesetztes
--  userTeam) erobert wurden, haben owner_team = NULL -> im Popup steht dann
--  fälschlich "Keine Fraktion", obwohl der Besitzer in einer Fraktion ist.
--  Diese Migration füllt owner_team aus der Fraktion (user_team) des Besitzer-
--  profils. Ab jetzt hält die Edge Function conquer den Wert bei jedem Lauf
--  durchs eigene Gebiet aktuell.
--
--  Idempotent: mehrfach ausführbar (setzt nur dort, wo noch NULL/leer).
-- ============================================================================

update public.h3_territories t
   set owner_team = p.user_team
  from public.profiles p
 where p.id = t.owner
   and coalesce(t.owner_team, '') = ''
   and coalesce(p.user_team, '') <> '';
