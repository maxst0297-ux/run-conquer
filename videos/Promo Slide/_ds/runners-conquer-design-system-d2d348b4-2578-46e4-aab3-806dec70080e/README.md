# Runners Conquer — Design System

**Runners Conquer** (codebase name *Run & Conquer*, product vision *ConqRun*) is a
location‑based running app that is evolving into a **persistent real‑world strategy
game**. You run in the physical world; the app turns your routes into **conquered
territory** on a live map. The long‑term thesis: every feature must amplify a feeling of
**ownership, discovery, status, rivalry or conquest** — it should feel less like a fitness
tracker and more like an MMO played with your legs.

The product is German‑language first (`lang="de"`). Core loop: start a run → GPS draws your
path → enclosed area becomes your territory → defend it, raid rivals, claim landmarks,
climb the seasonal leaderboard.

### Signature look
A **dynamic, sporty, Strava‑adjacent** aesthetic: a near‑black **deep‑forest‑green** canvas
lit by an electric **citrus‑lime** accent, condensed **Bebas Neue** numerals stacked on
clean **Poppins** body text, and **conquest gold** reserved for crowns, rulers and
legendary tiers. Modern, high‑contrast, game‑like — but uncluttered.

---

## Sources

This system was reverse‑engineered from the founder's repositories. If you have access,
explore them for deeper fidelity — the live app is the ground truth for every component.

- **App + marketing (primary):** https://github.com/maxst0297-ux/run-conquer
  - `index.html` — the entire PWA (map, dashboard, community, profile, settings, the new
    ConqRun conquest systems). The token block, component CSS and game constants here are
    the source of truth.
  - `promo.html` — a scene‑based animated marketing intro (splash → map → conquest → stats
    → quests → app showcase → leaderboard → CTA).
  - `supabase_schema.sql` — backend tables (`profiles`, `runs`, `support_messages`).
- Other repos on the account (`maxst0297-ux/Liste`, `maxst0297-ux/Max`) were **not** used —
  they appear unrelated to this product.
- **Logo:** supplied by the user (`assets/logo-full.png`) — crown + "RC" monogram with a
  sprinting figure, "RUNNERS / CONQUER" wordmark, gold + white on black.

> The app is a single self‑contained HTML file using **Leaflet** (maps + heatmap),
> **Turf.js** (territory geometry), **Chart.js** (weekly graphs), **Font Awesome 6.4**
> (icons) and **Supabase** (auth + sync). Fonts are **Bebas Neue** + **Poppins** from
> Google Fonts.

---

## Content fundamentals

**Language.** German, informal **du** ("Tritt an!", "Halte dein Revier", "Bleib dran!").
Direct, motivating, a little competitive — it talks to you like a coach who wants you to
win turf.

**Voice & tone.** Punchy and game‑y. Short imperative calls to action. Conquest vocabulary
sits next to running vocabulary: *erobern* (conquer), *verteidigen* (defend), *Revier*
(turf), *Herrscher* (ruler), *Gebiet* (territory), *Wahrzeichen* (landmark), *Saison*
(season). Taglines are three stamped verbs: **"Lauf · Erobere · Verteidige."**

**Casing.** Display type and labels are **UPPERCASE** with wide tracking (Bebas Neue):
`RANGLISTE`, `WOCHENZIEL`, `PROFIL BEARBEITEN`, `JETZT SPIELEN`. Body copy is sentence
case in Poppins. Numbers are king — stats (km, points, streak, m²) are set large in Bebas
Neue and tinted with the primary accent.

**Ruler titles** (status ladder, by amount of territory controlled):
`Neuling → Besitzer → Baron → Herzog → König → Imperator`.

**Rarity labels** (streets / landmarks):
`Gewöhnlich → Selten → Episch → Legendär`.

**Emoji & symbols.** Emoji are used **functionally and liberally** as compact glyphs — as
user avatars (🏃 🤸 🏋️ ⚡), in leaderboard rows, on quest rewards (🎁), badges (🏆 🔥 ⚔️
🛡️ 🗺️ 👑) and toasts ("🏆 Saison Juni abgeschlossen!"). This is part of the brand's casual,
game‑y energy — keep it, but don't let emoji replace the Font Awesome UI icon set (below).
Mid‑dot separators (`·`) join short stat fragments: `48.200 m² · 7🔥`.

**Numbers.** German formatting — thousands with `.` ("4.280", "48.200 m²"), decimals with
`,` in copy though the app often uses `.` for paces ("5:12 /km"). Distances in km, area in
m², pace in min/km, heart rate in bpm.

---

## Visual foundations

**Color.** A dark, saturated **forest‑green** base (`--bg #042D22`) — *not* pure black; it
reads sporty and outdoorsy rather than techy. Cards step up one notch to `#0D3D2C`. The hero
accent is **citrus‑lime `#E6FF55`**, used for every value, active state, primary button and
glow. **Conquest gold `#FFD700`** is the status color — crowns, ruler badges, the logo,
legendary tier. Status trio: rival/attack **red `#FF4D6D`**, success/defend **green
`#10B981`**, info/rare **cyan `#00D4FF`**; epic tier adds **purple `#9B5DE5`**. Three
alternate themes ship (Stone — light; Pine — sage/butter; Petrol — sand/blue) but **Citrus
is the signature**.

**Type.** Two families only. **Bebas Neue** (condensed, all‑caps, tracked ~2px) for every
heading, logo, stat and button label — it carries the athletic, scoreboard feel. **Poppins**
(400–800) for body, labels and inputs. Labels are tiny (.58–.65rem), uppercase, tracked,
in `--muted`. The contrast of huge condensed numerals against small tracked labels is the
core typographic move.

**Backgrounds.** Flat solid surfaces — no busy imagery behind content. The map (dark
Leaflet tiles) is the one full‑bleed surface. Profile banners use a subtle dark green
diagonal **gradient** with a faint SVG topographic line texture. The promo uses radial vignettes
and a few decorative glows; the app itself stays flat and calm so data pops.

**Cards.** `background:var(--card)`, `1px solid var(--border)` (white at 9% on dark themes),
`border-radius:16px`, generous padding (12–16px). No heavy drop shadows inside the app —
elevation comes from the lighter card fill against the darker bg. Floating/modal surfaces
use `--shadow-pop` and a grabber handle.

**Buttons.** Primary = solid `--primary` fill with `--bg` (dark green) text, Bebas Neue,
tracked, radius 14px. Secondary = `--card` fill, `--border`, `--text`. Pills (fly‑to,
badges, tabs) use `border-radius:40px`. The big CTA can carry a pulsing lime glow.

**Press / hover.** Mobile‑first → **press states dominate**: buttons scale down
(`transform:scale(.96–.97)`) on `:active`. Active nav/tab items switch text to `--primary`
and reveal a 2px lime indicator (`scaleX` grow). Glowing buttons animate box‑shadow.

**Animation.** Springy, quick, purposeful. Entrances use
`cubic-bezier(.34,1.15,.64,1)` (slight overshoot) and staggered `--delay` per item; rows
fade+slide in (`translateX(8px)`). Counters tick up with cubic ease‑out. GPS trails draw via
`stroke-dashoffset`. Avatars/runners do a gentle infinite bounce. Conquest cells flash
white→lime when captured. Respect `prefers-reduced-motion` for static contexts.

**Transparency & blur.** The sticky header uses `backdrop-filter: blur(12px)` over a
translucent bg. Accent tints are built with `rgba(var(--primary-rgb), …)` at low alpha
(.04–.15) for soft fills and selected rows. Fog‑of‑war is a grey canvas overlay punched out
along run paths.

**Corner radii.** 16px cards, 12–14px inputs/buttons, 40px pills, full circles for
avatars/color swatches. Consistent and friendly.

**Imagery vibe.** Cool, dark, neon‑lit, night‑run energy. Map heatmaps glow lime→hot. No
photography in the core UI; the logo and emoji carry personality.

---

## Iconography

- **UI icon set: Font Awesome 6.4 (solid, `fas`)**, loaded from CDN. This is the app's only
  vector icon system — use it everywhere for interface chrome. Link:
  `https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css`.
  Core glyphs in use: `fa-map`, `fa-chart-pie`, `fa-globe`, `fa-user`, `fa-bars` (bottom
  nav); `fa-play / fa-pause / fa-stop / fa-running` (run controls); `fa-bolt`,
  `fa-heartbeat`, `fa-shoe-prints` (live metrics); `fa-crown` (Herrschaft / rulers),
  `fa-trophy`, `fa-medal`, `fa-star`, `fa-fire`, `fa-location-arrow`, `fa-cloud` (fog),
  `fa-fire` (heatmap), `fa-flag-checkered`, `fa-bullseye`, `fa-scroll`, `fa-cog`. Icons are
  tinted `--primary` when active/emphasised, `--muted` otherwise.
- **Emoji** are used as a *content* glyph layer (avatars, badges, rewards, toasts) — see
  Content fundamentals. They complement, not replace, Font Awesome.
- **No custom SVG icon set.** A few inline SVGs exist for decorative map/banner art only.
  Don't hand‑draw new icons — reach for Font Awesome first, emoji second.
- **Logo / brand mark:** in `assets/`. The header uses the **"RC"** lettermark in Bebas
  Neue tinted `--primary`; the splash/app icon uses the crown+monogram mark.

---

## Index — what's in this folder

| File | What it is |
|---|---|
| `README.md` | This document — context, sources, content + visual foundations, iconography. |
| `SKILL.md` | Agent‑Skill front‑matter so this system works inside Claude Code. |
| `colors_and_type.css` | All design tokens: theme color vars (Citrus + 3 alternates), tier/team colors, type scale, elevation, easing. **Import this first.** |
| `assets/` | Brand assets: `logo-full.png` (lockup), `logo-mark.png` (crown+monogram), `logo-wordmark.png`. |
| `preview/` | Small HTML specimen cards that populate the Design System tab (colors, type, spacing, components, brand). |
| `ui_kits/app/` | High‑fidelity recreation of the **ConqRun mobile app** — `index.html` (interactive click‑through of all 5 tabs) plus modular JSX components. Start here to build app mocks. |
| `_source/` | Imported originals (`app.html`, `promo.html`) for reference. Not part of the system. |

### Fonts
Both fonts are Google Fonts and load via the `@import` at the top of `colors_and_type.css`
(and a `<link>` in each kit). No local font files are bundled — if you need offline/PDF
output, download **Bebas Neue** and **Poppins** from Google Fonts into a `fonts/` folder.

### Build with these repos
For maximum fidelity, browse the live source at
**https://github.com/maxst0297-ux/run-conquer** — the real component CSS, game constants
(`RULER_TIERS`, `RARITY_COLORS`, raid timing) and screen markup live in `index.html`.
