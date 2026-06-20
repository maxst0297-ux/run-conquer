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

alter table public.profiles enable row level security;

create policy "Alle können Profile lesen"
  on public.profiles for select using (true);

create policy "Nutzer verwalten eigenes Profil"
  on public.profiles for all using (auth.uid() = id);

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
