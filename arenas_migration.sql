-- ============================================================================
-- arenas_migration.sql — Arenen (Festungen), Phase 1
-- Einmalig im Supabase-SQL-Editor ausführen. Idempotent & gefahrlos wiederholbar.
--
-- Arenen sind feste Zonen an Sportanlagen. Läufst du durch (eine Lauf-Zelle im
-- radius_m der Arena), gibt es Punkte: 10 × Tempo-Faktor (0,7–1,5), max. 3
-- zählende Durchläufe pro Arena/Tag. Die Punkte zählen als ZUSÄTZLICHE
-- Fraktions-XP der Monatssaison + ins Arena-Leaderboard. KEIN Einfluss auf
-- Gebiete/Verteidigung. Saison = Kalendermonat (season = 'YYYY-MM').
-- ============================================================================

-- Arena-Stammdaten
create table if not exists public.arenas (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  center_lat      double precision not null,
  center_lng      double precision not null,
  radius_m        integer not null default 150,
  reference_speed double precision not null default 10,  -- km/h Basislinie
  active          boolean not null default true,
  created_at      timestamptz not null default now()
);

-- Einzelne gezählte Durchläufe (Historie)
create table if not exists public.arena_activity (
  id          uuid primary key default gen_random_uuid(),
  arena_id    uuid not null references public.arenas(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  points      numeric not null,
  season      text not null,                              -- 'YYYY-MM'
  recorded_at timestamptz not null default now()
);
create index if not exists arena_activity_cap_idx on public.arena_activity(arena_id, user_id, recorded_at);

-- Leaderboard je Arena + Saison + Nutzer (Rang wird beim Lesen berechnet)
create table if not exists public.arena_leaderboard (
  arena_id     uuid not null references public.arenas(id) on delete cascade,
  season       text not null,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  total_points numeric not null default 0,
  updated_at   timestamptz not null default now(),
  primary key (arena_id, season, user_id)
);
create index if not exists arena_lb_rank_idx on public.arena_leaderboard(arena_id, season, total_points desc);

-- RLS: Lesen öffentlich, Schreiben ausschließlich serverseitig (Award-RPC).
alter table public.arenas            enable row level security;
alter table public.arena_activity    enable row level security;
alter table public.arena_leaderboard enable row level security;
drop policy if exists "arenas_select_all"      on public.arenas;
drop policy if exists "arena_activity_select"  on public.arena_activity;
drop policy if exists "arena_lb_select_all"    on public.arena_leaderboard;
create policy "arenas_select_all"     on public.arenas            for select using (true);
create policy "arena_activity_select" on public.arena_activity    for select using (true);
create policy "arena_lb_select_all"   on public.arena_leaderboard for select using (true);
grant select on public.arenas, public.arena_activity, public.arena_leaderboard to anon, authenticated;

-- Award-RPC: vom Server (conquer, service_role) aufgerufen. Setzt den Tages-Cap
-- (max. 3/Arena/Nutzer/Tag) durch, schreibt Activity + Leaderboard-Upsert.
create or replace function public.rc_award_arena(a_id uuid, uid uuid, mk text, pts numeric)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_cnt int;
begin
  if a_id is null or uid is null or coalesce(pts,0) <= 0 then
    return jsonb_build_object('counted', false, 'reason', 'bad_args');
  end if;
  select count(*) into v_cnt from public.arena_activity
    where arena_id = a_id and user_id = uid
      and recorded_at >= date_trunc('day', now());
  if v_cnt >= 3 then return jsonb_build_object('counted', false, 'reason', 'daily_cap'); end if;
  insert into public.arena_activity(arena_id, user_id, points, season) values (a_id, uid, pts, mk);
  insert into public.arena_leaderboard(arena_id, season, user_id, total_points, updated_at)
    values (a_id, mk, uid, pts, now())
  on conflict (arena_id, season, user_id) do update
    set total_points = public.arena_leaderboard.total_points + excluded.total_points,
        updated_at = now();
  return jsonb_build_object('counted', true, 'points', pts);
end; $$;
revoke all on function public.rc_award_arena(uuid, uuid, text, numeric) from public, anon, authenticated;
grant execute on function public.rc_award_arena(uuid, uuid, text, numeric) to service_role;

-- ── Seed: Regensburg-Start-Arenen (aus der Feature-Spec) ─────────────────────
-- Unique auf name -> Seed bleibt idempotent (kein Duplikat bei Wiederholung).
create unique index if not exists arenas_name_uniq on public.arenas(name);
insert into public.arenas (name, center_lat, center_lng, radius_m, active) values
  ('Oberer Wöhrd & Wöhrdbad',      49.0252323, 12.0849755, 200, true),
  ('Sportanlage Am Weinweg',       49.0282263, 12.0630266, 150, true),
  ('Sportpark Ost',                49.0078447, 12.1287802, 180, true),
  ('SSV Jahn Trainingsgelände',    49.0026244, 12.0759517, 150, true),
  ('Freizeitsporthalle 37',        49.0056534, 12.1311601, 120, true),
  ('KICK ARENA Regensburg',        49.0302262, 12.1265822, 120, true)
on conflict (name) do nothing;
