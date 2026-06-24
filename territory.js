/* ============================================================
   RUNNERS CONQUER — Territory Renderer (share card hero)
   ------------------------------------------------------------
   Pure, dependency-free. Turns a closed boundary polygon (the
   enclosed area a run conquered) into an isometric, neon-glowing
   3D "claimed territory" SVG, with a faint street map inside and
   a planted flag at the centre.

   ── Integration (Claude Code) ─────────────────────────────
   const svg = RC.renderTerritory({
     points: hullToLocalXY(run.routeLatLng),  // [[x,y], …] closed-ish
     accent: '#9B5DE5',                        // user-chosen colour
     width: 1080, height: 860
   });
   document.querySelector('#hero').innerHTML = svg;

   `points` are ground-plane coordinates in ANY units (metres,
   normalised, px). The renderer auto-centres + scales to fit.
   To feed real GPS: project lat/lng → local metres (equirect is
   fine for a single run), take the run's enclosed-area hull, pass
   the ring here. Order doesn't matter; winding is normalised.
   ============================================================ */
(function (global) {
  'use strict';

  // ── tiny seeded PRNG so the demo shape is stable ──────────
  function rng(seed) {
    let s = seed >>> 0;
    return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  }

  /* Generate an organic, street-blocky territory ring.
     Smooth radial noise, then snap to a grid so edges read as
     city blocks (the jagged "conquered district" look). */
  function generateTerritory(seed, n) {
    const rnd = rng(seed || 7);
    const N = n || 46;
    const raw = [];
    const p1 = rnd() * 6.28, p2 = rnd() * 6.28, p3 = rnd() * 6.28;
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2;
      const r =
        0.70 +
        0.30 * Math.sin(a * 1 + p1) * 0.5 +
        0.22 * Math.sin(a * 2 + p2) +
        0.12 * Math.sin(a * 3 + p3) +
        0.06 * (rnd() - 0.5) * 2;
      raw.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
    // snap to grid → blocky outline
    const g = 0.085;
    return raw.map(([x, y]) => [Math.round(x / g) * g, Math.round(y / g) * g]);
  }

  function centroid(pts) {
    let x = 0, y = 0;
    for (const p of pts) { x += p[0]; y += p[1]; }
    return [x / pts.length, y / pts.length];
  }

  function esc(s) { return String(s); }

  /* convert "#rrggbb" → "r,g,b" */
  function rgbOf(hex) {
    const h = hex.replace('#', '');
    const v = h.length === 3
      ? h.split('').map(c => c + c).join('')
      : h;
    const n = parseInt(v, 16);
    return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
  }

  function renderTerritory(opts) {
    opts = opts || {};
    const W = opts.width || 1080;
    const H = opts.height || 860;
    const accent = opts.accent || '#9B5DE5';
    const rgb = rgbOf(accent);
    const glow = opts.glow == null ? 1 : opts.glow;          // 0..1.6
    const showMap = opts.showMap !== false;
    const showFlag = opts.showFlag !== false;
    const rotZ = (opts.rotate == null ? -32 : opts.rotate) * Math.PI / 180;
    const tilt = opts.tilt == null ? 0.52 : opts.tilt;        // y foreshorten
    const id = 't' + Math.random().toString(36).slice(2, 8);

    const boundary = (opts.points && opts.points.length > 2)
      ? opts.points.slice()
      : generateTerritory(opts.seed, opts.detail);

    // ── ground → screen projection (gentle iso / tilt-back) ──
    const ca = Math.cos(rotZ), sa = Math.sin(rotZ);
    function proj(gx, gy) {
      const rx = gx * ca - gy * sa;
      const ry = gx * sa + gy * ca;
      return [rx, ry * tilt];
    }

    const rawB = boundary.map(p => proj(p[0], p[1]));

    // fit transform from boundary bbox
    let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
    for (const [x, y] of rawB) {
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
    const bw = maxX - minX || 1, bh = maxY - minY || 1;
    const depth = (opts.depth == null ? 46 : opts.depth);
    const scale = Math.min((W * 0.84) / bw, (H * 0.50) / bh);
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    const ox = W / 2, oy = H * 0.575;
    const T = (p) => [ (p[0] - cx) * scale + ox, (p[1] - cy) * scale + oy ];

    const top = rawB.map(T);
    const bot = top.map(p => [p[0], p[1] + depth]);
    const ptsStr = a => a.map(p => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');

    // ── side walls (front-facing edges show below the face) ──
    let walls = '';
    for (let i = 0; i < top.length; i++) {
      const j = (i + 1) % top.length;
      // only front edges (going left→right along lower hull) read; draw all,
      // face covers the back ones.
      const quad = [top[i], top[j], bot[j], bot[i]];
      walls += `<polygon points="${ptsStr(quad)}" fill="url(#${id}-wall)"/>`;
    }

    // ── street map inside (clipped to top face) ──────────────
    let streets = '';
    if (showMap) {
      const c = centroid(boundary);
      const maxR = Math.max(bw, bh) * 1.4;
      const seg = [];
      // rotated grid
      const ga = 0.26, gc = Math.cos(ga), gs = Math.sin(ga);
      const step = maxR / 7;
      for (let k = -8; k <= 8; k++) {
        const d = k * step;
        seg.push([[c[0] + d * gc - maxR * gs, c[1] + d * gs + maxR * gc],
                  [c[0] + d * gc + maxR * gs, c[1] + d * gs - maxR * gc]]);
        seg.push([[c[0] - maxR * gc - d * gs, c[1] - maxR * gs + d * gc],
                  [c[0] + maxR * gc - d * gs, c[1] + maxR * gs + d * gc]]);
      }
      // radial avenues from an off-centre town core
      const core = [c[0] + bw * 0.08, c[1] - bh * 0.05];
      for (let k = 0; k < 7; k++) {
        const a = (k / 7) * Math.PI * 2 + 0.4;
        seg.push([core, [core[0] + Math.cos(a) * maxR, core[1] + Math.sin(a) * maxR]]);
      }
      // two ring roads
      for (const rr of [0.28, 0.55]) {
        const ring = [];
        for (let k = 0; k <= 28; k++) {
          const a = (k / 28) * Math.PI * 2;
          ring.push([core[0] + Math.cos(a) * maxR * rr, core[1] + Math.sin(a) * maxR * rr]);
        }
        for (let k = 0; k < ring.length - 1; k++) seg.push([ring[k], ring[k + 1]]);
      }
      let lines = '';
      for (const s of seg) {
        const a = T(proj(s[0][0], s[0][1])), b = T(proj(s[1][0], s[1][1]));
        lines += `<line x1="${a[0].toFixed(1)}" y1="${a[1].toFixed(1)}" x2="${b[0].toFixed(1)}" y2="${b[1].toFixed(1)}"/>`;
      }
      streets =
        `<g clip-path="url(#${id}-clip)">` +
        `<g stroke="rgba(255,255,255,.07)" stroke-width="1.4">${lines}</g>` +
        `<g stroke="rgba(${rgb},.16)" stroke-width="2.2">${lines}</g>` +
        `</g>`;
    }

    // ── flag at centroid, drawn upright ──────────────────────
    let flag = '';
    if (showFlag) {
      const cg = T(proj(...centroid(boundary)));
      const fx = cg[0], fy = cg[1];
      const ph = Math.max(96, scale * 0.42);    // pole height
      const fw = ph * 0.46;                      // pennant width
      const pw = Math.max(5, ph * 0.05);
      flag =
        `<g filter="url(#${id}-flagsh)">` +
        // base glow on ground
        `<ellipse cx="${fx}" cy="${fy}" rx="${(pw * 2.6).toFixed(1)}" ry="${(pw * 1.1).toFixed(1)}" fill="rgba(${rgb},.5)"/>` +
        // pole
        `<rect x="${(fx - pw / 2).toFixed(1)}" y="${(fy - ph).toFixed(1)}" width="${pw.toFixed(1)}" height="${ph.toFixed(1)}" rx="${(pw / 2).toFixed(1)}" fill="#fff"/>` +
        // pennant (waving)
        `<path d="M ${(fx + pw / 2).toFixed(1)} ${(fy - ph).toFixed(1)} ` +
        `q ${(fw * 0.5).toFixed(1)} ${(ph * 0.07).toFixed(1)} ${fw.toFixed(1)} 0 ` +
        `q ${(-fw * 0.18).toFixed(1)} ${(ph * 0.14).toFixed(1)} 0 ${(ph * 0.28).toFixed(1)} ` +
        `q ${(-fw * 0.5).toFixed(1)} ${(ph * 0.07).toFixed(1)} ${(-fw).toFixed(1)} 0 Z" fill="#fff"/>` +
        `</g>`;
    }

    const gw = (4 + glow * 7);
    // ground halo behind everything
    const halo =
      `<ellipse cx="${ox}" cy="${(oy + depth * 0.4).toFixed(1)}" rx="${(bw * scale * 0.62).toFixed(1)}" ry="${(bh * scale * 0.5).toFixed(1)}" fill="url(#${id}-halo)"/>`;

    return `
<svg viewBox="0 0 ${W} ${H}" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" fill="none" style="overflow:visible">
  <defs>
    <clipPath id="${id}-clip"><polygon points="${ptsStr(top)}"/></clipPath>
    <linearGradient id="${id}-wall" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="rgba(${rgb},.55)"/>
      <stop offset="1" stop-color="rgba(${rgb},0)"/>
    </linearGradient>
    <radialGradient id="${id}-halo" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="rgba(${rgb},.30)"/>
      <stop offset="1" stop-color="rgba(${rgb},0)"/>
    </radialGradient>
    <linearGradient id="${id}-face" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="rgba(8,14,12,.42)"/>
      <stop offset="1" stop-color="rgba(4,8,7,.66)"/>
    </linearGradient>
    <filter id="${id}-glow" x="-60%" y="-60%" width="220%" height="220%">
      <feGaussianBlur stdDeviation="${(2 + glow * 5).toFixed(1)}" result="b1"/>
      <feMerge><feMergeNode in="b1"/><feMergeNode in="b1"/></feMerge>
    </filter>
    <filter id="${id}-flagsh" x="-60%" y="-60%" width="220%" height="220%">
      <feDropShadow dx="0" dy="6" stdDeviation="8" flood-color="#000" flood-opacity="0.55"/>
    </filter>
  </defs>

  ${halo}
  ${walls}

  <!-- top face -->
  <polygon points="${ptsStr(top)}" fill="url(#${id}-face)"/>
  ${streets}

  <!-- glowing conquered border -->
  <g filter="url(#${id}-glow)">
    <polygon points="${ptsStr(top)}" stroke="${accent}" stroke-width="${gw.toFixed(1)}" stroke-linejoin="round"/>
  </g>
  <polygon points="${ptsStr(top)}" stroke="#fff" stroke-opacity="0.9" stroke-width="2" stroke-linejoin="round"/>
  <polygon points="${ptsStr(top)}" stroke="${accent}" stroke-width="3.5" stroke-linejoin="round"/>

  ${flag}
</svg>`;
  }

  global.RC = global.RC || {};
  global.RC.renderTerritory = renderTerritory;
  global.RC.generateTerritory = generateTerritory;
})(window);
