-- ══════════════════════════════════════════════════════════════════════
-- Runners Conquer — Saison-System (Monatspunkte + Monatssieger, autoritativ)
-- ----------------------------------------------------------------------
-- 1) faction_month_points: Punkte je Fraktion UND Monat. Wird ausschließlich
--    serverseitig befüllt (Edge Functions conquer/bot_tick über die Funktion
--    rc_add_faction_points) — Clients können nur lesen.
--    Damit startet jede Fraktion jeden Monat bei 0 (echte Saisons), statt dass
--    die historisch stärkste Fraktion über kumulierte Punkte ewig gewinnt.
-- 2) season_winners: Nach Monatsende wird der Sieger EINMAL festgeschrieben.
-- Sicher mehrfach ausführbar (idempotent).
-- ══════════════════════════════════════════════════════════════════════

-- ── Monatspunkte je Fraktion ──
create table if not exists public.faction_month_points (
  month_key  text not null,               -- 'YYYY-MM'
  team       text not null,               -- 'fire' | 'ice' | 'storm' | 'shadow'
  points     bigint not null default 0,
  updated_at timestamptz not null default now(),
  primary key (month_key, team)
);

alter table public.faction_month_points enable row level security;

drop policy if exists "faction_month_points lesen" on public.faction_month_points;
create policy "faction_month_points lesen"
  on public.faction_month_points for select
  to authenticated using (true);
-- Kein insert/update/delete für Clients: Schreiben nur über rc_add_faction_points.

-- Punkte gutschreiben (nur Edge Functions mit service_role dürfen das).
create or replace function public.rc_add_faction_points(mk text, team_id text, pts bigint)
returns void
language sql
security definer
set search_path = public
as $$
  insert into faction_month_points (month_key, team, points)
  values (mk, team_id, greatest(0, pts))
  on conflict (month_key, team) do update
    set points = faction_month_points.points + greatest(0, excluded.points),
        updated_at = now();
$$;

revoke execute on function public.rc_add_faction_points(text, text, bigint) from public;
revoke execute on function public.rc_add_faction_points(text, text, bigint) from anon;
revoke execute on function public.rc_add_faction_points(text, text, bigint) from authenticated;
grant  execute on function public.rc_add_faction_points(text, text, bigint) to service_role;

-- ── Monatssieger ──
create table if not exists public.season_winners (
  month_key    text primary key,          -- 'YYYY-MM' des ABGESCHLOSSENEN Monats
  winner_team  text not null,
  total_points bigint not null default 0, -- Monatspunkte der Sieger-Fraktion
  settled_at   timestamptz not null default now()
);

alter table public.season_winners enable row level security;

drop policy if exists "season_winners lesen" on public.season_winners;
create policy "season_winners lesen"
  on public.season_winners for select
  to authenticated using (true);

-- Abrechnung: legt den Sieger des VORMONATS fest, falls noch nicht geschehen.
-- Quelle sind die MONATSPUNKTE des Vormonats (faction_month_points) — nicht die
-- kumulierten Gesamtpunkte. Gibt es für den Vormonat keine Punkte, gibt es
-- keinen Sieger (kein Fallback auf Gesamtsummen).
create or replace function public.rc_settle_season()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  prev_mk text;
  w_team  text;
  w_total bigint;
begin
  prev_mk := to_char(date_trunc('month', now()) - interval '1 month', 'YYYY-MM');
  if exists (select 1 from season_winners where month_key = prev_mk) then
    return; -- Vormonat bereits abgerechnet
  end if;

  select team, points
    into w_team, w_total
    from faction_month_points
   where month_key = prev_mk
   order by points desc
   limit 1;

  if w_team is null or coalesce(w_total, 0) <= 0 then
    return; -- keine Monatsdaten -> kein Sieger
  end if;

  insert into season_winners (month_key, winner_team, total_points)
  values (prev_mk, w_team, w_total)
  on conflict (month_key) do nothing;

  -- Fraktions-Monatssieg: allen (echten) Mitgliedern der Sieger-Fraktion 24h Gebiets-Schutz.
  perform set_config('rc.allow_points', '1', true);
  update profiles
     set shield_until = greatest(coalesce(shield_until, now()), now() + interval '24 hours'), updated_at = now()
   where user_team = w_team and coalesce(is_bot, false) = false;
end;
$$;

grant execute on function public.rc_settle_season() to authenticated;
