# Handoff: Runners Conquer — Erfolg-Icons (Achievement Badges)

## Overview
A complete achievement-badge system for the **Runners Conquer** running/conquest app.
There are **7 achievement categories**, each with its **own pictogram**, and each category
has **6 tiers**. Both the *motif* (the inner picture) and the *frame* (the surrounding
ring/border) change per tier, so progression is readable at a glance. Each badge also has
an **unlocked** and a **locked** (faded silhouette + padlock) state, and a row of 6 **pips**
under the motif showing which tier has been reached.

Deliverables in the prototype:
1. A **gallery** — all 7×6 badges in a grid, with the *unlock threshold* printed under each.
2. A **states** demo — unlocked vs. locked.
3. An **in-app screen** — the Profil → "Erfolge" tab inside a phone mock.

## About the Design Files
The file in this bundle (`Erfolg-Icons.dc.html`) is a **design reference created in HTML** —
a prototype showing the intended look and the icon-construction algorithm, **not** production
code to ship as-is. The badges are drawn as **procedurally generated inline SVG** (a JS
function builds the SVG string from `category` + `tier` + `locked`). Recreate this in the
target codebase's environment (React/Vue/SwiftUI/etc.) using its established patterns. The
SVG-building logic is framework-agnostic and can be lifted almost verbatim into a helper that
returns an SVG string (or a React/JSX `<svg>`).

## Fidelity
**High-fidelity.** Final colors, typography, geometry and per-tier treatments are all
defined. Recreate pixel-accurately. The single source of truth for the drawing is the
`Component` class inside `Erfolg-Icons.dc.html` (methods `icon`, `frame`, `motif`, and the
per-category `m*` methods).

---

## The Icon System (core spec)

Every badge is a **100×100 viewBox SVG**, composed in this draw order:

1. `defs` — a radial gradient backplate `g<uid>` (centered at 50% / 34%, radius 74%), an
   optional Gaussian-blur glow filter `f<uid>` (tiers ≥ 4), and a circular `clipPath`
   `c<uid>` at `cx50 cy50 r38` that keeps **all motif art inside the disc**.
2. **Backplate** — `<circle cx50 cy50 r38 fill="url(#g<uid>)">`. Fill brightness scales with
   tier: gradient inner stop-opacity = `0.22 + tier*0.09`. Glow filter applied for tier ≥ 4.
3. **Frame** — the per-tier ring silhouette (see "Per-tier frames").
4. **Motif** — the per-category pictogram, wrapped in `<g clip-path="url(#c<uid>)">`. For
   locked badges the whole group is `opacity:.3`.
5. **Lock** (locked only) — a small padlock centered at ~`cx50 cy51`.
6. **Pips** — 6 dots at `y85`, `x` from 35 to 65 in steps of 6, radius 1.9. Filled (tier
   color) for `i < tier`, otherwise hollow with a faint white stroke.

`<uid>` is a unique string per render (`key + tier + locked + counter`) so gradient/filter/clip
IDs never collide when many badges are on one page. **This is essential** — duplicate SVG def
IDs in a single document break rendering.

### Per-tier frames (the main "tiers look different" mechanism)
Each tier has a **distinct frame shape** so they're separable at a glance:

| Tier | Name | Color | Frame treatment |
|---|---|---|---|
| 1 | Bronze | `#C0824A` | Single thin ring (`r42`, stroke 1.6) |
| 2 | Silber | `#CBD5DA` | Double ring (`r42` stroke 2.2 + inner `r37`) |
| 3 | Limette | `#E6FF55` | 24-point gear/notched edge (alternating r 44/40) + inner ring `r36` |
| 4 | Türkis | `#00D4FF` | 18-bump scalloped wave edge (alternating r 43/39) + 4 corner dots + inner ring `r35` |
| 5 | Episch | `#9B5DE5` | 16-point faceted spike crown (alternating r 45/38) + radial facet lines + inner ring `r34` |
| 6 | Imperial | `#FFD700` | Full 36-spoke sunburst (every 3rd longer) + ring `r40` + laurel sprigs + small crown at top |

Glow (blur filter) applies from tier 4 up; tier 6 uses a stronger blur.

### The 7 categories & their motifs
Each motif **grows with the tier** (more elements / more complexity), staying inside the clip disc.

| key | Name (DE) | FA icon | Motif description |
|---|---|---|---|
| `distance` | Distanz | `fa-shoe-prints` | A curved trail with a start dot and a **checkered finish flag**; footprints accumulate along the path (1 per tier). |
| `territory` | Territorium | `fa-draw-polygon` | A blobby **claimed region** filled with a 4×4 grid of tiles; the number of filled tiles grows with tier; a **pennant** plants at tier ≥ 2; dashed border at tier ≥ 4. |
| `raid` | Raids & Verteidigung | `fa-shield-halved` | A **heraldic shield with a lightning emblem**; crossed swords appear (1 at tier 2, 2 at tier 3); a small crown at tier ≥ 5; flank flourishes at tier 6. |
| `rank` | Herrschaft | `fa-crown` | A **king's crown**: number of points = `tier+1`, gains an **arch** (t≥3), an **orb** above (t≥5), and side flourishes (t≥6); jewels on the band grow with tier. |
| `streak` | Streak | `fa-fire` | A **multi-layer flame** that scales up with tier, an inner flame core, **sparks** (one more per tier), and **crossed logs** at tier ≥ 3. |
| `pace` | Tempo | `fa-bolt` | A **winged lightning bolt** with speed-lines; wings appear/scale from tier 2; a ghost bolt at tier ≥ 5. |
| `landmark` | Wahrzeichen | `fa-location-dot` | A stacked **monument/obelisk** (segments = `min(5, tier+1)`) topped by a star, with a small **constellation** of stars whose connected nodes grow with tier; plinth steps at tier ≥ 4. |

> All motif geometry is in the `m<Name>(t, c, soft)` methods. `c` = tier main color,
> `soft` = the same color at low alpha for fills.

### Tier color ramp (used for frame, motif strokes, pips, captions)
```
Bronze   main #C0824A  soft rgba(192,130,74,.16)  deep #8a5a2e
Silber   main #CBD5DA  soft rgba(203,213,218,.16) deep #7d878c
Limette  main #E6FF55  soft rgba(230,255,85,.15)  deep #9aae1f
Türkis   main #00D4FF  soft rgba(0,212,255,.15)   deep #0a7fa0
Episch   main #9B5DE5  soft rgba(155,93,229,.18)  deep #5e2fa0
Imperial main #FFD700  soft rgba(255,215,0,.18)   deep #b89500
Locked   main #33564a  soft rgba(255,255,255,.05) deep #0c2c22
```
`deep` is the gradient inner color (backplate). Backplate outer color is always `#06291f`.

### Unlock thresholds (printed under each badge — these are the captions, NOT tier names)
The user specifically asked that the caption show **the value required to unlock**, not the
tier name. Defaults used in the prototype (tune to real balancing):

```
Distanz:      10 km · 50 km · 100 km · 250 km · 500 km · 1.000 km
Territorium:  1.000 m² · 10.000 m² · 50.000 m² · 100.000 m² · 500.000 m² · 1 Mio. m²
Raids:        5× · 25× · 50× · 100× · 250× · 500×
Herrschaft:   Top 1000 · Top 500 · Top 100 · Top 50 · Top 10 · Platz 1
Streak:       3 · 7 · 14 · 30 · 60 · 100 Tage
Tempo:        6:30 · 6:00 · 5:30 · 5:00 · 4:30 · 4:00 /km
Wahrzeichen:  1 · 5 · 10 · 25 · 50 · 100 ★
```

---

## Components in the prototype

### 1. Gallery card (per category)
- Card: `background var(--card)`, `1px solid var(--border)`, `border-radius 16px`, padding `20px 22px`.
- Header: 42×42 rounded tile (`border-radius 12px`, lime tint bg) with the category's FA icon
  in `--primary`, next to a Bebas-Neue title (25px, tracked 2px) and a small Poppins
  description in `--muted`.
- Grid: `grid-template-columns: repeat(6, 1fr)`, gap 14px. Each cell = badge (max 108px,
  `aspect-ratio 1`) + the unlock-threshold caption in the tier color (Bebas Neue, ~1.05rem).
- Hover: badge lifts `translateY(-4px) scale(1.05)`, transition `.18s var(--ease)`.

### 2. Tier-ramp legend
A pill-less inline row in a card listing the 6 tier names, each with a colored 14px dot
(with a soft glow) + Bebas-Neue label. Purely informational.

### 3. In-app screen (phone mock)
- 330px-wide device, `10px solid #021c16` bezel, `border-radius 46px`, notch.
- Header row (RC lettermark, "Profil" title, cog), avatar + name "Max" + gold "König" ruler
  pill, a 3-up stat strip (km / m² / streak), then the **Erfolge** grid (2 columns) where
  each cell shows a 58px badge, category name, the unlock caption, and a thin progress bar
  in the tier color.
- Bottom nav: 5 FA icons (`fa-map`, `fa-chart-pie`, `fa-globe`, `fa-user` active, `fa-bars`),
  active item tinted `--primary` with a 2px lime indicator.

---

## Interactions & Behavior
- **Hover** on gallery badges: lift + scale (see above). Mobile-first → in the real app
  prefer a **press** state (`transform: scale(.96–.97)` on `:active`).
- No other interactivity in the prototype; badges are presentational. In production, a tap
  would open an achievement detail / progress sheet.
- Respect `prefers-reduced-motion` (disable the lift/glow transitions).

## State Management
Per badge the only inputs are:
- `category` (one of the 7 keys)
- `tier` (1–6) — the **reached** tier
- `locked` (boolean) — true when tier 0 / not yet started
- `progressPct` (0–100) — for the in-app progress bar

No global state required for the icons themselves; they are pure functions of those inputs.

## Design Tokens
From the bound **Runners Conquer Design System** (`colors_and_type.css`), do not invent new ones:
- `--bg #042D22` (deep forest green), `--card #0D3D2C`, `--bg2` (one notch up), `--border`
  (white @ ~9%), `--text`, `--muted`.
- Accent `--primary #E6FF55` (citrus lime), `--gold #FFD700` (status/ruler), plus tier colors
  listed above (cyan `#00D4FF`, purple `#9B5DE5`, etc.).
- Type: **Bebas Neue** (all headings/stats/labels, uppercase, tracked ~2px) + **Poppins**
  (body, 400–800). Numbers large in Bebas Neue.
- Radius: 16px cards, 12–14px tiles/inputs, 40px pills, full circles for avatars/dots.
- Easing: entrance `cubic-bezier(.34,1.15,.64,1)`; the prototype uses `var(--ease)`.

## Assets
- **No raster assets** for the badges — everything is generated SVG.
- **Font Awesome 6.4 (solid)** for category header icons and the phone-mock chrome
  (CDN: `https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css`).
- Fonts Bebas Neue + Poppins from Google Fonts (loaded via the design system's
  `colors_and_type.css`).

## Ready-to-use port (USE THIS)
This bundle already contains a finished, framework-neutral JS port so you don't have to
extract anything by hand:

- **`achievements.js`** — dependency-free ES module. Exports:
  - `evaluate(key, value)` → the **counter**: maps a raw stat value to `{ tier, locked,
    tierName, color, currentGoal, nextGoal, nextValue, progressPct }`. Handles both
    "higher is better" (distance, area, streak, raids, landmarks) and "lower is better"
    (pace in sec/km, best leaderboard rank).
  - `renderAchievement(key, value)` → `evaluate()` **plus** `svg` (the matching badge as an
    SVG string). One call per badge.
  - `buildIconSvg(key, tier, locked, opts?)` → just the SVG for a known tier (e.g. a static
    gallery). `opts.showPips=false` hides the tier dots; `opts.size` is advisory.
  - `CATEGORIES`, `TIERS`, `LOCKED` — the tokens + thresholds (edit `CATEGORIES[*].values`
    and `.labels` to match your real balancing; geometry never changes).
  - `paceToSeconds("4:30")` helper for the pace category.
- **`demo.html`** — open in a browser: a slider scales the player's progress and all 7
  badges re-render live (tier, caption, progress bar). This is the reference for wiring the
  module into your UI.

### Wiring it in
```js
import { renderAchievement } from './achievements.js';
const a = renderAchievement('distance', player.totalKm);   // e.g. 137.4
container.innerHTML = a.svg;                                 // web
// React:        <div dangerouslySetInnerHTML={{ __html: a.svg }} />
// React Native: <SvgXml xml={a.svg} width={64} height={64} />  (react-native-svg)
caption.textContent = a.locked ? 'Gesperrt'
  : a.nextGoal ? `Nächstes Ziel: ${a.nextGoal}` : 'Maximalstufe';
bar.style.width = a.progressPct + '%';
```
`evaluate()` is pure — compare last-known `tier` with the new one to fire an **unlock**
animation/toast when it increases.

## Files
- `achievements.js` — the production-ready port (counter + SVG generator). **Start here.**
- `demo.html` — live counter demo wiring `achievements.js`.
- `Erfolg-Icons.dc.html` — the original visual prototype (gallery + states + in-app screen).
  The `Component` class holds the same icon logic the module was ported from:
  - `icon(key, t, tr, locked)` — assembles the full SVG.
  - `frame(t, c, locked)` — the per-tier ring silhouette.
  - `motif(key, t, c, soft)` → dispatches to `mDistance / mTerritory / mRaid / mRank /
    mStreak / mPace / mLandmark`.
  - `star(...)`, `svgEl(...)` — helpers.
  - `renderVals()` — builds the gallery + in-app data (category list, goals, sample
    `currents` per category).
> This is a "Design Component" HTML file; ignore the `<helmet>`/`<x-import>`/`DCLogic`
> wrappers — they're prototype scaffolding. Port the pure SVG-building methods.

## Recommended port
**Already done** — use `achievements.js` as described above. If you'd rather re-implement
natively (SwiftUI/Compose), mirror the same constants (`TIERS`, `CATEGORIES`) and the
`frame()` / `motif()` geometry; keep the unique-ID scheme for SVG def IDs if you stay on SVG.
