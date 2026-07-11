/* ============================================================
   GET /api/landmarks?bbox=<south,west,north,east>
   Liefert Wahrzeichen (OSM/Overpass) für den sichtbaren Kartenausschnitt.

   Statt den Client direkt gegen die oft rate-limitierte Overpass-API laufen
   zu lassen, fragt diese Funktion pro Geo-Kachel einmal an und cached das
   Ergebnis 24 h in der Supabase-Tabelle landmark_cache (service_role, umgeht
   RLS). Nachbar-Pans treffen denselben Cache-Eintrag.

   Benötigte Vercel-Env-Vars (bereits für Garmin vorhanden):
     SUPABASE_URL
     SUPABASE_SERVICE_ROLE_KEY
   ============================================================ */

const CELL = 0.05;                 // Kachelgröße in Grad (~5,5 km N-S)
const TTL_MS = 24 * 3600 * 1000;   // Cache-Lebensdauer
const MAX_CELLS = 12;              // Obergrenze pro Anfrage (Schutz vor Zoom-out-Floods)
const OVERPASS = 'https://overpass-api.de/api/interpreter';

function env(name) {
  const v = process.env[name];
  if (!v) throw new Error('Missing env var: ' + name);
  return v;
}
function sbHeaders(extra = {}) {
  const key = env('SUPABASE_SERVICE_ROLE_KEY');
  return { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json', ...extra };
}

/* Cache-Lookup für eine Kachel; gibt das Landmark-Array zurück oder null
   (Miss oder abgelaufen). Fehler werden geschluckt -> Fallback auf Overpass. */
async function cacheGet(tileKey) {
  try {
    const url = `${env('SUPABASE_URL')}/rest/v1/landmark_cache` +
      `?tile_key=eq.${encodeURIComponent(tileKey)}&select=data,fetched_at`;
    const r = await fetch(url, { headers: sbHeaders() });
    if (!r.ok) return null;
    const rows = await r.json();
    if (!rows.length) return null;
    if (Date.now() - new Date(rows[0].fetched_at).getTime() > TTL_MS) return null;
    return Array.isArray(rows[0].data) ? rows[0].data : null;
  } catch { return null; }
}

/* Kachel in den Cache schreiben (Upsert). Best-effort. */
async function cachePut(tileKey, data) {
  try {
    const url = `${env('SUPABASE_URL')}/rest/v1/landmark_cache?on_conflict=tile_key`;
    await fetch(url, {
      method: 'POST',
      headers: sbHeaders({ Prefer: 'resolution=merge-duplicates,return=minimal' }),
      body: JSON.stringify([{ tile_key: tileKey, data, fetched_at: new Date().toISOString() }])
    });
  } catch { /* egal — Cache ist nur Beschleuniger */ }
}

/* Overpass für eine einzelne Kachel abfragen und auf das schlanke
   Client-Format reduzieren. Wirft bei Netzwerk-/Parse-Fehlern. */
async function fetchOverpassCell(ti, tj) {
  const s = ti * CELL, w = tj * CELL, n = s + CELL, e = w + CELL;
  const bb = `${s},${w},${n},${e}`;
  // nwr = node|way|relation: Kirchen & viele Wahrzeichen sind als WEG (Gebäude-
  // umriss) oder Relation gemappt, NICHT als Node — deshalb reichte die reine
  // node-Abfrage nicht (in kirchenreichen Gegenden erschien nichts).
  // Vorerst NUR Kirchen (christliche Kultstätten + als Kirche gemappte Gebäude).
  const q = `[out:json][timeout:25];(`
    + `nwr["building"~"church|cathedral|chapel"]["name"](${bb});`
    + `nwr["amenity"="place_of_worship"]["religion"="christian"]["name"](${bb});`
    + `);out center qt 200;`;
  const r = await fetch(OVERPASS, { method: 'POST', body: 'data=' + encodeURIComponent(q) });
  if (!r.ok) throw new Error('overpass ' + r.status);
  const d = await r.json();
  return (d.elements || []).map(el => {
    const lat = el.lat ?? el.center?.lat;
    const lng = el.lon ?? el.center?.lon;
    if (lat == null || lng == null) return null;
    return {
      // type-präfixierte ID: node/way/relation können dieselbe Nummer haben.
      id: (el.type ? el.type[0] : 'n') + el.id,
      lat, lng,
      name: el.tags?.name || 'Wahrzeichen',
      type: el.tags?.tourism || el.tags?.historic || el.tags?.leisure
        || el.tags?.amenity || el.tags?.natural || el.tags?.building || ''
    };
  }).filter(Boolean);
}

export default async function handler(req, res) {
  // CORS: die native App (Origin capacitor://localhost) ruft diesen Endpunkt
  // cross-origin auf — ohne diese Header blockt WKWebView die Antwort und die
  // Wahrzeichen kamen nie an.
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'content-type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  try {
    const bbox = req.query.bbox;
    if (!bbox) return res.status(400).json({ error: 'bbox required' });
    const [s, w, n, e] = String(bbox).split(',').map(Number);
    if (![s, w, n, e].every(Number.isFinite) || s > n || w > e) {
      return res.status(400).json({ error: 'bad bbox' });
    }

    // Alle Kacheln aufzählen, die den Ausschnitt überdecken (gedeckelt).
    const cells = [];
    outer:
    for (let ti = Math.floor(s / CELL); ti <= Math.floor(n / CELL); ti++) {
      for (let tj = Math.floor(w / CELL); tj <= Math.floor(e / CELL); tj++) {
        cells.push([ti, tj]);
        if (cells.length >= MAX_CELLS) break outer;
      }
    }

    const out = [];
    const seen = new Set();
    for (const [ti, tj] of cells) {
      // Query-Version im Key: v3 = nur Kirchen. Erzwingt frische Cache-Einträge,
      // damit nicht die alten (zu vielen) Ergebnisse aus v2 ausgeliefert werden.
      const key = `c${CELL}v3:${ti}:${tj}`;
      let data = await cacheGet(key);
      if (!data) {
        data = await fetchOverpassCell(ti, tj);  // wirft -> unten 200 mit Teilergebnis
        await cachePut(key, data);
      }
      for (const lm of data) {
        if (!seen.has(lm.id)) { seen.add(lm.id); out.push(lm); }
      }
    }

    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.status(200).json({ landmarks: out });
  } catch (err) {
    // Nie hart fehlschlagen: lieber leeres/teilweises Ergebnis, Client fällt
    // notfalls auf direkten Overpass-Call zurück.
    return res.status(200).json({ landmarks: [], error: String((err && err.message) || err) });
  }
}
