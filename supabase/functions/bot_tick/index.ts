/* ============================================================================
   Runners Conquer — Edge Function "bot_tick"
   ----------------------------------------------------------------------------
   Bots nehmen mit der Zeit vernachlässigte (stark verfallene) Gebiete ein.
   Kein Cron: der Client stößt diese Function beim App-Start beiläufig an. Ein
   Server-Lock (game_state.last_bot_tick, atomar per bedingtem UPDATE) sorgt
   dafür, dass nur EIN Aufruf pro Zeitfenster tatsächlich Züge ausführt — alle
   anderen sind No-Ops. Die Auswahl-Logik liegt in der getesteten Engine.

   Deploy:  supabase functions deploy bot_tick
   ========================================================================== */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { pickBotTargets, BOT_NEW_DEFENSE } from '../_shared/h3-engine.mjs';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } });

const LOCK_MINUTES = 30; // frühestens alle 30 Min ein Bot-Zug (global)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  try {
    const svc = createClient(SUPABASE_URL, SERVICE);

    // ── Server-Lock: die Zeitschranke nur weiterstellen, wenn sie alt genug ist.
    //    Nur der Aufruf, der hier eine Zeile zurückbekommt, führt Züge aus. ──
    const cutoff = new Date(Date.now() - LOCK_MINUTES * 60000).toISOString();
    const { data: locked } = await svc.from('game_state')
      .update({ last_bot_tick: new Date().toISOString() })
      .eq('id', 1).lt('last_bot_tick', cutoff).select('id');
    if (!locked || !locked.length) return json({ skipped: true });

    const { data: bots } = await svc.from('profiles')
      .select('id,player_name,user_color,user_team').eq('is_bot', true);
    if (!bots || !bots.length) return json({ ok: true, taken: [], note: 'no bots' });
    const botIds = bots.map((b: any) => b.id);

    const { data: trows } = await svc.from('h3_territories').select('id,owner,defense,updated_at');
    const territories = (trows || []).map((t: any) => ({
      id: t.id, owner: t.owner, defense: t.defense, updatedAtMs: Date.parse(t.updated_at) || 0,
    }));
    const targets: string[] = pickBotTargets({ territories, nowMs: Date.now(), botOwnerIds: botIds });

    // ── Übernahmen anwenden: Besitzer -> zufälliger Bot, Startverteidigung. Die
    //    Zellen (h3_cells) bleiben am Gebiet — der Bot erbt sie. ──
    const now = new Date().toISOString();
    const taken: any[] = [];
    for (const id of targets) {
      const bot = bots[Math.floor(Math.random() * bots.length)];
      await svc.from('h3_territories').update({
        owner: bot.id, owner_name: bot.player_name, owner_color: bot.user_color,
        owner_team: bot.user_team, defense: BOT_NEW_DEFENSE, updated_at: now, last_captured_at: now,
      }).eq('id', id);
      taken.push({ id, bot: bot.player_name });
    }
    return json({ ok: true, taken });
  } catch (e) {
    return json({ error: String(e && (e as Error).message || e) }, 500);
  }
});
