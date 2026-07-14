import * as h3 from 'h3-js';
import { createEngine, paceFactor, distanceBonus, runValue, validateRun, decayedDefense, timeToMinMs, DECAY_PER_DAY, pickBotTargets, botAttack, BOT_NEW_DEFENSE } from './h3-engine.mjs';

const eng = createEngine(h3);
let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { (cond ? pass++ : fail++); console.log((cond ? '✅' : '❌') + ' ' + name + (extra ? '  ' + extra : '')); };
const near = (a, b, e = 1e-6) => Math.abs(a - b) < e;

// ---------- GDS Tabelle 1: Pace-Faktor ----------
ok('pace <8 -> 0/0', paceFactor(7.9, 'def') === 0 && paceFactor(7.9, 'atk') === 0);
ok('pace 8 -> def10/atk8', paceFactor(8, 'def') === 10 && paceFactor(8, 'atk') === 8);
ok('pace 11 -> def13/atk10', paceFactor(11, 'def') === 13 && paceFactor(11, 'atk') === 10);
ok('pace 13 -> def16/atk12', paceFactor(13, 'def') === 16 && paceFactor(13, 'atk') === 12);
ok('pace 15 -> def20/atk15', paceFactor(15, 'def') === 20 && paceFactor(15, 'atk') === 15);
ok('pace 16+ -> def20/atk18', paceFactor(16, 'def') === 20 && paceFactor(20, 'atk') === 18);

// ---------- GDS Tabelle 2: Distanzbonus ----------
ok('bonus <8 ->0', distanceBonus(7.9) === 0);
ok('bonus 8 ->20', distanceBonus(8) === 20);
ok('bonus 12 ->35', distanceBonus(12) === 35);
ok('bonus 15 ->50', distanceBonus(15) === 50);

// ---------- runValue ----------
// 10 km @ 13 km/h atk: 10*12 + Bonus(10km=20) = 140
ok('runValue 10km@13 atk =140', near(runValue(10, 13, 'atk'), 140), '=' + runValue(10, 13, 'atk'));
// 5 km @ 9 km/h def: 5*10 + 0 = 50
ok('runValue 5km@9 def =50', near(runValue(5, 9, 'def'), 50));

// ---------- Geometrie-Setup (echtes H3, Res 10) ----------
const center = h3.latLngToCell(48.137, 11.575, 10);
const territory = h3.gridDisk(center, 3);          // 37 Zellen
const enclosedSuper = new Set(h3.gridDisk(center, 4)); // Obermenge -> Umrundung

// EDGE: eine Zelle im Ring-Abstand 4 (grenzt an Gebiet, überlappt nicht)
const ring4 = h3.gridRingUnsafe(center, 4);
const edgeRun = new Set([ring4[0]]);
ok('classify EDGE', eng.classify(new Set(territory), edgeRun, new Set()).mode === 'edge');

// THROUGH: kurzer Stummel (center + 1 Nachbar) -> Rest bleibt 1 Cluster
const throughRun = new Set([center, h3.gridDisk(center, 1)[1]]);
{
  const c = eng.classify(new Set(territory), throughRun, new Set());
  ok('classify THROUGH (1 Cluster)', c.mode === 'through', 'mode=' + c.mode);
}

// CUT: volle Diagonale quer durchs Gebiet -> >=2 Cluster
const west = h3.gridRingUnsafe(center, 3)[0];
const east = h3.gridRingUnsafe(center, 3)[Math.floor(h3.gridRingUnsafe(center, 3).length / 2)];
const cutRun = new Set(h3.gridPathCells(west, east));
{
  const c = eng.classify(new Set(territory), cutRun, new Set());
  ok('classify CUT (>=2 Cluster)', c.mode === 'cut', 'mode=' + c.mode + (c.clusters ? ' clusters=' + c.clusters.length : ''));
}

// CIRCUMNAVIGATION
ok('classify CIRCUMNAVIGATION', eng.classify(new Set(territory), new Set([center]), enclosedSuper).mode === 'circumnavigation');

// COVERED: Pfad deckt gesamtes Gebiet
ok('classify COVERED', eng.classify(new Set(territory), new Set(territory), new Set()).mode === 'covered');

// ---------- resolveAttack: Umrundung LANGSAM vs SCHNELL vs schwaches Gebiet ----------
// atk = runValue; fresh territory defense 100.
const atkSlow = runValue(2, 10, 'atk');   // 2km@10 = 20 -> zu wenig für def 100
const atkFast = runValue(6, 16, 'atk');   // 6km@16 = 6*18 + Bonus(6km=0) = 108 -> >100
{
  const r = eng.resolveAttack({ enemyCells: territory, enemyDefense: 100, runCells: new Set([center]), enclosed: enclosedSuper, attackPoints: atkSlow });
  ok('Umrundung LANGSAM (atk20) -> KEIN Sieg', r.mode === 'circumnavigation' && !r.conquered && r.defenderDefense === 80, 'def=' + r.defenderDefense);
}
{
  const r = eng.resolveAttack({ enemyCells: territory, enemyDefense: 100, runCells: new Set([center]), enclosed: enclosedSuper, attackPoints: atkFast });
  ok('Umrundung SCHNELL (atk108) -> Sieg', r.mode === 'circumnavigation' && r.conquered && r.attackerDefense === (108 - 100) + 20, 'atkDef=' + r.attackerDefense);
}
{
  const r = eng.resolveAttack({ enemyCells: territory, enemyDefense: 15, runCells: new Set([center]), enclosed: enclosedSuper, attackPoints: atkSlow });
  ok('Umrundung langsam, Gebiet SCHWACH(15) -> Sieg', r.conquered && r.attackerDefense === Math.max(1, 20 - 15) + 20, 'atkDef=' + r.attackerDefense);
}

// ---------- resolveAttack: gerader Durchlauf = 20% ----------
{
  const r = eng.resolveAttack({ enemyCells: territory, enemyDefense: 100, runCells: throughRun, enclosed: new Set(), attackPoints: 100 });
  ok('Durchlauf 20% (atk100 -> dmg20)', r.mode === 'through' && near(r.damage, 20) && r.defenderDefense === 80, 'dmg=' + r.damage);
}
// ---------- resolveAttack: Randberührung = 10% ----------
{
  const r = eng.resolveAttack({ enemyCells: territory, enemyDefense: 100, runCells: edgeRun, enclosed: new Set(), attackPoints: 100 });
  ok('Rand 10% (atk100 -> dmg10)', r.mode === 'edge' && near(r.damage, 10) && r.defenderDefense === 90, 'dmg=' + r.damage);
}

// ---------- resolveAttack: CUT Erfolg + Fehlschlag (GDS 1.6) ----------
{
  const cInfo = eng.classify(new Set(territory), cutRun, new Set());
  const small = cInfo.clusters[cInfo.clusters.length - 1].length;
  const total = territory.length;
  const areaFrac = small / total;
  const areaDef = 100 * areaFrac;
  // Erfolg: attack knapp über areaDef
  const rSucc = eng.resolveAttack({ enemyCells: territory, enemyDefense: 100, runCells: cutRun, enclosed: new Set(), attackPoints: areaDef + 10 });
  ok('CUT Erfolg -> Angreifer bekommt kleinen Cluster', rSucc.mode === 'cut' && rSucc.conquered && rSucc.attackerCells.length === small && near(rSucc.attackerDefense, 10 + 20), 'small=' + small + ' atkDef=' + rSucc.attackerDefense);
  ok('CUT Erfolg -> Verteidiger verliert Flächenanteil', near(rSucc.defenderDefense, Math.max(1, 100 * (1 - areaFrac)), 1e-6), 'defDef=' + rSucc.defenderDefense);
  // Fehlschlag: attack unter areaDef
  const rFail = eng.resolveAttack({ enemyCells: territory, enemyDefense: 100, runCells: cutRun, enclosed: new Set(), attackPoints: areaDef - 5 });
  ok('CUT Fehlschlag -> keine Abtrennung, voller Angriff ab', rFail.mode === 'cut' && !rFail.conquered && rFail.attackerCells === null && near(rFail.defenderDefense, 100 - (areaDef - 5)), 'defDef=' + rFail.defenderDefense);
}

// ---------- resolveDefenseBuild: Tageslimit + Max ----------
{
  const r = eng.resolveDefenseBuild({ ownDefense: 50, coverFrac: 1, buildPoints: 80, dailyAlready: 0 });
  ok('Build: volle Deckung +80 auf 50 -> 130', r.built === 80 && r.defense === 130);
}
{
  const r = eng.resolveDefenseBuild({ ownDefense: 50, coverFrac: 0.25, buildPoints: 80, dailyAlready: 0 });
  ok('Build: 25% Deckung -> nur +20 (anteilig)', r.built === 20 && r.defense === 70, 'built=' + r.built);
}
{
  const r = eng.resolveDefenseBuild({ ownDefense: 50, coverFrac: 1, buildPoints: 80, dailyAlready: 60 });
  ok('Build: Tageslimit greift (nur +40)', r.built === 40 && r.defense === 90 && r.dailyAfter === 100);
}
{
  const r = eng.resolveDefenseBuild({ ownDefense: 290, coverFrac: 1, buildPoints: 80, dailyAlready: 0 });
  ok('Build: Max 300 greift (nur +10)', r.built === 10 && r.defense === 300);
}
{
  const r = eng.resolveDefenseBuild({ ownDefense: 50, coverFrac: 0, buildPoints: 80, dailyAlready: 0 });
  ok('Build: keine Deckung -> 0', r.built === 0 && r.defense === 50);
}

// ================= resolveRun (Orchestrierung) =================
const uid = 'me';
const enemyT = { id: 'T1', owner: 'foe', ownerName: 'Gegner', defense: 100, cells: new Set(territory) };

// 1) Neutral-Claim: Loop um leeres Land, keine Gebiete
{
  const r = eng.resolveRun({ userId: uid, runCells: new Set([center]), enclosed: enclosedSuper, distanceKm: 3, paceKmh: 12, territories: [] });
  const neut = r.creates.find(c => c.neutral);
  ok('resolveRun NEUTRAL-Claim erzeugt Gebiet', !!neut && neut.cells.length === enclosedSuper.size && r.deletes.length === 0, 'cells=' + (neut && neut.cells.length));
}
// 2) Enemy schwächen (Durchlauf 20%)
{
  const r = eng.resolveRun({ userId: uid, runCells: throughRun, enclosed: new Set(), distanceKm: 5, paceKmh: 12, territories: [{ ...enemyT, cells: new Set(territory) }] });
  const up = r.updates.find(u => u.id === 'T1');
  ok('resolveRun WEAKEN: update ohne create/delete', !!up && up.defense < 100 && !up.setCells && r.creates.length === 0 && r.deletes.length === 0, 'def=' + (up && up.defense));
}
// 3) Ganzes Gebiet erobern (schnelle Umrundung eines schwachen Gebiets)
{
  const r = eng.resolveRun({ userId: uid, runCells: new Set([center]), enclosed: enclosedSuper, distanceKm: 6, paceKmh: 16, territories: [{ ...enemyT, defense: 30, cells: new Set(territory) }] });
  ok('resolveRun CONQUER: delete + create', r.deletes.includes('T1') && r.creates.some(c => !c.neutral && c.owner === uid && c.cells.length === territory.length), 'deletes=' + r.deletes.length + ' creates=' + r.creates.length);
}
// 4) Cut: Linie quer, genug Angriff
{
  const cInfo = eng.classify(new Set(territory), cutRun, new Set());
  const small = cInfo.clusters[cInfo.clusters.length - 1].length;
  const areaDef = 100 * (small / territory.length);
  // paceKmh so wählen, dass atkPts > areaDef: 8km@16 = 8*18+20=164
  const r = eng.resolveRun({ userId: uid, runCells: cutRun, enclosed: new Set(), distanceKm: 8, paceKmh: 16, territories: [{ ...enemyT, cells: new Set(territory) }] });
  const up = r.updates.find(u => u.id === 'T1');
  const cre = r.creates.find(c => !c.neutral);
  ok('resolveRun CUT: update(setCells) + create(kleiner Cluster)', !!up && !!up.setCells && !!cre && cre.cells.length === small, 'atk=' + r.atkPts + ' small=' + small + ' got=' + (cre && cre.cells.length));
}
// 5) Verteidigungsaufbau eigenes Gebiet — nur ABGELAUFENE Zellen zählen
{
  // Alle 37 eigenen Zellen tatsächlich abgelaufen -> volle Deckung. enclosed
  // (Schleifen-Inneres) zählt NICHT mehr für den Verteidigungsaufbau.
  const r = eng.resolveRun({ userId: uid, runCells: new Set(territory), enclosed: enclosedSuper, distanceKm: 5, paceKmh: 12, territories: [{ id: 'OWN', owner: uid, defense: 50, dailyAdded: 0, lastDay: null, today: '2026-07-06', cells: new Set(territory) }] });
  const up = r.updates.find(u => u.id === 'OWN');
  ok('resolveRun DEFEND (alle Zellen abgelaufen): +80 -> 130', !!up && up.defense === 130 && up.lastDay === '2026-07-06', 'def=' + (up && up.defense));
}
{
  // Nur umrundet (Pfad außerhalb, nur enclosed deckt das Gebiet) -> KEIN Aufbau.
  const ring = new Set(h3.gridRingUnsafe(center, 5));
  const r = eng.resolveRun({ userId: uid, runCells: ring, enclosed: enclosedSuper, distanceKm: 5, paceKmh: 12, territories: [{ id: 'OWN', owner: uid, defense: 50, dailyAdded: 0, lastDay: null, today: '2026-07-06', cells: new Set(territory) }] });
  const up = r.updates.find(u => u.id === 'OWN');
  ok('resolveRun DEFEND (nur umrundet): kein Aufbau', !up || up.defense === 50, 'def=' + (up ? up.defense : 'kein update'));
}
// Teil-Deckung: nur 2 von 37 eigenen Zellen durchlaufen -> ~5% Zuwachs
{
  const r = eng.resolveRun({ userId: uid, runCells: throughRun, enclosed: new Set(), distanceKm: 5, paceKmh: 12, territories: [{ id: 'OWN', owner: uid, defense: 50, dailyAdded: 0, lastDay: null, today: '2026-07-06', cells: new Set(territory) }] });
  const up = r.updates.find(u => u.id === 'OWN');
  const expected = 50 + 80 * (2 / territory.length); // buildPts(5km@12)=80
  ok('resolveRun DEFEND (Teil-Deckung): anteilig statt voll', !!up && Math.abs(up.defense - expected) < 1e-6 && up.defense < 60, 'def=' + (up && up.defense.toFixed(2)));
}

// ================= validateRun (Anti-Cheat, GDS 3.1) =================
ok('validate: zu kurz', validateRun({ distanceM: 100, durationS: 60 }).reason === 'too_short');
ok('validate: OK normaler Lauf', validateRun({ distanceM: 2000, durationS: 600 }).ok === true); // 12 km/h
ok('validate: 25-km/h-Hardcap', validateRun({ distanceM: 5000, durationS: 600 }).reason === 'speed_hardcap'); // 30 km/h
ok('validate: Cadence 0 bei Tempo -> ungültig', validateRun({ distanceM: 2000, durationS: 600, cadence: 0 }).reason === 'cadence_zero');
ok('validate: Cadence null -> nicht geprüft (OK)', validateRun({ distanceM: 2000, durationS: 600, cadence: null }).ok === true);
ok('validate: Cadence 160 -> OK', validateRun({ distanceM: 2000, durationS: 600, cadence: 160 }).ok === true);

// Lauf durch eigenes Gebiet UND nach außen: Verteidigung steigt + Außen-Pfad
// wird als neues Gebiet beansprucht (nichts geht verloren).
{
  const far = h3.gridRingUnsafe(center, 6)[0];
  const runLine = new Set(h3.gridPathCells(center, far));
  const r = eng.resolveRun({ userId: uid, runCells: runLine, enclosed: new Set(), distanceKm: 3, paceKmh: 12, territories: [{ id: 'OWN', owner: uid, defense: 50, dailyAdded: 0, lastDay: null, today: '2026-07-06', cells: new Set(territory) }] });
  const up = r.updates.find(u => u.id === 'OWN');
  const neutral = r.creates.find(c => c.neutral);
  const tset = new Set(territory);
  const outsideCount = [...runLine].filter(c => !tset.has(c)).length;
  ok('resolveRun: Außen-Strecke beansprucht + eigene Verteidigung steigt', !!up && up.defense > 50 && !!neutral && neutral.cells.length === outsideCount, 'defUp=' + (up && up.defense.toFixed(1)) + ' neutral=' + (neutral && neutral.cells.length) + ' outside=' + outsideCount);
}

// ================= Verfall + Energie-Boost =================
const DAY = 86400000;
ok('decay: 100 nach 2 Tagen -> 84 (Rate 8)', near(decayedDefense(100, 0, 2 * DAY), 100 - 2 * DECAY_PER_DAY));
ok('decay: floored bei 1', decayedDefense(20, 0, 10 * DAY) === 1);
ok('decay: frisch = unverändert', near(decayedDefense(50, 5 * DAY, 5 * DAY), 50));
ok('timeToMin: def 41 -> 5 Tage', near(timeToMinMs(41, 0, 0) / DAY, (41 - 1) / DECAY_PER_DAY));
{
  const base = eng.resolveRun({ userId: uid, runCells: throughRun, enclosed: new Set(), distanceKm: 5, paceKmh: 12, territories: [{ ...enemyT, cells: new Set(territory) }] });
  const boost = eng.resolveRun({ userId: uid, runCells: throughRun, enclosed: new Set(), distanceKm: 5, paceKmh: 12, boosted: true, territories: [{ ...enemyT, cells: new Set(territory) }] });
  ok('Energie-Boost: +10% Angriff', near(boost.atkPts, base.atkPts * 1.1), 'base=' + base.atkPts + ' boost=' + boost.atkPts.toFixed(1));
}

// ================= Bots: Übernahme verfallener Gebiete =================
{
  const now = 100 * DAY;
  const terrs = [
    { id: 'A', owner: 'p1', defense: 300, updatedAtMs: now }, // frisch, stark -> nein
    { id: 'B', owner: 'p2', defense: 40, updatedAtMs: now - 6 * DAY }, // 40-48<1 -> ~1 -> ja
    { id: 'C', owner: 'p3', defense: 100, updatedAtMs: now - 20 * DAY }, // -> 1 -> ja
    { id: 'D', owner: 'bot1', defense: 2, updatedAtMs: now }, // gehört Bot -> nein
    { id: 'E', owner: 'p4', defense: 60, updatedAtMs: now - 1 * DAY }, // 52 -> nein
  ];
  const picks = pickBotTargets({ territories: terrs, nowMs: now, botOwnerIds: ['bot1'], limit: 2 });
  ok('pickBotTargets: nur verfallene Nicht-Bot-Gebiete', picks.length === 2 && picks.includes('B') && picks.includes('C') && !picks.includes('A') && !picks.includes('D') && !picks.includes('E'), 'picks=' + picks.join(','));
}
{
  const now = 0;
  const terrs = [{ id: 'X', owner: 'p', defense: 300, updatedAtMs: 0 }];
  ok('pickBotTargets: nichts Verfallenes -> leer', pickBotTargets({ territories: terrs, nowMs: now }).length === 0);
}

// Bot-Angriff (durchschnittliche Stärke)
ok('botAttack: stark genug -> übernommen', (()=>{const r=botAttack(40,50);return r.taken&&r.newDefense===BOT_NEW_DEFENSE;})());
ok('botAttack: zu schwach -> nur geschwächt', (()=>{const r=botAttack(100,50);return !r.taken&&r.newDefense===50;})());
ok('botAttack: Schwächung floored bei 1', (()=>{const r=botAttack(3,50);return r.taken;})()); // 50>=3 -> taken

// ================= Vernachlässigtes Gebiet: Drüberlaufen erobert =================
// Ein Gebiet mit ~1 Verteidigung fällt beim Durchlaufen — unabhängig vom Tempo
// und ohne den 0.2-Durchlauf-Dämpfer.
{
  // Durchlauf (through) über ein Gebiet mit Verteidigung 1, winzige Angriffspunkte.
  const r = eng.resolveAttack({ enemyCells: territory, enemyDefense: 1, runCells: throughRun, enclosed: new Set(), attackPoints: 2 });
  ok('SCHWACH(1) Durchlauf -> ganzes Gebiet erobert', r.conquered && r.defenderCells.length === 0 && r.attackerCells.length === territory.length, 'mode=' + r.mode + ' atkDef=' + r.attackerDefense);
}
{
  // Sogar bei atkPts=0 (z. B. sehr langsamer Lauf) fällt das aufgegebene Gebiet.
  const r = eng.resolveAttack({ enemyCells: territory, enemyDefense: 1, runCells: throughRun, enclosed: new Set(), attackPoints: 0 });
  ok('SCHWACH(1) Durchlauf, atk=0 -> trotzdem erobert', r.conquered && r.attackerDefense === 1 + 20, 'atkDef=' + r.attackerDefense);
}
{
  // Genau an der Schwelle (8) -> noch erobert.
  const r = eng.resolveAttack({ enemyCells: territory, enemyDefense: 8, runCells: throughRun, enclosed: new Set(), attackPoints: 1 });
  ok('SCHWACH(8=Schwelle) Durchlauf -> erobert', r.conquered && r.defenderCells.length === 0, 'mode=' + r.mode);
}
{
  // Knapp über der Schwelle (9) mit kleinem Angriff -> NICHT via Neglect erobert,
  // fällt zurück auf normalen 0.2-Durchlauf (dmg 0.2*1=0.2 < 9 -> nur geschwächt).
  const r = eng.resolveAttack({ enemyCells: territory, enemyDefense: 9, runCells: throughRun, enclosed: new Set(), attackPoints: 1 });
  ok('SCHWACH(9) knapp drüber, kleiner Angriff -> nur geschwächt', !r.conquered && r.mode === 'through', 'def=' + r.defenderDefense);
}
{
  // Reine Randberührung (edge) eines schwachen Gebiets -> KEIN Gratis-Claim.
  const r = eng.resolveAttack({ enemyCells: territory, enemyDefense: 1, runCells: edgeRun, enclosed: new Set(), attackPoints: 2 });
  ok('SCHWACH(1) nur Rand (edge) -> nicht via Neglect erobert', r.mode === 'edge', 'conquered=' + r.conquered);
}
{
  // resolveRun-Ende-zu-Ende: Durchlauf über schwaches Gegnergebiet -> delete+create+Event.
  const r = eng.resolveRun({ userId: uid, runCells: throughRun, enclosed: new Set(), distanceKm: 0.3, paceKmh: 7, territories: [{ id: 'WEAK', owner: 'foe', defense: 1, cells: new Set(territory) }] });
  const conqEv = r.events.find(e => e.type === 'conquered');
  ok('resolveRun: langsamer Durchlauf über SCHWACH(1) -> erobert', r.deletes.includes('WEAK') && r.creates.some(c => !c.neutral && c.owner === uid) && !!conqEv, 'deletes=' + r.deletes.length + ' events=' + JSON.stringify(r.events.map(e=>e.type)));
}
{
  // Gegenprobe: gepflegtes Gebiet (Verteidigung 40) beim Durchlaufen NICHT gekapert.
  const r = eng.resolveRun({ userId: uid, runCells: throughRun, enclosed: new Set(), distanceKm: 1, paceKmh: 12, territories: [{ id: 'STRONG', owner: 'foe', defense: 40, cells: new Set(territory) }] });
  ok('resolveRun: Durchlauf über GEPFLEGT(40) -> nur geschwächt, kein Claim', r.deletes.length === 0 && !r.creates.some(c => !c.neutral), 'deletes=' + r.deletes.length);
}

// ===== Engine-Objekt: alle von conquer/bot_tick als engine.X(...) genutzten Member =====
// Fängt Fehler wie "engine.decayedDefense is not a function" ab, die zur Laufzeit
// in der Edge Function auftreten, weil das Objekt einen Export nicht enthält.
{
  const need = ['pathToCells','enclosedCells','resolveRun','decayedDefense','timeToMinMs'];
  need.forEach(k => ok('engine.'+k+' ist function', typeof eng[k] === 'function', 'typeof=' + typeof eng[k]));
  const needNum = ['ENERGY_PER_WEEK','ENERGY_BOOST'];
  needNum.forEach(k => ok('engine.'+k+' ist number', typeof eng[k] === 'number', 'typeof=' + typeof eng[k]));
  // Funktioniert der Aufruf, wie conquer ihn macht?
  ok('engine.decayedDefense rechnet', near(eng.decayedDefense(100, 0, 2 * DAY), 100 - 2 * DECAY_PER_DAY), '=' + eng.decayedDefense(100, 0, 2 * DAY));
}

// ===== Gebiets-Schutz: geschütztes Gegnergebiet ist unangreifbar =====
{
  // Ohne Schutz: schwaches Gebiet wird beim Umrunden erobert.
  const noShield = eng.resolveRun({ userId: uid, runCells: new Set([center]), enclosed: enclosedSuper, distanceKm: 6, paceKmh: 16, territories: [{ ...enemyT, defense: 30, cells: new Set(territory) }] });
  ok('Schutz-Gegenprobe: ungeschützt -> erobert', noShield.deletes.includes('T1'));
  // Mit Schutz: derselbe Angriff prallt ab (kein delete/create, nur 'shielded'-Event).
  const shielded = eng.resolveRun({ userId: uid, runCells: new Set([center]), enclosed: enclosedSuper, distanceKm: 6, paceKmh: 16, territories: [{ ...enemyT, defense: 30, shielded: true, cells: new Set(territory) }] });
  const ev = shielded.events.find(e => e.type === 'shielded');
  ok('Gebiets-Schutz: geschütztes Gebiet NICHT erobert', shielded.deletes.length === 0 && !shielded.creates.some(c => !c.neutral) && !!ev, 'deletes=' + shielded.deletes.length);
}

// ===== #44 — Tempo je Hexagon: pathToCellPace + gebietsabhängige Angriffskraft =====
{
  // pathToCells bleibt abwärtskompatibel ein Set.
  const legacy = eng.pathToCells([[48.137, 11.575], [48.1388, 11.575]]);
  ok('#44 pathToCells -> Set (kompatibel)', legacy instanceof Set && legacy.size > 0, 'size=' + legacy.size);

  // pathToCellPace: gleicher Weg, aber schneller gelaufen -> höheres Zell-Tempo.
  const A = [48.137, 11.575], B = [48.1388, 11.575]; // ~200 m auseinander
  const fast = eng.pathToCellPace([[A[0], A[1], 0], [B[0], B[1], 40000]]);  // 200m/40s ≈ 18 km/h
  const slow = eng.pathToCellPace([[A[0], A[1], 0], [B[0], B[1], 120000]]); // 200m/120s ≈ 6 km/h
  const maxFast = Math.max(...fast.cellPace.values());
  const maxSlow = Math.max(...slow.cellPace.values());
  ok('#44 Zell-Tempo aus Zeitstempeln', fast.cellPace.size > 0 && maxFast > maxSlow + 5, `fast=${maxFast.toFixed(1)} slow=${maxSlow.toFixed(1)}`);
  ok('#44 Zell-Tempo <= Hardcap', maxFast <= 25 && maxSlow > 0, `maxFast=${maxFast.toFixed(1)}`);

  // Ohne Zeitstempel (Alt-Track/Import): kein Zell-Tempo -> Engine nutzt Global-Tempo.
  const noTime = eng.pathToCellPace([[A[0], A[1]], [B[0], B[1]]]);
  ok('#44 ohne Zeitstempel -> cellPace leer', noTime.cellPace.size === 0);

  // resolveRun mit Zell-Tempo: ZWEI gleich starke Gegner-Gebiete, EIN Lauf. Durch
  // das eine wird gesprintet (16 km/h), durchs andere getrabt (8 km/h). Nur das
  // schnell durchlaufene fällt -> verschiedene Verteidigungswerte je Gebiet.
  const cFast = h3.latLngToCell(48.137, 11.575, 10);
  const cSlow = h3.latLngToCell(48.200, 11.660, 10); // weit weg -> disjunkt
  const tFast = h3.gridDisk(cFast, 2), tSlow = h3.gridDisk(cSlow, 2);
  const run = new Set([...tFast, ...tSlow]); // deckt beide Gebiete vollständig ab (covered)
  const cp = new Map();
  tFast.forEach(c => cp.set(c, 16)); // Sprint
  tSlow.forEach(c => cp.set(c, 8));  // Trab
  // defense 100; 6 km @16 atk = 6*18=108 >=100 (erobert); @8 atk = 6*8=48 <100 (hält).
  const terrsPace = [
    { id: 'FAST', owner: 'foe', defense: 100, cells: new Set(tFast) },
    { id: 'SLOW', owner: 'foe', defense: 100, cells: new Set(tSlow) },
  ];
  const withPace = eng.resolveRun({ userId: uid, runCells: run, enclosed: new Set(), distanceKm: 6, paceKmh: 8, territories: terrsPace, cellPace: cp });
  ok('#44 Sprint-Gebiet erobert', withPace.deletes.includes('FAST'), 'deletes=' + JSON.stringify(withPace.deletes));
  ok('#44 Trab-Gebiet hält', !withPace.deletes.includes('SLOW'));

  // Gegenprobe ohne Zell-Tempo (Global 8 km/h): KEINES fällt -> beweist, dass das
  // Zell-Tempo den Unterschied macht.
  const noPace = eng.resolveRun({ userId: uid, runCells: run, enclosed: new Set(), distanceKm: 6, paceKmh: 8, territories: [
    { id: 'FAST', owner: 'foe', defense: 100, cells: new Set(tFast) },
    { id: 'SLOW', owner: 'foe', defense: 100, cells: new Set(tSlow) },
  ] });
  ok('#44 ohne Zell-Tempo faellt keines', noPace.deletes.length === 0, 'deletes=' + JSON.stringify(noPace.deletes));
}

// engine.pathToCellPace muss im Objekt liegen (conquer ruft engine.pathToCellPace).
ok('engine.pathToCellPace ist function', typeof eng.pathToCellPace === 'function', 'typeof=' + typeof eng.pathToCellPace);

console.log(`\n==== ${pass} passed, ${fail} failed ====`);
process.exit(fail ? 1 : 0);
