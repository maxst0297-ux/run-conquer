/**
 * game-logic.js — RunConquer Core Game Logic
 *
 * Isolated, pure game-logic layer.
 * Zero UI dependencies — no DOM, no toast(), no beep(), no map calls.
 * Usable in browser (window.GameLogic) and Node.js (module.exports).
 *
 * Public API:
 *   GameLogic.calculateGridCell(lat, lng)
 *   GameLogic.calculateInfluence(distanceMeters, speedMps)
 *   GameLogic.updateTerritoryOwnership(cell, userId, influence, opts)
 *   GameLogic.applyDecayToTerritories(opts)
 *
 * State management:
 *   GameLogic.init(territories)   — seed with existing territory array
 *   GameLogic.getState()          — return shallow copy of territory state
 */

'use strict';

// ─── Constants ───────────────────────────────────────────────────────────────

/**
 * @typedef {Object} GLConfig
 * All numeric tuning constants. Override via GameLogic.CFG if needed.
 */
const GL_CFG = Object.freeze({
  // Grid
  GRID_CELL_METERS:    100,    // one cell ≈ 1 city block

  // Territory defense (0–100 scale)
  MAX_DEF:             100,
  INIT_DEF_BASE:        30,   // minimum starting defense
  INIT_DEF_PER_200M:     1,   // +1 defense per 200 m of run distance
  LM_DEF_BONUS:          1.3, // ×1.3 if the cell contains landmarks

  // Combat
  DMG_PER_KM:           15,   // base attack damage per km run through enemy cell
  REP_PER_KM:           10,   // base repair per km run through own cell
  CRIT_CHANCE:           0.15,
  CRIT_MUL:              2.0,
  ATK_BONUS_PER_LVL:     0.05, // +5 % attack multiplier per level above 1
  REP_BONUS_PER_LVL:     0.03, // +3 % repair multiplier per level above 1

  // Speed modulation
  SPEED_WALK_MS:         1.5,  // m/s — below this = minimal influence
  SPEED_SPRINT_MS:       5.0,  // m/s — above this = maximum influence
  SPEED_MUL_MIN:         0.8,  // multiplier at walking pace
  SPEED_MUL_MAX:         1.5,  // multiplier at sprint pace

  // Combo (consecutive conquests in one run session)
  COMBO_MULTI_3:         1.5,
  COMBO_MULTI_5:         2.0,

  // XP rewards
  XP_NEUTRAL:            50,   // claiming a neutral cell
  XP_SCALE_PER_KM:      100,   // bonus XP per km (scales capture reward)
  XP_CONQUER_MIN:       100,
  XP_CONQUER_MAX:       300,
  XP_DEFEND:             75,

  // Decay (enemy territories only)
  DECAY_PER_DAY:          5,   // defense points lost per full day
  MAX_AGE_HOURS:        120,   // territory pruned after 5 days at 0 defense
});

// ─── Types (JSDoc) ───────────────────────────────────────────────────────────

/**
 * @typedef {Object} GridCell
 * @property {number} row         - Discrete row index
 * @property {number} col         - Discrete column index
 * @property {string} key         - Canonical identifier: "row:col"
 * @property {number} centerLat
 * @property {number} centerLng
 * @property {{minLat:number,maxLat:number,minLng:number,maxLng:number}} bounds
 */

/**
 * @typedef {Object} Influence
 * @property {number} damage      - Attack damage available
 * @property {number} repair      - Repair potential available
 * @property {number} speedMul    - Speed multiplier applied (0.8–1.5)
 * @property {number} km          - Distance in km
 * @property {{damage:number,repair:number}} raw - Pre-speed-multiplier values
 */

/**
 * @typedef {Object} Territory
 * @property {string}  id
 * @property {string}  cellKey         - Links to GridCell.key
 * @property {string}  owner           - userId
 * @property {number}  defense         - Current defense (0–100)
 * @property {number}  maxDefense
 * @property {number}  createdAt       - Timestamp
 * @property {number}  lastDefended    - Timestamp
 * @property {number}  _lastDecayTs    - Internal: last time decay ran
 * @property {string}  rarity          - 'common' | 'rare' | 'epic' | 'legendary'
 */

/**
 * @typedef {Object} ConquestResult
 * @property {'claimed'|'defended'|'attacked'|'conquered'} event
 * @property {Territory} territory  - Updated territory object
 * @property {number}    xpGained
 * @property {boolean}   isCrit
 * @property {number}    comboMul
 */

// ─── Internal State ──────────────────────────────────────────────────────────

/** @type {Territory[]} */
let _territories = [];

// ─── State Management ────────────────────────────────────────────────────────

/**
 * Seed the module with an existing territory list.
 * @param {Territory[]} territories
 */
function init(territories) {
  _territories = territories.map(t => ({ ...t }));
}

/**
 * Return a shallow copy of the current internal territory state.
 * @returns {Territory[]}
 */
function getState() {
  return _territories.map(t => ({ ...t }));
}

// ─── Core Functions ──────────────────────────────────────────────────────────

/**
 * Map GPS coordinates to a discrete grid cell.
 *
 * Builds a rectangular grid where every cell is approximately
 * `cellSizeMeters × cellSizeMeters`. Longitude degree-width is corrected
 * for the input latitude using a Mercator-style cosine factor.
 *
 * @param {number} lat
 * @param {number} lng
 * @param {number} [cellSizeMeters=GL_CFG.GRID_CELL_METERS]
 * @returns {GridCell}
 *
 * @example
 * const cell = GameLogic.calculateGridCell(48.8566, 2.3522); // Paris
 * // → { row: 5440076, col: 2130, key: "5440076:2130", ... }
 */
function calculateGridCell(lat, lng, cellSizeMeters = GL_CFG.GRID_CELL_METERS) {
  const METERS_PER_DEG_LAT = 111_320;
  const METERS_PER_DEG_LNG = Math.cos((lat * Math.PI) / 180) * METERS_PER_DEG_LAT;

  const degPerCellLat = cellSizeMeters / METERS_PER_DEG_LAT;
  const degPerCellLng = cellSizeMeters / METERS_PER_DEG_LNG;

  const row = Math.floor(lat / degPerCellLat);
  const col = Math.floor(lng / degPerCellLng);

  return {
    row,
    col,
    key:       `${row}:${col}`,
    centerLat: (row + 0.5) * degPerCellLat,
    centerLng: (col + 0.5) * degPerCellLng,
    bounds: {
      minLat: row       * degPerCellLat,
      maxLat: (row + 1) * degPerCellLat,
      minLng: col       * degPerCellLng,
      maxLng: (col + 1) * degPerCellLng,
    },
  };
}

/**
 * Compute the influence (attack / repair potential) generated by a run segment.
 *
 * - Damage scales with km × speed multiplier (faster runners attack harder)
 * - Repair is distance-only (speed does not affect defense restoration)
 *
 * @param {number} distanceMeters   Total run distance in metres
 * @param {number} speedMps         Average speed in m/s — pass 0 if unknown
 * @returns {Influence}
 *
 * @example
 * const inf = GameLogic.calculateInfluence(2000, 3.5); // 2 km at 12.6 km/h
 * // → { damage: ~27, repair: 20, speedMul: ~1.13, km: 2, raw: {...} }
 */
function calculateInfluence(distanceMeters, speedMps) {
  const km = distanceMeters / 1000;

  const speedNorm = speedMps > 0
    ? Math.max(0, Math.min(1,
        (speedMps - GL_CFG.SPEED_WALK_MS) /
        (GL_CFG.SPEED_SPRINT_MS - GL_CFG.SPEED_WALK_MS)
      ))
    : 0.5; // mid-range default when speed is unavailable

  const speedMul = GL_CFG.SPEED_MUL_MIN +
    speedNorm * (GL_CFG.SPEED_MUL_MAX - GL_CFG.SPEED_MUL_MIN);

  const rawDamage = km * GL_CFG.DMG_PER_KM;
  const rawRepair = km * GL_CFG.REP_PER_KM;

  return {
    damage:  rawDamage * speedMul,
    repair:  rawRepair,
    speedMul,
    km,
    raw: { damage: rawDamage, repair: rawRepair },
  };
}

/**
 * Apply influence to a territory cell and update ownership.
 *
 * Decision tree:
 *  1. No territory at `cell` → create new territory owned by `userId`
 *  2. Territory belongs to `userId` → repair defense
 *  3. Territory belongs to another player → attack; transfer on reaching 0
 *
 * Mutates internal territory state. Returns a result describing what happened.
 *
 * @param {GridCell}  cell
 * @param {string}    userId
 * @param {Influence} influence         Result of calculateInfluence()
 * @param {Object}    [opts]
 * @param {number}    [opts.level=1]              Player level (1–6)
 * @param {boolean}   [opts.hasLandmarks=false]   Cell contains landmarks
 * @param {number}    [opts.sessionConquests=0]   Conquests so far this run
 * @param {number}    [opts.now]                  Timestamp override (for tests)
 * @returns {ConquestResult}
 */
function updateTerritoryOwnership(cell, userId, influence, opts = {}) {
  const {
    level             = 1,
    hasLandmarks      = false,
    sessionConquests  = 0,
    now               = Date.now(),
  } = opts;

  const atkBonus = 1 + (level - 1) * GL_CFG.ATK_BONUS_PER_LVL;
  const repBonus = 1 + (level - 1) * GL_CFG.REP_BONUS_PER_LVL;
  const comboMul = sessionConquests >= 5 ? GL_CFG.COMBO_MULTI_5
                 : sessionConquests >= 3 ? GL_CFG.COMBO_MULTI_3
                 : 1;

  const idx = _territories.findIndex(t => t.cellKey === cell.key);

  // ── 1. Neutral cell: claim it ───────────────────────────────────────────
  if (idx === -1) {
    const initDef = Math.min(
      GL_CFG.MAX_DEF,
      GL_CFG.INIT_DEF_BASE + Math.floor((influence.km * 1000) / 200),
    );
    const defense = hasLandmarks
      ? Math.min(GL_CFG.MAX_DEF, Math.floor(initDef * GL_CFG.LM_DEF_BONUS))
      : initDef;

    const xp = Math.round(
      (GL_CFG.XP_NEUTRAL + Math.min(
        GL_CFG.XP_CONQUER_MAX - GL_CFG.XP_NEUTRAL,
        influence.km * GL_CFG.XP_SCALE_PER_KM,
      )) * comboMul,
    );

    /** @type {Territory} */
    const territory = {
      id:           `t_${now}_${cell.key}`,
      cellKey:      cell.key,
      owner:        userId,
      defense,
      maxDefense:   GL_CFG.MAX_DEF,
      createdAt:    now,
      lastDefended: now,
      _lastDecayTs: now,
      rarity:       _pickRarity(hasLandmarks),
    };

    _territories.push(territory);
    return { event: 'claimed', territory, xpGained: xp, isCrit: false, comboMul };
  }

  const t = _territories[idx];

  // ── 2. Own cell: repair ─────────────────────────────────────────────────
  if (t.owner === userId) {
    const repaired = Math.min(
      GL_CFG.MAX_DEF - t.defense,
      influence.repair * repBonus,
    );
    _territories[idx] = {
      ...t,
      defense:      Math.min(GL_CFG.MAX_DEF, t.defense + repaired),
      lastDefended: now,
      _lastDecayTs: now,
    };
    return {
      event: 'defended',
      territory: _territories[idx],
      xpGained: GL_CFG.XP_DEFEND,
      isCrit: false,
      comboMul,
    };
  }

  // ── 3. Enemy cell: attack ───────────────────────────────────────────────
  let dmg = influence.damage * atkBonus;
  const isCrit = Math.random() < GL_CFG.CRIT_CHANCE;
  if (isCrit) dmg *= GL_CFG.CRIT_MUL;
  dmg = Math.min(t.defense, dmg); // never deal more than remaining defense

  const newDefense = Math.max(0, t.defense - dmg);

  if (newDefense <= 0) {
    // Territory changes hands
    const xp = Math.round(
      Math.min(
        GL_CFG.XP_CONQUER_MAX,
        GL_CFG.XP_CONQUER_MIN + influence.km * GL_CFG.XP_SCALE_PER_KM,
      ) * comboMul,
    );
    _territories[idx] = {
      ...t,
      owner:        userId,
      defense:      20, // new owner starts with minimal hold defense
      lastDefended: now,
      createdAt:    now,
      _lastDecayTs: now,
    };
    return { event: 'conquered', territory: _territories[idx], xpGained: xp, isCrit, comboMul };
  }

  // Attack dealt but territory not yet taken
  const xp = Math.floor(dmg * 2) + 15;
  _territories[idx] = { ...t, defense: newDefense };
  return { event: 'attacked', territory: _territories[idx], xpGained: xp, isCrit, comboMul };
}

/**
 * Apply time-based decay to all territories not owned by `ownerId`.
 *
 * Decay schedule:
 *  - Sub-24h:  linear — DECAY_PER_DAY / 24 points per hour
 *  - 24h+:     stepped — 2 defense points per full day elapsed
 *
 * Territories at 0 defense older than MAX_AGE_HOURS are pruned.
 *
 * Mutates internal territory state.
 *
 * @param {Object} [opts]
 * @param {string} [opts.ownerId]   Territories owned by this user are immune
 * @param {number} [opts.now]       Timestamp override (for tests)
 * @returns {{ decayed: number, pruned: number }}
 */
function applyDecayToTerritories(opts = {}) {
  const { ownerId, now = Date.now() } = opts;

  let decayed = 0;
  let pruned  = 0;

  _territories = _territories
    .map(t => {
      if (ownerId && t.owner === ownerId) return t; // owner's territories are immune

      const ref     = t._lastDecayTs || t.lastDefended || t.createdAt || now;
      const hoursEl = (now - ref) / 3_600_000;
      const daysEl  = hoursEl / 24;

      let defense = t.defense;

      if (daysEl >= 1) {
        // Stepped: lose 2 defense per full day elapsed
        defense = Math.max(0, defense - 2 * Math.floor(daysEl));
      } else {
        // Linear interpolation within the first 24 hours
        defense = Math.max(0, defense - hoursEl * (GL_CFG.DECAY_PER_DAY / 24));
      }

      if (defense !== t.defense) decayed++;

      return { ...t, defense, _lastDecayTs: now };
    })
    .filter(t => {
      const age  = now - (t.lastDefended || 0);
      const keep = t.defense > 0
                || (ownerId && t.owner === ownerId)
                || age < GL_CFG.MAX_AGE_HOURS * 3_600_000;
      if (!keep) pruned++;
      return keep;
    });

  return { decayed, pruned };
}

// ─── Private Helpers ─────────────────────────────────────────────────────────

/**
 * Weighted-random rarity pick.
 * Landmarks bump the result one tier higher.
 * @param {boolean} hasLandmarks
 * @returns {'common'|'rare'|'epic'|'legendary'}
 */
function _pickRarity(hasLandmarks) {
  const TIERS   = ['common', 'rare', 'epic', 'legendary'];
  const WEIGHTS = [60, 25, 12, 3]; // must sum to 100
  let r = Math.random() * 100;
  let i = 0;
  for (; i < WEIGHTS.length - 1; i++) {
    r -= WEIGHTS[i];
    if (r <= 0) break;
  }
  if (hasLandmarks && i < TIERS.length - 1) i++;
  return TIERS[i];
}

// ─── Module Export ────────────────────────────────────────────────────────────

const GameLogic = {
  CFG: GL_CFG,

  // State
  init,
  getState,

  // Core functions
  calculateGridCell,
  calculateInfluence,
  updateTerritoryOwnership,
  applyDecayToTerritories,
};

// Works in both browser and Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = GameLogic;
} else {
  window.GameLogic = GameLogic;
}
