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
  return distanceKm * paceFactor(paceKmh, kind) + distanceBonus(km_(distanceKm));
}
const km_ = v => v; // Klarheits-Alias

export function clampDefense(v) {
  return Math.max(DEF_MIN, Math.min(DEF_MAX, v));
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
      const big = info.clusters.slice(0, -1).flat();
      const areaFrac = small.length / total;
      const areaDefense = enemyDefense * areaFrac;
      if (attackPoints >= areaDefense) {
        // Erfolg: kleiner Cluster wird neues Gebiet des Angreifers.
        const overflow = attackPoints - areaDefense;
        return {
          ...base, cutOff: small,
          defenderCells: big,
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

  /* Verteidigungsaufbau durch Umrunden des EIGENEN Gebiets (GDS 1.3).
     Nur gültig, wenn der Lauf das eigene Gebiet vollständig einschließt. Baut
     runValue('def') auf, gedeckelt durch Tageslimit (+100/Tag) und Max 300. */
  function resolveDefenseBuild({ ownCells, ownDefense, enclosed, buildPoints, dailyAlready }) {
    const O = new Set(ownCells);
    const encl = enclosed instanceof Set ? enclosed : new Set(enclosed || []);
    if (!O.size || !isSuperset(encl, O)) {
      return { built: 0, defense: ownDefense, dailyAfter: dailyAlready, circumnavigated: false };
    }
    const dayRoom = Math.max(0, DAILY_BUILD_CAP - (dailyAlready || 0));
    const maxRoom = Math.max(0, DEF_MAX - ownDefense);
    const built = Math.max(0, Math.min(buildPoints, dayRoom, maxRoom));
    return {
      built,
      defense: clampDefense(ownDefense + built),
      dailyAfter: (dailyAlready || 0) + built,
      circumnavigated: true,
    };
  }

  return {
    pathToCells, enclosedCells, clusters, classify,
    resolveAttack, resolveDefenseBuild,
    // Re-Exports als Convenience
    paceFactor, distanceBonus, runValue, clampDefense,
    RES, DEF_MIN, DEF_MAX, CAPTURE_BONUS, DAILY_BUILD_CAP,
  };
}
