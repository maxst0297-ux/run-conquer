-- ============================================================================
--  H3-Cutover — sauberer Frischstart (OPTIONAL)
-- ----------------------------------------------------------------------------
--  Leert die ALTEN polygon-basierten Spielgebiete, damit die Welt nach dem
--  Umstieg auf das H3-System komplett leer/neu beginnt. Erst ausführen, wenn
--  die Edge Function 'conquer' deployt ist und du wirklich frisch starten willst.
--
--  Betroffen (nur Spielstand des ALTEN Systems):
--    • territories          — alte Polygon-Gebiete (inkl. Bots)
--    • territory_breaches    — Invasionen, die daran hingen
--    • rc_claims_log         — alter Eroberungs-Log
--
--  NICHT betroffen: Nutzerkonten (profiles), Nachrichten, Follows, Wahrzeichen-
--  Cache, Logs. Die neuen h3_*-Tabellen bleiben unangetastet (starten leer).
--
--  Idempotent + mit Existenz-Guards: mehrfach ausführbar, schadet nichts, wenn
--  eine Tabelle fehlt.
-- ============================================================================
do $$
begin
  if to_regclass('public.territory_breaches') is not null then
    execute 'truncate table public.territory_breaches restart identity cascade';
  end if;
  if to_regclass('public.territories') is not null then
    execute 'truncate table public.territories restart identity cascade';
  end if;
  if to_regclass('public.rc_claims_log') is not null then
    execute 'truncate table public.rc_claims_log restart identity';
  end if;
end $$;

-- ----------------------------------------------------------------------------
--  OPTIONAL: auch die gebietsabhängigen Spielerzähler zurücksetzen (Punkte,
--  eroberte/verteidigte/entdeckte Gebiete). NUR entkommentieren, wenn du die
--  Ranglisten wirklich auf null stellen willst — Konten bleiben erhalten.
-- ----------------------------------------------------------------------------
-- update public.profiles set
--   points = 0, total_conquered = 0, total_defended = 0, total_discovered = 0
-- where is_bot is not true;
