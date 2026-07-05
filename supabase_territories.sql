-- Run & Conquer – Globale Gebiete (Server-autoritativ)
-- Im Supabase Dashboard → SQL Editor ausführen (NACH supabase_schema.sql).
--
-- Hintergrund: Bisher waren "Gebiete" pro Nutzer privat in profile_private.game_data
-- gespeichert (nur per RLS für den Besitzer lesbar) und "Gegner" waren lokal pro
-- Gerät simulierte Bots (genRivals/simulateBotRun in index.html). Die Karte war
-- dadurch NICHT für alle Nutzer gleich. Diese Migration ersetzt das durch:
--   1. Eine globale, für alle lesbare PostGIS-Tabelle `territories`.
--   2. Eine einzige autoritative RPC-Funktion `rc_claim()` (SECURITY DEFINER),
--      die ALLE Eroberungsregeln serverseitig durchsetzt. Direkte Schreibzugriffe
--      auf `territories` sind per RLS komplett gesperrt -- nur rc_claim() darf
--      schreiben (sie läuft mit den Rechten des Funktions-Eigentümers).
--   3. Serverseitige Anti-Cheat-Prüfungen für importierte Aktivitäten (TCX/GPX):
--      Flächen-Cap, Pace-Plausibilität, Tageslimit -- da Importe nicht live per
--      GPS verifizierbar sind.
--
-- Scope-Hinweis (bewusste Abgrenzung, siehe Commit-Beschreibung):
--   - Server-autoritativ ist hier NUR Gebiets-Besitz/-Geometrie/-Verteidigung.
--     Das Punkte/XP/Quest-System bleibt wie bisher client-seitig berechnet
--     (profiles.points etc., bereits durch protect_profile_stats() grob
--     plausibilisiert -- siehe supabase_schema.sql).
--   - Wahrzeichen-Bonus bleibt client-asserted (p_landmark_ids): Wahrzeichen
--     kommen live von der Overpass-API (OpenStreetMap) ohne Server-Spiegel;
--     einen solchen Spiegel aufzubauen ist eine eigene, hier nicht beauftragte
--     Erweiterung.
--   - "The Breach" (Invasions-System auf eigene vernachlässigte Gebiete) und
--     der periodische Bot-Angriffs-Timer (simulateBotRun) bleiben rein
--     client-seitige Effekte ohne Server-Persistenz (sie mutieren nur die
--     lokale territories[]-Kopie für Atmosphäre/Dringlichkeit, können aber seit
--     dieser Migration nicht mehr zurückgeschrieben werden, da Direkt-Writes
--     jetzt gesperrt sind). Die für den Spielausgang entscheidende Verteidigung
--     wird stattdessen bei jeder echten Interaktion (rc_claim) verfallsbereinigt
--     berechnet (siehe rc_claim()-Kommentar zu "lazy decay").

create extension if not exists postgis;

-- ── Profiles erweitern ───────────────────────────────────────────────────
alter table public.profiles add column if not exists registered_at timestamptz;
alter table public.profiles add column if not exists is_bot boolean not null default false;
-- Bestehende Nutzer rückwirkend NICHT als "Newcomer" behandeln (siehe rc_claim
-- Newcomer-Schutz, 14 Tage) -- sonst würden alle Alt-Konten beim Start dieser
-- Migration plötzlich 14 Tage unangreifbar.
update public.profiles set registered_at = now() - interval '15 days' where registered_at is null;
alter table public.profiles alter column registered_at set default now();

-- ── Gebiete-Tabelle ──────────────────────────────────────────────────────
create table if not exists public.territories (
  id                   uuid primary key default gen_random_uuid(),
  owner                uuid not null references public.profiles(id) on delete cascade,
  owner_name           text,
  owner_color          text,
  owner_registered_at  timestamptz,
  geom                 geometry(MultiPolygon,4326) not null,
  area_m2              float8 not null check (area_m2 > 0),
  defense              float8 not null default 20 check (defense >= 0 and defense <= 100),
  max_defense          float8 not null default 100,
  rarity               text not null default 'common' check (rarity in ('common','rare','epic','legendary')),
  custom_name          text,
  landmark_ids         text[] not null default '{}',
  attack_history       jsonb not null default '{}'::jsonb,
  is_bot               boolean not null default false,
  created_at           timestamptz not null default now(),
  last_defended        timestamptz not null default now(),
  last_decay_ts        timestamptz not null default now(),
  last_bonus_ts        timestamptz,
  updated_at           timestamptz not null default now()
);

create index if not exists territories_geom_gix on public.territories using gist(geom);
create index if not exists territories_owner_idx on public.territories(owner);

-- Bestandsspalten von Polygon auf MultiPolygon hochstufen (idempotent), damit
-- ST_MakeValid() bei selbstüberschneidenden GPS-Tracks ALLE Polygon-Fragmente
-- behalten kann statt nur das erste (siehe rc_claim()/rc_seed_bot_territory()).
do $$
begin
  if exists (
    select 1 from geometry_columns
    where f_table_schema = 'public' and f_table_name = 'territories'
      and f_geometry_column = 'geom' and type = 'POLYGON'
  ) then
    alter table public.territories alter column geom type geometry(MultiPolygon,4326) using ST_Multi(geom);
  end if;
end $$;

alter table public.territories enable row level security;

drop policy if exists "Alle können Gebiete lesen" on public.territories;
create policy "Alle können Gebiete lesen"
  on public.territories for select using (true);

-- Bewusst KEINE insert/update/delete-Policy: jeder Direktschreibzugriff über
-- den Supabase-Client (anon/authenticated-Rolle) wird von RLS blockiert.
-- Die einzige Schreibmöglichkeit ist rc_claim() (SECURITY DEFINER, läuft mit
-- den Rechten des Funktionsbesitzers und umgeht damit RLS gezielt an genau
-- dieser einen, vertrauenswürdigen Stelle).

-- ── Idempotenz + Tageslimit-Log ─────────────────────────────────────────
-- Jeder rc_claim()-Aufruf wird mit der vom Client erzeugten run/import-id
-- protokolliert. Damit sind Netzwerk-Retries sicher (gleiche id -> gecachtes
-- Ergebnis statt erneuter Spielauswirkung) und Tageslimits für Importe
-- lassen sich einfach abfragen.
create table if not exists public.rc_claims_log (
  id          uuid primary key,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  is_import   boolean not null default false,
  distance_m  float8,
  area_m2     float8,
  result      jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists rc_claims_log_user_idx on public.rc_claims_log(user_id, is_import, created_at);

alter table public.rc_claims_log enable row level security;

drop policy if exists "Nutzer lesen eigene Claims" on public.rc_claims_log;
create policy "Nutzer lesen eigene Claims"
  on public.rc_claims_log for select using (auth.uid() = user_id);
-- Auch hier: kein insert/update/delete für Clients, nur über rc_claim().

-- Realtime: Änderungen an territories an alle verbundenen Clients streamen,
-- damit die Karte ohne Polling für jeden gleich aktuell bleibt.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'territories'
     )
  then
    alter publication supabase_realtime add table public.territories;
  end if;
end $$;

-- ── Hilfsfunktionen (Faithful Port aus index.html) ──────────────────────

-- Port von getLevel(pts) aus index.html (CFG.LVL_XP).
create or replace function public.rc_get_level(p_pts float8)
returns int language plpgsql immutable as $$
declare
  lvl_xp float8[] := array[0,500,1500,4000,10000,25000];
  i int;
begin
  for i in reverse array_length(lvl_xp,1)..1 loop
    if p_pts >= lvl_xp[i] then return i; end if;
  end loop;
  return 1;
end;
$$;

-- Port von pickRarity(hasLandmarks) aus index.html. Gewichtungs-Walk
-- [60,25,12,3] über common/rare/epic/legendary, +1 Stufe bei Wahrzeichen.
create or replace function public.rc_pick_rarity(p_has_landmarks boolean)
returns text language plpgsql as $$
declare
  w float8[] := array[60,25,12];
  r float8 := random()*100;
  i int := 0;
begin
  while i < 3 loop
    r := r - w[i+1];
    if r <= 0 then exit; end if;
    i := i + 1;
  end loop;
  if p_has_landmarks and i < 3 then i := i + 1; end if;
  return (array['common','rare','epic','legendary'])[i+1];
end;
$$;

-- Wandelt eine territories-Zeile in die vom Client erwartete Form um
-- (camelCase-Felder, Zeitstempel als epoch-ms, Geometrie als GeoJSON).
create or replace function public.rc_territory_to_json(t public.territories)
returns jsonb language sql stable as $$
  select jsonb_build_object(
    'id', t.id,
    'owner', t.owner,
    'ownerName', t.owner_name,
    'color', t.owner_color,
    'polygon', ST_AsGeoJSON(t.geom)::jsonb,
    'area', t.area_m2,
    'defense', t.defense,
    'maxDefense', t.max_defense,
    'rarity', t.rarity,
    'customName', t.custom_name,
    'landmarkIds', t.landmark_ids,
    'attackHistory', t.attack_history,
    'isBot', t.is_bot,
    'createdAt', floor(extract(epoch from t.created_at)*1000),
    'lastDefended', floor(extract(epoch from t.last_defended)*1000),
    'ownerRegisteredAt', case when t.owner_registered_at is null then null
                          else floor(extract(epoch from t.owner_registered_at)*1000) end
  );
$$;

-- Liefert alle Gebiete für den initialen Karten-Load. Verfall wird hier nur
-- für die Anzeige live nachgerechnet (nicht persistiert) -- ein reiner Read
-- darf keine Zeilen sperren/schreiben; die persistierte Korrektur passiert
-- weiterhin lazy beim nächsten rc_claim()-Kontakt (siehe dort).
create or replace function public.rc_list_territories()
returns jsonb language sql stable as $$
  select coalesce(jsonb_agg(
    public.rc_territory_to_json(t) || jsonb_build_object(
      'defense', greatest(0, t.defense - (extract(epoch from (now() - t.last_decay_ts))/86400.0) * 5)
    )
  ), '[]'::jsonb)
  from public.territories t;
$$;

-- ── rc_claim(): die einzige autoritative Eroberungs-Funktion ────────────
-- Ersetzt processConquest() aus index.html. p_polygon_geojson ist die vom
-- Client per turf.js gebaute Lauf-/Import-Fläche (np.geometry, [lng,lat]-
-- GeoJSON), genau wie bisher lokal an processConquest übergeben.
--
-- Lazy Decay: anstatt eines periodischen Hintergrund-Tasks (kein Cron in
-- dieser Migration vorausgesetzt) wird der Verfall einer Zeile genau dann
-- nachgeholt und persistiert, wenn sie das nächste Mal durch eine
-- Überlappung berührt wird (FOR UPDATE-Zeilen unten). Das ist deterministisch
-- und global konsistent (anders als die alte, pro Gerät inkonsistente
-- applyDecay()-Logik, die eigene Gebiete von ihrer eigenen Sicht aus vom
-- Verfall ausnahm).
create or replace function public.rc_claim(
  p_claim_id        uuid,
  p_polygon_geojson jsonb,
  p_distance_m      float8,
  p_player_name     text,
  p_user_color      text,
  p_landmark_ids    text[] default '{}',
  p_is_import       boolean default false,
  p_duration_s      float8 default null,
  p_boosted         boolean default false
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c_max_def        constant float8 := 100;
  c_str_dmg_per_km constant float8 := 15;
  c_str_rep_per_km constant float8 := 10;
  c_decay_per_day  constant float8 := 5;
  c_max_age_h      constant float8 := 120;
  c_xp_neutral     constant float8 := 50;
  c_xp_conquer_min constant float8 := 100;
  c_xp_conquer_max constant float8 := 300;
  c_xp_defend      constant float8 := 75;
  c_xp_7day        constant float8 := 200;
  c_lm_def_bonus   constant float8 := 1.3;
  c_lm_pts         constant float8 := 300;
  c_crit_chance    constant float8 := .15;
  c_crit_mul       constant float8 := 2;
  c_combo_h        constant float8 := 24;
  c_combo_multi_3  constant float8 := 1.5;
  c_combo_multi_5  constant float8 := 2.0;
  c_atk_bonus_lvl  constant float8 := .05;
  c_def_regen_lvl  constant float8 := .03;
  c_newcomer_days  constant float8 := 14;
  c_import_area_cap_m2   constant float8 := 2000000; -- 2 km²
  c_import_max_speed_mps constant float8 := 10;       -- = CFG.MAX_SPEED_MPS
  c_import_daily_limit   constant int    := 8;

  v_user        uuid := auth.uid();
  v_cached      jsonb;
  v_geom        geometry;
  v_area        float8;
  v_points      float8;
  v_registered  timestamptz;
  v_level       int;
  v_atk_bonus   float8;
  v_def_bonus   float8;
  v_has_lm      boolean;
  v_overlap_cnt int := 0;
  v_session_conq int := 0;
  v_pts         float8 := 0;
  v_conquered   boolean := false;
  v_defended    boolean := false;
  v_messages    jsonb := '[]'::jsonb;
  v_changed     jsonb := '[]'::jsonb;
  v_new_id      uuid;
  v_today_imports int;
  t             public.territories%rowtype;
  v_decayed     float8;
  v_elapsed_d   float8;
  v_ov_geom     geometry;
  v_ov_area     float8;
  v_overlap_frac float8;
  v_km_through  float8;
  v_cover_frac  float8;
  v_cover_dmg   float8;
  v_dmg         float8;
  v_crit        boolean;
  v_last_atk    float8;
  v_combo_bonus boolean;
  v_now_ms      float8;
  v_rep         float8;
  v_day_held    float8;
  v_combo_mul   float8;
  v_conquest_xp float8;
begin
  if v_user is null then
    raise exception 'rc_claim: not authenticated';
  end if;

  -- Idempotenz: identische claim_id (z.B. nach Netzwerk-Retry) liefert das
  -- bereits berechnete Ergebnis zurück, ohne die Spielwelt erneut zu ändern.
  select result into v_cached from public.rc_claims_log where id = p_claim_id;
  if v_cached is not null then
    return v_cached;
  end if;

  select points, registered_at into v_points, v_registered
    from public.profiles where id = v_user;
  if not found then
    raise exception 'rc_claim: profile not found for %', v_user;
  end if;
  v_points := coalesce(v_points, 0);

  -- Geometrie bauen + validieren (ST_MakeValid kann bei selbstüberschneidenden
  -- Pfaden -- typisch für echte GPS-Tracks mit Jitter/Schleifen -- eine
  -- GeometryCollection oder ein MultiPolygon mit mehreren Fragmenten liefern.
  -- Alle Fragmente behalten (ST_Dump+ST_Union), nur Mikro-Splitter durch
  -- Floating-Point-Rauschen verwerfen (< 1 m²) statt nur das erste zu nehmen.
  v_geom := ST_SetSRID(ST_GeomFromGeoJSON(p_polygon_geojson::text), 4326);
  v_geom := ST_MakeValid(v_geom);
  if GeometryType(v_geom) = 'GEOMETRYCOLLECTION' then
    v_geom := ST_CollectionExtract(v_geom, 3);
  end if;
  if v_geom is null or ST_IsEmpty(v_geom) then
    raise exception 'rc_claim: invalid polygon';
  end if;
  select ST_Multi(ST_Union(dmp.geom)) into v_geom
    from ST_Dump(v_geom) as dmp
    where ST_Area(dmp.geom::geography) > 1;
  if v_geom is null or ST_IsEmpty(v_geom) then
    raise exception 'rc_claim: invalid polygon';
  end if;

  v_area := ST_Area(v_geom::geography);
  if v_area <= 0 then
    raise exception 'rc_claim: zero-area polygon';
  end if;

  if p_is_import then
    if v_area > c_import_area_cap_m2 then
      raise exception 'rc_claim: import_area_cap_exceeded';
    end if;
    if p_duration_s is null or p_duration_s <= 0
       or (p_distance_m / p_duration_s) > c_import_max_speed_mps then
      raise exception 'rc_claim: import_pace_implausible';
    end if;
    select count(*) into v_today_imports from public.rc_claims_log
      where user_id = v_user and is_import and created_at >= now() - interval '24 hours';
    if v_today_imports >= c_import_daily_limit then
      raise exception 'rc_claim: import_daily_limit_reached';
    end if;
  end if;

  v_level := public.rc_get_level(v_points);
  v_atk_bonus := (1 + (v_level-1)*c_atk_bonus_lvl) * (case when p_boosted then 1.3 else 1 end);
  v_def_bonus := 1 + (v_level-1)*c_def_regen_lvl;
  v_has_lm := coalesce(array_length(p_landmark_ids,1),0) > 0;
  v_now_ms := floor(extract(epoch from now())*1000);

  -- Alle überlappenden Gebiete sperren, in fester Reihenfolge (id), um
  -- Deadlocks bei parallelen Claims mit überschneidenden Gebietsmengen zu
  -- vermeiden (Standard-Postgres-Empfehlung: Zeilen immer in derselben
  -- globalen Ordnung locken).
  for t in
    select * from public.territories
    where ST_Intersects(geom, v_geom)
    order by id
    for update
  loop
    v_overlap_cnt := v_overlap_cnt + 1;

    -- Lazy Decay seit der letzten Berührung nachholen.
    v_elapsed_d := extract(epoch from (now() - t.last_decay_ts)) / 86400.0;
    v_decayed := greatest(0, t.defense - v_elapsed_d * c_decay_per_day);

    v_ov_geom := ST_Intersection(t.geom, v_geom);
    v_ov_area := coalesce(ST_Area(v_ov_geom::geography), 0);
    v_overlap_frac := least(1, v_ov_area / greatest(v_area, 1));
    v_km_through := (p_distance_m/1000.0) * v_overlap_frac;
    -- Deckungsgrad: WIE VIEL DES GEGNER-Gebiets liegt in deinem Claim. Umrundest
    -- (schließt du es ein) oder überdeckst du es, geht das gegen 1 -- unabhängig
    -- davon, wie groß dein eigenes Polygon ist. Das ist die Basis dafür, dass
    -- „umrunden/durchqueren" das GANZE Gebiet kippt, nicht nur ein Randstreifen.
    v_cover_frac := least(1, v_ov_area / greatest(t.area_m2, 1));

    if t.owner = v_user then
      -- Eigenes Gebiet → Reparatur
      v_rep := least(c_max_def - v_decayed, v_km_through * c_str_rep_per_km * v_def_bonus);
      if v_rep > 0.1 then
        update public.territories set
          defense = least(c_max_def, v_decayed + v_rep),
          last_defended = now(), last_decay_ts = now(), updated_at = now()
        where id = t.id returning * into t;
        v_pts := v_pts + c_xp_defend;
        v_defended := true;
        v_messages := v_messages || jsonb_build_object('type','repaired','territoryId',t.id,'defense',t.defense);
      else
        update public.territories set defense = v_decayed, last_decay_ts = now()
          where id = t.id returning * into t;
      end if;

      v_day_held := extract(epoch from (now() - t.created_at)) / 86400.0;
      if v_day_held >= 7 and (t.last_bonus_ts is null or now() - t.last_bonus_ts >= interval '7 days') then
        v_pts := v_pts + c_xp_7day;
        update public.territories set last_bonus_ts = now() where id = t.id returning * into t;
        v_messages := v_messages || jsonb_build_object('type','bonus_7day','territoryId',t.id,'xp',c_xp_7day);
      end if;

      v_changed := v_changed || public.rc_territory_to_json(t);
    else
      -- Newcomer-Schutz: frisch registrierte Besitzer 14 Tage unangreifbar.
      if t.owner_registered_at is not null
         and now() - t.owner_registered_at < (c_newcomer_days || ' days')::interval then
        update public.territories set defense = v_decayed, last_decay_ts = now() where id = t.id;
        v_messages := v_messages || jsonb_build_object('type','newcomer_protected','territoryId',t.id);
        continue;
      end if;

      -- Feindgebiet → Angriff. Zwei Schadensquellen, es zählt die STÄRKERE:
      --  1) Durchlauf-Schaden: proportional zur tatsächlich im Gebiet gelaufenen
      --     Strecke (ein gerader Durchgang schwächt anteilig).
      --  2) Deckungs-Schaden: proportional dazu, wie viel des Gebiets dein Claim
      --     abdeckt. Volle Deckung (umrunden/überdecken) = c_max_def Schaden ->
      --     nimmt selbst ein voll verteidigtes Gebiet ein; Teildeckung schwächt
      --     anteilig, und ein bereits schwaches Gebiet kippt schon bei wenig.
      -- So erfüllt sich der Wunsch „umrunden/genug Schaden -> ganzes Gebiet wird
      -- deins", ohne dass ein bloßer Randkontakt die Verteidigung wertlos macht.
      v_cover_dmg := v_cover_frac * c_max_def * v_atk_bonus;
      v_dmg := greatest(v_km_through * c_str_dmg_per_km * v_atk_bonus, v_cover_dmg);
      v_crit := random() < c_crit_chance;
      if v_crit then v_dmg := v_dmg * c_crit_mul; end if;
      v_dmg := least(v_decayed, v_dmg);

      v_last_atk := (t.attack_history ->> v_user::text)::float8;
      v_combo_bonus := v_last_atk is not null and v_last_atk > 0 and (v_now_ms - v_last_atk) < c_combo_h*3600000;
      if v_combo_bonus then v_pts := v_pts + 25; end if;

      v_pts := v_pts + floor(v_dmg*2) + 15;

      if v_crit then
        v_messages := v_messages || jsonb_build_object('type','critical_hit');
      end if;
      if v_combo_bonus then
        v_messages := v_messages || jsonb_build_object('type','combo_bonus','xp',25);
      end if;

      if (v_decayed - v_dmg) <= 0 then
        -- Gebiet erobert!
        v_session_conq := v_session_conq + 1;
        v_combo_mul := case when v_session_conq >= 5 then c_combo_multi_5
                            when v_session_conq >= 3 then c_combo_multi_3
                            else 1 end;
        v_conquest_xp := round(least(c_xp_conquer_max, c_xp_conquer_min + floor(t.area_m2/500)) * v_combo_mul);
        v_pts := v_pts + v_conquest_xp;
        v_conquered := true;

        update public.territories set
          owner = v_user, owner_name = p_player_name, owner_color = p_user_color,
          owner_registered_at = v_registered,
          defense = 20, max_defense = c_max_def,
          last_defended = now(), last_decay_ts = now(), created_at = now(), last_bonus_ts = null,
          attack_history = jsonb_set(coalesce(t.attack_history,'{}'::jsonb), array[v_user::text], to_jsonb(v_now_ms)),
          rarity = coalesce(t.rarity, public.rc_pick_rarity(array_length(t.landmark_ids,1) > 0)),
          updated_at = now()
        where id = t.id returning * into t;

        v_messages := v_messages || jsonb_build_object('type','conquered','territoryId',t.id,'rarity',t.rarity,'comboMul',v_combo_mul,'xp',v_conquest_xp);
      else
        update public.territories set
          defense = v_decayed - v_dmg, last_decay_ts = now(),
          last_defended = now(),
          attack_history = jsonb_set(coalesce(t.attack_history,'{}'::jsonb), array[v_user::text], to_jsonb(v_now_ms)),
          updated_at = now()
        where id = t.id returning * into t;
        v_messages := v_messages || jsonb_build_object('type','attacked','territoryId',t.id,'defense',t.defense,'dmg',round(v_dmg));
      end if;

      v_changed := v_changed || public.rc_territory_to_json(t);
    end if;
  end loop;

  if v_overlap_cnt = 0 then
    -- Neutral → sofortige Einnahme
    v_session_conq := v_session_conq + 1;
    declare
      v_comb float8 := case when v_session_conq >= 5 then c_combo_multi_5
                            when v_session_conq >= 3 then c_combo_multi_3
                            else 1 end;
      v_init_def float8 := least(c_max_def, 30 + floor(p_distance_m/200));
      v_rarity text := public.rc_pick_rarity(v_has_lm);
      v_xp float8;
    begin
      if v_has_lm then
        v_init_def := least(c_max_def, floor(v_init_def * c_lm_def_bonus));
        v_pts := v_pts + c_lm_pts;
        v_messages := v_messages || jsonb_build_object('type','landmark_bonus','pts',c_lm_pts);
      end if;

      v_xp := round((c_xp_neutral + least(c_xp_conquer_max - c_xp_neutral, floor(v_area/500))) * v_comb);
      v_pts := v_pts + v_xp;

      insert into public.territories (
        owner, owner_name, owner_color, owner_registered_at, geom, area_m2,
        defense, max_defense, rarity, landmark_ids
      ) values (
        v_user, p_player_name, p_user_color, v_registered, v_geom, v_area,
        v_init_def, c_max_def, v_rarity, p_landmark_ids
      ) returning id into v_new_id;

      select * into t from public.territories where id = v_new_id;
      v_changed := v_changed || public.rc_territory_to_json(t);
      v_messages := v_messages || jsonb_build_object('type','neutral_claim','territoryId',v_new_id,'rarity',v_rarity,'comboMul',v_comb,'xp',v_xp);
    end;
  end if;

  -- Globale Aufräum-Spülung, begrenzt auf die soeben gesperrten Zeilen: eine
  -- Zeile, die durch Verfall bei 0 Verteidigung steht und seit c_max_age_h
  -- Stunden nicht mehr verteidigt wurde, gilt als aufgegeben.
  delete from public.territories
   where id in (select (jsonb_array_elements(v_changed)->>'id')::uuid)
     and defense <= 0
     and now() - last_defended >= (c_max_age_h || ' hours')::interval;

  declare
    v_result jsonb;
  begin
    v_result := jsonb_build_object(
      'pts', v_pts, 'conquered', v_conquered, 'defended', v_defended,
      'area', v_area, 'territories', v_changed, 'messages', v_messages
    );
    insert into public.rc_claims_log (id, user_id, is_import, distance_m, area_m2, result)
      values (p_claim_id, v_user, p_is_import, p_distance_m, v_area, v_result);
    return v_result;
  end;
end;
$$;

revoke all on function public.rc_claim from public;
grant execute on function public.rc_claim to authenticated;

-- Wartungsfunktion: wendet Verfall auf länger nicht berührte Gebiete an und
-- entfernt bei 0 Verteidigung aufgegebene, alte Gebiete. Optional über
-- Supabase → Database → Cron Jobs alle 30 Min. einplanen
-- (select cron.schedule('rc-decay','*/30 * * * *', $$select public.rc_apply_global_decay()$$);
-- falls die pg_cron-Extension auf dem Projekt verfügbar ist). Ohne Cron
-- verfällt ein Gebiet weiterhin korrekt -- nur eben erst beim nächsten
-- rc_claim()-Kontakt (siehe "Lazy Decay" oben) statt im Hintergrund.
create or replace function public.rc_apply_global_decay(p_limit int default 500)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  c_decay_per_day constant float8 := 5;
  c_max_age_h     constant float8 := 120;
  v_n int;
begin
  with stale as (
    select id from public.territories
    where now() - last_decay_ts > interval '1 hour'
    order by last_decay_ts asc
    limit p_limit
    for update
  )
  update public.territories tr set
    defense = greatest(0, tr.defense - (extract(epoch from (now()-tr.last_decay_ts))/86400.0) * c_decay_per_day),
    last_decay_ts = now()
  where tr.id in (select id from stale);
  get diagnostics v_n = row_count;

  delete from public.territories
   where defense <= 0 and now() - last_defended >= (c_max_age_h || ' hours')::interval;

  return v_n;
end;
$$;

revoke all on function public.rc_apply_global_decay from public;
grant execute on function public.rc_apply_global_decay to authenticated;

-- Erlaubt es einem eingeloggten Client, ein Bot-Gebiet anzulegen (für
-- genRivals()/runOneBot() in index.html, die weiterhin client-seitig anhand
-- des Straßen-Graphen um den Spieler herum realistische Bot-Polygone bauen --
-- nur das Schreiben geht jetzt über diese RPC statt über lokale territories[]
-- -Mutation, damit Bot-Gebiete für alle Nutzer sichtbar sind). Schreibt
-- ausdrücklich NUR auf Profile mit is_bot=true -- ein Aufrufer kann sich damit
-- kein eigenes Gebiet erschleichen, da p_owner gegen is_bot=true geprüft wird.
create or replace function public.rc_seed_bot_territory(
  p_owner           uuid,
  p_polygon_geojson jsonb,
  p_custom_name     text default null,
  p_rarity          text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_geom  geometry;
  v_area  float8;
  v_is_bot boolean;
  t public.territories%rowtype;
begin
  if auth.uid() is null then
    raise exception 'rc_seed_bot_territory: not authenticated';
  end if;

  select is_bot into v_is_bot from public.profiles where id = p_owner;
  if v_is_bot is distinct from true then
    raise exception 'rc_seed_bot_territory: owner is not a bot profile';
  end if;

  v_geom := ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON(p_polygon_geojson::text), 4326));
  if GeometryType(v_geom) = 'GEOMETRYCOLLECTION' then v_geom := ST_CollectionExtract(v_geom, 3); end if;
  if v_geom is null or ST_IsEmpty(v_geom) then return null; end if;
  select ST_Multi(ST_Union(dmp.geom)) into v_geom
    from ST_Dump(v_geom) as dmp
    where ST_Area(dmp.geom::geography) > 1;
  if v_geom is null or ST_IsEmpty(v_geom) then return null; end if;

  -- Wie im alten genRivals(): bei Überschneidung mit einem bestehenden
  -- Gebiet wird dieser Kandidat übersprungen statt erzwungen.
  if exists (select 1 from public.territories where ST_Intersects(geom, v_geom)) then
    return null;
  end if;

  v_area := ST_Area(v_geom::geography);
  if v_area <= 0 then return null; end if;

  insert into public.territories (owner, owner_name, owner_color, geom, area_m2, defense, max_defense, rarity, custom_name, is_bot)
  select p_owner, player_name, user_color, v_geom, v_area, 20 + floor(random()*61), 100,
         coalesce(p_rarity, public.rc_pick_rarity(false)), p_custom_name, true
  from public.profiles where id = p_owner
  returning * into t;

  return public.rc_territory_to_json(t);
end;
$$;

revoke all on function public.rc_seed_bot_territory from public;
grant execute on function public.rc_seed_bot_territory to authenticated;

-- ── Bot-Welt seeden ──────────────────────────────────────────────────────
-- Feste UUIDs (müssen mit BOT_UUIDS in index.html übereinstimmen), damit die
-- Karte nicht leer startet, bevor reale Nutzer Gebiete erobert haben.
insert into public.profiles (id, player_name, user_avatar, user_color, points, total_km, total_conquered, streak_days, is_bot, registered_at)
values
  ('00000000-0000-0000-0000-0000000000b1','Roter Wolf','🐺','#ff4d6d',8420,142.3,47,14,true,now()-interval '120 days'),
  ('00000000-0000-0000-0000-0000000000b2','Eiserne Hand','✊','#00d4ff',7110,118.7,31,9,true,now()-interval '120 days'),
  ('00000000-0000-0000-0000-0000000000b3','Stahl-Garde','⚔️','#9b5de5',5830,96.2,23,7,true,now()-interval '120 days'),
  ('00000000-0000-0000-0000-0000000000b4','Nachtwache','🌙','#ff9f1c',3210,58.1,12,3,true,now()-interval '120 days'),
  ('00000000-0000-0000-0000-0000000000b5','Sturmbrecher','⚡','#10b981',2100,41.5,8,5,true,now()-interval '120 days')
on conflict (id) do nothing;
