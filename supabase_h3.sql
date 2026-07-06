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
