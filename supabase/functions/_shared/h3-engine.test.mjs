import * as h3 from 'h3-js';
import { createEngine, paceFactor, distanceBonus, runValue } from './h3-engine.mjs';

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
  const r = eng.resolveDefenseBuild({ ownCells: territory, ownDefense: 50, enclosed: enclosedSuper, buildPoints: 80, dailyAlready: 0 });
  ok('Build: +80 auf 50 -> 130 (unter Cap)', r.circumnavigated && r.built === 80 && r.defense === 130);
}
{
  const r = eng.resolveDefenseBuild({ ownCells: territory, ownDefense: 50, enclosed: enclosedSuper, buildPoints: 80, dailyAlready: 60 });
  ok('Build: Tageslimit greift (nur +40 statt +80)', r.built === 40 && r.defense === 90 && r.dailyAfter === 100);
}
{
  const r = eng.resolveDefenseBuild({ ownCells: territory, ownDefense: 290, enclosed: enclosedSuper, buildPoints: 80, dailyAlready: 0 });
  ok('Build: Max 300 greift (nur +10)', r.built === 10 && r.defense === 300);
}
{
  const r = eng.resolveDefenseBuild({ ownCells: territory, ownDefense: 50, enclosed: new Set(), buildPoints: 80, dailyAlready: 0 });
  ok('Build ohne Umrundung -> 0', !r.circumnavigated && r.built === 0 && r.defense === 50);
}

console.log(`\n==== ${pass} passed, ${fail} failed ====`);
process.exit(fail ? 1 : 0);
