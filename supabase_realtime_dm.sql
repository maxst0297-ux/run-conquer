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
