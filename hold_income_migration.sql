-- ============================================================================
--  Gebiete halten: Sperrzeit nach Eroberung + passives Einkommen
--  Einmal im Supabase-SQL-Editor ausführen. Idempotent, gefahrlos wiederholbar.
-- ============================================================================

-- ── 1) Sperrzeit pro Gebiet ────────────────────────────────────────────────
-- Frisch erobertes/beanspruchtes Gebiet ist kurz unangreifbar. Das verhindert
-- Ping-Pong an den Grenzen. Gesetzt wird die Sperre von der conquer-Function;
-- respektiert wird sie dort UND im bot_tick.
alter table public.h3_territories add column if not exists locked_until timestamptz;
create index if not exists h3_terr_locked_idx on public.h3_territories(locked_until)
  where locked_until is not null;

-- ── 2) Passives Einkommen für gehaltene Gebiete ────────────────────────────
alter table public.profiles add column if not exists last_income_at timestamptz;

-- Ertrag pro Stunde, degressiv nach Anzahl gehaltener Zellen:
--   1–50   Zellen: 0.10 / Zelle / Stunde
--   51–200 Zellen: 0.05
--   ab 201 Zellen: 0.01
-- So lohnt sich Halten spürbar, ohne dass Großbesitzer uneinholbar davonziehen.
create or replace function public.rc_hold_rate(cells int)
returns numeric language sql immutable as $$
  select round(
      least(coalesce(cells,0), 50)                        * 0.10
    + greatest(least(coalesce(cells,0), 200) - 50, 0)      * 0.05
    + greatest(coalesce(cells,0) - 200, 0)                 * 0.01
  , 4);
$$;

-- Lazy-Abrechnung: wird beim App-Start aufgerufen und zahlt die seit dem
-- letzten Abruf aufgelaufenen Punkte aus.
--   • Aktivitätsprüfung: nur wer in den letzten 72 h gelaufen ist, kassiert.
--     Sonst wird die Uhr zurückgesetzt (kein Nachzahlen für lange Abwesenheit).
--   • Der Anrechnungszeitraum ist auf 48 h gedeckelt. Das begrenzt zugleich,
--     wie viel sich durch "kurz vorher viele Zellen erobern" herausholen lässt,
--     da die Zellen zum Abrechnungszeitpunkt gezählt werden.
-- Bewusst OHNE uid-Parameter: der Aufrufer wird aus der Sitzung bestimmt.
-- Sonst könnte jeder die Abrechnungs-Uhr fremder Spieler zurücksetzen.
create or replace function public.rc_claim_hold_income()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid       uuid := auth.uid();
  v_now     timestamptz := now();
  v_last    timestamptz;
  v_lastrun timestamptz;
  v_hours   numeric;
  v_cells   int;
  v_rate    numeric;
  v_pts     int;
begin
  if uid is null then
    return jsonb_build_object('ok', false, 'reason', 'no_session');
  end if;

  select last_income_at into v_last from public.profiles where id = uid;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'no_profile');
  end if;

  -- Erster Aufruf: nur die Uhr starten.
  if v_last is null then
    update public.profiles set last_income_at = v_now where id = uid;
    return jsonb_build_object('ok', true, 'points', 0, 'reason', 'init');
  end if;

  -- Aktivitätsprüfung
  select max(created_at) into v_lastrun from public.runs where user_id = uid;
  if v_lastrun is null or v_lastrun < v_now - interval '72 hours' then
    update public.profiles set last_income_at = v_now where id = uid;
    return jsonb_build_object('ok', true, 'points', 0, 'reason', 'inactive');
  end if;

  v_hours := least(extract(epoch from (v_now - v_last)) / 3600.0, 48);
  if v_hours < 0.5 then
    return jsonb_build_object('ok', true, 'points', 0, 'reason', 'too_soon');
  end if;

  select count(*) into v_cells
    from public.h3_cells c
    join public.h3_territories t on t.id = c.territory_id
   where t.owner = uid;

  if coalesce(v_cells, 0) = 0 then
    update public.profiles set last_income_at = v_now where id = uid;
    return jsonb_build_object('ok', true, 'points', 0, 'reason', 'no_cells');
  end if;

  v_rate := public.rc_hold_rate(v_cells);
  v_pts  := floor(v_rate * v_hours)::int;

  update public.profiles
     set points = coalesce(points, 0) + greatest(v_pts, 0),
         last_income_at = v_now
   where id = uid;

  return jsonb_build_object('ok', true, 'points', greatest(v_pts, 0),
                            'cells', v_cells, 'hours', round(v_hours, 2),
                            'rate', v_rate);
end; $$;

revoke all on function public.rc_claim_hold_income() from public, anon;
grant execute on function public.rc_claim_hold_income() to authenticated, service_role;
grant execute on function public.rc_hold_rate(int) to authenticated, service_role;
