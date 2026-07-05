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
