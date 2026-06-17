/**
 * achievements.js — Runners Conquer Erfolg-Icons
 * ------------------------------------------------------------
 * Framework-neutral, dependency-free. Generates an achievement
 * badge as an SVG string (100x100 viewBox), procedurally, from:
 *   category key + tier (1..6) + locked flag.
 *
 * Includes a built-in COUNTER: pass the player's raw stat value
 * and the module computes the reached tier, locked state, the
 * next threshold and progress %, then renders the matching icon.
 *
 * USAGE
 *   import { renderAchievement, evaluate, buildIconSvg, CATEGORIES } from './achievements.js';
 *
 *   // 1) Fire-and-forget from a live value:
 *   const a = renderAchievement('distance', 137.4);   // 137.4 km run
 *   //   a.svg        -> "<svg ...>...</svg>"  (drop into innerHTML / dangerouslySetInnerHTML)
 *   //   a.tier       -> 3   (reached tier, 0 = locked)
 *   //   a.locked     -> false
 *   //   a.tierName   -> "Limette"
 *   //   a.color      -> "#E6FF55"
 *   //   a.nextGoal   -> "250 km"   (caption to print; null at max)
 *   //   a.progressPct-> 35          (toward next tier, 0..100)
 *   //   a.justUnlocked is up to you to derive (see evaluate()).
 *
 *   // 2) Just the SVG for a known tier (e.g. the full gallery):
 *   const svg = buildIconSvg('rank', 6, false);
 *
 * RENDER NOTES
 *   - Each SVG gets unique <defs> IDs so many badges can coexist on one page.
 *   - Web: el.innerHTML = svg  (or React: dangerouslySetInnerHTML={{__html: svg}}).
 *   - React Native: use react-native-svg's SvgXml -> <SvgXml xml={svg} width={W} height={H}/>.
 *   - SwiftUI/native: rasterize the SVG, or re-implement frame()/motif() with the same numbers.
 *   - Colors/threshold values are the single source of truth here — tune THRESHOLDS to
 *     your real game balancing; the visuals don't change.
 */

/* ---------------------------------------------------------------- tokens */

export const TIERS = [
  { name: 'Bronze',   main: '#C0824A', soft: 'rgba(192,130,74,.16)',  deep: '#8a5a2e' },
  { name: 'Silber',   main: '#CBD5DA', soft: 'rgba(203,213,218,.16)', deep: '#7d878c' },
  { name: 'Limette',  main: '#E6FF55', soft: 'rgba(230,255,85,.15)',  deep: '#9aae1f' },
  { name: 'Türkis',   main: '#00D4FF', soft: 'rgba(0,212,255,.15)',   deep: '#0a7fa0' },
  { name: 'Episch',   main: '#9B5DE5', soft: 'rgba(155,93,229,.18)',  deep: '#5e2fa0' },
  { name: 'Imperial', main: '#FFD700', soft: 'rgba(255,215,0,.18)',   deep: '#b89500' },
];
export const LOCKED = { name: 'Gesperrt', main: '#33564a', soft: 'rgba(255,255,255,.05)', deep: '#0c2c22' };

/**
 * The 6 unlock thresholds per category.
 *   value     numeric thresholds (ascending) used by the counter.
 *   labels    the captions shown under each badge (German formatted).
 *   higherIsBetter
 *             true  -> tier unlocks when value >= threshold (distance, area, streak, …)
 *             false -> tier unlocks when value <= threshold (pace & rank: lower/closer to 1 is better)
 *   unit/format are only used to auto-format a live value if you want to show it.
 */
export const CATEGORIES = {
  distance:  { name: 'Distanz',              fa: 'fa-shoe-prints',   desc: 'Gelaufene Kilometer',          higherIsBetter: true,
               values: [10, 50, 100, 250, 500, 1000],
               labels: ['10 km', '50 km', '100 km', '250 km', '500 km', '1.000 km'] },
  territory: { name: 'Territorium',          fa: 'fa-draw-polygon',  desc: 'Eroberte Fläche',              higherIsBetter: true,
               values: [1000, 10000, 50000, 100000, 500000, 1000000],
               labels: ['1.000 m²', '10.000 m²', '50.000 m²', '100.000 m²', '500.000 m²', '1 Mio. m²'] },
  raid:      { name: 'Raids & Verteidigung', fa: 'fa-shield-halved', desc: 'Verteidigte & geraidete Reviere', higherIsBetter: true,
               values: [5, 25, 50, 100, 250, 500],
               labels: ['5×', '25×', '50×', '100×', '250×', '500×'] },
  rank:      { name: 'Herrschaft',           fa: 'fa-crown',         desc: 'Bester Saison-Rang',           higherIsBetter: false,
               values: [1000, 500, 100, 50, 10, 1],   // your best (lowest) leaderboard position
               labels: ['Top 1000', 'Top 500', 'Top 100', 'Top 50', 'Top 10', 'Platz 1'] },
  streak:    { name: 'Streak',               fa: 'fa-fire',          desc: 'Tage am Stück gelaufen',       higherIsBetter: true,
               values: [3, 7, 14, 30, 60, 100],
               labels: ['3 Tage', '7 Tage', '14 Tage', '30 Tage', '60 Tage', '100 Tage'] },
  pace:      { name: 'Tempo',                fa: 'fa-bolt',          desc: 'Beste Pace (Sek./km)',         higherIsBetter: false,
               values: [390, 360, 330, 300, 270, 240], // pace in seconds/km (6:30 … 4:00)
               labels: ['6:30 /km', '6:00 /km', '5:30 /km', '5:00 /km', '4:30 /km', '4:00 /km'] },
  landmark:  { name: 'Wahrzeichen',          fa: 'fa-location-dot',  desc: 'Gesammelte Landmarks',         higherIsBetter: true,
               values: [1, 5, 10, 25, 50, 100],
               labels: ['1 ★', '5 ★', '10 ★', '25 ★', '50 ★', '100 ★'] },
};

/* ------------------------------------------------------ the counter logic */

/**
 * Compute reached tier + progress for a raw stat value.
 * @param {string} key   category key
 * @param {number} value the player's current stat (km, m², pace-seconds, best rank, …)
 * @returns {{tier:number, locked:boolean, tierName:string, color:string,
 *            currentGoal:?string, nextGoal:?string, nextValue:?number, progressPct:number}}
 */
export function evaluate(key, value) {
  const cat = CATEGORIES[key];
  if (!cat) throw new Error('Unknown achievement category: ' + key);
  const pass = cat.higherIsBetter
    ? (v, thr) => v >= thr
    : (v, thr) => v <= thr;

  let tier = 0;
  for (let i = 0; i < cat.values.length; i++) {
    if (value != null && pass(value, cat.values[i])) tier = i + 1;
  }
  const locked = tier === 0;
  const maxed = tier === cat.values.length;

  // progress toward the NEXT tier (0..100). At max -> 100.
  let progressPct = 0;
  if (maxed) {
    progressPct = 100;
  } else if (value != null) {
    const lo = tier === 0 ? 0 : cat.values[tier - 1];
    const hi = cat.values[tier];
    if (cat.higherIsBetter) {
      progressPct = clamp(Math.round(((value - lo) / (hi - lo)) * 100), 0, 100);
    } else {
      // lower is better: shrink from lo down to hi
      const span = lo - hi || 1;
      progressPct = clamp(Math.round(((lo - value) / span) * 100), 0, 100);
    }
  }

  const tierMeta = locked ? LOCKED : TIERS[tier - 1];
  return {
    tier,
    locked,
    tierName: tierMeta.name,
    color: locked ? '#5A8A6E' : tierMeta.main,
    currentGoal: locked ? null : cat.labels[tier - 1],
    nextGoal: maxed ? null : cat.labels[tier],         // caption: what's needed next
    nextValue: maxed ? null : cat.values[tier],
    progressPct,
  };
}

/** Convenience: evaluate + render the matching SVG in one call. */
export function renderAchievement(key, value, opts) {
  const ev = evaluate(key, value);
  const drawTier = Math.max(1, ev.tier); // locked badges still draw the tier-1 silhouette
  const svg = buildIconSvg(key, drawTier, ev.locked, opts);
  return { ...ev, svg };
}

/* -------------------------------------------------------- svg generation */
/* Ported verbatim from the prototype Component class. Geometry untouched.  */

let _uid = 0;

function star(cx, cy, r, c, op) {
  let pts = '';
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 ? r * 0.45 : r;
    const a = -Math.PI / 2 + i * Math.PI / 5;
    pts += (cx + Math.cos(a) * rr).toFixed(1) + ',' + (cy + Math.sin(a) * rr).toFixed(1) + ' ';
  }
  return `<polygon points="${pts.trim()}" fill="${c}" opacity="${op}"/>`;
}

function motif(key, t, c, soft) {
  switch (key) {
    case 'distance':  return mDistance(t, c);
    case 'territory': return mTerritory(t, c, soft);
    case 'raid':      return mRaid(t, c, soft);
    case 'rank':      return mRank(t, c, soft);
    case 'streak':    return mStreak(t, c, soft);
    case 'pace':      return mPace(t, c, soft);
    case 'landmark':  return mLandmark(t, c, soft);
    default:          return '';
  }
}

// DISTANZ — Fußspuren-Trail mit Zielflagge
function mDistance(t, c) {
  let s = '';
  const trail = 'M 34 70 C 36 54 50 58 52 46 C 54 34 62 36 58 26';
  s += `<path d="${trail}" fill="none" stroke="${c}" stroke-width="8" opacity=".10" stroke-linecap="round"/>`;
  s += `<path d="${trail}" fill="none" stroke="${c}" stroke-width="2.6" opacity=".4" stroke-linecap="round"/>`;
  const fp = [[37,66,-22],[43,58,-30],[49,51,-18],[53,43,-34],[56,35,-20],[58,28,-30]];
  for (let i = 0; i < t; i++) { const p = fp[i]; s += `<g transform="translate(${p[0]} ${p[1]}) rotate(${p[2]})"><ellipse cx="0" cy="0" rx="2.1" ry="3.4" fill="${c}"/><circle cx="0.5" cy="-3.6" r="1" fill="${c}"/></g>`; }
  s += `<circle cx="34" cy="70" r="3.2" fill="#072c21" stroke="${c}" stroke-width="2.2"/>`;
  const px = 58, ptop = 15, fw = 11, fh = 8, fx0 = px - fw;
  s += `<line x1="${px}" y1="28" x2="${px}" y2="${ptop}" stroke="${c}" stroke-width="2"/>`;
  s += `<rect x="${fx0}" y="${ptop}" width="${fw}" height="${fh}" fill="#072c21" stroke="${c}" stroke-width="1.4"/>`;
  for (let col = 0; col < 3; col++) for (let row = 0; row < 2; row++) { if ((col + row) % 2 === 0) s += `<rect x="${(fx0 + col * fw / 3).toFixed(1)}" y="${(ptop + row * fh / 2).toFixed(1)}" width="${(fw / 3).toFixed(1)}" height="${(fh / 2).toFixed(1)}" fill="${c}"/>`; }
  return s;
}

// TERRITORIUM — erobertes Gebiet mit Kacheln + Wimpel
function mTerritory(t, c, soft) {
  let s = '';
  const region = 'M 30 42 Q 28 30 40 27 Q 54 23 65 31 Q 74 40 69 52 Q 64 65 49 65 Q 33 64 31 53 Z';
  s += `<path d="${region}" fill="${soft}" stroke="${c}" stroke-width="2.8" stroke-linejoin="round"/>`;
  const cells = [];
  for (let r = 0; r < 4; r++) for (let col = 0; col < 4; col++) cells.push([37 + col * 7.5, 33 + r * 7.5]);
  const filled = Math.min(cells.length, Math.round(t * 16 / 6));
  cells.forEach((p, i) => { const on = i < filled; s += `<rect x="${p[0]}" y="${p[1]}" width="6" height="6" rx="1" fill="${on ? c : 'none'}" opacity="${on ? '.5' : '1'}" stroke="${on ? 'none' : c}" stroke-opacity="${on ? '0' : '.16'}" stroke-width="1"/>`; });
  if (t >= 4) s += `<path d="${region}" fill="none" stroke="${c}" stroke-width="1" stroke-dasharray="3 3" opacity=".5"/>`;
  if (t >= 2) { const fx = 49, fy = 24; s += `<line x1="${fx}" y1="${fy+1}" x2="${fx}" y2="${fy-13}" stroke="${c}" stroke-width="2"/><path d="M ${fx} ${fy-13} L ${fx+11} ${fy-10.5} L ${fx+8} ${fy-8} L ${fx+11} ${fy-5.5} L ${fx} ${fy-3} Z" fill="${c}"/>`; }
  return s;
}

// RAIDS — heraldisches Wappen mit Blitz-Emblem, Schwertern, Krone
function mRaid(t, c, soft) {
  const cx = 50, cy = 47;
  let s = '';
  const sword = (rot) => `<g transform="rotate(${rot} ${cx} ${cy})" opacity=".72"><line x1="${cx}" y1="${cy-23}" x2="${cx}" y2="${cy+21}" stroke="${c}" stroke-width="2.2" stroke-linecap="round"/><path d="M ${cx} ${cy-26} l -1.8 4 h3.6 z" fill="${c}"/><line x1="${cx-6}" y1="${cy+13}" x2="${cx+6}" y2="${cy+13}" stroke="${c}" stroke-width="2.4" stroke-linecap="round"/><circle cx="${cx}" cy="${cy+20}" r="2" fill="${c}"/></g>`;
  if (t >= 3) s += sword(32) + sword(-32);
  else if (t >= 2) s += sword(40);
  if (t >= 5) { const ty = cy - 25; s += `<path d="M ${cx-9} ${ty} L ${cx-9} ${ty-5} L ${cx-4} ${ty-1} L ${cx} ${ty-7} L ${cx+4} ${ty-1} L ${cx+9} ${ty-5} L ${cx+9} ${ty} Z" fill="${c}"/>`; }
  const sh = `M ${cx} ${cy-19} L ${cx+15} ${cy-13} L ${cx+15} ${cy+3} Q ${cx+15} ${cy+17} ${cx} ${cy+23} Q ${cx-15} ${cy+17} ${cx-15} ${cy+3} L ${cx-15} ${cy-13} Z`;
  s += `<path d="${sh}" fill="${soft}" stroke="${c}" stroke-width="2.8" stroke-linejoin="round"/>`;
  s += `<path d="M ${cx+3} ${cy-9} L ${cx-5} ${cy+2} L ${cx-0.5} ${cy+2} L ${cx-3} ${cy+11} L ${cx+6} ${cy-2} L ${cx+1.5} ${cy-2} Z" fill="${c}"/>`;
  if (t >= 4) { [[cx-10,cy-9],[cx+10,cy-9]].forEach(p => s += `<circle cx="${p[0]}" cy="${p[1]}" r="1.5" fill="${c}"/>`); }
  if (t >= 6) s += `<path d="M ${cx-19} ${cy+14} Q ${cx-26} ${cy-1} ${cx-17} ${cy-15}" fill="none" stroke="${c}" stroke-width="2"/><path d="M ${cx+19} ${cy+14} Q ${cx+26} ${cy-1} ${cx+17} ${cy-15}" fill="none" stroke="${c}" stroke-width="2"/>`;
  return s;
}

// HERRSCHAFT — Königskrone mit Bügel, Juwelen, Reichsapfel
function mRank(t, c, soft) {
  const cx = 50, bw = 36, lx = cx - bw / 2, bandY = 54, bandH = 8, peaks = t + 1, mid = Math.floor(peaks / 2);
  let s = '';
  let d = `M ${lx} ${bandY}`;
  const tip = [];
  for (let i = 0; i < peaks; i++) { const x1 = lx + bw * (i + 1) / peaks, xm = lx + bw * (i + 0.5) / peaks, ph = 17 + (i === mid ? 7 : 0); tip.push([xm, bandY - ph]); d += ` L ${xm.toFixed(1)} ${(bandY-ph).toFixed(1)} L ${x1.toFixed(1)} ${bandY}`; }
  d += ' Z';
  if (t >= 3) s += `<path d="M ${lx+3} ${bandY} Q ${cx} ${bandY-26} ${lx+bw-3} ${bandY}" fill="none" stroke="${c}" stroke-width="1.6" opacity=".5"/>`;
  s += `<path d="${d}" fill="${soft}" stroke="${c}" stroke-width="2.6" stroke-linejoin="round"/>`;
  s += `<path d="M ${lx} ${bandY} L ${lx+bw} ${bandY} L ${lx+bw} ${bandY+bandH-2} Q ${cx} ${bandY+bandH+3} ${lx} ${bandY+bandH-2} Z" fill="${soft}" stroke="${c}" stroke-width="2.6" stroke-linejoin="round"/>`;
  for (const p of tip) s += `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="2" fill="${c}"/>`;
  for (let i = 0; i < t; i++) { const x = lx + bw * (i + 0.5) / t; s += `<circle cx="${x.toFixed(1)}" cy="${bandY+bandH/2-1}" r="1.5" fill="${c}"/>`; }
  if (t >= 5) { const oy = bandY - 28; s += `<circle cx="${cx}" cy="${oy}" r="2.6" fill="none" stroke="${c}" stroke-width="1.6"/><line x1="${cx}" y1="${oy-2.6}" x2="${cx}" y2="${oy-8}" stroke="${c}" stroke-width="1.8"/><line x1="${cx-3}" y1="${oy-6}" x2="${cx+3}" y2="${oy-6}" stroke="${c}" stroke-width="1.8"/>`; }
  if (t >= 6) s += `<path d="M ${cx-22} ${bandY+12} Q ${cx-30} ${bandY-4} ${cx-19} ${bandY-18}" fill="none" stroke="${c}" stroke-width="2" opacity=".8"/><path d="M ${cx+22} ${bandY+12} Q ${cx+30} ${bandY-4} ${cx+19} ${bandY-18}" fill="none" stroke="${c}" stroke-width="2" opacity=".8"/>`;
  return s;
}

// STREAK — mehrschichtige Flamme mit Funken & Scheiten
function mStreak(t, c, soft) {
  const cx = 50, by = 66, sc = 0.78 + t * 0.055;
  const flame = (k, fill, op, dx) => `<path transform="translate(${cx+(dx||0)} ${by}) scale(${k.toFixed(3)})" d="M0 0 C -13 -7 -11 -23 -2 -36 C 0 -28 4 -27 5 -19 C 6 -13 13 -11 12 -2 C 11 6 5 5 0 0 Z" fill="${fill}" opacity="${op}" stroke="${fill}" stroke-width="${(1.2/k).toFixed(2)}" stroke-linejoin="round"/>`;
  let s = '';
  s += flame(sc, soft, 1, 0);
  s += flame(sc * 0.72, c, .4, 0);
  if (t >= 2) s += flame(sc * 0.4, c, .95, 0.5);
  for (let i = 0; i < t; i++) { const side = i % 2 ? 1 : -1; const x = cx + side * (9 + (i % 3) * 2); const y = by - 16 - i * 5; s += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(1.2+(i%2)*0.5).toFixed(1)}" fill="${c}" opacity=".75"/>`; }
  if (t >= 3) { s += `<line x1="${cx-11}" y1="${by+4}" x2="${cx+9}" y2="${by-1}" stroke="${c}" stroke-width="2.6" stroke-linecap="round" opacity=".8"/><line x1="${cx-9}" y1="${by-1}" x2="${cx+11}" y2="${by+4}" stroke="${c}" stroke-width="2.6" stroke-linecap="round" opacity=".8"/>`; }
  return s;
}

// TEMPO — geflügelter Blitz mit Speed-Lines
function mPace(t, c, soft) {
  const cx = 50, cy = 46;
  let s = '';
  const lines = Math.max(2, t);
  for (let i = 0; i < lines; i++) { const y = cy - 15 + i * (30 / lines); const len = 6 + (i % 2 ? 8 : 3); s += `<line x1="${cx-28}" y1="${y.toFixed(1)}" x2="${(cx-28+len)}" y2="${y.toFixed(1)}" stroke="${c}" stroke-width="2" stroke-linecap="round" opacity=".55"/>`; }
  if (t >= 2) { const ws = (0.4 + t * 0.07).toFixed(2); s += `<g transform="translate(${cx} ${cy}) scale(${ws})" opacity=".45"><path d="M -4 -1 q -12 -3 -20 4 q 11 -1 16 2 q -10 1 -14 6 q 12 -2 18 0 Z" fill="${c}"/><path d="M 4 -1 q 12 -3 20 4 q -11 -1 -16 2 q 10 1 14 6 q -12 -2 -18 0 Z" fill="${c}"/></g>`; }
  const bolt = (dx, op) => `<path transform="translate(${dx} 0)" d="M ${cx+5} ${cy-21} L ${cx-8} ${cy+3} L ${cx-1} ${cy+3} L ${cx-5} ${cy+22} L ${cx+12} ${cy-6} L ${cx+3} ${cy-6} Z" fill="${c}" opacity="${op}"/>`;
  if (t >= 5) s += bolt(-9, .4);
  s += bolt(0, 1);
  return s;
}

// WAHRZEICHEN — Monument mit Sternbild
function mLandmark(t, c, soft) {
  const cx = 50;
  let s = '';
  s += `<path d="M 26 70 Q 50 60 74 70" fill="none" stroke="${c}" stroke-width="2.4" stroke-linecap="round" opacity=".55"/>`;
  const seg = Math.min(5, t + 1), baseY = 68, segH = 6;
  for (let i = 0; i < seg; i++) { const y = baseY - (i + 1) * segH; const ww = Math.max(7, 20 - i * 3); s += `<rect x="${(cx-ww/2).toFixed(1)}" y="${y}" width="${ww.toFixed(1)}" height="${segH-1}" rx="1" fill="${soft}" stroke="${c}" stroke-width="2"/>`; }
  const topY = baseY - seg * segH;
  s += `<path d="M ${cx-5} ${topY} L ${cx} ${topY-9} L ${cx+5} ${topY} Z" fill="${soft}" stroke="${c}" stroke-width="2" stroke-linejoin="round"/>`;
  s += star(cx, topY - 12, 3.2, c, 1);
  const extra = t - 1, cp = [[31,30],[39,22],[61,23],[69,31],[34,44]];
  let prev = null;
  for (let i = 0; i < extra; i++) { const p = cp[i % cp.length]; if (prev) s += `<line x1="${prev[0]}" y1="${prev[1]}" x2="${p[0]}" y2="${p[1]}" stroke="${c}" stroke-width="0.8" opacity=".3"/>`; s += star(p[0], p[1], 2, c, .85); prev = p; }
  return s;
}

// distinct frame silhouette per tier
function frame(t, c, locked) {
  const op = locked ? '.3' : '1';
  if (t === 1) { // Bronze — schlichter Einzelring
    return `<circle cx="50" cy="50" r="42" fill="none" stroke="${c}" stroke-width="1.6" opacity="${op}"/>`;
  }
  if (t === 2) { // Silber — Doppelring
    return `<circle cx="50" cy="50" r="42" fill="none" stroke="${c}" stroke-width="2.2" opacity="${op}"/>` +
           `<circle cx="50" cy="50" r="37" fill="none" stroke="${c}" stroke-width="1.1" opacity="${locked ? '.22' : '.55'}"/>`;
  }
  if (t === 3) { // Limette — gezahnter Zahnrad-Rand
    let teeth = ''; const n = 24;
    for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; const r = i % 2 ? 44 : 40; teeth += `${(50+Math.cos(a)*r).toFixed(1)},${(50+Math.sin(a)*r).toFixed(1)} `; }
    return `<polygon points="${teeth.trim()}" fill="none" stroke="${c}" stroke-width="2" stroke-linejoin="round" opacity="${op}"/>` +
           `<circle cx="50" cy="50" r="36" fill="none" stroke="${c}" stroke-width="1.1" opacity="${locked ? '.22' : '.5'}"/>`;
  }
  if (t === 4) { // Türkis — geschuppter Wellenrand + Eckpunkte
    let d = ''; const n = 18;
    for (let i = 0; i <= n; i++) { const a = i / n * Math.PI * 2; const r = i % 2 ? 43 : 39; const x = (50+Math.cos(a)*r).toFixed(1), y = (50+Math.sin(a)*r).toFixed(1); d += (i === 0 ? 'M' : 'L') + x + ' ' + y + ' '; }
    d += 'Z';
    let dots = ''; for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2 - Math.PI / 4; dots += `<circle cx="${(50+Math.cos(a)*43).toFixed(1)}" cy="${(50+Math.sin(a)*43).toFixed(1)}" r="2.2" fill="${c}" opacity="${op}"/>`; }
    return `<path d="${d}" fill="none" stroke="${c}" stroke-width="2.4" stroke-linejoin="round" opacity="${op}"/>` +
           `<circle cx="50" cy="50" r="35" fill="none" stroke="${c}" stroke-width="1" opacity="${locked ? '.2' : '.45'}"/>` + dots;
  }
  if (t === 5) { // Episch — facettierter Zackenkranz
    let spikes = ''; const n = 16;
    for (let i = 0; i < n * 2; i++) { const a = i / (n * 2) * Math.PI * 2; const r = i % 2 ? 45 : 38; spikes += `${(50+Math.cos(a)*r).toFixed(1)},${(50+Math.sin(a)*r).toFixed(1)} `; }
    let facet = ''; for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2 - Math.PI / 2; facet += `<line x1="${(50+Math.cos(a)*38).toFixed(1)}" y1="${(50+Math.sin(a)*38).toFixed(1)}" x2="${(50+Math.cos(a)*44.5).toFixed(1)}" y2="${(50+Math.sin(a)*44.5).toFixed(1)}" stroke="${c}" stroke-width="1" opacity="${locked ? '.2' : '.4'}"/>`; }
    return `<polygon points="${spikes.trim()}" fill="none" stroke="${c}" stroke-width="2.4" stroke-linejoin="round" opacity="${op}"/>` + facet +
           `<circle cx="50" cy="50" r="34" fill="none" stroke="${c}" stroke-width="1.2" opacity="${locked ? '.22' : '.55'}"/>`;
  }
  // t === 6 Imperial — voller Strahlenkranz + Lorbeer + Krönchen
  let rays = ''; const n = 36;
  for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; const lng = i % 3 === 0; rays += `<line x1="${(50+Math.cos(a)*40).toFixed(1)}" y1="${(50+Math.sin(a)*40).toFixed(1)}" x2="${(50+Math.cos(a)*(lng?47:44)).toFixed(1)}" y2="${(50+Math.sin(a)*(lng?47:44)).toFixed(1)}" stroke="${c}" stroke-width="${lng ? '1.8' : '1'}" stroke-linecap="round" opacity="${locked ? '.3' : (lng ? '.8' : '.5')}"/>`; }
  const wreath = locked ? '' : `<path d="M 30 56 Q 26 67 37 72" fill="none" stroke="${c}" stroke-width="1.8" opacity=".6"/><path d="M 70 56 Q 74 67 63 72" fill="none" stroke="${c}" stroke-width="1.8" opacity=".6"/>` +
    [0, 1, 2].map(k => `<circle cx="${30+k*2}" cy="${60+k*4}" r="1.2" fill="${c}" opacity=".5"/><circle cx="${70-k*2}" cy="${60+k*4}" r="1.2" fill="${c}" opacity=".5"/>`).join('');
  const crown = locked ? '' : `<path d="M 44 11 L 46.5 16 L 50 10.5 L 53.5 16 L 56 11 L 55 18 L 45 18 Z" fill="${c}"/>`;
  return rays +
    `<circle cx="50" cy="50" r="40" fill="none" stroke="${c}" stroke-width="3" opacity="${op}"/>` +
    `<circle cx="50" cy="50" r="35" fill="none" stroke="${c}" stroke-width="1.2" opacity="${locked ? '.22' : '.6'}"/>` +
    wreath + crown;
}

/**
 * Build the full badge SVG.
 * @param {string} key      category key
 * @param {number} t        tier 1..6 (the silhouette to draw)
 * @param {boolean} locked  draw faded + padlock
 * @param {object} [opts]   { size:number=100, showPips:boolean=true }
 * @returns {string} SVG markup
 */
export function buildIconSvg(key, t, locked, opts = {}) {
  const showPips = opts.showPips !== false;
  const tr = locked ? LOCKED : TIERS[t - 1];
  const c = tr.main, soft = tr.soft, deep = tr.deep;
  const uid = key + t + (locked ? 'l' : 'u') + (++_uid);
  const glow = (!locked && t >= 4);
  const fillStop = locked ? '.4' : (0.22 + t * 0.09).toFixed(2);

  let defs = `<defs><radialGradient id="g${uid}" cx="50%" cy="34%" r="74%"><stop offset="0%" stop-color="${locked ? '#0e3326' : deep}" stop-opacity="${locked ? '1' : fillStop}"/><stop offset="100%" stop-color="#06291f" stop-opacity="1"/></radialGradient>`;
  if (glow) defs += `<filter id="f${uid}" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="${t >= 6 ? '2.6' : '1.7'}" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`;
  defs += `<clipPath id="c${uid}"><circle cx="50" cy="50" r="38"/></clipPath></defs>`;

  const plate = `<circle cx="50" cy="50" r="38" fill="url(#g${uid})" ${glow ? `filter="url(#f${uid})"` : ''}/>`;
  const fr = frame(t, c, locked);
  const m = `<g clip-path="url(#c${uid})"${locked ? ' opacity=".3"' : ''}>${motif(key, t, c, soft)}</g>`;

  let pips = '';
  if (showPips) {
    const gap = 6, sx = 50 - (5 * gap) / 2, y = 85;
    for (let i = 0; i < 6; i++) { const on = i < t; pips += `<circle cx="${(sx+i*gap).toFixed(1)}" cy="${y}" r="1.9" fill="${on ? (locked ? '#33564a' : c) : 'none'}" stroke="${on ? 'none' : 'rgba(255,255,255,.16)'}" stroke-width="1"/>`; }
  }

  let lock = '';
  if (locked) lock = `<g><circle cx="50" cy="51" r="13" fill="#05231a" stroke="rgba(255,255,255,.16)" stroke-width="1.4"/><rect x="44" y="49" width="12" height="9.5" rx="1.8" fill="#9fb4aa"/><path d="M46.2 49 v-2.6 a3.8 3.8 0 0 1 7.6 0 V49" fill="none" stroke="#9fb4aa" stroke-width="1.8"/><circle cx="50" cy="53.4" r="1.3" fill="#05231a"/></g>`;

  return `<svg viewBox="0 0 100 100" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">${defs}${plate}${fr}${m}${lock}${pips}</svg>`;
}

/* --------------------------------------------------------------- helpers */

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

/** Parse a "m:ss" pace string into seconds/km (for the `pace` category). */
export function paceToSeconds(mmss) {
  const [m, s] = String(mmss).split(':').map(Number);
  return (m || 0) * 60 + (s || 0);
}
