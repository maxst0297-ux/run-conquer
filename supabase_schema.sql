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

alter table public.profiles enable row level security;

create policy "Alle können Profile lesen"
  on public.profiles for select using (true);

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

create policy "Alle können Runs lesen"
  on public.runs for select using (true);

create policy "Nutzer fügen eigene Runs ein"
  on public.runs for insert with check (auth.uid() = user_id);

-- UPDATE-Policy: nötig für syncRun()'s upsert(...,{onConflict:'id'}) – ohne sie
-- würde der ON-CONFLICT-DO-UPDATE-Pfad bei Retries an RLS scheitern, da
-- upsert technisch ein INSERT mit Fallback auf UPDATE ist.
create policy "Nutzer aktualisieren eigene Runs"
  on public.runs for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

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
create policy "Nutzer senden eigene Support-Nachrichten"
  on public.support_messages for insert
  with check (
    auth.uid() is not distinct from user_id
    and admin_reply is null
    and replied_at is null
  );

create policy "Nutzer lesen eigene Nachrichten, Admin liest alle"
  on public.support_messages for select
  using (
    (auth.jwt() ->> 'email') = 'maxst0297@gmail.com'
    or auth.uid() = user_id
  );

create policy "Admin aktualisiert Nachrichten"
  on public.support_messages for update
  using ((auth.jwt() ->> 'email') = 'maxst0297@gmail.com')
  with check ((auth.jwt() ->> 'email') = 'maxst0297@gmail.com');

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

alter table public.direct_messages enable row level security;

drop policy if exists "dm_own" on public.direct_messages;
drop policy if exists "dm_select" on public.direct_messages;
drop policy if exists "dm_insert" on public.direct_messages;
drop policy if exists "dm_update" on public.direct_messages;
drop policy if exists "dm_delete" on public.direct_messages;

-- SELECT: nur Sender + Empfänger dürfen lesen
create policy "dm_select" on public.direct_messages
  for select using (auth.uid()::text in (from_uid, to_uid));

-- INSERT: from_uid MUSS die eigene Auth-ID sein (verhindert Absender-Fälschung)
create policy "dm_insert" on public.direct_messages
  for insert with check (from_uid = auth.uid()::text);

-- UPDATE: Sender + Empfänger dürfen updaten (z.B. read_at setzen)
create policy "dm_update" on public.direct_messages
  for update using (auth.uid()::text in (from_uid, to_uid));

-- DELETE: Sender + Empfänger dürfen löschen (Chat leeren)
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
