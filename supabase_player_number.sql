-- ============================================================================
--  player_number — individuelle Spieler-Nummer je Profil
-- ----------------------------------------------------------------------------
--  Jeder Spieler bekommt eine eindeutige 8-stellige Nummer. Man findet sie in
--  der App unter Einstellungen → Profil. Gibt man die Nummer bei „Spieler
--  entdecken" ein, wird direkt das zugehörige Profil geöffnet (und man kann
--  folgen).
--
--  Umsetzung über eine Sequenz: garantiert eindeutig, ohne Kollisionsrisiko,
--  und neue Profile bekommen die Nummer automatisch per DEFAULT.
--  Idempotent. Ausführen: Supabase → SQL Editor → einfügen → Run.
-- ============================================================================

create sequence if not exists public.player_number_seq start 10000042;

alter table public.profiles
  add column if not exists player_number bigint;

-- Bestehende Profile ohne Nummer nachziehen.
update public.profiles
   set player_number = nextval('public.player_number_seq')
 where player_number is null;

-- Eindeutigkeit + schneller Lookup bei der Nummernsuche.
create unique index if not exists profiles_player_number_key
  on public.profiles(player_number);

-- Neue Profile bekommen automatisch die nächste Nummer.
alter table public.profiles
  alter column player_number set default nextval('public.player_number_seq');
