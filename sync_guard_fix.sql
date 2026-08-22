-- ============================================================================
--  Fix: „Unplausibler Fortschritts-Sprung abgelehnt"
--  Einmal im Supabase-SQL-Editor ausführen. Idempotent, gefahrlos wiederholbar.
-- ----------------------------------------------------------------------------
--  PROBLEM
--  protect_profile_stats() erlaubt pro Sync „Stunden × 20 + 10" Kilometer und
--  misst die Stunden ab profiles.updated_at. Dieses Feld wird aber bei JEDEM
--  Lauf serverseitig neu gesetzt (rc_bump_conquered sowie die conquer-Function,
--  die points/energy schreibt). Das Zeitfenster fällt dadurch staendig auf ~0
--  zurueck und die Grenze bleibt bei ~10 km.
--  Sobald der Client also einmal weiter ist als der Server -- etwa nach einem
--  Netzausfall -- waechst der Rueckstand mit jedem Lauf, wird jedes Mal erneut
--  abgelehnt und kann NIE mehr aufgeholt werden. Folge: total_km/total_conquered
--  bleiben serverseitig stehen, Rangliste und oeffentliches Profil zeigen alte
--  Werte, und der komplette Cloud-Schnappschuss wird nie geschrieben (der
--  profile_private-Upsert haengt hinter demselben Aufruf).
--
--  LOESUNG
--  Eigener Bezugspunkt fuer die Kilometer, der nur vorrueckt, wenn sich total_km
--  tatsaechlich aendert. Damit waechst das Fenster waehrend eines Rueckstands
--  mit -- der Sync holt sich selbst wieder ein.
-- ============================================================================

alter table public.profiles add column if not exists km_updated_at timestamptz;

create or replace function public.protect_profile_stats()
returns trigger as $$
declare
  km_hours     float8;
  other_hours  float8;
  max_km_delta float8;
  max_points_delta float8;
  max_conquered_delta float8;
begin
  -- Kilometer: Fenster seit der letzten ECHTEN Kilometer-Aenderung.
  km_hours := greatest(
    extract(epoch from (now() - coalesce(old.km_updated_at, old.updated_at, now()))) / 3600.0, 0.01);
  -- Punkte/Eroberungen schreibt der Server selbst; dort bleibt updated_at richtig.
  other_hours := greatest(
    extract(epoch from (now() - coalesce(old.updated_at, now()))) / 3600.0, 0.01);

  if old.km_updated_at is null then
    -- Genau EIN grosszuegiger Sync direkt nach dieser Migration, damit ein
    -- bestehender Rueckstand einmalig aufgeholt werden kann. Danach greifen
    -- wieder die normalen Grenzen, weil km_updated_at dann gesetzt ist.
    max_km_delta := 5000;
  else
    max_km_delta := km_hours * 20 + 10;   -- ~20 km/h Dauerschnitt + Puffer
  end if;
  max_points_delta    := other_hours * 500 + 500;
  max_conquered_delta := other_hours * 5 + 10;

  if (coalesce(new.total_km,0) - coalesce(old.total_km,0)) > max_km_delta
     or (coalesce(new.points,0) - coalesce(old.points,0)) > max_points_delta
     or (coalesce(new.total_conquered,0) - coalesce(old.total_conquered,0)) > max_conquered_delta then
    raise exception 'Unplausibler Fortschritts-Sprung abgelehnt (km:%, pts:%, terr:%)',
      coalesce(new.total_km,0) - coalesce(old.total_km,0),
      coalesce(new.points,0) - coalesce(old.points,0),
      coalesce(new.total_conquered,0) - coalesce(old.total_conquered,0);
  end if;

  -- Bezugspunkt nur mitfuehren, wenn sich die Kilometer wirklich geaendert haben.
  if new.total_km is distinct from old.total_km then
    new.km_updated_at := now();
  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_protect_profile_stats on public.profiles;
create trigger trg_protect_profile_stats
  before update on public.profiles
  for each row execute function public.protect_profile_stats();
