/* ============================================================================
   Runners Conquer — Edge Function "conquer" (server-autoritative H3-Eroberung)
   ----------------------------------------------------------------------------
   Empfängt einen Lauf (roher GPS-Track + Distanz + Dauer), wandelt ihn in H3-
   Zellen, lädt die betroffenen Gebiete, lässt die getestete Engine (resolveRun)
   entscheiden und schreibt das Ergebnis atomar-sequenziell in die h3_*-Tabellen.
   Die gesamte Spielmechanik liegt in ../_shared/h3-engine.mjs (in Node getestet).

   Deploy:  supabase functions deploy conquer
   Aufruf:  POST { path:[[lat,lng],...], distanceM, durationS, playerName, userColor }
            Header: Authorization: Bearer <user-jwt>
   ========================================================================== */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import * as h3 from 'https://esm.sh/h3-js@4.1.0';
import { createEngine, validateRun } from '../_shared/h3-engine.mjs';

const engine = createEngine(h3);

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

// Grobe Distanz zweier [lat,lng]-Punkte in Metern (Loop-Erkennung).
function haversine(a: number[], b: number[]) {
  const R = 6371000, toRad = (d: number) => d * Math.PI / 180;
  const dLat = toRad(b[0] - a[0]), dLng = toRad(b[1] - a[1]);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;
  const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  try {
    // ── Auth: JWT des aufrufenden Nutzers prüfen ─────────────────────────────
    const authHeader = req.headers.get('Authorization') || '';
    const userClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: 'unauthorized' }, 401);

    // ── Eingaben + Anti-Cheat-Grundprüfungen (GDS 3.1) ───────────────────────
    const body = await req.json();
    const path: number[][] = body.path || [];
    const distanceM: number = +body.distanceM || 0;
    const durationS: number = +body.durationS || 0;
    const playerName: string = (body.playerName || '').slice(0, 40);
    const userColor: string = (body.userColor || '#e8ff47').slice(0, 9);
    const userTeam: string | null = (body.userTeam || '').slice(0, 20) || null;
    if (!Array.isArray(path) || path.length < 2) return json({ error: 'bad_path' }, 400);
    const cadence = (body.cadence != null) ? +body.cadence : null; // Ø Schritte/Min (optional, aus HealthKit/Fit)
    const distanceKm = distanceM / 1000;
    // km-XP serverseitig (gleiche Formel wie der Client): Basis km*10, degressiv
    // nach Wochen-km, Streak-Multiplikator hart auf max ×2 gedeckelt. weeklyKm/
    // streakDays sind Client-Angaben, aber eng geklammert — die XP-Höhe bleibt
    // durch die VALIDIERTE Distanz begrenzt (max km*20).
    const weeklyKm = Math.max(0, Math.min(500, +body.weeklyKm || 0));
    const streakDays = Math.max(0, Math.min(3650, Math.floor(+body.streakDays || 0)));
    const xpFactor = weeklyKm < 20 ? 1.0 : (weeklyKm < 50 ? 0.7 : 0.4);
    const streakMul = streakDays > 0 ? Math.min(2, 1 + (streakDays - 1) * 0.1) : 1;
    const kmXp = Math.round(Math.round(distanceKm * 10 * xpFactor) * streakMul);
    // Anti-Cheat (GDS 3.1): Mindestdistanz, 25-km/h-Hardcap, Cadence-Plausibilität.
    const v = validateRun({ distanceM, durationS, cadence });
    if (!v.ok) return json({ error: v.reason }, 400);
    const paceKmh = v.paceKmh;

    // ── GPS-Track -> H3-Zellen; geschlossener Loop -> eingeschlossene Zellen ──
    const runCells: Set<string> = engine.pathToCells(path);
    const gap = haversine(path[0], path[path.length - 1]);
    let enclosed: Set<string> = gap < 60 ? engine.enclosedCells([...path, path[0]]) : new Set();
    // Sicherheits-Kappung: eine absurd große eingeschlossene Fläche (Spoofing /
    // Riesen-Loop) würde tausende Zellen und teure Abfragen erzeugen. Res-10-Zelle
    // ~0,015 km² -> 5000 Zellen ≈ 75 km². Darüber: Umrundung verwerfen.
    if (enclosed.size > 5000) enclosed = new Set();

    // ── Betroffene Gebiete finden (Zellen + Randnachbarn für Rand-Berührung) ─
    const candidate = new Set<string>([...runCells, ...enclosed]);
    for (const c of runCells) { try { for (const n of h3.gridDisk(c, 1)) candidate.add(n); } catch (_) { /*noop*/ } }

    const svc = createClient(SUPABASE_URL, SERVICE);
    const { data: hitCells } = await svc.from('h3_cells').select('territory_id').in('cell', [...candidate]);
    const terrIds = [...new Set((hitCells || []).map((r: any) => r.territory_id))];

    const nowMs = Date.now();
    const territories: any[] = [];
    if (terrIds.length) {
      const { data: trows } = await svc.from('h3_territories').select('*').in('id', terrIds);
      const { data: allCells } = await svc.from('h3_cells').select('cell,territory_id').in('territory_id', terrIds);
      const byT: Record<string, Set<string>> = {};
      for (const r of (allCells || [])) (byT[r.territory_id] ||= new Set()).add(r.cell);
      const today = new Date().toISOString().slice(0, 10);
      for (const t of (trows || [])) territories.push({
        id: t.id, owner: t.owner, ownerName: t.owner_name,
        // Lazy-Decay: die wirksame Verteidigung wird aus updated_at berechnet,
        // damit Angriffe gegen lange nicht verteidigte Gebiete leichter sind.
        defense: engine.decayedDefense(t.defense, Date.parse(t.updated_at || t.created_at) || nowMs, nowMs),
        dailyAdded: t.daily_defense_added, lastDay: t.last_defense_day,
        today, cells: byT[t.id] || new Set(),
      });
    }

    // ── Energie (server-autoritativ): 3 Boosts/Woche, +10% Angriff ───────────
    const weekKey = (() => { const d = new Date(); const jan1 = Date.UTC(d.getUTCFullYear(), 0, 1); const wk = Math.floor((nowMs - jan1) / (7 * 86400000)); return d.getUTCFullYear() + '-' + wk; })();
    const { data: prof } = await svc.from('profiles').select('points,energy,energy_week').eq('id', user.id).single();
    let energy = (prof?.energy != null) ? prof.energy : engine.ENERGY_PER_WEEK;
    if (prof?.energy_week !== weekKey) energy = engine.ENERGY_PER_WEEK; // Wochen-Reset
    let applyBoost = false;
    if (body.boosted && energy > 0) { applyBoost = true; energy -= 1; }

    // ── Engine entscheidet ───────────────────────────────────────────────────
    const res = engine.resolveRun({ userId: user.id, runCells, enclosed, distanceKm, paceKmh, territories, boosted: applyBoost });

    // ── Mutationen anwenden (Reihenfolge: delete -> update -> create, damit
    //    Zellen frei sind, bevor sie neu vergeben werden; cell ist global PK) ─
    const now = new Date().toISOString();
    for (const id of res.deletes) await svc.from('h3_territories').delete().eq('id', id); // Zellen cascade
    for (const u of res.updates) {
      const patch: any = { defense: u.defense, updated_at: now };
      if (u.dailyAdded != null) { patch.daily_defense_added = u.dailyAdded; patch.last_defense_day = u.lastDay; }
      // Eigenes Gebiet (Verteidigungsaufbau): Fraktion/Name/Farbe auffrischen bzw.
      // nachtragen — sonst bleibt owner_team bei Altbeständen leer ("Keine Fraktion").
      if (u.own) { patch.owner_team = userTeam; patch.owner_name = playerName; patch.owner_color = userColor; }
      await svc.from('h3_territories').update(patch).eq('id', u.id);
      if (u.setCells) {
        await svc.from('h3_cells').delete().eq('territory_id', u.id);
        if (u.setCells.length) await svc.from('h3_cells').insert(u.setCells.map((c: string) => ({ cell: c, territory_id: u.id })));
      }
    }
    for (const cr of res.creates) {
      const { data: nt } = await svc.from('h3_territories')
        .insert({ owner: cr.owner, owner_name: playerName, owner_color: userColor, owner_team: userTeam, defense: cr.defense, last_captured_at: now })
        .select('id').single();
      if (nt && cr.cells.length)
        await svc.from('h3_cells').upsert(cr.cells.map((c: string) => ({ cell: c, territory_id: nt.id })), { onConflict: 'cell' });
    }

    // ── Eroberungs-Bonus: Erobern gibt spürbar mehr XP (zusätzlich zu den
    //    Angriffspunkten der Engine): +40 XP je erobertem/abgetrenntem Gebiet. ─
    const CONQUEST_BONUS_XP = 40;
    const conqCount = (res.events || []).filter((e: any) => e.type === 'conquered' || e.type === 'cut').length;
    const conquestBonus = conqCount * CONQUEST_BONUS_XP;

    // ── Punkte + Energie persistieren (Energie server-autoritativ) ───────────
    // Lauf-XP (Eroberung + Bonus + km-XP) werden serverseitig gutgeschrieben; der
    // Client bucht dieselben Beträge lokal (identische Formel) — konsistenter Stand.
    const runTotal = (res.playerPoints || 0) + conquestBonus + kmXp;
    await svc.from('profiles').update({
      points: (prof?.points || 0) + runTotal,
      energy, energy_week: weekKey,
    }).eq('id', user.id);
    // Eigene Eroberungen serverseitig mitzählen (Fraktions-Kontrolle basiert darauf).
    if (conqCount > 0) {
      try { await svc.rpc('rc_bump_conquered', { uid: user.id, n: conqCount }); } catch (_) { /* noop */ }
    }

    // ── Monats-Fraktionspunkte (echte Saisons: jeden Monat bei 0) ────────────
    // Fehlt das SQL noch (rc_add_faction_points), scheitert das leise — der Lauf
    // selbst bleibt gewertet.
    if (userTeam && runTotal > 0) {
      const mk = new Date().toISOString().slice(0, 7); // 'YYYY-MM' (UTC)
      try { await svc.rpc('rc_add_faction_points', { mk, team_id: userTeam, pts: Math.round(runTotal) }); } catch (_) { /* noop */ }
    }

    // ── Echte Events: Fortschritt dieses Laufs fortschreiben ─────────────────
    // Events sind serverseitig definiert (events-Tabelle); der Fortschritt wird
    // hier — und nur hier — aus validierten Läufen geschrieben. Fehlt das SQL
    // noch, scheitert der Block leise.
    try {
      const nowIso = new Date().toISOString();
      try { await svc.rpc('rc_ensure_events'); } catch (_) { /* noop */ }
      const { data: evs } = await svc.from('events').select('id,type,target')
        .lte('starts_at', nowIso).gt('ends_at', nowIso);
      if (evs && evs.length) {
        const { data: prows } = await svc.from('event_progress')
          .select('event_id,progress,completed_at')
          .eq('user_id', user.id).in('event_id', evs.map((e: any) => e.id));
        const pmap = new Map((prows || []).map((r: any) => [r.event_id, r]));
        for (const ev of evs) {
          const cur: any = pmap.get(ev.id);
          let prog = cur ? (+cur.progress || 0) : 0;
          if (ev.type === 'distance_single') prog = Math.max(prog, distanceM);
          else if (ev.type === 'distance_total') prog += distanceM;
          else if (ev.type === 'conquer') prog += conqCount;
          else if (ev.type === 'runs') prog += 1;
          // claimed wird bewusst NICHT mitgeschickt -> bleibt beim Upsert erhalten.
          await svc.from('event_progress').upsert({
            event_id: ev.id, user_id: user.id, progress: prog,
            completed_at: (cur && cur.completed_at) || (prog >= ev.target ? nowIso : null),
            updated_at: nowIso,
          }, { onConflict: 'event_id,user_id' });
        }
      }
    } catch (_) { /* Events optional — Lauf bleibt gewertet */ }

    return json({ ok: true, points: (res.playerPoints || 0) + conquestBonus, kmXp, conquestBonus, events: res.events, atkPts: res.atkPts, defPts: res.defPts, energy, boosted: applyBoost });
  } catch (e) {
    return json({ error: String(e && (e as Error).message || e) }, 500);
  }
});
