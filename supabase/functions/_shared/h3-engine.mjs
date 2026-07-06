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
export const DAILY_BUILD_CAP = 100;   // max +100 Verteidigung pro Gebiet & Tag

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

export function createEngine(h3) {
  if (!h3 || !h3.latLngToCell) throw new Error('createEngine: h3-Lib fehlt');

  /* GPS-Track (Array [lat,lng]) -> Set der DURCHLAUFENEN H3-Zellen. Zwischen
     aufeinanderfolgenden Fixes wird der Zellpfad gefüllt (gridPathCells), damit
     bei großem Fix-Abstand keine Lücken in der Schneise entstehen. */
  function pathToCells(latlngs, res = RES) {
    const cells = new Set();
    let prev = null;
    for (const [lat, lng] of latlngs) {
      const c = h3.latLngToCell(lat, lng, res);
      if (prev && prev !== c) {
        try { for (const p of h3.gridPathCells(prev, c)) cells.add(p); }
        catch { cells.add(c); } // gridPathCells wirft bei zu weiter Distanz
      }
      cells.add(c);
      prev = c;
    }
    return cells;
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

  /* Bestimmt die Lauf-Art gegen ein Feindgebiet (GDS 1.5/1.6, Schritt 1–2). */
  function classify(enemyCells, runCells, encl) {
    if (!enemyCells.size) return { mode: 'none' };
    if (encl && encl.size && isSuperset(encl, enemyCells)) return { mode: 'circumnavigation' };

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
  function resolveRun({ userId, runCells, enclosed, distanceKm, paceKmh, territories, boosted }) {
    // Energie-Boost: +10% Angriffspunkte (Verteidigungsaufbau bleibt unberührt).
    const atkPts = runValue(distanceKm, paceKmh, 'atk') * (boosted ? (1 + ENERGY_BOOST) : 1);
    const defPts = runValue(distanceKm, paceKmh, 'def');
    const R = runCells instanceof Set ? runCells : new Set(runCells);
    const encl = enclosed instanceof Set ? enclosed : new Set(enclosed || []);
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
        const rb = resolveDefenseBuild({ ownDefense: t.defense, coverFrac, buildPoints: defPts, dailyAlready: already });
        if (rb.built > 0) {
          out.updates.push({ id: t.id, defense: rb.defense, dailyAdded: rb.dailyAfter, lastDay: t.today });
          out.events.push({ type: 'defended', id: t.id, built: Math.round(rb.built) });
          out.playerPoints += Math.round(rb.built);
        }
        continue;
      }
      const ra = resolveAttack({ enemyCells: [...cells], enemyDefense: t.defense, runCells: R, enclosed: encl, attackPoints: atkPts });
      if (ra.mode === 'none') continue;
      if (ra.conquered && ra.defenderCells.length === 0) {
        out.deletes.push(t.id);
        out.creates.push({ owner: userId, cells: ra.attackerCells, defense: ra.attackerDefense });
        ra.attackerCells.forEach(c => claimed.add(c));
        out.events.push({ type: 'conquered', id: t.id, cells: ra.attackerCells.length });
        out.playerPoints += Math.round(atkPts);
      } else if (ra.conquered && ra.cutOff) {
        out.updates.push({ id: t.id, defense: ra.defenderDefense, setCells: ra.defenderCells });
        out.creates.push({ owner: userId, cells: ra.attackerCells, defense: ra.attackerDefense });
        ra.attackerCells.forEach(c => claimed.add(c));
        out.events.push({ type: 'cut', id: t.id, got: ra.attackerCells.length });
        out.playerPoints += Math.round(atkPts);
      } else {
        out.updates.push({ id: t.id, defense: ra.defenderDefense });
        out.events.push({ type: 'attacked', id: t.id, damage: Math.round(ra.damage) });
        out.playerPoints += Math.round(ra.damage);
      }
    }

    // Neutral-Claim: alle Zellen, die dieser Lauf beansprucht und die noch
    // niemandem gehören, werden ein neues Gebiet. Das ist der DURCHLAUFENE PFAD
    // (auch der Teil außerhalb eigener Gebiete!) PLUS — bei einer Schleife — das
    // eingeschlossene Innere. So geht die außerhalb gelaufene Strecke nicht
    // verloren.
    const owned = new Set();
    for (const t of terrs) { const cs = t.cells instanceof Set ? t.cells : new Set(t.cells); for (const c of cs) owned.add(c); }
    const source = new Set([...R, ...encl]);
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
    pathToCells, enclosedCells, clusters, classify,
    resolveAttack, resolveDefenseBuild, resolveRun,
    // Re-Exports als Convenience
    paceFactor, distanceBonus, runValue, clampDefense,
    RES, DEF_MIN, DEF_MAX, CAPTURE_BONUS, DAILY_BUILD_CAP,
  };
}
