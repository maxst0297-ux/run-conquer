/* ============================================================================
   Runners Conquer — Edge Function "bot_tick" (aktive, ortsbezogene Bots)
   ----------------------------------------------------------------------------
   Bots agieren RUND UM Spielergebiete (dort, wo tatsächlich gespielt wird):
   pro Tick mehrere Aktionen — entweder ein Angriff auf ein benachbartes
   Spielergebiet (mittlere Stärke, UNABHÄNGIG vom Verteidigungswert; schwache/
   mittlere fallen, starke werden nur geschwächt) oder das Beanspruchen neutraler
   Nachbarzellen als neues Bot-Gebiet.

   Kein Cron: der Client stößt die Function beim Start an. Ein Server-Lock
   (game_state) drosselt global und verhindert Doppelausführung.

   Deploy:  supabase functions deploy bot_tick
   ========================================================================== */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import * as h3 from 'https://esm.sh/h3-js@4.1.0';
import {
  botAttack, decayedDefense,
  BOT_NEW_DEFENSE, BOT_ACTIONS_PER_TICK, BOT_ATK_MIN, BOT_ATK_MAX, BOT_CLAIM_CELLS, BOT_ATTACK_CHANCE,
} from '../_shared/h3-engine.mjs';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } });

const LOCK_MINUTES = 5; // frühestens alle 5 Min ein Bot-Tick (global)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  // force:true (Admin-Diagnose) umgeht den Lock, damit der Test immer wirklich läuft.
  let force = false;
  try { const b = await req.json(); force = !!(b && b.force); } catch (_) { /* kein Body */ }
  try {
    const svc = createClient(SUPABASE_URL, SERVICE);

    // ── Server-Lock (bei force übersprungen) ──
    if (!force) {
      const cutoff = new Date(Date.now() - LOCK_MINUTES * 60000).toISOString();
      const { data: locked } = await svc.from('game_state')
        .update({ last_bot_tick: new Date().toISOString() })
        .eq('id', 1).lt('last_bot_tick', cutoff).select('id');
      if (!locked || !locked.length) return json({ skipped: true });
    }

    const { data: bots } = await svc.from('profiles')
      .select('id,player_name,user_color,user_team').eq('is_bot', true);
    if (!bots || !bots.length) return json({ ok: true, actions: [], note: 'no bots' });
    const botIdSet = new Set(bots.map((b: any) => b.id));
    const randBot = () => bots[Math.floor(Math.random() * bots.length)];

    const { data: trows } = await svc.from('h3_territories').select('id,owner,defense,updated_at');
    if (!trows || !trows.length) return json({ ok: true, actions: [], note: 'empty world' });
    const { data: crows } = await svc.from('h3_cells').select('cell,territory_id');

    const terrCells = new Map<string, string[]>();
    const ownedCells = new Set<string>();
    for (const c of (crows || [])) {
      ownedCells.add(c.cell);
      if (!terrCells.has(c.territory_id)) terrCells.set(c.territory_id, []);
      terrCells.get(c.territory_id)!.push(c.cell);
    }

    const nowMs = Date.now();
    const now = new Date().toISOString();
    const claimedThisTick = new Set<string>();
    const actions: any[] = [];
    // Monats-Fraktionspunkte: Bot-Aktionen halten den Saison-Wettkampf lebendig.
    // Fehlt das SQL (rc_add_faction_points), scheitert das leise.
    const monthKey = now.slice(0, 7); // 'YYYY-MM'
    const addFactionPts = async (team: string | null, pts: number) => {
      if (!team || !(pts > 0)) return;
      try { await svc.rpc('rc_add_faction_points', { mk: monthKey, team_id: team, pts: Math.round(pts) }); } catch (_) { /* noop */ }
    };

    // Bots agieren bevorzugt an Spielergebieten (dort wird gespielt).
    const playerTerr = trows.filter((t: any) => !botIdSet.has(t.owner));
    const anchors = playerTerr.length ? playerTerr : trows;
    // Gebiets-Schutz: Spieler mit shield_until in der Zukunft sind angriffs-immun.
    const shielded = new Set<string>();
    try {
      const owners = [...new Set(playerTerr.map((t: any) => t.owner).filter(Boolean))];
      if (owners.length) {
        const { data: shrows } = await svc.from('profiles').select('id,shield_until').in('id', owners);
        for (const p of (shrows || [])) { const tm = Date.parse(p.shield_until || ''); if (tm && tm > nowMs) shielded.add(p.id); }
      }
    } catch (_) { /* Spalte fehlt -> kein Schutz */ }

    for (let i = 0; i < BOT_ACTIONS_PER_TICK && anchors.length; i++) {
      const anchor: any = anchors[Math.floor(Math.random() * anchors.length)];
      const anchorCells = terrCells.get(anchor.id) || [];
      if (!anchorCells.length) continue;
      const doAttack = Math.random() < BOT_ATTACK_CHANCE;

      if (doAttack && !botIdSet.has(anchor.owner) && !shielded.has(anchor.owner)) {
        // Angriff auf ein Spielergebiet — mittlere Stärke, unabhängig vom Wert.
        // (Geschützte Spieler werden übersprungen.)
        const def = decayedDefense(anchor.defense, Date.parse(anchor.updated_at) || nowMs, nowMs);
        const strength = BOT_ATK_MIN + Math.random() * (BOT_ATK_MAX - BOT_ATK_MIN);
        const r = botAttack(def, strength);
        const bot = randBot();
        if (r.taken) {
          await svc.from('h3_territories').update({
            owner: bot.id, owner_name: bot.player_name, owner_color: bot.user_color,
            owner_team: bot.user_team, defense: r.newDefense, updated_at: now, last_captured_at: now,
          }).eq('id', anchor.id);
          anchor.owner = bot.id;
          actions.push({ type: 'attack_take', id: anchor.id, bot: bot.player_name });
          await addFactionPts(bot.user_team, strength);
          // Bot-Eroberung zählt für die Fraktions-Kontrolle (kumulativ, wie bei Spielern).
          try { await svc.rpc('rc_bump_conquered', { uid: bot.id, n: 1 }); } catch (_) { /* noop */ }
        } else {
          await svc.from('h3_territories').update({ defense: r.newDefense, updated_at: now }).eq('id', anchor.id);
          actions.push({ type: 'attack_weaken', id: anchor.id, def: Math.round(r.newDefense) });
          await addFactionPts(randBot().user_team, strength * 0.5);
        }
      } else {
        // Neutrale Nachbarzellen des Anchors beanspruchen -> neues Bot-Gebiet.
        const seed = anchorCells[Math.floor(Math.random() * anchorCells.length)];
        let ring: string[] = [];
        // Zufälliger Radius (1–4) -> Bots beanspruchen mal näher, mal weiter weg,
        // statt immer dieselben direkten Nachbarzellen.
        const kRad = 1 + Math.floor(Math.random() * 4);
        try { ring = h3.gridDisk(seed, kRad); } catch (_) { /*noop*/ }
        // Frei-Zellen mischen, damit nicht immer dieselben gegriffen werden.
        const neutral = ring.filter((c) => !ownedCells.has(c) && !claimedThisTick.has(c))
          .sort(() => Math.random() - 0.5)
          .slice(0, BOT_CLAIM_CELLS);
        if (neutral.length) {
          const bot = randBot();
          const { data: nt } = await svc.from('h3_territories').insert({
            owner: bot.id, owner_name: bot.player_name, owner_color: bot.user_color,
            owner_team: bot.user_team, defense: BOT_NEW_DEFENSE, last_captured_at: now,
          }).select('id').single();
          if (nt) {
            await svc.from('h3_cells').upsert(neutral.map((c) => ({ cell: c, territory_id: nt.id })), { onConflict: 'cell' });
            neutral.forEach((c) => { claimedThisTick.add(c); ownedCells.add(c); });
            actions.push({ type: 'claim', bot: bot.player_name, cells: neutral.length });
            await addFactionPts(bot.user_team, neutral.length);
          }
        }
      }
    }
    return json({ ok: true, actions });
  } catch (e) {
    return json({ error: String(e && (e as Error).message || e) }, 500);
  }
});
