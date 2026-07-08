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
