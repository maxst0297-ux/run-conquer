-- ============================================================================
--  Bots + Tick-Lock — Bots nehmen mit der Zeit vernachlässigte Gebiete ein.
-- ----------------------------------------------------------------------------
--  Die Edge Function bot_tick läuft NICHT per Cron, sondern wird vom Client
--  beim App-Start beiläufig angestoßen. Damit nicht jeder Client dieselben
--  Bot-Züge doppelt ausführt, gibt es einen Server-Lock (game_state): nur der
--  Aufruf, der die Zeitschranke atomar weiterstellt, führt wirklich Züge aus.
--  Idempotent.
-- ============================================================================

-- Bot-Kennzeichnung auf Profilen.
alter table public.profiles add column if not exists is_bot boolean default false;

-- Bot-Profile (feste UUIDs -> mehrfaches Ausführen aktualisiert nur).
insert into public.profiles (id, player_name, user_avatar, user_color, user_team, is_bot, points) values
  ('b0700000-0000-4000-8000-000000000001','Glutwölfe',    '🔥','#ff5a3c','fire',  true, 0),
  ('b0700000-0000-4000-8000-000000000002','Frostgarde',   '❄️','#4cc3ff','ice',   true, 0),
  ('b0700000-0000-4000-8000-000000000003','Sturmreiter',  '⚡','#a78bfa','storm', true, 0),
  ('b0700000-0000-4000-8000-000000000004','Schattenpakt', '🌑','#8b5cf6','shadow',true, 0)
on conflict (id) do update set
  is_bot = true, player_name = excluded.player_name, user_color = excluded.user_color,
  user_team = excluded.user_team, user_avatar = excluded.user_avatar;

-- Singleton-Zustandstabelle für den Bot-Tick-Lock.
create table if not exists public.game_state (
  id            integer primary key default 1,
  last_bot_tick timestamptz not null default (now() - interval '1 hour'),
  constraint game_state_singleton check (id = 1)
);
insert into public.game_state (id) values (1) on conflict (id) do nothing;

alter table public.game_state enable row level security;
-- Keine Policies -> nur service_role (Edge Function) greift zu.
