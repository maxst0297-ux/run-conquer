-- ============================================================================
--  territory_breaches — "The Breach" server-autoritativ
-- ----------------------------------------------------------------------------
--  Bisher liefen Invasionen rein im Client (invasionTick): pro Gerät eigene
--  RNG, nur in localStorage, NICHT im Cloud-Snapshot -> beim Gerätewechsel /
--  Cloud-Reload verloren und auf jedem Gerät anders. Diese Migration zieht den
--  Zustand auf den Server, konsistent mit dem bereits server-autoritativen
--  Gebietsmodell (rc_claim / rc_list_territories):
--
--    • rc_sync_breaches()  – treibt aktive Invasionen voran (Server-Uhr),
--                            spawnt neue auf vernachlässigte Gebiete, löst
--                            Überrennungen auf, liefert die aktive Liste.
--    • rc_repel_breach()   – wehrt eine Invasion ab, wenn der Läufer nah genug
--                            am Marker ist (Server-validierte Distanz).
--
--  Die Werte sind ein 1:1-Port der CFG.INV_*-Konstanten aus index.html.
--  Idempotent: mehrfach im Supabase SQL-Editor ausführbar.
-- ============================================================================

create table if not exists public.territory_breaches (
  id            uuid primary key default gen_random_uuid(),
  territory_id  uuid not null references public.territories(id) on delete cascade,
  owner         uuid not null references public.profiles(id) on delete cascade,
  lat           float8 not null,
  lng           float8 not null,
  progress      float8 not null default 0 check (progress >= 0),
  status        text not null default 'active' check (status in ('active','repelled','overrun')),
  spawned_at    timestamptz not null default now(),
  last_tick     timestamptz not null default now(),
  resolved_at   timestamptz,
  created_at    timestamptz not null default now()
);

-- Pro Gebiet höchstens EINE aktive Invasion.
create unique index if not exists territory_breaches_active_uniq
  on public.territory_breaches(territory_id) where status = 'active';
create index if not exists territory_breaches_owner_idx
  on public.territory_breaches(owner, status);

alter table public.territory_breaches enable row level security;

drop policy if exists "Nutzer lesen eigene Invasionen" on public.territory_breaches;
create policy "Nutzer lesen eigene Invasionen"
  on public.territory_breaches for select using (auth.uid() = owner);
-- Bewusst KEINE insert/update/delete-Policy: Schreibzugriff ausschließlich über
-- die SECURITY-DEFINER-RPCs unten.

-- Realtime: aktive Invasionen an verbundene Clients streamen (SELECT-RLS filtert
-- pro Eigentümer), damit Marker ohne Polling aktuell bleiben.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public'
         and tablename = 'territory_breaches'
     )
  then
    alter publication supabase_realtime add table public.territory_breaches;
  end if;
end $$;

-- ----------------------------------------------------------------------------
--  rc_sync_breaches() — Tick + Spawn + Auflösung für den aufrufenden Nutzer.
-- ----------------------------------------------------------------------------
create or replace function public.rc_sync_breaches()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c_threat_def        constant float8 := 55;
  c_min_neglect_h     constant float8 := 2;
  c_max_active        constant int    := 4;
  c_spawn_chance      constant float8 := 0.14;
  c_growth_per_min    constant float8 := 2.5;
  c_def_drain_per_min constant float8 := 0.6;
  c_overrun_def_loss  constant float8 := 30;
  c_max_tick_min      constant float8 := 10;

  v_user      uuid := auth.uid();
  v_now       timestamptz := now();
  v_active    int;
  v_events    jsonb := '[]'::jsonb;
  v_changed   boolean := false;
  v_breaches  jsonb;
  r           record;
  v_mins      float8;
  v_prog      float8;
  v_cx        float8;
  v_cy        float8;
  v_drift     float8;
  v_ang       float8;
  v_off       float8;
  v_name      text;
begin
  if v_user is null then
    raise exception 'rc_sync_breaches: not authenticated';
  end if;

  -- 1) Aktive Invasionen des Nutzers voranbringen (Zeilen sperren, damit zwei
  --    parallele Geräte nicht doppelt vorrücken).
  for r in
    select b.*, t.owner as t_owner, t.defense as t_def, t.custom_name,
           ST_Y(ST_Centroid(t.geom)) as cy, ST_X(ST_Centroid(t.geom)) as cx
      from public.territory_breaches b
      join public.territories t on t.id = b.territory_id
     where b.owner = v_user and b.status = 'active'
     for update of b skip locked
  loop
    -- Gebiet nicht mehr im Besitz -> Invasion endet (als abgewehrt markiert).
    if r.t_owner is distinct from v_user then
      update public.territory_breaches
         set status = 'repelled', resolved_at = v_now
       where id = r.id;
      v_changed := true;
      continue;
    end if;

    v_mins := least(c_max_tick_min, greatest(0, extract(epoch from (v_now - r.last_tick)) / 60.0));
    v_prog := coalesce(r.progress, 0) + v_mins * c_growth_per_min;
    v_cx := r.cx; v_cy := r.cy;
    v_drift := least(0.5, v_mins * 0.08);

    -- Verteidigung des bedrängten Gebiets sinkt schneller.
    if v_mins > 0 then
      update public.territories
         set defense = greatest(0, defense - v_mins * c_def_drain_per_min),
             updated_at = v_now
       where id = r.territory_id;
      v_changed := true;
    end if;

    if v_prog >= 100 then
      -- Überrennung: Verteidigung bricht ein, Invasion endet.
      update public.territories
         set defense = greatest(0, defense - c_overrun_def_loss),
             last_decay_ts = v_now, updated_at = v_now
       where id = r.territory_id;
      update public.territory_breaches
         set status = 'overrun', progress = 100, last_tick = v_now, resolved_at = v_now
       where id = r.id;
      v_events := v_events || jsonb_build_object(
        'type','overrun','territoryId', r.territory_id,
        'name', coalesce(r.custom_name,'Gebiet'));
      v_changed := true;
    else
      -- Marker driftet langsam Richtung Gebiet, Fortschritt steigt.
      update public.territory_breaches
         set progress = v_prog,
             lat = r.lat + (v_cy - r.lat) * v_drift,
             lng = r.lng + (v_cx - r.lng) * v_drift,
             last_tick = v_now
       where id = r.id;
    end if;
  end loop;

  -- 2) Neue Invasionen auf vernachlässigte Gebiete spawnen (bis max aktiv).
  select count(*) into v_active
    from public.territory_breaches
   where owner = v_user and status = 'active';

  if v_active < c_max_active then
    for r in
      select t.id, t.custom_name,
             ST_Y(ST_Centroid(t.geom)) as cy, ST_X(ST_Centroid(t.geom)) as cx
        from public.territories t
       where t.owner = v_user
         and t.defense < c_threat_def
         and (extract(epoch from (v_now - t.last_defended)) / 3600.0) > c_min_neglect_h
         and not exists (
           select 1 from public.territory_breaches b
            where b.territory_id = t.id and b.status = 'active')
       order by t.defense asc
    loop
      exit when v_active >= c_max_active;
      if random() >= c_spawn_chance then continue; end if;
      v_ang := random() * 2 * pi();
      v_off := 0.0016 + random() * 0.0014;   -- ~180–340 m entfernt
      insert into public.territory_breaches(territory_id, owner, lat, lng, progress, spawned_at, last_tick)
      values (
        r.id, v_user,
        r.cy + sin(v_ang) * v_off,
        r.cx + cos(v_ang) * v_off / cos(r.cy * pi() / 180.0),
        0, v_now, v_now)
      on conflict do nothing;     -- falls parallel bereits gespawnt
      v_active := v_active + 1;
      v_events := v_events || jsonb_build_object(
        'type','spawn','territoryId', r.id,
        'name', coalesce(r.custom_name,'Gebiet'));
      v_changed := true;
    end loop;
  end if;

  -- 3) Aktuelle aktive Liste für den Client zusammenstellen.
  select coalesce(jsonb_agg(jsonb_build_object(
            'id', b.id,
            'terrId', b.territory_id,
            'lat', b.lat,
            'lng', b.lng,
            'progress', b.progress,
            'spawnedAt', round(extract(epoch from b.spawned_at) * 1000)
         )), '[]'::jsonb)
    into v_breaches
    from public.territory_breaches b
   where b.owner = v_user and b.status = 'active';

  return jsonb_build_object(
    'breaches', v_breaches,
    'events', v_events,
    'territoriesChanged', v_changed);
end;
$$;

grant execute on function public.rc_sync_breaches to authenticated;

-- ----------------------------------------------------------------------------
--  rc_repel_breach(breach_id, lat, lng) — Abwehr bei ausreichender Nähe.
-- ----------------------------------------------------------------------------
create or replace function public.rc_repel_breach(
  p_breach_id uuid,
  p_lat       float8,
  p_lng       float8
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c_max_def        constant float8 := 100;
  c_repel_radius_m constant float8 := 45;
  c_repel_repair   constant float8 := 35;
  c_repel_xp       constant float8 := 120;

  v_user uuid := auth.uid();
  v_now  timestamptz := now();
  b      public.territory_breaches%rowtype;
  v_dist float8;
  v_def  float8;
  v_name text;
begin
  if v_user is null then
    raise exception 'rc_repel_breach: not authenticated';
  end if;

  select * into b from public.territory_breaches
   where id = p_breach_id and owner = v_user and status = 'active'
   for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  v_dist := ST_Distance(
    ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
    ST_SetSRID(ST_MakePoint(b.lng, b.lat), 4326)::geography);
  if v_dist > c_repel_radius_m then
    return jsonb_build_object('ok', false, 'reason', 'too_far', 'dist', round(v_dist));
  end if;

  -- Gebiet reparieren + als verteidigt markieren.
  update public.territories
     set defense = least(c_max_def, defense + c_repel_repair),
         last_defended = v_now, last_decay_ts = v_now, updated_at = v_now
   where id = b.territory_id
   returning defense, coalesce(custom_name,'Gebiet') into v_def, v_name;

  update public.territory_breaches
     set status = 'repelled', resolved_at = v_now
   where id = b.id;

  return jsonb_build_object(
    'ok', true,
    'territoryId', b.territory_id,
    'name', v_name,
    'defense', v_def,
    'xp', c_repel_xp);
end;
$$;

grant execute on function public.rc_repel_breach to authenticated;
