/* ============================================================================
   Runners Conquer — H3 Eroberungs-Engine (reine Logik, testbar)
   ----------------------------------------------------------------------------
   Implementiert das Game-Design-Spec (GDS), Modul 1: pace-basierte Punkte,
   Distanzbonus, Verteidigungsaufbau (Tageslimit), Angriffs-/Eroberungslogik und
   den BFS-Abschneide-Algorithmus auf Ubers H3-Raster (Resolution 10).

   Bewusst DEPENDENCY-INJECTED: createEngine(h3) bekommt die h3-Lib herein, damit
   dasselbe Modul in Node (Tests, h3-js via require/import) UND in einer Supabase
   Edge Function (Deno, h3-js via esm.sh) läuft. Keine DB-/Netzwerk-Zugriffe hier
   — nur pure Funktionen, damit die Spielmechanik deterministisch testbar ist.
   ========================================================================== */

export const RES = 10; // ~65–76 m Kantenlänge; feinkörnig genug für Straßenzüge

export const DEF_MIN = 1;
export const DEF_MAX = 300;
export const CAPTURE_BONUS = 20;      // +20 nach Eroberung (darf 300 überschreiten)
// Vernachlässigungs-Schwelle: Ein Gebiet, dessen WIRKSAME (verfallene) Verteidigung
// hierunter liegt, gilt als aufgegeben und fällt an jeden, der es tatsächlich
// DURCHLÄUFT oder umrundet — ohne den Durchlauf-Dämpfer (0.2) und unabhängig vom
// Tempo. So wird ein Gebiet mit ~1 Verteidigung beim Drüberlaufen sofort erobert.
// Gepflegte/frische Gebiete starten bei >=20 (Neutral-Claim 20, Bot 22) und sind
// damit klar oberhalb dieser Schwelle geschützt.
export const NEGLECT_CAPTURE_DEF = 8;
export const DAILY_BUILD_CAP = 100;   // max +100 Verteidigung pro Gebiet & Tag
// Mindest-Verteidigungsaufbau im EIGENEN Gebiet je gelaufenem km — unabhängig vom
// Tempo. So verstärkt auch ein ruhiger Lauf durch eigenes Revier die Verteidigung
// (Tempo gibt mehr, ist aber keine Voraussetzung). Anteilig zur überlaufenen Fläche.
export const OWN_BUILD_MIN_PER_KM = 6;

// GDS Tabelle 1 — Punkte pro km nach Pace (km/h), getrennt für Verteidigung/Angriff.
const PACE_TABLE = [
  { min: 16,  def: 20, atk: 18 },
  { min: 14,  def: 20, atk: 15 },
  { min: 12,  def: 16, atk: 12 },
  { min: 10,  def: 13, atk: 10 },
  { min: 8,   def: 10, atk: 8  },
  { min: 0,   def: 0,  atk: 0  },
];

// GDS Tabelle 2 — einmaliger Distanzbonus (auf das Endergebnis addiert).
const DISTANCE_BONUS = [
  { min: 15, bonus: 50 },
  { min: 12, bonus: 35 },
  { min: 8,  bonus: 20 },
  { min: 0,  bonus: 0  },
];

// Anteil des Angriffsschadens je nach Lauf-Art (GDS 1.5).
export const MODE_FACTOR = {
  circumnavigation: 1.0, // vollständige Umrundung
  covered: 1.0,          // Pfad überdeckt das ganze Gebiet
  cut: 1.0,              // Teilabschnitt — eigene Cluster-Rechnung (1.6)
  through: 0.2,          // gerade durchgelaufen
  edge: 0.1,             // nur Rand berührt
  none: 0.0,             // keine Berührung
};

export function paceFactor(paceKmh, kind /* 'def' | 'atk' */) {
  for (const row of PACE_TABLE) if (paceKmh >= row.min) return row[kind];
  return 0;
}

export function distanceBonus(km) {
  for (const row of DISTANCE_BONUS) if (km >= row.min) return row.bonus;
  return 0;
}

/* Punkte eines Laufs = Distanz(km) × Pace-Faktor + Distanzbonus (GDS 1.2). */
export function runValue(distanceKm, paceKmh, kind) {
  return distanceKm * paceFactor(paceKmh, kind) + distanceBonus(distanceKm);
}

export function clampDefense(v) {
  return Math.max(DEF_MIN, Math.min(DEF_MAX, v));
}

// ── Verfall: Verteidigung sinkt mit der Zeit bis auf DEF_MIN (1) ──
// Lazy-Decay: kein Scheduler nötig. Aus dem Zeitstempel der letzten Änderung
// wird die aktuell wirksame Verteidigung berechnet (beim Lesen wie beim Kampf).
export const DECAY_PER_DAY = 8; // Punkte/Tag — zentrale Stellschraube fürs Tempo
export function decayedDefense(defense, updatedAtMs, nowMs) {
  const days = Math.max(0, (nowMs - updatedAtMs) / 86400000);
  return Math.max(DEF_MIN, (defense || DEF_MIN) - days * DECAY_PER_DAY);
}
// Verbleibende Zeit (ms), bis die Verteidigung DEF_MIN erreicht.
export function timeToMinMs(defense, updatedAtMs, nowMs) {
  const cur = decayedDefense(defense, updatedAtMs, nowMs);
  return Math.max(0, ((cur - DEF_MIN) / DECAY_PER_DAY) * 86400000);
}

// ── Energie-Boost: erhöht den Angriff eines Laufs um 10% ──
export const ENERGY_BOOST = 0.10;
export const ENERGY_PER_WEEK = 3;

// ── Bots: nehmen mit der Zeit stark verfallene Gebiete ein ──
// Reine Auswahl-Logik (testbar): liefert die IDs der Gebiete, die ein Bot in
// diesem Tick übernimmt — die am stärksten verfallenen (wirksame Verteidigung
// <= maxDef), die noch keinem Bot gehören, begrenzt auf `limit`.
export const BOT_TAKE_DEF_MAX = 5;   // ab hier gilt ein Gebiet als vernachlässigt
export const BOT_TAKE_LIMIT = 2;     // max. Übernahmen pro Tick
export const BOT_NEW_DEFENSE = 22;   // Startverteidigung eines Bot-Gebiets (schwächer -> leichter zurückzuerobern)
// Aktive Bots: pro Tick wenige Aktionen rund um Spielergebiete. Bewusst SCHWACH
// gehalten — Angriffe im unteren Bereich, sodass gut/mittel verteidigte Gebiete
// standhalten und nur vernachlässigte fallen. Bots sollen die Welt beleben,
// nicht den Spieler überrennen.
export const BOT_ACTIONS_PER_TICK = 3;
export const BOT_ATK_MIN = 6;
export const BOT_ATK_MAX = 18;       // Ø ~12: schwächt höchstens, übernimmt selten
export const BOT_CLAIM_CELLS = 6;    // Größe eines neu beanspruchten Bot-Gebiets
export const BOT_ATTACK_CHANCE = 0.15; // seltener Angriff auf Spielergebiete (Rest: neutrale Zellen beanspruchen)

/* Ein Bot-Angriff der Stärke `strength` auf ein Gebiet mit `defense`.
   strength >= defense -> übernommen (Startverteidigung BOT_NEW_DEFENSE), sonst
   nur geschwächt (min. 1). Rein + testbar. */
export function botAttack(defense, strength) {
  if (strength >= defense) return { taken: true, newDefense: BOT_NEW_DEFENSE };
  return { taken: false, newDefense: Math.max(DEF_MIN, defense - strength) };
}
export function pickBotTargets({ territories, nowMs, maxDef = BOT_TAKE_DEF_MAX, limit = BOT_TAKE_LIMIT, botOwnerIds = [] } = {}) {
  const bots = new Set(botOwnerIds);
  const cand = [];
  for (const t of (territories || [])) {
    if (bots.has(t.owner)) continue; // gehört schon einem Bot
    const def = decayedDefense(t.defense, t.updatedAtMs || 0, nowMs);
    if (def <= maxDef) cand.push({ id: t.id, def });
  }
  cand.sort((a, b) => a.def - b.def); // schwächste zuerst
  return cand.slice(0, limit).map(c => c.id);
}

// ── Bot-Aufräumen: begrenzt das unbegrenzte Wachstum der Bot-Gebiete ──
// Bots beanspruchen jeden Tick neue Zellen; ohne Obergrenze füllt sich Welt/DB
// endlos. Liefert die IDs der Bot-Gebiete, die WEG sollen: die schwächsten
// (am stärksten verfallenen) über der Obergrenze `cap`. Spieler-Gebiete werden
// NIE angefasst (deren Verfall ist gewolltes Gameplay). Rein + testbar.
export const BOT_TERR_CAP = 1000; // max. gleichzeitige Bot-Gebiete weltweit
export function pickBotCleanup({ territories, nowMs = 0, botOwnerIds = [], cap = BOT_TERR_CAP } = {}) {
  const bots = new Set(botOwnerIds);
  const botTerr = [];
  for (const t of (territories || [])) {
    if (!bots.has(t.owner)) continue;
    botTerr.push({ id: t.id, def: decayedDefense(t.defense, t.updatedAtMs || 0, nowMs) });
  }
  if (botTerr.length <= cap) return [];
  botTerr.sort((a, b) => a.def - b.def); // schwächste/verfallenste zuerst
  return botTerr.slice(0, botTerr.length - cap).map(c => c.id);
}

// ── Anti-Cheat-Regeln (GDS 3.1) — server-autoritativ, ohne Geo-Abhängigkeit ──
export const MIN_DIST_M = 150;
export const HARD_MAX_KMH = 25;   // > Rad/Auto -> Lauf ungültig
export const CADENCE_SPEED_KMH = 6; // ab hier ist Bewegung ohne Schritte verdächtig

/* Prüft einen Lauf vor der Wertung. cadence (Schritte/Min, Ø) ist OPTIONAL:
   ist sie null/undefined (keine Health-Daten), wird sie NICHT geprüft — die
   GPS-Bewertung bleibt möglich. Ist sie 0 bei relevanter Geschwindigkeit,
   deutet das auf Fahrzeug/Spoofing hin -> ungültig. */
export function validateRun({ distanceM, durationS, cadence, paceKmh } = {}) {
  if (!(distanceM >= MIN_DIST_M)) return { ok: false, reason: 'too_short' };
  const pace = (paceKmh != null) ? paceKmh
    : (durationS > 0 ? (distanceM / 1000) / (durationS / 3600) : 0);
  if (pace > HARD_MAX_KMH) return { ok: false, reason: 'speed_hardcap' };
  if (cadence != null && cadence <= 0 && pace > CADENCE_SPEED_KMH) return { ok: false, reason: 'cadence_zero' };
  return { ok: true, paceKmh: pace };
}

// Großkreis-Distanz zweier [lat,lng]-Punkte in Metern (rein, für Tempo je Zelle).
export function haversineM(a, b) {
  const R = 6371000, toRad = (d) => d * Math.PI / 180;
  const dLat = toRad(b[0] - a[0]), dLng = toRad(b[1] - a[1]);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

/* Anti-Cheat: Teleport-/Spoof-Erkennung auf SEGMENT-Ebene (#33). Nutzt die
   Zeitstempel je GPS-Fix ([lat,lng,tMs], #44), die das Durchschnitts-Tempo NICHT
   zeigt. Ungültig, wenn (a) ein einzelnes Segment schneller als `hardKmh` ist
   (unmöglicher Sprung) ODER (b) mehr als `fastFrac` der getrackten Distanz über
   `maxKmh` (25) zurückgelegt wurde (anhaltend zu schnell -> Fahrzeug/Spoof).
   Fehlen Zeitstempel (Alt-Track/Import), wird NICHT geprüft (ok). Rein + testbar.
   Rückgabe-Grund 'speed_hardcap' -> nutzt die bestehende Client-Meldung. */
export function validateTrack(latlngs, { maxKmh = HARD_MAX_KMH, hardKmh = 45, fastFrac = 0.35 } = {}) {
  let prev = null, trackedDist = 0, fastDist = 0;
  for (const ll of (latlngs || [])) {
    const lat = ll[0], lng = ll[1], t = (ll.length > 2 && ll[2] != null) ? +ll[2] : null;
    if (prev && prev.t != null && t != null && t > prev.t) {
      const dM = haversineM([prev.lat, prev.lng], [lat, lng]);
      const dtH = (t - prev.t) / 3600000;
      if (dtH > 0) {
        const kmh = (dM / 1000) / dtH;
        trackedDist += dM;
        if (kmh > hardKmh) return { ok: false, reason: 'speed_hardcap', kmh };
        if (kmh > maxKmh) fastDist += dM;
      }
    }
    prev = { lat, lng, t };
  }
  if (trackedDist > 0 && fastDist > fastFrac * trackedDist) return { ok: false, reason: 'speed_hardcap' };
  return { ok: true };
}

export function createEngine(h3) {
  if (!h3 || !h3.latLngToCell) throw new Error('createEngine: h3-Lib fehlt');

  /* GPS-Track (Array [lat,lng]) -> Set der DURCHLAUFENEN H3-Zellen. Zwischen
     aufeinanderfolgenden Fixes wird der Zellpfad gefüllt (gridPathCells), damit
     bei großem Fix-Abstand keine Lücken in der Schneise entstehen. */
  function pathToCells(latlngs, res = RES) {
    return pathToCellPace(latlngs, res).cells;
  }

  /* GPS-Track MIT Zeitstempeln ([lat,lng,tMs]) -> DURCHLAUFENE Zellen PLUS das
     Tempo (km/h) je Zelle zum Zeitpunkt des Durchlaufens (#44). Zwischen zwei
     Fixes wird die Segment-Geschwindigkeit (Distanz/Zeit) berechnet und JEDER
     Zelle des gefüllten Zellpfads zugewiesen. Fehlen Zeitstempel (Alt-Track/
     Import), bleibt cellPace leer -> die Engine fällt aufs Global-Tempo zurück.
     Rückgabe: { cells:Set, cellPace:Map<cell, kmh> }. */
  function pathToCellPace(latlngs, res = RES) {
    const cells = new Set();
    const cellPace = new Map();
    let prev = null, prevLL = null, prevT = null;
    const setPace = (c, kmh) => {
      if (!(kmh > 0)) return;
      // Bei überlappenden Segmenten die höhere plausible Geschwindigkeit behalten
      // (kurzer Sprint durch eine Zelle soll nicht vom langsamen Nachbarsegment
      // verwässert werden). Hart auf den Anti-Cheat-Hardcap geklammert.
      const v = Math.min(HARD_MAX_KMH, kmh);
      const cur = cellPace.get(c);
      if (cur == null || v > cur) cellPace.set(c, v);
    };
    for (const ll of latlngs) {
      const lat = ll[0], lng = ll[1], t = (ll.length > 2 && ll[2] != null) ? +ll[2] : null;
      const c = h3.latLngToCell(lat, lng, res);
      let segKmh = 0;
      if (prevLL && prevT != null && t != null && t > prevT) {
        const dM = haversineM(prevLL, [lat, lng]);
        segKmh = (dM / 1000) / ((t - prevT) / 3600000);
      }
      if (prev && prev !== c) {
        try { for (const p of h3.gridPathCells(prev, c)) { cells.add(p); setPace(p, segKmh); } }
        catch { cells.add(c); } // gridPathCells wirft bei zu weiter Distanz
      }
      cells.add(c);
      setPace(c, segKmh);
      prev = c; prevLL = [lat, lng]; prevT = t;
    }
    return { cells, cellPace };
  }

  /* Fläche eines geschlossenen Laufs -> eingeschlossene H3-Zellen (für die
     Umrundungs-Erkennung). loopLatLngs ist ein Ring [[lat,lng],...]. */
  function enclosedCells(loopLatLngs, res = RES) {
    if (!loopLatLngs || loopLatLngs.length < 4) return new Set();
    try {
      const ring = loopLatLngs.map(([lat, lng]) => [lat, lng]);
      return new Set(h3.polygonToCells(ring, res)); // [lat,lng]-Ringe (h3-js v4)
    } catch { return new Set(); }
  }

  /* BFS: zerlege ein Set von Zellen in zusammenhängende Cluster (Nachbarschaft
     über gridDisk k=1). Gibt Array von Zell-Arrays zurück, größter zuerst. */
  function clusters(cellSet) {
    const remaining = new Set(cellSet);
    const out = [];
    while (remaining.size) {
      const start = remaining.values().next().value;
      remaining.delete(start);
      const comp = [start];
      const queue = [start];
      while (queue.length) {
        const cur = queue.pop();
        let neigh;
        try { neigh = h3.gridDisk(cur, 1); } catch { neigh = []; }
        for (const n of neigh) {
          if (remaining.has(n)) { remaining.delete(n); comp.push(n); queue.push(n); }
        }
      }
      out.push(comp);
    }
    out.sort((a, b) => b.length - a.length);
    return out;
  }

  function isSuperset(big, small) {
    for (const c of small) if (!big.has(c)) return false;
    return true;
  }
  function touchesBorder(runCells, enemyCells) {
    for (const rc of runCells) {
      let neigh; try { neigh = h3.gridDisk(rc, 1); } catch { neigh = []; }
      for (const n of neigh) if (enemyCells.has(n)) return true;
    }
    return false;
  }

  /* Bestimmt die Lauf-Art gegen ein Feindgebiet (GDS 1.5/1.6, Schritt 1–2).
     #36 — es zählen AUSSCHLIESSLICH Zellen, durch die der Lauf PHYSISCH führt.
     Reines Umschließen (Umrundung) ohne Durchlaufen ist KEIN Angriff mehr — der
     Parameter `encl` wird bewusst nicht mehr ausgewertet (bleibt für Signatur-
     Kompatibilität erhalten). */
  function classify(enemyCells, runCells, encl) {
    if (!enemyCells.size) return { mode: 'none' };

    const overlap = new Set();
    for (const c of runCells) if (enemyCells.has(c)) overlap.add(c);

    if (!overlap.size) {
      return touchesBorder(runCells, enemyCells) ? { mode: 'edge' } : { mode: 'none' };
    }
    const remaining = new Set(enemyCells);
    for (const c of overlap) remaining.delete(c);
    if (!remaining.size) return { mode: 'covered', overlap };
    const cl = clusters(remaining);
    if (cl.length >= 2) return { mode: 'cut', clusters: cl, overlap };
    return { mode: 'through', overlap };
  }

  /* Vollständige Angriffs-Auflösung (GDS 1.4–1.6).
     Eingaben:
       enemyCells   : string[]  H3-Zellen des Zielgebiets
       enemyDefense : number    aktuelle Gesamtverteidigung (>=1)
       runCells     : Set|string[] durchlaufene Zellen
       enclosed     : Set|string[] eingeschlossene Zellen (0 wenn kein Loop)
       attackPoints : number    Punkte des Laufs (runValue(...,'atk'))
     Rückgabe: { mode, conquered, cutOff, defenderCells, defenderDefense,
                 attackerCells, attackerDefense, damage } */
  function resolveAttack({ enemyCells, enemyDefense, runCells, enclosed, attackPoints }) {
    const E = new Set(enemyCells);
    const R = runCells instanceof Set ? runCells : new Set(runCells);
    const encl = enclosed instanceof Set ? enclosed : new Set(enclosed || []);
    const info = classify(E, R, encl);
    const base = {
      mode: info.mode, conquered: false, cutOff: null,
      defenderCells: [...E], defenderDefense: enemyDefense,
      attackerCells: null, attackerDefense: 0, damage: 0,
    };
    if (info.mode === 'none') return base;

    // --- Vernachlässigtes Gebiet: einfach drüberlaufen genügt (GDS-Ergänzung) ---
    // Wer ein Gebiet mit sehr niedriger, verfallener Verteidigung tatsächlich
    // überläuft (Überdeckung/Durchlauf/Cut) oder umrundet, beansprucht es KOMPLETT.
    // Der 0.2-Durchlauf-Dämpfer und die Pace-Punkte spielen hier bewusst keine
    // Rolle — ein aufgegebenes Gebiet (~1 Verteidigung) soll fallen, sobald man
    // darüberläuft. Reine Randberührung ('edge', kein Überlappen) zählt NICHT.
    if (info.mode !== 'edge' && enemyDefense <= NEGLECT_CAPTURE_DEF) {
      return {
        ...base, conquered: true, damage: enemyDefense,
        defenderCells: [], defenderDefense: 0,
        attackerCells: [...E],
        attackerDefense: Math.max(DEF_MIN, attackPoints - enemyDefense) + CAPTURE_BONUS,
      };
    }

    // --- Teilabschnitt (1.6): kleinster Cluster wird separat bewertet ---
    if (info.mode === 'cut') {
      const total = E.size;
      const small = info.clusters[info.clusters.length - 1];
      const smallSet = new Set(small);
      const areaFrac = small.length / total;
      const areaDefense = enemyDefense * areaFrac;
      if (attackPoints >= areaDefense) {
        // Erfolg: NUR der kleine (abgetrennte) Cluster wird Gebiet des Angreifers.
        // Der Verteidiger behält alles Übrige (großer Cluster + durchlaufene
        // Swath-Zellen) und verliert den Flächenanteil an Verteidigung (GDS 1.6).
        const overflow = attackPoints - areaDefense;
        return {
          ...base, cutOff: small,
          defenderCells: [...E].filter(c => !smallSet.has(c)),
          defenderDefense: clampDefense(enemyDefense * (1 - areaFrac)),
          attackerCells: small,
          attackerDefense: overflow + CAPTURE_BONUS,
          conquered: true, damage: areaDefense,
        };
      }
      // Fehlschlag: keine Abtrennung, ganzer Angriff von Gesamtverteidigung ab.
      const nd = enemyDefense - attackPoints;
      return { ...base, defenderDefense: Math.max(DEF_MIN, nd), damage: attackPoints };
    }

    // --- Umrundung / Überdeckung / Durchlauf / Randberührung ---
    const factor = MODE_FACTOR[info.mode] ?? 0;
    const dmg = attackPoints * factor;
    const nd = enemyDefense - dmg;
    if (nd <= 0) {
      // Ganzes Gebiet erobert. Neue Basisverteidigung = Überschuss + Bonus.
      const overflow = dmg - enemyDefense;
      return {
        ...base, conquered: true, damage: enemyDefense,
        defenderCells: [], defenderDefense: 0,
        attackerCells: [...E], attackerDefense: Math.max(DEF_MIN, overflow) + CAPTURE_BONUS,
      };
    }
    return { ...base, defenderDefense: clampDefense(nd), damage: dmg };
  }

  /* Verteidigungsaufbau im EIGENEN Gebiet — ANTEILIG zur überlaufenen Fläche.
     coverFrac = Anteil der eigenen Zellen, die dieser Lauf berührt/einschließt
     (0..1). Der Zuwachs ist buildPoints × coverFrac: läuft man nur einen Teil
     des Gebiets ab, steigt die Gesamtverteidigung nur anteilig; volles Umrunden
     (coverFrac=1) gibt den vollen Zuwachs. Gedeckelt durch Tageslimit (+100/Tag)
     und Max 300. */
  function resolveDefenseBuild({ ownDefense, coverFrac, buildPoints, dailyAlready }) {
    const frac = Math.max(0, Math.min(1, coverFrac || 0));
    if (frac <= 0) {
      return { built: 0, defense: ownDefense, dailyAfter: dailyAlready || 0, coverFrac: 0 };
    }
    const dayRoom = Math.max(0, DAILY_BUILD_CAP - (dailyAlready || 0));
    const maxRoom = Math.max(0, DEF_MAX - ownDefense);
    const built = Math.max(0, Math.min(buildPoints * frac, dayRoom, maxRoom));
    return {
      built,
      defense: clampDefense(ownDefense + built),
      dailyAfter: (dailyAlready || 0) + built,
      coverFrac: frac,
    };
  }

  /* Orchestriert EINEN Lauf gegen die Spielwelt (GDS Modul 1 gesamt).
     Eingaben:
       userId, playerName, userColor
       runCells   : Set  durchlaufene H3-Zellen
       enclosed   : Set  eingeschlossene Zellen (0 wenn kein Loop)
       distanceKm, paceKmh
       territories: [{ id, owner, ownerName, ownerColor, defense,
                       dailyAdded, lastDay, today, cells:Set }]
                    — ALLE Gebiete, die mind. eine betroffene Zelle enthalten.
     Rückgabe: { atkPts, defPts, playerPoints, updates[], deletes[], creates[], events[] }
       updates : { id, defense, dailyAdded?, lastDay?, setCells? }  (setCells = neue Zell-Liste)
       deletes : [territoryId]   (vollständig erobert -> gelöscht, Zellen wandern in ein create)
       creates : { owner, cells[], defense, neutral? }  (neues Gebiet des Angreifers) */
  function resolveRun({ userId, runCells, enclosed, distanceKm, paceKmh, territories, boosted, cellPace }) {
    const boostMul = boosted ? (1 + ENERGY_BOOST) : 1;
    // Global-Tempo als Reporting-/Fallback-Wert (out.atkPts/defPts, sowie überall
    // dort, wo kein Zell-Tempo vorliegt — z.B. Alt-Tracks ohne Zeitstempel).
    const atkPts = runValue(distanceKm, paceKmh, 'atk') * boostMul;
    const defPts = runValue(distanceKm, paceKmh, 'def');
    const R = runCells instanceof Set ? runCells : new Set(runCells);
    const encl = enclosed instanceof Set ? enclosed : new Set(enclosed || []);
    const cp = (cellPace instanceof Map) ? cellPace : null;
    // #44 — Tempo je Hexagon: das für ein Gebiet wirksame Tempo ist der Mittelwert
    // des Lauf-Tempos ÜBER GENAU DIE ZELLEN, die dieser Lauf in dem Gebiet berührt.
    // So schlägt ein Sprint durch ein Gebiet härter zu als ein Spaziergang durch
    // ein anderes — verschiedene Gebiete bekommen dadurch verschiedene Angriffs-
    // bzw. Verteidigungswerte aus DEMSELBEN Lauf. Ohne Zell-Tempo: Global-Tempo.
    const localPace = (cells) => {
      if (!cp) return paceKmh;
      let sum = 0, n = 0;
      for (const c of cells) { if (R.has(c) && cp.has(c)) { sum += cp.get(c); n++; } }
      return n ? sum / n : paceKmh;
    };
    const terrs = territories || [];
    const out = { atkPts, defPts, playerPoints: 0, updates: [], deletes: [], creates: [], events: [] };
    const claimed = new Set(); // Zellen, die in diesem Lauf an den Angreifer gehen

    for (const t of terrs) {
      const cells = t.cells instanceof Set ? t.cells : new Set(t.cells);
      if (t.owner === userId) {
        const already = (t.lastDay && t.today && t.lastDay === t.today) ? (t.dailyAdded || 0) : 0;
        // Anteil des eigenen Gebiets, den dieser Lauf TATSÄCHLICH DURCHLÄUFT
        // (nur die abgelaufenen Zellen; die eingeschlossene Fläche einer Schleife
        // zählt bewusst NICHT — man muss das Gebiet abfahren, nicht umrunden).
        let covered = 0;
        for (const c of cells) if (R.has(c)) covered++;
        const coverFrac = cells.size ? covered / cells.size : 0;
        // Verteidigungspunkte tempo-basiert (lokales Tempo in DIESEM Gebiet), mit
        // tempo-unabhängigem Mindestwert je km, damit auch langsames Durchlaufen
        // des eigenen Gebiets verstärkt.
        const ownDefPts = runValue(distanceKm, localPace(cells), 'def');
        const buildPoints = Math.max(ownDefPts, distanceKm * OWN_BUILD_MIN_PER_KM);
        const rb = resolveDefenseBuild({ ownDefense: t.defense, coverFrac, buildPoints, dailyAlready: already });
        if (rb.built > 0) {
          out.updates.push({ id: t.id, own: true, defense: rb.defense, dailyAdded: rb.dailyAfter, lastDay: t.today });
          out.events.push({ type: 'defended', id: t.id, built: Math.round(rb.built) });
          out.playerPoints += Math.round(rb.built);
        }
        continue;
      }
      // Gebiets-Schutz: geschützte Gegnergebiete (24h-Immunität) können NICHT
      // angegriffen/erobert werden. Der Schutz wird pro Gebiet als t.shielded=true
      // hereingereicht (in conquer aus profiles.shield_until der Besitzer bestimmt).
      if (t.shielded) { out.events.push({ type: 'shielded', id: t.id }); continue; }
      // #44 — Angriffspunkte für DIESES Gebiet aus dem lokalen Tempo (Sprint durch
      // ein Gebiet trifft härter als Trab durch ein anderes). Boost bleibt aktiv.
      const tAtk = runValue(distanceKm, localPace(cells), 'atk') * boostMul;
      const ra = resolveAttack({ enemyCells: [...cells], enemyDefense: t.defense, runCells: R, enclosed: encl, attackPoints: tAtk });
      if (ra.mode === 'none') continue;
      if (ra.conquered && ra.defenderCells.length === 0) {
        out.deletes.push(t.id);
        out.creates.push({ owner: userId, cells: ra.attackerCells, defense: ra.attackerDefense });
        ra.attackerCells.forEach(c => claimed.add(c));
        out.events.push({ type: 'conquered', id: t.id, cells: ra.attackerCells.length });
        out.playerPoints += Math.round(tAtk);
      } else if (ra.conquered && ra.cutOff) {
        out.updates.push({ id: t.id, defense: ra.defenderDefense, setCells: ra.defenderCells });
        out.creates.push({ owner: userId, cells: ra.attackerCells, defense: ra.attackerDefense });
        ra.attackerCells.forEach(c => claimed.add(c));
        out.events.push({ type: 'cut', id: t.id, got: ra.attackerCells.length });
        out.playerPoints += Math.round(tAtk);
      } else {
        out.updates.push({ id: t.id, defense: ra.defenderDefense });
        out.events.push({ type: 'attacked', id: t.id, damage: Math.round(ra.damage) });
        out.playerPoints += Math.round(ra.damage);
      }
    }

    // Neutral-Claim: alle Zellen, die dieser Lauf beansprucht und die noch
    // niemandem gehören, werden ein neues Gebiet. #36 — das ist NUR der DURCHLAUFENE
    // PFAD (auch der Teil außerhalb eigener Gebiete). Eine eingeschlossene Schleifen-
    // fläche zählt NICHT mehr — es werden ausschließlich Hexagone gewertet, durch
    // die man wirklich läuft.
    const owned = new Set();
    for (const t of terrs) { const cs = t.cells instanceof Set ? t.cells : new Set(t.cells); for (const c of cs) owned.add(c); }
    const source = new Set(R);
    const neutral = [];
    for (const c of source) if (!owned.has(c) && !claimed.has(c)) neutral.push(c);
    if (neutral.length) {
      const initDef = clampDefense(20 + Math.floor(distanceKm * 10));
      out.creates.push({ owner: userId, cells: neutral, defense: initDef, neutral: true });
      out.events.push({ type: 'neutral_claim', cells: neutral.length });
      out.playerPoints += neutral.length;
    }
    return out;
  }

  return {
    pathToCells, pathToCellPace, haversineM, enclosedCells, clusters, classify,
    resolveAttack, resolveDefenseBuild, resolveRun,
    // Re-Exports als Convenience — die conquer-Function ruft diese als
    // engine.X(...) auf, daher MÜSSEN sie im Objekt liegen (sonst
    // "engine.decayedDefense is not a function" zur Laufzeit).
    paceFactor, distanceBonus, runValue, clampDefense,
    decayedDefense, timeToMinMs, botAttack, pickBotTargets, pickBotCleanup,
    RES, DEF_MIN, DEF_MAX, CAPTURE_BONUS, DAILY_BUILD_CAP, OWN_BUILD_MIN_PER_KM,
    NEGLECT_CAPTURE_DEF, DECAY_PER_DAY, ENERGY_BOOST, ENERGY_PER_WEEK,
  };
}
