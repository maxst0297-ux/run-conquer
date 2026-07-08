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
