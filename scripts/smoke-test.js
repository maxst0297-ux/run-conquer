#!/usr/bin/env node
/* ============================================================================
   Smoke-Test — fängt kaputte Pushes des index.html-Monolithen ab, bevor sie
   deployt werden. Läuft in CI (.github/workflows/smoke.yml) und lokal:
     node scripts/smoke-test.js
   Prüft:
     1. Syntax aller Inline-<script>-Blöcke in index.html + promo
     2. Syntax von sw.js, territory.js und allen api/**-Handlern
     3. Existenz aller statisch referenzierten Assets
     4. Headless-Boot von index.html (keine PageErrors) — wenn ein Browser
        verfügbar ist (CI: playwright-Chromium; sonst wird Schritt 4 übersprungen)
   Exit-Code != 0 bei jedem Fehler.
   ========================================================================== */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
let failures = 0;
const fail = msg => { failures++; console.error('  ✗ ' + msg); };
const ok = msg => console.log('  ✓ ' + msg);

/* ── 1) Inline-Scripts extrahieren + Syntax prüfen ── */
function checkInlineScripts(file) {
  const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
  let m, i = 0;
  while ((m = re.exec(html))) {
    if (m[1].trim().length < 5) continue;
    const tmp = path.join(os.tmpdir(), `smoke_${path.basename(file)}_${i}.js`);
    fs.writeFileSync(tmp, m[1]);
    try { execFileSync(process.execPath, ['--check', tmp], { stdio: 'pipe' }); ok(`${file} <script #${i}> Syntax`); }
    catch (e) { fail(`${file} <script #${i}>: ${String(e.stderr).split('\n').slice(0, 3).join(' | ')}`); }
    i++;
  }
  if (!i) fail(`${file}: keine Inline-Scripts gefunden (unerwartet)`);
}
console.log('1) Inline-Script-Syntax');
checkInlineScripts('index.html');
checkInlineScripts('videos/Promo Slide/Promo Scroll.html');

/* ── 2) Eigenständige JS-Dateien ── */
console.log('2) JS-Dateien');
const jsFiles = ['sw.js', 'territory.js', 'rc-erfolg-icons.js'];
const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e =>
  e.isDirectory() ? walk(path.join(d, e.name)) : e.name.endsWith('.js') ? [path.join(d, e.name)] : []);
jsFiles.push(...walk(path.join(ROOT, 'api')).map(f => path.relative(ROOT, f)));
for (const f of jsFiles) {
  try { execFileSync(process.execPath, ['--check', path.join(ROOT, f)], { stdio: 'pipe' }); ok(f); }
  catch (e) { fail(`${f}: ${String(e.stderr).split('\n').slice(0, 2).join(' | ')}`); }
}

/* ── 3) Referenzierte Assets existieren ── */
console.log('3) Asset-Referenzen');
const assets = ['index.html', 'manifest.json', 'sw.js', 'territory.js', 'rc-erfolg-icons.js', 'privacy.html', 'promo.html',
  'bg.mp4', 'bg-poster.jpg', 'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png',
  'assets/logo/lyr_rc.png', 'assets/logo/lyr_crown.png', 'videos/Promo Slide/Promo Scroll.html'];
for (const a of assets) {
  if (fs.existsSync(path.join(ROOT, a))) ok(a);
  else fail(`fehlt: ${a} (wird von index.html/CI referenziert)`);
}

/* ── 4) Headless-Boot (optional, wenn Browser verfügbar) ── */
async function browserBoot() {
  let chromium, exe;
  try { ({ chromium } = require('playwright')); }
  catch { try { ({ chromium } = require('playwright-core')); exe = process.env.PW_EXE; if (!exe) { console.log('4) Headless-Boot: playwright-core ohne PW_EXE — übersprungen'); return; } }
  catch { console.log('4) Headless-Boot: kein playwright installiert — übersprungen'); return; } }
  console.log('4) Headless-Boot');
  const b = await chromium.launch(exe ? { executablePath: exe, args: ['--no-sandbox'] } : { args: ['--no-sandbox'] });
  const p = await (await b.newContext()).newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.join(ROOT, 'index.html'), { waitUntil: 'load' });
  await p.waitForTimeout(2000);
  const probes = await p.evaluate(() => ({
    views: document.querySelectorAll('.view').length,
    nav: document.querySelectorAll('.nav-item').length,
    onboarding: !!document.getElementById('onboarding'),
  }));
  await b.close();
  if (errs.length) fail('PageErrors beim Boot: ' + errs.slice(0, 3).join(' | '));
  else ok('Boot ohne PageErrors');
  if (probes.views >= 4 && probes.nav >= 4 && probes.onboarding) ok(`DOM-Grundgerüst (views=${probes.views}, nav=${probes.nav})`);
  else fail('DOM-Grundgerüst unvollständig: ' + JSON.stringify(probes));
}

browserBoot().then(() => {
  console.log(failures ? `\nFEHLGESCHLAGEN: ${failures} Problem(e)` : '\nALLE CHECKS BESTANDEN ✅');
  process.exit(failures ? 1 : 0);
}).catch(e => { console.error('Smoke-Test-Crash:', e.message); process.exit(1); });
