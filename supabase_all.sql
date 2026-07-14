-- ============================================================================
--  Runners Conquer — KOMPLETTES Datenbank-Setup (alle Migrationen in einem)
-- ----------------------------------------------------------------------------
--  Einmal komplett im Supabase SQL-Editor ausführen (Reihenfolge beachtet).
--  Alle Teile sind idempotent -> mehrfaches Ausführen ist unbedenklich.
--  Danach noch die Edge Functions deployen: conquer, bot_tick.
-- ============================================================================


-- ############################################################################
-- ## supabase_schema.sql
-- ############################################################################
-- Run & Conquer – Supabase Schema
-- Im Supabase Dashboard → SQL Editor ausführen

-- Profiles Tabelle
create table if not exists public.profiles (
  id           uuid primary key,
  player_name  text not null,
  user_avatar  text default '🏃',
  user_color   text default '#e8ff47',
  points       integer default 0,
  total_km     float8  default 0,
  total_conquered integer default 0,
  streak_days  integer default 0,
  updated_at   timestamptz default now()
);

-- Spalten, die im Client (syncProfile()) genutzt werden, aber ursprünglich
-- nicht in dieser Datei dokumentiert waren. ADD COLUMN IF NOT EXISTS ist
-- ein No-Op bei Fresh-Setups (Spalten existieren schon aus CREATE TABLE
-- oben) und ergänzt sie sicher auf der bestehenden Live-DB.
alter table public.profiles add column if not exists user_id text;
alter table public.profiles add column if not exists user_team text;
alter table public.profiles add column if not exists club_code text;
alter table public.profiles add column if not exists user_avatar_img text; -- Profilbild (Rangliste)

alter table public.profiles enable row level security;

drop policy if exists "Alle können Profile lesen" on public.profiles;
create policy "Alle können Profile lesen"
  on public.profiles for select using (true);

drop policy if exists "Nutzer verwalten eigenes Profil" on public.profiles;
create policy "Nutzer verwalten eigenes Profil"
  on public.profiles for all using (auth.uid() = id);

-- Private Spielstände (u.a. komprimierte GPS-Lauf-Historie der letzten 20
-- Läufe) bewusst NICHT in profiles: RLS ist zeilen-, nicht spaltenbasiert.
-- Die obige "Alle können Profile lesen"-Policy (using(true), nötig für die
-- öffentliche Rangliste) hätte sonst per select('*') oder gezieltem
-- select('game_data') auch die GPS-Routen jedes Nutzers für jeden lesbar
-- gemacht (Rückschluss auf Wohn-/Arbeitsort). profile_private ist nur für
-- den jeweiligen Besitzer lesbar.
create table if not exists public.profile_private (
  id         uuid primary key references public.profiles(id) on delete cascade,
  game_data  text,
  updated_at timestamptz default now()
);

-- Bereits vorhandene game_data-Werte aus profiles übernehmen, falls die
-- Spalte dort aus der Zeit vor dieser Migration noch existiert.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='profiles' and column_name='game_data'
  ) then
    insert into public.profile_private (id, game_data)
    select id, game_data::text from public.profiles where game_data is not null
    on conflict (id) do update set game_data=excluded.game_data;
    alter table public.profiles drop column game_data;
  end if;
end $$;

alter table public.profile_private enable row level security;

drop policy if exists "Nutzer lesen eigene private Daten" on public.profile_private;
create policy "Nutzer lesen eigene private Daten"
  on public.profile_private for select using (auth.uid() = id);

drop policy if exists "Nutzer schreiben eigene private Daten" on public.profile_private;
create policy "Nutzer schreiben eigene private Daten"
  on public.profile_private for all using (auth.uid() = id) with check (auth.uid() = id);

-- Schranke gegen Rangliste-Manipulation: points/total_km/total_conquered
-- werden komplett client-seitig berechnet und ungeprüft hochgeschrieben.
-- Diese Funktion blockt Updates, deren Zuwachs seit dem letzten Sync
-- (zeitfenster-basiert, nicht starr pro Aufruf) physikalisch nicht
-- plausibel ist, z.B. ein Sprung auf 999999999 Punkte per Browser-Konsole.
create or replace function public.protect_profile_stats()
returns trigger as $$
declare
  hours_elapsed float8;
  max_km_delta float8;
  max_points_delta float8;
  max_conquered_delta float8;
begin
  hours_elapsed := greatest(extract(epoch from (now() - coalesce(old.updated_at, now()))) / 3600.0, 0.01);
  -- großzügige Obergrenzen: ~20 km/h Dauerschnitt + fester Puffer pro Sync
  max_km_delta := hours_elapsed * 20 + 10;
  max_points_delta := hours_elapsed * 500 + 500;
  max_conquered_delta := hours_elapsed * 5 + 10;

  if (coalesce(new.total_km,0) - coalesce(old.total_km,0)) > max_km_delta
     or (coalesce(new.points,0) - coalesce(old.points,0)) > max_points_delta
     or (coalesce(new.total_conquered,0) - coalesce(old.total_conquered,0)) > max_conquered_delta then
    raise exception 'Unplausibler Fortschritts-Sprung abgelehnt (km:%, pts:%, terr:%)',
      coalesce(new.total_km,0) - coalesce(old.total_km,0),
      coalesce(new.points,0) - coalesce(old.points,0),
      coalesce(new.total_conquered,0) - coalesce(old.total_conquered,0);
  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_protect_profile_stats on public.profiles;
create trigger trg_protect_profile_stats
  before update on public.profiles
  for each row execute function public.protect_profile_stats();

-- Runs Tabelle
create table if not exists public.runs (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references public.profiles(id) on delete cascade,
  player_name  text,
  distance     float8,
  duration     integer,
  points       integer,
  kcal         integer,
  conquered    boolean default false,
  defended     boolean default false,
  path         jsonb,
  created_at   timestamptz default now()
);

alter table public.runs enable row level security;

drop policy if exists "Alle können Runs lesen" on public.runs;
create policy "Alle können Runs lesen"
  on public.runs for select using (true);

drop policy if exists "Nutzer fügen eigene Runs ein" on public.runs;
create policy "Nutzer fügen eigene Runs ein"
  on public.runs for insert with check (auth.uid() = user_id);

-- UPDATE-Policy: nötig für syncRun()'s upsert(...,{onConflict:'id'}) – ohne sie
-- würde der ON-CONFLICT-DO-UPDATE-Pfad bei Retries an RLS scheitern, da
-- upsert technisch ein INSERT mit Fallback auf UPDATE ist.
drop policy if exists "Nutzer aktualisieren eigene Runs" on public.runs;
create policy "Nutzer aktualisieren eigene Runs"
  on public.runs for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- DELETE-Policy: ohne sie scheitert deleteAccount()'s expliziter
-- runs-delete()-Aufruf (DSGVO Art. 17) stillschweigend an RLS (0 Zeilen
-- gelöscht, kein Error) -- nur über die anschließende profiles-Löschung
-- per ON DELETE CASCADE würden die Runs zufällig trotzdem verschwinden.
drop policy if exists "Nutzer löschen eigene Runs" on public.runs;
create policy "Nutzer löschen eigene Runs"
  on public.runs for delete using (auth.uid() = user_id);

-- Support Messages Tabelle
create table if not exists public.support_messages (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references public.profiles(id) on delete set null,
  player_name  text,
  subject      text default 'Kein Betreff',
  message      text not null,
  admin_reply  text,
  replied_at   timestamptz,
  created_at   timestamptz default now()
);

alter table public.support_messages enable row level security;

-- INSERT: user_id muss (NULL-sicher) der eigene auth.uid() sein, Admin-Felder
-- duerfen beim Einfuegen nicht vorbelegt werden (verhindert Identitaets- und
-- Antwort-Faelschung, z.B. bei DSGVO-Loeschantraegen)
drop policy if exists "Nutzer senden eigene Support-Nachrichten" on public.support_messages;
create policy "Nutzer senden eigene Support-Nachrichten"
  on public.support_messages for insert
  with check (
    auth.uid() is not distinct from user_id
    and admin_reply is null
    and replied_at is null
  );

drop policy if exists "Nutzer lesen eigene Nachrichten, Admin liest alle" on public.support_messages;
create policy "Nutzer lesen eigene Nachrichten, Admin liest alle"
  on public.support_messages for select
  using (
    (auth.jwt() ->> 'email') = 'maxst0297@gmail.com'
    or auth.uid() = user_id
  );

drop policy if exists "Admin aktualisiert Nachrichten" on public.support_messages;
create policy "Admin aktualisiert Nachrichten"
  on public.support_messages for update
  using ((auth.jwt() ->> 'email') = 'maxst0297@gmail.com')
  with check ((auth.jwt() ->> 'email') = 'maxst0297@gmail.com');

drop policy if exists "Admin löscht Nachrichten" on public.support_messages;
create policy "Admin löscht Nachrichten"
  on public.support_messages for delete
  using ((auth.jwt() ->> 'email') = 'maxst0297@gmail.com');

-- Direct Messages Tabelle
-- (war bisher nur als showSqlHint('dm')-String im Client dokumentiert,
-- nicht in dieser Datei -- bei einem Fresh-Setup allein aus diesem Schema
-- hätte die Tabelle samt RLS gefehlt bzw. wäre der Nutzer auf die alte,
-- unsichere Variante angewiesen gewesen)
create table if not exists public.direct_messages (
  id         uuid default gen_random_uuid() primary key,
  from_uid   text not null,
  from_name  text not null,
  to_uid     text not null,
  to_name    text not null,
  content    text not null,
  created_at timestamptz default now(),
  read_at    timestamptz
);

-- Falls main's eigenes supabase_fix.sql diese Tabelle bereits mit
-- UUID-Spalten angelegt hat: auf TEXT umstellen, sonst scheitern die
-- Policies unten (Vergleich mit auth.uid()::text) an "operator does
-- not exist: uuid = text".
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='direct_messages'
      and column_name='from_uid' and data_type='uuid'
  ) then
    alter table public.direct_messages alter column from_uid type text using from_uid::text;
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='direct_messages'
      and column_name='to_uid' and data_type='uuid'
  ) then
    alter table public.direct_messages alter column to_uid type text using to_uid::text;
  end if;
end $$;

alter table public.direct_messages enable row level security;


-- SELECT: nur Sender + Empfänger dürfen lesen
drop policy if exists "dm_select" on public.direct_messages;
create policy "dm_select" on public.direct_messages
  for select using (auth.uid()::text in (from_uid, to_uid));

-- INSERT: from_uid MUSS die eigene Auth-ID sein (verhindert Absender-Fälschung)
drop policy if exists "dm_insert" on public.direct_messages;
create policy "dm_insert" on public.direct_messages
  for insert with check (from_uid = auth.uid()::text);

-- UPDATE: Sender + Empfänger dürfen updaten (z.B. read_at setzen)
drop policy if exists "dm_update" on public.direct_messages;
create policy "dm_update" on public.direct_messages
  for update using (auth.uid()::text in (from_uid, to_uid));

-- DELETE: Sender + Empfänger dürfen löschen (Chat leeren)
drop policy if exists "dm_delete" on public.direct_messages;
create policy "dm_delete" on public.direct_messages
  for delete using (auth.uid()::text in (from_uid, to_uid));

-- Trigger: from_uid/to_uid/content/created_at sind nach dem Insert unveränderlich
create or replace function public.protect_dm_fields()
returns trigger as $$
begin
  if (new.from_uid is distinct from old.from_uid or
      new.to_uid is distinct from old.to_uid or
      new.content is distinct from old.content or
      new.created_at is distinct from old.created_at) then
    raise exception 'from_uid/to_uid/content/created_at duerfen nicht geaendert werden';
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_protect_dm_fields on public.direct_messages;
create trigger trg_protect_dm_fields
  before update on public.direct_messages
  for each row execute function public.protect_dm_fields();

-- Follow Requests Tabelle
-- DMs sollen erst nach gegenseitig angenommener Follow-Anfrage möglich sein,
-- damit Nutzer nicht von Fremden belästigt werden können. Eine Richtung
-- "accepted" reicht aus (kein gegenseitiges Doppel-Follow nötig).
create table if not exists public.follow_requests (
  id             uuid primary key default gen_random_uuid(),
  requester_uid  uuid not null references public.profiles(id) on delete cascade,
  requester_name text,
  target_uid     uuid not null references public.profiles(id) on delete cascade,
  target_name    text,
  status         text not null default 'pending' check (status in ('pending','accepted','declined')),
  created_at     timestamptz default now(),
  responded_at   timestamptz,
  constraint follow_requests_no_self check (requester_uid <> target_uid)
);

create unique index if not exists idx_follow_requests_pair on public.follow_requests(requester_uid, target_uid);
create index if not exists idx_follow_requests_lookup on public.follow_requests(requester_uid, target_uid, status);
create index if not exists idx_follow_requests_lookup_rev on public.follow_requests(target_uid, requester_uid, status);

alter table public.follow_requests enable row level security;

drop policy if exists "fr_select" on public.follow_requests;
create policy "fr_select" on public.follow_requests
  for select using (auth.uid() in (requester_uid, target_uid));

-- INSERT: nur als eigene pending-Anfrage möglich (verhindert Fälschung/Vorab-Annahme)
drop policy if exists "fr_insert" on public.follow_requests;
create policy "fr_insert" on public.follow_requests
  for insert with check (
    requester_uid = auth.uid()
    and status = 'pending'
    and responded_at is null
  );

-- UPDATE: nur das Ziel darf annehmen/ablehnen
drop policy if exists "fr_update" on public.follow_requests;
create policy "fr_update" on public.follow_requests
  for update using (auth.uid() = target_uid) with check (auth.uid() = target_uid);

-- DELETE: beide Seiten dürfen löschen (Anfrage zurückziehen / entfolgen)
drop policy if exists "fr_delete" on public.follow_requests;
create policy "fr_delete" on public.follow_requests
  for delete using (auth.uid() in (requester_uid, target_uid));

-- requester_uid/target_uid/created_at sind nach dem Insert unveränderlich
create or replace function public.protect_follow_request_fields()
returns trigger as $$
begin
  if (new.requester_uid is distinct from old.requester_uid or
      new.target_uid is distinct from old.target_uid or
      new.created_at is distinct from old.created_at) then
    raise exception 'requester_uid/target_uid/created_at duerfen nicht geaendert werden';
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_protect_follow_request_fields on public.follow_requests;
create trigger trg_protect_follow_request_fields
  before update on public.follow_requests
  for each row execute function public.protect_follow_request_fields();

-- DM-Insert-Policy verschärfen: Nachrichten nur zwischen Nutzern mit
-- angenommener Follow-Anfrage (verhindert Spam/Belästigung durch Fremde;
-- zusätzlich UI-seitig gegated über followStatus()==='accepted')
drop policy if exists "dm_insert" on public.direct_messages;
create policy "dm_insert" on public.direct_messages
  for insert with check (
    from_uid = auth.uid()::text
    and exists (
      select 1 from public.follow_requests fr
      where fr.status = 'accepted'
        and (
          (fr.requester_uid = auth.uid() and fr.target_uid::text = to_uid)
          or (fr.target_uid = auth.uid() and fr.requester_uid::text = to_uid)
        )
    )
  );


-- ############################################################################
-- ## supabase_is_admin.sql
-- ############################################################################
-- ============================================================================
--  is_admin() — zentrale Admin-Prüfung (optional, für Wartbarkeit)
-- ----------------------------------------------------------------------------
--  WICHTIG ZUR EINORDNUNG: Die App bestimmt isAdmin clientseitig nur, um die
--  Admin-UI ein-/auszublenden. Das ist KEIN Sicherheitsrisiko, denn die
--  eigentlichen Admin-Daten (app_logs, support_messages …) sind serverseitig
--  per RLS geschützt, die die E-Mail des Aufrufers prüft. Wer die Client-
--  Variable manipuliert, sieht zwar Buttons, bekommt aber vom Server keine
--  fremden Daten.
--
--  Diese Funktion zentralisiert die bisher in mehreren Policies wiederholte
--  E-Mail-Prüfung an EINER Stelle. Dadurch muss bei einer Änderung (z. B.
--  weiterer Admin) nur hier angepasst werden, statt jede Policy einzeln.
--  Der Wechsel bestehender Policies auf is_admin() ist bewusst NICHT Teil
--  dieser Migration (kein Lockout-Risiko) — er kann später schrittweise
--  erfolgen, z. B.:  USING ( public.is_admin() )
--
--  Idempotent: mehrfach im Supabase-SQL-Editor ausführbar.
-- ============================================================================
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((auth.jwt() ->> 'email') = 'maxst0297@gmail.com', false);
$$;

grant execute on function public.is_admin() to authenticated;


-- ############################################################################
-- ## supabase_territories.sql
-- ############################################################################
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
  -- Tempo-Modell für den Angriffsschaden: der Schaden skaliert mit dem
  -- Lauftempo. Bei c_speed_ref (m/s) ist der Faktor 1.0; darunter weniger (bis
  -- c_speed_floor), darüber mehr (bis c_speed_cap). Dadurch reicht Umrunden
  -- allein NICHT zur Übernahme -- man muss schnell genug laufen (oder das Gebiet
  -- ist bereits geschwächt). c_speed_ref ≈ 14 km/h. Diese drei Werte sind die
  -- Stellschrauben für die Balance.
  c_speed_ref   constant float8 := 3.9;
  c_speed_floor constant float8 := 0.45;
  c_speed_cap   constant float8 := 1.8;

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
  v_speed_mult  float8;
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
  -- Tempo-Faktor: schnelleres Laufen = mehr Angriffsschaden. Fehlt die Laufzeit
  -- (alte Clients), neutral 1.0 annehmen.
  v_speed_mult := case
    when p_duration_s is not null and p_duration_s > 0
      then least(c_speed_cap, greatest(c_speed_floor, (p_distance_m / p_duration_s) / c_speed_ref))
    else 1 end;
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

      -- Feindgebiet → Angriff. Roh-Schaden = der STÄRKERE aus:
      --  1) Durchlauf-Strecke: proportional zur im Gebiet gelaufenen Strecke.
      --  2) Gebietsdeckung: wie viel des Gebiets der Claim abdeckt (umrunden/
      --     überdecken → nahe c_max_def).
      -- Dieser Roh-Schaden wird mit dem TEMPO-Faktor und dem Angriffsbonus
      -- skaliert. Dadurch ist Umrunden allein KEIN sicherer Sieg: nur wer schnell
      -- genug läuft (oder ein bereits geschwächtes Gebiet angreift) bringt genug
      -- Schaden, um die Verteidigung ganz zu brechen. Ein Randkontakt bleibt
      -- schwach, die Verteidigung also weiterhin sinnvoll.
      v_dmg := greatest(v_km_through * c_str_dmg_per_km, v_cover_frac * c_max_def);
      v_dmg := v_dmg * v_speed_mult * v_atk_bonus;
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


-- ############################################################################
-- ## supabase_h3.sql
-- ############################################################################
-- ============================================================================
--  Runners Conquer — H3-Territorien-Schema (Phase 1 des GDS-Umstiegs)
-- ----------------------------------------------------------------------------
--  Ersetzt schrittweise das PostGIS-Polygon-Modell durch Ubers H3-Hexagon-
--  Raster (Resolution 10). Die gesamte Geometrie-/Kampflogik läuft server-
--  autoritativ in JavaScript (h3-js) in einer Supabase Edge Function — daher
--  ist hier KEINE h3-Postgres-Extension nötig; die Zellen werden als H3-Index-
--  String gespeichert (h3-js-nativ, keine BigInt-Serialisierungsfallen).
--
--  Frischstart: die neuen Tabellen beginnen leer. Das alte polygon-basierte
--  System (territories/rc_claim) bleibt bis zum Cutover in Phase 3 unberührt
--  daneben bestehen und wird erst dann entfernt.
--
--  Idempotent: mehrfach im Supabase-SQL-Editor ausführbar.
-- ============================================================================

-- ── Territorien ─────────────────────────────────────────────────────────────
create table if not exists public.h3_territories (
  id                  uuid primary key default gen_random_uuid(),
  owner               uuid references public.profiles(id) on delete cascade,
  owner_name          text,
  owner_color         text,
  -- Verteidigung: min 1. Kein oberes CHECK — der +20-Eroberungsbonus darf das
  -- normale Maximum von 300 überschreiten (GDS 1.4); die 300-Grenze beim
  -- regulären Aufbau setzt die Engine durch.
  defense             float8 not null default 20 check (defense >= 1),
  daily_defense_added float8 not null default 0,
  last_defense_day    date,
  last_captured_at    timestamptz not null default now(),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists h3_territories_owner_idx on public.h3_territories(owner);

-- ── Zellen (eine Zeile je H3-Zelle) ─────────────────────────────────────────
--  H3-Index als Text (z.B. '8a1f8d7a498ffff'). Jede Zelle gehört zu genau
--  einem Territorium (PK auf cell erzwingt das global).
create table if not exists public.h3_cells (
  cell         text primary key,
  territory_id uuid not null references public.h3_territories(id) on delete cascade
);

create index if not exists h3_cells_territory_idx on public.h3_cells(territory_id);

-- ── RLS: Karte ist öffentlich lesbar, Schreiben nur über die Edge Function ──
--  (service_role umgeht RLS). Für authenticated/anon gibt es bewusst KEINE
--  insert/update/delete-Policy → nur der Server verändert die Spielwelt.
alter table public.h3_territories enable row level security;
alter table public.h3_cells       enable row level security;

drop policy if exists "h3_terr_read_all" on public.h3_territories;
create policy "h3_terr_read_all" on public.h3_territories for select using (true);

drop policy if exists "h3_cells_read_all" on public.h3_cells;
create policy "h3_cells_read_all" on public.h3_cells for select using (true);

-- ── Komfort-View: Territorium inkl. seiner Zell-Liste (für Client-Ladepfad) ──
create or replace view public.h3_territories_full as
  select t.*,
         coalesce(array_agg(c.cell) filter (where c.cell is not null), '{}') as cells
    from public.h3_territories t
    left join public.h3_cells c on c.territory_id = t.id
   group by t.id;

-- WICHTIG: Ohne explizites GRANT kann der Client (Rolle authenticated/anon) die
-- Tabellen/View nicht lesen -> die Karte bliebe leer, obwohl Gebiete existieren.
grant select on public.h3_territories      to anon, authenticated;
grant select on public.h3_cells            to anon, authenticated;
grant select on public.h3_territories_full to anon, authenticated;


-- ############################################################################
-- ## supabase_h3_cutover.sql
-- ############################################################################
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


-- ############################################################################
-- ## supabase_h3_grants.sql
-- ############################################################################
-- ============================================================================
--  Nachzieh-Migration: Lesezugriffe für den Client auf die H3-Tabellen/View.
-- ----------------------------------------------------------------------------
--  Grund: In der ersten supabase_h3.sql fehlten die GRANT-SELECT. Ohne sie kann
--  die App (Rolle authenticated/anon) h3_territories_full nicht lesen — die
--  Abfrage schlägt still fehl und die Karte bleibt leer, obwohl die Edge
--  Function Gebiete korrekt anlegt. Einmal im Supabase-SQL-Editor ausführen.
--  Idempotent.
-- ============================================================================
grant select on public.h3_territories      to anon, authenticated;
grant select on public.h3_cells            to anon, authenticated;
grant select on public.h3_territories_full to anon, authenticated;


-- ############################################################################
-- ## supabase_energy.sql
-- ############################################################################
-- ============================================================================
--  Energie (server-autoritativ): 3 Boosts/Woche, jeder +10% Angriff.
-- ----------------------------------------------------------------------------
--  Die conquer-Edge-Function verwaltet Energie serverseitig: sie setzt sie zu
--  Wochenbeginn auf 3 zurück (energy_week) und zieht bei einem geboosteten Lauf
--  eine ab. Der Verfall der Verteidigung braucht KEINE Migration — er wird lazy
--  aus h3_territories.updated_at berechnet.
--  Idempotent.
-- ============================================================================
alter table public.profiles add column if not exists energy      integer default 3;
alter table public.profiles add column if not exists energy_week  text;

-- Fraktion des Gebiets-Besitzers (für die Anzeige beim Antippen eines Gebiets).
alter table public.h3_territories add column if not exists owner_team text;


-- ############################################################################
-- ## supabase_bots.sql
-- ############################################################################
-- ============================================================================
--  Bots + Tick-Lock — Bots nehmen mit der Zeit vernachlässigte Gebiete ein.
-- ----------------------------------------------------------------------------
--  Die Edge Function bot_tick läuft NICHT per Cron, sondern wird vom Client
--  beim App-Start beiläufig angestoßen. Damit nicht jeder Client dieselben
--  Bot-Züge doppelt ausführt, gibt es einen Server-Lock (game_state): nur der
--  Aufruf, der die Zeitschranke atomar weiterstellt, führt wirklich Züge aus.
--  Idempotent.
-- ============================================================================

-- Bot-Kennzeichnung auf Profilen.
alter table public.profiles add column if not exists is_bot boolean default false;

-- Bot-Profile (feste UUIDs -> mehrfaches Ausführen aktualisiert nur).
insert into public.profiles (id, player_name, user_avatar, user_color, user_team, is_bot, points) values
  ('b0700000-0000-4000-8000-000000000001','Glutwölfe',    '🔥','#ff5a3c','fire',  true, 0),
  ('b0700000-0000-4000-8000-000000000002','Frostgarde',   '❄️','#4cc3ff','ice',   true, 0),
  ('b0700000-0000-4000-8000-000000000003','Sturmreiter',  '⚡','#a78bfa','storm', true, 0),
  ('b0700000-0000-4000-8000-000000000004','Schattenpakt', '🌑','#8b5cf6','shadow',true, 0),
  ('b0700000-0000-4000-8000-000000000005','Aschejäger',   '🔥','#ff7a45','fire',  true, 0),
  ('b0700000-0000-4000-8000-000000000006','Eiszahn-Clan', '❄️','#38bdf8','ice',   true, 0),
  ('b0700000-0000-4000-8000-000000000007','Donnerhufe',   '⚡','#c084fc','storm', true, 0),
  ('b0700000-0000-4000-8000-000000000008','Nachtschwärme','🌑','#7c3aed','shadow',true, 0)
on conflict (id) do update set
  is_bot = true, player_name = excluded.player_name, user_color = excluded.user_color,
  user_team = excluded.user_team, user_avatar = excluded.user_avatar;

-- Singleton-Zustandstabelle für den Bot-Tick-Lock.
create table if not exists public.game_state (
  id            integer primary key default 1,
  last_bot_tick timestamptz not null default (now() - interval '1 hour'),
  constraint game_state_singleton check (id = 1)
);
insert into public.game_state (id) values (1) on conflict (id) do nothing;

alter table public.game_state enable row level security;
-- Keine Policies -> nur service_role (Edge Function) greift zu.


-- ############################################################################
-- ## supabase_bot_factions.sql
-- ############################################################################
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


-- ############################################################################
-- ## supabase_seed_bots_h3.sql
-- ############################################################################
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


-- ############################################################################
-- ## supabase_owner_team_backfill.sql
-- ############################################################################
-- ============================================================================
--  Backfill: owner_team auf bestehenden H3-Gebieten nachtragen
-- ----------------------------------------------------------------------------
--  Gebiete, die vor Einführung der Fraktions-Spalte (oder ohne gesetztes
--  userTeam) erobert wurden, haben owner_team = NULL -> im Popup steht dann
--  fälschlich "Keine Fraktion", obwohl der Besitzer in einer Fraktion ist.
--  Diese Migration füllt owner_team aus der Fraktion (user_team) des Besitzer-
--  profils. Ab jetzt hält die Edge Function conquer den Wert bei jedem Lauf
--  durchs eigene Gebiet aktuell.
--
--  Idempotent: mehrfach ausführbar (setzt nur dort, wo noch NULL/leer).
-- ============================================================================

update public.h3_territories t
   set owner_team = p.user_team
  from public.profiles p
 where p.id = t.owner
   and coalesce(t.owner_team, '') = ''
   and coalesce(p.user_team, '') <> '';


-- ############################################################################
-- ## supabase_breaches.sql
-- ############################################################################
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


-- ############################################################################
-- ## supabase_follow_requests.sql
-- ############################################################################
-- ============================================================================
--  follow_requests — Tabelle + RLS (eigenständig, idempotent)
-- ----------------------------------------------------------------------------
--  Symptom: Beim Versuch, jemandem zu folgen, erscheint
--    „did not find table public.follow_requests in the schema"
--  Ursache: Die Tabelle wurde nie angelegt (Teil von supabase_schema.sql, das
--  offenbar nicht komplett ausgeführt wurde). Dieses Skript legt NUR die
--  follow_requests-Tabelle inkl. Policies und Schutz-Trigger an — gefahrlos
--  mehrfach ausführbar.
--
--  Ausführen: Supabase → SQL Editor → einfügen → Run.
-- ============================================================================

create table if not exists public.follow_requests (
  id             uuid primary key default gen_random_uuid(),
  requester_uid  uuid not null references public.profiles(id) on delete cascade,
  requester_name text,
  target_uid     uuid not null references public.profiles(id) on delete cascade,
  target_name    text,
  status         text not null default 'pending' check (status in ('pending','accepted','declined')),
  created_at     timestamptz default now(),
  responded_at   timestamptz,
  constraint follow_requests_no_self check (requester_uid <> target_uid)
);

create unique index if not exists idx_follow_requests_pair on public.follow_requests(requester_uid, target_uid);
create index if not exists idx_follow_requests_lookup on public.follow_requests(requester_uid, target_uid, status);
create index if not exists idx_follow_requests_lookup_rev on public.follow_requests(target_uid, requester_uid, status);

alter table public.follow_requests enable row level security;

-- SELECT: nur Beteiligte
drop policy if exists "fr_select" on public.follow_requests;
create policy "fr_select" on public.follow_requests
  for select using (auth.uid() in (requester_uid, target_uid));

-- INSERT: nur als eigene pending-Anfrage (verhindert Fälschung/Vorab-Annahme)
drop policy if exists "fr_insert" on public.follow_requests;
create policy "fr_insert" on public.follow_requests
  for insert with check (
    requester_uid = auth.uid()
    and status = 'pending'
    and responded_at is null
  );

-- UPDATE: nur das Ziel darf annehmen/ablehnen
drop policy if exists "fr_update" on public.follow_requests;
create policy "fr_update" on public.follow_requests
  for update using (auth.uid() = target_uid) with check (auth.uid() = target_uid);

-- DELETE: beide Seiten dürfen löschen (Anfrage zurückziehen / entfolgen)
drop policy if exists "fr_delete" on public.follow_requests;
create policy "fr_delete" on public.follow_requests
  for delete using (auth.uid() in (requester_uid, target_uid));

-- requester_uid/target_uid/created_at sind nach dem Insert unveränderlich
create or replace function public.protect_follow_request_fields()
returns trigger as $$
begin
  if (new.requester_uid is distinct from old.requester_uid or
      new.target_uid is distinct from old.target_uid or
      new.created_at is distinct from old.created_at) then
    raise exception 'requester_uid/target_uid/created_at duerfen nicht geaendert werden';
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_protect_follow_request_fields on public.follow_requests;
create trigger trg_protect_follow_request_fields
  before update on public.follow_requests
  for each row execute function public.protect_follow_request_fields();


-- ############################################################################
-- ## supabase_follow_counts.sql
-- ############################################################################
-- ============================================================================
--  Follower-/Following-Zähler für beliebige Spieler
-- ----------------------------------------------------------------------------
--  Die RLS auf follow_requests gibt bewusst nur die EIGENEN Beziehungen frei,
--  damit niemand fremde Follow-Listen auslesen kann. Für die öffentliche
--  Profil-Anzeige braucht es aber die reinen ZAHLEN. Diese SECURITY-DEFINER-
--  Funktion liefert nur die Anzahl (keine Namen/Beziehungen) und ist damit
--  datenschutzkonform. Idempotent.
--
--  Follower  = wie viele Leute folgen dieser Person (target_uid = uid)
--  Following = wem diese Person folgt              (requester_uid = uid)
--  (jeweils nur angenommene Anfragen)
--
--  Ausführen: Supabase → SQL Editor → einfügen → Run.
-- ============================================================================

create or replace function public.rc_follow_counts(uid uuid)
returns table(followers integer, following integer)
language sql
security definer
set search_path = public
stable
as $$
  select
    (select count(*)::int from public.follow_requests where target_uid    = uid and status = 'accepted'),
    (select count(*)::int from public.follow_requests where requester_uid = uid and status = 'accepted');
$$;

revoke all on function public.rc_follow_counts(uuid) from public;
grant execute on function public.rc_follow_counts(uuid) to authenticated, anon;


-- ############################################################################
-- ## supabase_privacy.sql
-- ############################################################################
-- ============================================================================
--  Profil-Sichtbarkeit (öffentlich/privat) + Lauf-Zähler
-- ----------------------------------------------------------------------------
--  profile_public = true  -> alle Infos sind auch ohne Follow-Anfrage sichtbar
--  profile_public = false -> nur Name, Follower-Zahl, Fraktion, Club, Läufe und
--                            Anzahl Gebiete sind für Fremde sichtbar
--  Standard: öffentlich (true).
--
--  total_runs = Anzahl gewerteter Läufe (für die reduzierte Privat-Ansicht).
--
--  Die profiles-SELECT-Policy ist bereits öffentlich (Rangliste); die
--  Feld-Reduktion bei privaten Profilen macht der Client. Idempotent.
--
--  Ausführen: Supabase → SQL Editor → einfügen → Run.
-- ============================================================================

alter table public.profiles
  add column if not exists profile_public boolean not null default true,
  add column if not exists total_runs     integer not null default 0;


-- ############################################################################
-- ## supabase_bio.sql
-- ############################################################################
-- ============================================================================
--  Profil-Bio / Zitat — öffentlich sichtbare Kurzbeschreibung
-- ----------------------------------------------------------------------------
--  Spieler können eine kurze Beschreibung („obsessed with running") setzen, die
--  im eigenen Profil und beim Ansehen fremder Profile erscheint. Die profiles-
--  SELECT-Policy ist bereits öffentlich (Rangliste), daher ist die Bio damit
--  automatisch für andere sichtbar. Idempotent.
--
--  Ausführen: Supabase → SQL Editor → einfügen → Run.
-- ============================================================================

alter table public.profiles
  add column if not exists bio text;


-- ############################################################################
-- ## supabase_territory_names.sql
-- ############################################################################
-- ============================================================================
--  Gebietsnamen — persistente, benutzerdefinierte Namen für H3-Gebiete
-- ----------------------------------------------------------------------------
--  Gebiete sollen immer einen Namen tragen. Der Client erzeugt bereits aus der
--  Gebiets-ID deterministisch einen stimmungsvollen Namen (nie mehr „unbekannt"),
--  daher ist DIESES Skript OPTIONAL: Es macht zusätzlich das Umbenennen dauerhaft
--  und für alle Spieler sichtbar.
--
--  Schreibzugriff auf h3_territories läuft sonst ausschließlich über die Edge
--  Function (service_role). Damit dieses Prinzip erhalten bleibt, erlauben wir
--  das Umbenennen NICHT per RLS, sondern über eine SECURITY-DEFINER-Funktion,
--  die nur den Eigentümer sein eigenes Gebiet umbenennen lässt.
--
--  Ausführen: Supabase → SQL Editor → einfügen → Run.
-- ============================================================================

-- 1) Namensspalte
alter table public.h3_territories
  add column if not exists name text;

-- 2) View NEU bauen (nicht "create or replace"): seit ihrer ersten Anlage kamen
--    Tabellen-Spalten hinzu (z.B. owner_team). Dadurch ändert sich durch t.* die
--    Spaltenreihenfolge, was "create or replace view" verbietet (Fehler 42P16:
--    "cannot change name of view column"). Deshalb erst droppen, dann anlegen.
drop view if exists public.h3_territories_full;
create view public.h3_territories_full as
  select t.*,
         coalesce(array_agg(c.cell) filter (where c.cell is not null), '{}') as cells
    from public.h3_territories t
    left join public.h3_cells c on c.territory_id = t.id
   group by t.id;

grant select on public.h3_territories_full to anon, authenticated;

-- 3) Umbenennen nur durch den Eigentümer (max. 40 Zeichen, leer = zurücksetzen).
create or replace function public.rc_rename_territory(terr_id uuid, new_name text)
returns void as $$
declare clean text;
begin
  clean := nullif(btrim(coalesce(new_name, '')), '');
  if clean is not null and length(clean) > 40 then
    clean := left(clean, 40);
  end if;
  update public.h3_territories
     set name = clean
   where id = terr_id
     and owner = auth.uid();
  if not found then
    raise exception 'not_owner_or_missing';
  end if;
end;
$$ language plpgsql security definer set search_path = public;

revoke all on function public.rc_rename_territory(uuid, text) from public;
grant execute on function public.rc_rename_territory(uuid, text) to authenticated;


-- ############################################################################
-- ## supabase_player_number.sql
-- ############################################################################
-- ============================================================================
--  player_number — individuelle Spieler-Nummer je Profil
-- ----------------------------------------------------------------------------
--  Jeder Spieler bekommt eine eindeutige 8-stellige Nummer. Man findet sie in
--  der App unter Einstellungen → Profil. Gibt man die Nummer bei „Spieler
--  entdecken" ein, wird direkt das zugehörige Profil geöffnet (und man kann
--  folgen).
--
--  Umsetzung über eine Sequenz: garantiert eindeutig, ohne Kollisionsrisiko,
--  und neue Profile bekommen die Nummer automatisch per DEFAULT.
--  Idempotent. Ausführen: Supabase → SQL Editor → einfügen → Run.
-- ============================================================================

create sequence if not exists public.player_number_seq start 10000042;

alter table public.profiles
  add column if not exists player_number bigint;

-- Bestehende Profile ohne Nummer nachziehen.
update public.profiles
   set player_number = nextval('public.player_number_seq')
 where player_number is null;

-- Eindeutigkeit + schneller Lookup bei der Nummernsuche.
create unique index if not exists profiles_player_number_key
  on public.profiles(player_number);

-- Neue Profile bekommen automatisch die nächste Nummer.
alter table public.profiles
  alter column player_number set default nextval('public.player_number_seq');


-- ############################################################################
-- ## supabase_public_stats.sql
-- ############################################################################
-- ============================================================================
--  Öffentliche Erfolge & Strecken (server-seitig, für alle sichtbar)
-- ----------------------------------------------------------------------------
--  1) Fehlende Aggregat-Stats öffentlich zu profiles: damit lassen sich ALLE
--     36 Erfolge (feste Schwellen je Kategorie) für jeden Nutzer aus seinen
--     öffentlichen Stats ableiten — kein separater Achievement-Speicher nötig.
--  2) Öffentliche, PATHLOSE Sicht auf die Läufe (public_runs): jeder sieht
--     Distanz/Zeit/Datum/Punkte anderer, aber NICHT die GPS-Route (Wohnort-
--     Schutz). Die Route bleibt über die runs-Tabelle nur dem Besitzer lesbar.
--
--  Idempotent: mehrfach im Supabase-SQL-Editor ausführbar.
-- ============================================================================

-- 1) Fehlende Stat-Spalten (öffentlich lesbar via bestehender profiles-Policy).
alter table public.profiles add column if not exists total_defended  integer default 0;
alter table public.profiles add column if not exists total_discovered integer default 0;
alter table public.profiles add column if not exists total_raids      integer default 0;

-- 2) GPS-Route schützen: runs nur noch für den Besitzer direkt lesbar
--    (die pathlose View unten liefert die öffentlichen Felder für alle).
drop policy if exists "runs_select_own" on public.runs;
create policy "runs_select_own"
  on public.runs for select using (auth.uid() = user_id);

-- Öffentliche, pathlose Sicht. security_invoker=off (Default) -> die View läuft
-- mit den Rechten ihres Owners und umgeht damit die owner-only-RLS der
-- Basistabelle; sie gibt bewusst NUR die unkritischen Felder heraus (kein path).
drop view if exists public.public_runs;
create view public.public_runs as
  select id, user_id, player_name, distance, duration, points,
         conquered, defended, created_at
    from public.runs;

grant select on public.public_runs to anon, authenticated;


-- ############################################################################
-- ## supabase_realtime_dm.sql
-- ############################################################################
-- ============================================================================
--  Realtime für Direktnachrichten aktivieren
-- ----------------------------------------------------------------------------
--  Die App abonniert INSERTs auf public.direct_messages (gefiltert auf den
--  eigenen Nutzer), um eingehende Nachrichten live anzuzeigen und den
--  Ungelesen-Badge zu aktualisieren. Dafür muss die Tabelle in der
--  supabase_realtime-Publikation liegen. RLS (nur Sender+Empfänger) gilt auch
--  für den Realtime-Stream, es werden also keine fremden Nachrichten geleakt.
--
--  Idempotent: mehrfach im Supabase-SQL-Editor ausführbar.
-- ============================================================================
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public'
         and tablename = 'direct_messages'
     )
  then
    alter publication supabase_realtime add table public.direct_messages;
  end if;
end $$;


-- ############################################################################
-- ## supabase_support_rls.sql
-- ############################################################################
-- ============================================================================
--  support_messages — RLS-Policies (inkl. Admin-Löschen)
-- ----------------------------------------------------------------------------
--  Symptom: Als Admin gelöschte Support-Nachrichten kommen nach dem erneuten
--  Öffnen des Posteingangs wieder. Ursache: Es fehlt eine DELETE-Policy — RLS
--  löscht dann 0 Zeilen und liefert KEINEN Fehler (Supabase-Eigenheit), sodass
--  der Client fälschlich „gelöscht" annimmt.
--
--  Dieses Skript setzt alle vier Policies sauber neu (idempotent):
--    - INSERT: Nutzer senden nur eigene Nachrichten (ohne admin_reply)
--    - SELECT: Nutzer lesen eigene, Admin liest alle
--    - UPDATE: nur Admin (Antworten)
--    - DELETE: nur Admin  ← behebt das Wiederauftauchen
--
--  Admin-Kennung: E-Mail im JWT == maxst0297@gmail.com
-- ============================================================================

alter table public.support_messages
  add column if not exists admin_reply text,
  add column if not exists replied_at  timestamptz;

alter table public.support_messages enable row level security;

-- Bestehende Policies entfernen, dann sauber neu anlegen.
do $$
declare pol record;
begin
  for pol in select policyname from pg_policies
             where schemaname='public' and tablename='support_messages' loop
    execute format('drop policy if exists %I on public.support_messages', pol.policyname);
  end loop;
end $$;

drop policy if exists "Nutzer senden eigene Support-Nachrichten" on public.support_messages;
create policy "Nutzer senden eigene Support-Nachrichten" on public.support_messages
  for insert with check (
    auth.uid() is not distinct from user_id
    and admin_reply is null
    and replied_at is null
  );

drop policy if exists "Nutzer lesen eigene, Admin liest alle" on public.support_messages;
create policy "Nutzer lesen eigene, Admin liest alle" on public.support_messages
  for select using (
    (auth.jwt() ->> 'email') = 'maxst0297@gmail.com'
    or auth.uid() = user_id
  );

drop policy if exists "Admin aktualisiert Nachrichten" on public.support_messages;
create policy "Admin aktualisiert Nachrichten" on public.support_messages
  for update using ((auth.jwt() ->> 'email') = 'maxst0297@gmail.com')
  with check ((auth.jwt() ->> 'email') = 'maxst0297@gmail.com');

drop policy if exists "Admin loescht Nachrichten" on public.support_messages;
create policy "Admin loescht Nachrichten" on public.support_messages
  for delete using ((auth.jwt() ->> 'email') = 'maxst0297@gmail.com');


-- ############################################################################
-- ## supabase_logs.sql
-- ############################################################################
-- ============================================================================
--  app_logs — serverseitiges Fehler-Logging für Runners Conquer
-- ----------------------------------------------------------------------------
--  Zweck: Kritische Client-Fehler (fehlgeschlagene RPCs, Sync-Fehler, nicht
--  abgefangene Exceptions) landen nicht mehr nur in der Browser-Konsole des
--  Nutzers, sondern werden best-effort in dieser Tabelle persistiert. So sieht
--  der Betreiber, wo echte Nutzer hängenbleiben, bevor sie die App löschen.
--
--  Idempotent: kann mehrfach im Supabase SQL-Editor ausgeführt werden.
-- ============================================================================

create table if not exists public.app_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references public.profiles(id) on delete set null,
  level       text not null default 'error' check (level in ('error','warn','info')),
  context     text,                       -- z.B. 'rc_claim', 'cloud_load', 'window.onerror'
  message     text not null,
  detail      jsonb,                      -- optionaler Zusatzkontext (Stacktrace-Auszug, RPC-Args …)
  url         text,                       -- location.href zum Zeitpunkt des Fehlers
  ua          text,                       -- navigator.userAgent (Geräteklasse/Browser)
  app_version text,                       -- SW-Cache-Version o.ä. zur Korrelation mit Deploys
  created_at  timestamptz not null default now()
);

-- Längen kappen (Schutz gegen versehentliche Riesen-Payloads / Missbrauch)
alter table public.app_logs
  add constraint app_logs_message_len check (char_length(message) <= 2000) not valid;
do $$ begin
  alter table public.app_logs validate constraint app_logs_message_len;
exception when others then null; end $$;

create index if not exists app_logs_created_idx on public.app_logs (created_at desc);
create index if not exists app_logs_user_idx    on public.app_logs (user_id);
create index if not exists app_logs_level_idx   on public.app_logs (level);

alter table public.app_logs enable row level security;


-- INSERT: jeder (auch anonym, vor Login) darf Logs schreiben, aber user_id muss
-- NULL-sicher die eigene auth.uid() sein. Admin-Felder existieren hier nicht,
-- also keine Fälschungsgefahr. created_at wird per default gesetzt.
drop policy if exists "logs_insert_own" on public.app_logs;
create policy "logs_insert_own"
  on public.app_logs for insert
  with check (auth.uid() is not distinct from user_id);

-- SELECT: nur der Betreiber liest die Logs (kein Nutzer sieht fremde Fehler).
drop policy if exists "logs_select_admin" on public.app_logs;
create policy "logs_select_admin"
  on public.app_logs for select
  using ((auth.jwt() ->> 'email') = 'maxst0297@gmail.com');

-- UPDATE: niemand (Logs sind unveränderlich). Bewusst keine Policy => verboten.

-- DELETE: nur Admin (z.B. zum manuellen Aufräumen).
drop policy if exists "logs_delete_admin" on public.app_logs;
create policy "logs_delete_admin"
  on public.app_logs for delete
  using ((auth.jwt() ->> 'email') = 'maxst0297@gmail.com');

-- ----------------------------------------------------------------------------
--  Aufräum-Helfer: Logs älter als 30 Tage löschen. Manuell ausführbar oder per
--  Supabase-Cron (pg_cron) planbar. SECURITY DEFINER, damit der Aufruf nicht an
--  der DELETE-Policy scheitert.
-- ----------------------------------------------------------------------------
create or replace function public.rc_prune_app_logs(older_than_days int default 30)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer;
begin
  delete from public.app_logs
   where created_at < now() - (older_than_days || ' days')::interval;
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

-- Optional (auskommentiert): tägliche Bereinigung via pg_cron einrichten.
--   select cron.schedule('prune-app-logs','0 4 * * *',
--     $$ select public.rc_prune_app_logs(30); $$);


-- ############################################################################
-- ## supabase_landmarks.sql
-- ############################################################################
-- ============================================================================
--  landmark_cache — Server-Cache für Overpass-Wahrzeichen
-- ----------------------------------------------------------------------------
--  Zweck: Statt bei jedem Karten-Pan live die (oft rate-limitierte / langsame)
--  Overpass-API anzufragen, holt die Serverless-Funktion /api/landmarks die
--  Wahrzeichen pro Geo-Kachel einmal und cached sie hier für 24 h. Macht die
--  App unabhängig von Overpass-Ausfällen und entlastet die öffentliche API.
--
--  Zugriff ausschließlich über die Serverless-Funktion mit service_role, die
--  RLS umgeht. Es gibt daher bewusst KEINE Policy => anon/authenticated haben
--  keinerlei Zugriff auf diese Tabelle.
--
--  Idempotent: mehrfach im Supabase SQL-Editor ausführbar.
-- ============================================================================

create table if not exists public.landmark_cache (
  tile_key   text primary key,          -- gerundete Kachel, z.B. "c0.05:1024:153"
  data       jsonb not null,            -- Array von {id,lat,lng,name,type}
  fetched_at timestamptz not null default now()
);

create index if not exists landmark_cache_fetched_idx
  on public.landmark_cache (fetched_at);

alter table public.landmark_cache enable row level security;
-- (keine Policies — nur service_role greift zu)

-- Aufräum-Helfer: Kacheln löschen, die älter als N Tage sind (manuell oder per
-- pg_cron). SECURITY DEFINER, damit der Aufruf nicht an RLS scheitert.
create or replace function public.rc_prune_landmark_cache(older_than_days int default 30)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer;
begin
  delete from public.landmark_cache
   where fetched_at < now() - (older_than_days || ' days')::interval;
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;


-- ############################################################################
-- ## supabase_garmin.sql
-- ############################################################################
-- Run & Conquer – Garmin Integration Schema
-- Im Supabase Dashboard → SQL Editor ausführen.
--
-- Diese Tabellen werden NUR von den Vercel-Serverless-Functions
-- (mit dem Service-Role-Key) beschrieben. Tokens dürfen niemals
-- über den anon-Key lesbar sein → RLS bleibt aktiv, ohne Policies
-- für anon. Aktivitäten darf der Nutzer selbst lesen.

-- ── Verbindung: Garmin-Konto ↔ Supabase-Nutzer + OAuth-Tokens ──
create table if not exists public.garmin_connections (
  user_id        uuid primary key references auth.users(id) on delete cascade,
  garmin_user_id text unique not null,
  access_token   text not null,
  access_secret  text not null,
  connected_at   timestamptz default now()
);
alter table public.garmin_connections enable row level security;
-- keine anon/authenticated Policies → nur Service-Role kommt dran (Tokens geschützt)

-- ── Temporäre Request-Tokens während des OAuth-Flows ──
create table if not exists public.garmin_oauth_pending (
  request_token  text primary key,
  request_secret text not null,
  user_id        uuid not null,
  created_at     timestamptz default now()
);
alter table public.garmin_oauth_pending enable row level security;

-- ── Importierte Garmin-Aktivitäten inkl. GPS-Track ──
create table if not exists public.garmin_activities (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid references auth.users(id) on delete cascade,
  garmin_user_id   text,
  external_id      text not null,
  activity_type    text,
  start_time       timestamptz,
  duration_seconds integer,
  distance_meters  float8,
  track            jsonb,          -- [{lat,lng,ele,time}, …]
  created_at       timestamptz default now(),
  unique (user_id, external_id)
);
create index if not exists garmin_activities_user_idx on public.garmin_activities(user_id);
create index if not exists garmin_activities_time_idx on public.garmin_activities(start_time desc);

alter table public.garmin_activities enable row level security;
-- Nutzer darf seine eigenen Aktivitäten lesen
drop policy if exists "Nutzer liest eigene Garmin-Aktivitäten" on public.garmin_activities;
create policy "Nutzer liest eigene Garmin-Aktivitäten"
  on public.garmin_activities for select
  using (auth.uid() = user_id);

-- Alte Pending-OAuth-Einträge automatisch aufräumen (optional, via pg_cron):
-- delete from public.garmin_oauth_pending where created_at < now() - interval '1 hour';


-- ############################################################################
-- ## supabase_garmin_health.sql
-- ############################################################################
-- Run & Conquer – Garmin Health API Schema
-- Im Supabase Dashboard → SQL Editor ausführen (nach supabase_garmin.sql).

-- ── Tägliche Health-Zusammenfassungen (Steps, HR, Schlaf, Stress) ──
create table if not exists public.garmin_health_summaries (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid references auth.users(id) on delete cascade,
  garmin_user_id   text,
  summary_date     date not null,
  steps            integer,
  distance_meters  float8,
  active_calories  integer,
  total_calories   integer,
  avg_stress       integer,
  resting_hr       integer,
  max_hr           integer,
  sleep_seconds    integer,
  deep_sleep_secs  integer,
  rem_sleep_secs   integer,
  created_at       timestamptz default now(),
  unique (user_id, summary_date)
);

create index if not exists garmin_health_user_date_idx
  on public.garmin_health_summaries(user_id, summary_date desc);

alter table public.garmin_health_summaries enable row level security;

drop policy if exists "Nutzer liest eigene Health-Summaries" on public.garmin_health_summaries;
create policy "Nutzer liest eigene Health-Summaries"
  on public.garmin_health_summaries for select
  using (auth.uid() = user_id);


-- ############################################################################
-- ## supabase_fix.sql
-- ############################################################################
-- Run & Conquer – Sicherheits- und Schema-Fix
-- Im Supabase Dashboard → SQL Editor ausführen.
-- Dieses Script ist idempotent: es kann mehrfach ohne Fehler ausgeführt werden.

-- ══════════════════════════════════════════════════════════════════════
-- 1. Fehlende Spalten in public.profiles ergänzen
-- ══════════════════════════════════════════════════════════════════════

alter table public.profiles
  add column if not exists user_id      text,
  add column if not exists game_data    text,
  add column if not exists user_team    text,
  add column if not exists club_code    text;

-- Index für Club- und Team-Abfragen
create index if not exists profiles_club_idx  on public.profiles(club_code);
create index if not exists profiles_team_idx  on public.profiles(user_team);

-- ══════════════════════════════════════════════════════════════════════
-- 2. Fehlende Spalten in public.support_messages ergänzen
-- ══════════════════════════════════════════════════════════════════════

alter table public.support_messages
  add column if not exists admin_reply  text,
  add column if not exists replied_at   timestamptz,
  add column if not exists email        text;

-- ══════════════════════════════════════════════════════════════════════
-- 3. Tabelle direct_messages erstellen (Direktnachrichten)
-- ══════════════════════════════════════════════════════════════════════

-- Hinweis: from_uid/to_uid sind text, da die App auth.uid() als String
-- speichert. In den Policies wird auth.uid()::text verglichen, damit es
-- unabhängig vom vorhandenen Spaltentyp funktioniert (uuid oder text).
create table if not exists public.direct_messages (
  id          uuid primary key default gen_random_uuid(),
  from_uid    text not null,
  from_name   text,
  to_uid      text not null,
  to_name     text,
  content     text not null,
  read_at     timestamptz,
  created_at  timestamptz default now()
);

create index if not exists dm_to_uid_idx   on public.direct_messages(to_uid, created_at desc);
create index if not exists dm_from_uid_idx on public.direct_messages(from_uid, created_at desc);

alter table public.direct_messages enable row level security;

-- alte Policies entfernen (falls ein Teil-Lauf bereits welche angelegt hat)

-- Nutzer kann eigene gesendeten/empfangenen Nachrichten lesen
drop policy if exists "Nutzer liest eigene DMs" on public.direct_messages;
create policy "Nutzer liest eigene DMs"
  on public.direct_messages for select
  using (auth.uid()::text = from_uid or auth.uid()::text = to_uid);

-- Nutzer kann Nachrichten senden (from_uid muss eigene uid sein)
drop policy if exists "Nutzer sendet DMs" on public.direct_messages;
create policy "Nutzer sendet DMs"
  on public.direct_messages for insert
  with check (auth.uid()::text = from_uid);

-- Empfänger kann als gelesen markieren
drop policy if exists "Empfänger aktualisiert read_at" on public.direct_messages;
create policy "Empfänger aktualisiert read_at"
  on public.direct_messages for update
  using (auth.uid()::text = to_uid)
  with check (auth.uid()::text = to_uid);

-- Nutzer kann eigene Konversationen löschen
drop policy if exists "Nutzer löscht eigene DMs" on public.direct_messages;
create policy "Nutzer löscht eigene DMs"
  on public.direct_messages for delete
  using (auth.uid()::text = from_uid or auth.uid()::text = to_uid);

-- ══════════════════════════════════════════════════════════════════════
-- 4. RLS auf ALLEN verbleibenden public-Tabellen erzwingen (Sicherheitsnetz)
--    (sicher mehrfach auszuführen)
-- ══════════════════════════════════════════════════════════════════════

do $$
declare
  tbl text;
begin
  for tbl in
    select tablename from pg_tables
    where schemaname = 'public'
  loop
    execute format('alter table public.%I enable row level security', tbl);
  end loop;
end;
$$;

-- ══════════════════════════════════════════════════════════════════════
-- 5. Saison-System (Monatspunkte + Monatssieger) — siehe supabase_season.sql
-- ══════════════════════════════════════════════════════════════════════

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

-- ══════════════════════════════════════════════════════════════════════
-- 6. Echte Events + Punkte-Schutz + Eroberungszähler — siehe supabase_events_points.sql
-- ══════════════════════════════════════════════════════════════════════

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

-- ── Eroberungen kumulativ zählen (Fraktions-Kontrolle) ──
-- Nur Server (service_role via Edge Functions conquer/bot_tick) darf zählen.
-- total_conquered wird NIE verringert -> "einmal erobern reicht" (zählt auch
-- wieder verlorene Gebiete).
create or replace function public.rc_bump_conquered(uid uuid, n int)
returns void
language sql
security definer
set search_path = public
as $$
  update profiles
     set total_conquered = coalesce(total_conquered, 0) + greatest(0, n),
         updated_at = now()
   where id = uid;
$$;
revoke execute on function public.rc_bump_conquered(uuid, int) from public;
revoke execute on function public.rc_bump_conquered(uuid, int) from anon;
revoke execute on function public.rc_bump_conquered(uuid, int) from authenticated;
grant  execute on function public.rc_bump_conquered(uuid, int) to service_role;
