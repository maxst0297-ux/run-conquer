-- ============================================================================
-- bot_clubs_migration.sql — Bots in benannte Klubs gruppieren
-- Einmalig im Supabase-SQL-Editor ausführen. Idempotent: legt die Klubs nur an,
-- falls der Code frei ist, und weist NUR club-lose Bots zu (bereits zugeordnete
-- Bots/echte Nutzer werden nicht angefasst).
--
-- Ziel: Die Klub-Entdeckung wirkt lebendig — echte Klubs mit echten Mitgliedern
-- (Bot-Profilen) statt leerer Liste — ohne Fake-/Platzhalter-Klubs im Client.
--
-- Voraussetzung: club_admin_migration.sql (Tabelle public.clubs) ist eingespielt.
-- ============================================================================

-- 1) Benannte Bot-Klubs anlegen (nur falls Code noch frei). founder_uid bleibt
--    null -> ein echter Nutzer, der beitritt, kann den Klub später übernehmen.
insert into public.clubs(code, name, updated_at) values
  ('RCBOT1', 'Rheinland Runners',  now()),
  ('RCBOT2', 'Alpen Sprinter',     now()),
  ('RCBOT3', 'Nordwind Athletik',  now()),
  ('RCBOT4', 'Isar Läufer',        now()),
  ('RCBOT5', 'Hanse Hunter',       now()),
  ('RCBOT6', 'Spree Strider',      now()),
  ('RCBOT7', 'Schwarzwald Wölfe',  now()),
  ('RCBOT8', 'Elbe Eroberer',      now()),
  ('RCBOT9', 'Main Momentum',      now()),
  ('RCBOT10','Ruhrpott Rebellen',  now())
on conflict (code) do nothing;

-- 2) Club-lose Bots gleichmäßig (round-robin nach id) auf diese Klubs verteilen.
--    Nur is_bot=true und ohne bestehenden club_code -> idempotent.
with codes as (
  select code, row_number() over (order by code) as cn
  from public.clubs where code like 'RCBOT%'
),
kk as (select count(*)::int as k from codes),
pool as (
  select id, row_number() over (order by id) as rn
  from public.profiles
  where is_bot = true and coalesce(club_code, '') = ''
)
update public.profiles p
set club_code = c.code
from pool, kk, codes c
where p.id = pool.id
  and c.cn = 1 + (pool.rn % kk.k);

-- Kontrolle: wie viele Mitglieder pro Bot-Klub?
-- select club_code, count(*) from public.profiles
--   where club_code like 'RCBOT%' group by club_code order by club_code;
