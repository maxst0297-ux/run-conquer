-- ══════════════════════════════════════════════════════════════════════
-- Runners Conquer — Echte Events + server-autoritative Punkte
-- ----------------------------------------------------------------------
-- 1) events/event_progress: serverseitig definierte Events mit echtem
--    Fortschritt (von der Edge Function 'conquer' aus Läufen fortgeschrieben)
--    und echter Belohnung (rc_claim_event, server-gedeckelt).
-- 2) Punkte-Schutz: Clients können profiles.points/energy nicht mehr direkt
--    schreiben (Trigger-Guard). Client-Belohnungen (Quests, Erfolge, …) laufen
--    über rc_award_xp mit hartem Tages-/Einzeldeckel.
-- Sicher mehrfach ausführbar (idempotent).
-- ══════════════════════════════════════════════════════════════════════

-- ── 1a) Events ──
create table if not exists public.events (
  id        text primary key,           -- deterministisch je Zeitraum, z.B. 'wk_2026-28_sprint'
  title     text not null,
  descr     text not null,
  icon      text not null default '🏆',
  color     text not null default '',
  type      text not null,              -- 'distance_single' | 'distance_total' | 'conquer' | 'runs'
  target    float8 not null,            -- Meter bzw. Anzahl
  reward    int not null default 100,
  starts_at timestamptz not null default now(),
  ends_at   timestamptz not null
);
alter table public.events enable row level security;
drop policy if exists "events lesen" on public.events;
create policy "events lesen" on public.events for select to authenticated using (true);

create table if not exists public.event_progress (
  event_id     text not null references public.events(id) on delete cascade,
  user_id      uuid not null,
  progress     float8 not null default 0,
  completed_at timestamptz,
  claimed      boolean not null default false,
  updated_at   timestamptz not null default now(),
  primary key (event_id, user_id)
);
alter table public.event_progress enable row level security;
drop policy if exists "event_progress lesen" on public.event_progress;
create policy "event_progress lesen" on public.event_progress for select to authenticated using (true);
-- Kein insert/update für Clients: Fortschritt schreibt NUR die Edge Function
-- (service_role), die Belohnung NUR rc_claim_event.

-- Laufende Events sicherstellen (idempotent; deterministische IDs je Zeitraum).
-- Wöchentlich: Sprint (5 km am Stück) + Gebietskrieg (2 Eroberungen);
-- monatlich: Monats-Marathon (42 km gesamt). Zeiträume in UTC.
create or replace function public.rc_ensure_events()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  wk_start timestamptz := date_trunc('week', now());
  wk_end   timestamptz := date_trunc('week', now()) + interval '7 days';
  wk_key   text        := to_char(date_trunc('week', now()), 'IYYY-IW');
  mo_start timestamptz := date_trunc('month', now());
  mo_end   timestamptz := date_trunc('month', now()) + interval '1 month';
  mo_key   text        := to_char(now(), 'YYYY-MM');
begin
  insert into events (id, title, descr, icon, color, type, target, reward, starts_at, ends_at) values
    ('wk_'||wk_key||'_sprint', 'Wochen-Sprint',        'Laufe 5 km in einem Stück',      '⚡', 'cyan', 'distance_single', 5000,  250, wk_start, wk_end),
    ('wk_'||wk_key||'_conq',   'Gebietskrieg',         'Erobere 2 feindliche Gebiete',   '⚔️', 'red',  'conquer',         2,     350, wk_start, wk_end),
    ('mo_'||mo_key||'_total',  'Monats-Marathon',      'Laufe 42 km in diesem Monat',    '🏙️', '',     'distance_total',  42000, 500, mo_start, mo_end)
  on conflict (id) do nothing;
end;
$$;
grant execute on function public.rc_ensure_events() to authenticated;

-- Belohnung abholen: nur wenn Ziel erreicht und noch nicht abgeholt.
-- Schreibt die Punkte serverseitig (am Trigger-Guard vorbei) und füttert die
-- Monats-Fraktionswertung. Rückgabe: gutgeschriebene Punkte (0 = nicht möglich).
create or replace function public.rc_claim_event(eid text)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  ev  record;
  pr  record;
  my_team text;
begin
  if uid is null then return 0; end if;
  select * into ev from events where id = eid;
  if ev.id is null then return 0; end if;
  select * into pr from event_progress where event_id = eid and user_id = uid for update;
  if pr.event_id is null or pr.claimed or pr.progress < ev.target then return 0; end if;

  update event_progress
     set claimed = true, completed_at = coalesce(completed_at, now()), updated_at = now()
   where event_id = eid and user_id = uid;

  perform set_config('rc.allow_points', '1', true); -- Guard für DIESE Transaktion öffnen
  update profiles set points = coalesce(points, 0) + ev.reward, updated_at = now() where id = uid;

  select user_team into my_team from profiles where id = uid;
  if my_team is not null and my_team <> '' then
    insert into faction_month_points (month_key, team, points)
    values (to_char(now(), 'YYYY-MM'), my_team, ev.reward)
    on conflict (month_key, team) do update
      set points = faction_month_points.points + excluded.points, updated_at = now();
  end if;
  return ev.reward;
end;
$$;
grant execute on function public.rc_claim_event(text) to authenticated;

-- ── 2a) Punkte-Guard: Clients können points/energy nicht mehr direkt setzen ──
-- service_role (Edge Functions) und SQL-Editor bleiben unbeschränkt; DEFINER-
-- Funktionen öffnen den Guard gezielt über set_config('rc.allow_points','1',true).
create or replace function public.rc_guard_profile_points()
returns trigger
language plpgsql
as $$
declare
  jwt_role text;
begin
  if coalesce(current_setting('rc.allow_points', true), '') = '1' then return new; end if;
  jwt_role := coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb->>'role', '');
  if jwt_role in ('', 'service_role') then return new; end if; -- Server/SQL-Editor
  if tg_op = 'UPDATE' then
    new.points := old.points;
    new.energy := old.energy;
    new.energy_week := old.energy_week;
    new.is_bot := old.is_bot;
  else -- INSERT durch normalen Client: neutral starten
    new.points := 0;
    new.is_bot := false;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_profile_points on public.profiles;
create trigger trg_guard_profile_points
  before insert or update on public.profiles
  for each row execute function public.rc_guard_profile_points();

-- ── 2b) Gedeckelte XP-Gutschrift für Client-Belohnungen (Quests, Erfolge, …) ──
create table if not exists public.xp_awards (
  user_id uuid not null,
  day     date not null default current_date,
  total   int  not null default 0,
  primary key (user_id, day)
);
alter table public.xp_awards enable row level security; -- keine Policies: nur DEFINER

create or replace function public.rc_award_xp(amount int, reason text default '')
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  cap_call constant int := 500;   -- max je Gutschrift
  cap_day  constant int := 3000;  -- max je Tag (Quests+Erfolge+Challenges zusammen)
  today_total int;
  amt int;
begin
  if uid is null then return 0; end if;
  amt := greatest(0, least(coalesce(amount, 0), cap_call));
  if amt = 0 then return 0; end if;
  insert into xp_awards (user_id, day, total) values (uid, current_date, 0)
    on conflict (user_id, day) do nothing;
  select total into today_total from xp_awards where user_id = uid and day = current_date for update;
  amt := least(amt, greatest(0, cap_day - today_total));
  if amt <= 0 then return 0; end if;
  update xp_awards set total = total + amt where user_id = uid and day = current_date;
  perform set_config('rc.allow_points', '1', true);
  update profiles set points = coalesce(points, 0) + amt, updated_at = now() where id = uid;
  return amt;
end;
$$;
grant execute on function public.rc_award_xp(int, text) to authenticated;
