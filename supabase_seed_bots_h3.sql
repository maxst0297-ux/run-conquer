-- ============================================================================
--  rc_seed_bot_h3 — Bot-Reviere im H3-System nahe eines Spielers anlegen
-- ----------------------------------------------------------------------------
--  Problem: Die alte Bot-Aussaat (rc_seed_bot_territory) legt POLYGON-Gebiete an,
--  die auf der neuen H3-Hexagon-Karte gar nicht gezeichnet werden -> „keine Bots
--  in meiner Nähe". Diese Funktion legt stattdessen ein echtes H3-Gebiet an:
--  der Client rechnet die H3-Zellen um einen zufälligen Punkt nahe dem Spieler und
--  übergibt sie; die Funktion wählt einen zufälligen Bot und beansprucht die noch
--  freien Zellen. So erscheinen immer Bots rund um Spieler – auch bevor sie selbst
--  gelaufen sind – und durch die zufällige Platzierung nicht immer dieselben.
--
--  SECURITY DEFINER: schreibt kontrolliert (nur is_bot-Profile, nur freie Zellen).
--  Idempotent. Ausführen: Supabase → SQL Editor → einfügen → Run.
-- ============================================================================

create or replace function public.rc_seed_bot_h3(p_cells text[])
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  free_cells text[];
  bot        record;
  new_id     uuid;
begin
  -- Nur Zellen, die noch niemandem gehören.
  select array_agg(c) into free_cells
  from unnest(p_cells) c
  where not exists (select 1 from public.h3_cells hc where hc.cell = c);

  if free_cells is null or array_length(free_cells, 1) < 3 then
    return null; -- zu wenig freier Platz -> nichts anlegen
  end if;

  -- Zufälligen Bot wählen.
  select id, player_name, user_color, user_team
    into bot
  from public.profiles
  where is_bot = true
  order by random()
  limit 1;

  if bot.id is null then
    return null; -- keine Bots vorhanden
  end if;

  insert into public.h3_territories(owner, owner_name, owner_color, owner_team, defense, last_captured_at)
  values (bot.id, bot.player_name, bot.user_color, coalesce(bot.user_team,'fire'), 35, now())
  returning id into new_id;

  insert into public.h3_cells(cell, territory_id)
  select c, new_id from unnest(free_cells) c
  on conflict (cell) do nothing;

  return new_id;
end;
$$;

revoke all on function public.rc_seed_bot_h3(text[]) from public;
grant execute on function public.rc_seed_bot_h3(text[]) to authenticated, anon;
