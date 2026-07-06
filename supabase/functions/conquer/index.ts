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
import { createEngine } from '../_shared/h3-engine.mjs';

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
    if (!Array.isArray(path) || path.length < 2) return json({ error: 'bad_path' }, 400);
    if (distanceM < 150) return json({ error: 'too_short' }, 400);
    const distanceKm = distanceM / 1000;
    const paceKmh = durationS > 0 ? distanceKm / (durationS / 3600) : 0;
    if (paceKmh > 25) return json({ error: 'speed_hardcap' }, 400);   // Rad/Auto-Erkennung

    // ── GPS-Track -> H3-Zellen; geschlossener Loop -> eingeschlossene Zellen ──
    const runCells: Set<string> = engine.pathToCells(path);
    const gap = haversine(path[0], path[path.length - 1]);
    const enclosed: Set<string> = gap < 60 ? engine.enclosedCells([...path, path[0]]) : new Set();

    // ── Betroffene Gebiete finden (Zellen + Randnachbarn für Rand-Berührung) ─
    const candidate = new Set<string>([...runCells, ...enclosed]);
    for (const c of runCells) { try { for (const n of h3.gridDisk(c, 1)) candidate.add(n); } catch (_) { /*noop*/ } }

    const svc = createClient(SUPABASE_URL, SERVICE);
    const { data: hitCells } = await svc.from('h3_cells').select('territory_id').in('cell', [...candidate]);
    const terrIds = [...new Set((hitCells || []).map((r: any) => r.territory_id))];

    const territories: any[] = [];
    if (terrIds.length) {
      const { data: trows } = await svc.from('h3_territories').select('*').in('id', terrIds);
      const { data: allCells } = await svc.from('h3_cells').select('cell,territory_id').in('territory_id', terrIds);
      const byT: Record<string, Set<string>> = {};
      for (const r of (allCells || [])) (byT[r.territory_id] ||= new Set()).add(r.cell);
      const today = new Date().toISOString().slice(0, 10);
      for (const t of (trows || [])) territories.push({
        id: t.id, owner: t.owner, ownerName: t.owner_name, defense: t.defense,
        dailyAdded: t.daily_defense_added, lastDay: t.last_defense_day,
        today, cells: byT[t.id] || new Set(),
      });
    }

    // ── Engine entscheidet ───────────────────────────────────────────────────
    const res = engine.resolveRun({ userId: user.id, runCells, enclosed, distanceKm, paceKmh, territories });

    // ── Mutationen anwenden (Reihenfolge: delete -> update -> create, damit
    //    Zellen frei sind, bevor sie neu vergeben werden; cell ist global PK) ─
    const now = new Date().toISOString();
    for (const id of res.deletes) await svc.from('h3_territories').delete().eq('id', id); // Zellen cascade
    for (const u of res.updates) {
      const patch: any = { defense: u.defense, updated_at: now };
      if (u.dailyAdded != null) { patch.daily_defense_added = u.dailyAdded; patch.last_defense_day = u.lastDay; }
      await svc.from('h3_territories').update(patch).eq('id', u.id);
      if (u.setCells) {
        await svc.from('h3_cells').delete().eq('territory_id', u.id);
        if (u.setCells.length) await svc.from('h3_cells').insert(u.setCells.map((c: string) => ({ cell: c, territory_id: u.id })));
      }
    }
    for (const cr of res.creates) {
      const { data: nt } = await svc.from('h3_territories')
        .insert({ owner: cr.owner, owner_name: playerName, owner_color: userColor, defense: cr.defense, last_captured_at: now })
        .select('id').single();
      if (nt && cr.cells.length)
        await svc.from('h3_cells').upsert(cr.cells.map((c: string) => ({ cell: c, territory_id: nt.id })), { onConflict: 'cell' });
    }

    // ── Punkte gutschreiben ──────────────────────────────────────────────────
    if (res.playerPoints) {
      const { data: prof } = await svc.from('profiles').select('points').eq('id', user.id).single();
      await svc.from('profiles').update({ points: (prof?.points || 0) + res.playerPoints }).eq('id', user.id);
    }

    return json({ ok: true, points: res.playerPoints, events: res.events, atkPts: res.atkPts, defPts: res.defPts });
  } catch (e) {
    return json({ error: String(e && (e as Error).message || e) }, 500);
  }
});
