-- ============================================================================
--  Jeder Bot in einer Fraktion + Bot-Gebiete auf die Fraktion nachziehen
-- ----------------------------------------------------------------------------
--  1) Jeder Bot (is_bot = true) bekommt garantiert eine der 4 Fraktionen
--     (fire/ice/storm/shadow). Bereits gesetzte Fraktionen bleiben erhalten;
--     nur fehlende werden deterministisch aus der Bot-ID vergeben.
--  2) Alle Bot-Gebiete bekommen owner_team aus dem Bot-Profil (damit die
--     Fraktionskarte und der Fraktionskrieg stimmen – auch für Alt-Gebiete).
--  Idempotent. Ausführen: Supabase → SQL Editor → einfügen → Run.
-- ============================================================================

-- 1) Fehlende Bot-Fraktionen deterministisch auffüllen.
update public.profiles p
set user_team = (array['fire','ice','storm','shadow'])
                [ (get_byte(decode(md5(p.id::text),'hex'), 0) % 4) + 1 ]
where p.is_bot = true
  and (p.user_team is null or p.user_team = '');

-- 2) Bot-Gebiete auf die Fraktion des Bots ziehen.
update public.h3_territories t
set owner_team = p.user_team
from public.profiles p
where t.owner = p.id
  and p.is_bot = true
  and t.owner_team is distinct from p.user_team;
