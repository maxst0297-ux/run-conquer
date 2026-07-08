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

create policy "Nutzer senden eigene Support-Nachrichten" on public.support_messages
  for insert with check (
    auth.uid() is not distinct from user_id
    and admin_reply is null
    and replied_at is null
  );

create policy "Nutzer lesen eigene, Admin liest alle" on public.support_messages
  for select using (
    (auth.jwt() ->> 'email') = 'maxst0297@gmail.com'
    or auth.uid() = user_id
  );

create policy "Admin aktualisiert Nachrichten" on public.support_messages
  for update using ((auth.jwt() ->> 'email') = 'maxst0297@gmail.com')
  with check ((auth.jwt() ->> 'email') = 'maxst0297@gmail.com');

create policy "Admin loescht Nachrichten" on public.support_messages
  for delete using ((auth.jwt() ->> 'email') = 'maxst0297@gmail.com');
