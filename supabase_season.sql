-- ══════════════════════════════════════════════════════════════════════
-- Runners Conquer — Saison-Abrechnung (Fraktions-Monatssieger, autoritativ)
-- ----------------------------------------------------------------------
-- Nach Monatsende wird der Fraktions-Sieger EINMAL festgeschrieben
-- (season_winners). Der Client vergibt den Saison-Orden nur an Spieler,
-- die in dem Monat selbst in der Sieger-Fraktion waren.
-- Sicher mehrfach ausführbar (idempotent).
-- ══════════════════════════════════════════════════════════════════════

create table if not exists public.season_winners (
  month_key    text primary key,          -- 'YYYY-MM' des ABGESCHLOSSENEN Monats
  winner_team  text not null,             -- 'fire' | 'ice' | 'storm' | 'shadow'
  total_points bigint not null default 0, -- Punktesumme der Sieger-Fraktion bei Abrechnung
  settled_at   timestamptz not null default now()
);

alter table public.season_winners enable row level security;

drop policy if exists "season_winners lesen" on public.season_winners;
create policy "season_winners lesen"
  on public.season_winners for select
  to authenticated using (true);
-- Kein insert/update/delete für Clients: Schreiben nur über die Funktion unten.

-- Abrechnung: legt den Sieger des VORMONATS fest, falls noch nicht geschehen.
-- Punktestand = Summe profiles.points je Fraktion zum Zeitpunkt der ersten
-- Abrechnung nach Monatswechsel (Bots zählen mit — konsistent zum Fraktionskrieg).
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

  select user_team, sum(coalesce(points, 0))::bigint
    into w_team, w_total
    from profiles
   where user_team is not null and user_team <> ''
   group by user_team
   order by 2 desc
   limit 1;

  if w_team is null or coalesce(w_total, 0) <= 0 then
    return; -- keine Daten -> nichts festschreiben
  end if;

  insert into season_winners (month_key, winner_team, total_points)
  values (prev_mk, w_team, w_total)
  on conflict (month_key) do nothing;
end;
$$;

grant execute on function public.rc_settle_season() to authenticated;
