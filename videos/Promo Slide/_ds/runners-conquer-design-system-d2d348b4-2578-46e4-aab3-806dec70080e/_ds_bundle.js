/* @ds-bundle: {"format":3,"namespace":"RunnersConquerDesignSystem_d2d348","components":[],"sourceHashes":{"ui_kits/app/app.jsx":"a6c8137a536f","ui_kits/app/components.jsx":"961bb9866d64","ui_kits/app/image-slot.js":"9309434cb09c","ui_kits/app/screens-map.jsx":"e15e8d186498","ui_kits/app/screens-social.jsx":"14af4a9791c7"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.RunnersConquerDesignSystem_d2d348 = window.RunnersConquerDesignSystem_d2d348 || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// ui_kits/app/app.jsx
try { (() => {
// ConqRun UI kit — root app
const {
  useState: useAppState,
  useEffect: useAppEffect,
  useRef: useAppRef
} = React;
function App() {
  const [started, setStarted] = useAppState(false);
  const [view, setView] = useAppState('map');
  const [player, setPlayer] = useAppState({
    name: 'Max_Runner',
    avatar: '🏃',
    color: '#E8FF47',
    level: 7
  });
  const [theme, setTheme] = useAppState('theme-citrus');
  const [team, setTeam] = useAppState('lime');
  const [running, setRunning] = useAppState(false);
  const [live, setLive] = useAppState({
    km: '0.00',
    time: '00:00',
    pace: '--:--',
    hr: '--',
    cad: '--'
  });
  const [toast, setToast] = useAppState('');
  const tRef = useAppRef(null);
  useAppEffect(() => {
    document.body.className = theme;
  }, [theme]);
  function showToast(msg) {
    setToast(msg);
    clearTimeout(tRef.current);
    tRef.current = setTimeout(() => setToast(''), 2600);
  }

  // fake live run ticker
  useAppEffect(() => {
    if (!running) return;
    let t = 0,
      km = 0;
    const id = setInterval(() => {
      t += 1;
      km += 0.0042 * (3 + Math.random());
      const m = String(Math.floor(t / 60)).padStart(2, '0'),
        s = String(t % 60).padStart(2, '0');
      setLive({
        km: km.toFixed(2),
        time: `${m}:${s}`,
        pace: (4 + Math.random() * 1.5).toFixed(2).replace('.', ':'),
        hr: 150 + Math.floor(Math.random() * 20),
        cad: 168 + Math.floor(Math.random() * 10)
      });
    }, 700);
    return () => clearInterval(id);
  }, [running]);
  function toggleRun() {
    if (running) {
      setRunning(false);
      showToast('⚔️ Gebiet erobert · +200 Punkte');
    } else {
      setRunning(true);
      setLive({
        km: '0.00',
        time: '00:00',
        pace: '5:14',
        hr: 152,
        cad: 172
      });
      showToast('🏃 Lauf gestartet · GPS aktiv');
    }
  }
  if (!started) {
    return /*#__PURE__*/React.createElement("div", {
      className: "screen"
    }, /*#__PURE__*/React.createElement("div", {
      className: "notch"
    }), /*#__PURE__*/React.createElement(Onboarding, {
      onStart: p => {
        setPlayer({
          ...player,
          ...p
        });
        setStarted(true);
      }
    }));
  }
  return /*#__PURE__*/React.createElement("div", {
    className: "screen"
  }, /*#__PURE__*/React.createElement("div", {
    className: "notch"
  }), /*#__PURE__*/React.createElement(AppHeader, {
    player: player,
    onSettings: () => setView('menu')
  }), /*#__PURE__*/React.createElement("div", {
    className: "toast" + (toast ? ' show' : '')
  }, toast), view === 'map' && /*#__PURE__*/React.createElement(MapScreen, {
    running: running,
    onToggleRun: toggleRun,
    live: live
  }), view === 'dash' && /*#__PURE__*/React.createElement(DashboardScreen, null), view === 'community' && /*#__PURE__*/React.createElement(CommunityScreen, null), view === 'profile' && /*#__PURE__*/React.createElement(ProfileScreen, {
    player: player,
    onEdit: () => setView('menu')
  }), view === 'menu' && /*#__PURE__*/React.createElement(MenuScreen, {
    player: player,
    theme: theme,
    onTheme: setTheme,
    team: team,
    onTeam: setTeam,
    onEdit: () => {}
  }), /*#__PURE__*/React.createElement(BottomNav, {
    view: view,
    onNav: setView
  }));
}
ReactDOM.createRoot(document.getElementById('root')).render(/*#__PURE__*/React.createElement(App, null));
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/app.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/components.jsx
try { (() => {
// ConqRun UI kit — primitives, chrome, onboarding, menu
const {
  useState
} = React;

/* ── Data ── */
const TEAMS = [{
  id: 'lime',
  name: 'Limonen',
  color: '#E8FF47',
  txt: '#042'
}, {
  id: 'red',
  name: 'Rote',
  color: '#FF4D6D',
  txt: '#fff'
}, {
  id: 'cyan',
  name: 'Cyane',
  color: '#00D4FF',
  txt: '#042'
}, {
  id: 'purple',
  name: 'Lila',
  color: '#9B5DE5',
  txt: '#fff'
}];
const THEMES = [{
  id: 'theme-citrus',
  name: 'Citrus',
  bg: '#042D22',
  dot: '#E6FF55'
}, {
  id: 'theme-stone',
  name: 'Stone',
  bg: '#F0EBE9',
  dot: '#36A372'
}, {
  id: 'theme-pine',
  name: 'Pine',
  bg: '#455B51',
  dot: '#FFF0A4'
}, {
  id: 'theme-petrol',
  name: 'Petrol',
  bg: '#F4E9D4',
  dot: '#326586'
}];
const AVATARS = ['🏃', '🤸', '🏋️', '⚡', '🦊', '🐺', '🦅', '🔥'];
const PLAYER_COLORS = ['#E8FF47', '#FF4D6D', '#00D4FF', '#9B5DE5', '#FF9F1C'];

/* ── Primitives ── */
function SectionHd({
  icon,
  children,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "sec-hd",
    style: style
  }, /*#__PURE__*/React.createElement("i", {
    className: "fas " + icon
  }), children);
}
function StatCard({
  v,
  l
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "stat-card"
  }, /*#__PURE__*/React.createElement("div", {
    className: "sv"
  }, v), /*#__PURE__*/React.createElement("div", {
    className: "sl"
  }, l));
}
function RulerBadge({
  title
}) {
  return /*#__PURE__*/React.createElement("span", {
    className: "ruler-badge"
  }, /*#__PURE__*/React.createElement("i", {
    className: "fas fa-crown"
  }), title);
}
function RarityTag({
  tier
}) {
  const map = {
    Selten: '#00D4FF',
    Episch: '#9B5DE5',
    'Legendär': '#FFD700',
    'Gewöhnlich': '#5A8A6E'
  };
  const c = map[tier];
  return /*#__PURE__*/React.createElement("span", {
    className: "rar-tag",
    style: {
      color: c,
      borderColor: c + '70',
      background: c + '1a'
    }
  }, tier);
}

/* ── Header ── */
function AppHeader({
  player,
  onSettings
}) {
  return /*#__PURE__*/React.createElement("header", {
    className: "app-hdr"
  }, /*#__PURE__*/React.createElement("img", {
    className: "hdr-logo-tile",
    src: "../../assets/logo-mark-t.png",
    alt: "Runners Conquer"
  }), /*#__PURE__*/React.createElement("span", {
    className: "hdr-badge"
  }, player.avatar, " ", player.name, " ", /*#__PURE__*/React.createElement("span", {
    className: "lv"
  }, "Lv.", player.level)), /*#__PURE__*/React.createElement("button", {
    className: "icon-btn",
    onClick: onSettings
  }, /*#__PURE__*/React.createElement("i", {
    className: "fas fa-cog"
  })));
}

/* ── Bottom nav ── */
const NAV = [{
  id: 'map',
  icon: 'fa-map',
  label: 'Karte'
}, {
  id: 'dash',
  icon: 'fa-chart-pie',
  label: 'Aktivität'
}, {
  id: 'community',
  icon: 'fa-globe',
  label: 'Community'
}, {
  id: 'profile',
  icon: 'fa-user',
  label: 'Profil'
}, {
  id: 'menu',
  icon: 'fa-bars',
  label: 'Menü'
}];
function BottomNav({
  view,
  onNav
}) {
  return /*#__PURE__*/React.createElement("nav", {
    className: "bottom-nav"
  }, NAV.map(n => /*#__PURE__*/React.createElement("div", {
    key: n.id,
    className: "nav-item" + (view === n.id ? " active" : ""),
    onClick: () => onNav(n.id)
  }, /*#__PURE__*/React.createElement("div", {
    className: "nav-ind"
  }), /*#__PURE__*/React.createElement("i", {
    className: "fas " + n.icon
  }), /*#__PURE__*/React.createElement("span", null, n.label))));
}

/* ── Onboarding ── */
function Onboarding({
  onStart
}) {
  const [tab, setTab] = useState('create');
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState('🏃');
  const [color, setColor] = useState('#E8FF47');
  const ready = name.trim().length > 1;
  return /*#__PURE__*/React.createElement("div", {
    className: "ob"
  }, /*#__PURE__*/React.createElement("img", {
    className: "ob-logo",
    src: "../../assets/logo-mark-t.png",
    alt: "Runners Conquer"
  }), /*#__PURE__*/React.createElement("div", {
    className: "ob-tagline"
  }, "Lauf \xB7 Erobere \xB7 Verteidige"), /*#__PURE__*/React.createElement("div", {
    className: "ob-card"
  }, /*#__PURE__*/React.createElement("div", {
    className: "av-row",
    style: {
      display: 'flex',
      gap: 6,
      marginBottom: 18
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn" + (tab === 'create' ? ' btn-p' : ''),
    onClick: () => setTab('create')
  }, "Neu"), /*#__PURE__*/React.createElement("button", {
    className: "btn" + (tab === 'login' ? ' btn-p' : ''),
    onClick: () => setTab('login')
  }, "Anmelden")), tab === 'create' ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "field"
  }, /*#__PURE__*/React.createElement("div", {
    className: "label",
    style: {
      marginBottom: 6
    }
  }, "Spielername"), /*#__PURE__*/React.createElement("input", {
    value: name,
    onChange: e => setName(e.target.value),
    placeholder: "z.B. Max_Runner"
  })), /*#__PURE__*/React.createElement("div", {
    className: "field"
  }, /*#__PURE__*/React.createElement("div", {
    className: "label",
    style: {
      marginBottom: 6
    }
  }, "Avatar"), /*#__PURE__*/React.createElement("div", {
    className: "av-row"
  }, AVATARS.map(a => /*#__PURE__*/React.createElement("div", {
    key: a,
    className: "av-opt" + (avatar === a ? ' sel' : ''),
    onClick: () => setAvatar(a)
  }, a)))), /*#__PURE__*/React.createElement("div", {
    className: "field"
  }, /*#__PURE__*/React.createElement("div", {
    className: "label",
    style: {
      marginBottom: 6
    }
  }, "Deine Farbe"), /*#__PURE__*/React.createElement("div", {
    className: "col-row"
  }, PLAYER_COLORS.map(c => /*#__PURE__*/React.createElement("div", {
    key: c,
    className: "col-opt" + (color === c ? ' sel' : ''),
    style: {
      background: c
    },
    onClick: () => setColor(c)
  })))), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-p glow",
    style: {
      width: '100%',
      padding: 16,
      fontSize: '1.2rem',
      marginTop: 6
    },
    disabled: !ready,
    onClick: () => onStart({
      name: name.trim() || 'Läufer',
      avatar,
      color
    })
  }, "LOSLEGEN \u2192")) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "field"
  }, /*#__PURE__*/React.createElement("div", {
    className: "label",
    style: {
      marginBottom: 6
    }
  }, "E-Mail"), /*#__PURE__*/React.createElement("input", {
    placeholder: "du@email.de"
  })), /*#__PURE__*/React.createElement("div", {
    className: "field"
  }, /*#__PURE__*/React.createElement("div", {
    className: "label",
    style: {
      marginBottom: 6
    }
  }, "Passwort"), /*#__PURE__*/React.createElement("input", {
    type: "password",
    placeholder: "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"
  })), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-p glow",
    style: {
      width: '100%',
      padding: 16,
      fontSize: '1.2rem',
      marginTop: 6
    },
    onClick: () => onStart({
      name: 'Max_Runner',
      avatar: '🏃',
      color: '#E8FF47'
    })
  }, "ANMELDEN \u2192"))));
}

/* ── Menu / Settings ── */
function MenuScreen({
  player,
  theme,
  onTheme,
  team,
  onTeam,
  onEdit
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "view"
  }, /*#__PURE__*/React.createElement("div", {
    className: "pad"
  }, /*#__PURE__*/React.createElement(SectionHd, {
    icon: "fa-palette",
    style: {
      marginTop: 4
    }
  }, "Theme"), /*#__PURE__*/React.createElement("div", {
    className: "theme-grid"
  }, THEMES.map(t => /*#__PURE__*/React.createElement("div", {
    key: t.id,
    className: "theme-opt" + (theme === t.id ? ' sel' : ''),
    onClick: () => onTheme(t.id)
  }, /*#__PURE__*/React.createElement("div", {
    className: "theme-sw",
    style: {
      background: t.bg
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "dot",
    style: {
      background: t.dot
    }
  })), /*#__PURE__*/React.createElement("div", {
    className: "theme-cap",
    style: {
      color: 'var(--primary)'
    }
  }, t.name)))), /*#__PURE__*/React.createElement(SectionHd, {
    icon: "fa-shield-halved"
  }, "Dein Team"), /*#__PURE__*/React.createElement("div", {
    className: "team-grid"
  }, TEAMS.map(t => /*#__PURE__*/React.createElement("div", {
    key: t.id,
    className: "team-opt" + (team === t.id ? ' sel' : ''),
    style: {
      background: t.color,
      color: t.txt
    },
    onClick: () => onTeam(t.id)
  }, "\u2694\uFE0F ", t.name))), /*#__PURE__*/React.createElement(SectionHd, {
    icon: "fa-gear"
  }, "Konto"), /*#__PURE__*/React.createElement("div", {
    className: "card",
    style: {
      padding: '2px 16px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "menu-row",
    onClick: onEdit
  }, /*#__PURE__*/React.createElement("i", {
    className: "fas fa-user-pen"
  }), " Profil bearbeiten ", /*#__PURE__*/React.createElement("i", {
    className: "fas fa-chevron-right chev"
  })), /*#__PURE__*/React.createElement("div", {
    className: "menu-row"
  }, /*#__PURE__*/React.createElement("i", {
    className: "fas fa-bell"
  }), " Benachrichtigungen ", /*#__PURE__*/React.createElement("i", {
    className: "fas fa-chevron-right chev"
  })), /*#__PURE__*/React.createElement("div", {
    className: "menu-row"
  }, /*#__PURE__*/React.createElement("i", {
    className: "fas fa-share-nodes"
  }), " Erfolge teilen ", /*#__PURE__*/React.createElement("i", {
    className: "fas fa-chevron-right chev"
  })), /*#__PURE__*/React.createElement("div", {
    className: "menu-row"
  }, /*#__PURE__*/React.createElement("i", {
    className: "fas fa-circle-question"
  }), " Support ", /*#__PURE__*/React.createElement("i", {
    className: "fas fa-chevron-right chev"
  })), /*#__PURE__*/React.createElement("div", {
    className: "menu-row",
    style: {
      borderBottom: 'none',
      color: 'var(--red)'
    }
  }, /*#__PURE__*/React.createElement("i", {
    className: "fas fa-right-from-bracket",
    style: {
      color: 'var(--red)'
    }
  }), " Abmelden"))));
}
Object.assign(window, {
  TEAMS,
  THEMES,
  AVATARS,
  PLAYER_COLORS,
  SectionHd,
  StatCard,
  RulerBadge,
  RarityTag,
  AppHeader,
  BottomNav,
  NAV,
  Onboarding,
  MenuScreen
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/components.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/image-slot.js
try { (() => {
// @ds-adherence-ignore -- omelette starter scaffold (raw elements/hex/px by design)
/* BEGIN USAGE */
/**
 * <image-slot> — user-fillable image placeholder.
 *
 * Drop this into a deck, mockup, or page wherever you want the user to
 * supply an image. You control the slot's shape and size; the user fills it
 * by dragging an image file onto it (or clicking to browse). The dropped
 * image persists across reloads via a .image-slots.state.json sidecar —
 * same read-via-fetch / write-via-window.omelette pattern as
 * design_canvas.jsx, so the filled slot shows on share links, downloaded
 * zips, and PPTX export. Outside the omelette runtime the slot is read-only.
 *
 * The host bridge only allows sidecar writes at the project root, so the
 * HTML that uses this component is assumed to live at the project root too
 * (same constraint as design_canvas.jsx).
 *
 * Attributes:
 *   id           Persistence key. REQUIRED for the drop to survive reload —
 *                every slot on the page needs a distinct id.
 *   shape        'rect' | 'rounded' | 'circle' | 'pill'   (default 'rounded')
 *                'circle' applies 50% border-radius; on a non-square slot
 *                that's an ellipse — set equal width and height for a true
 *                circle.
 *   radius       Corner radius in px for 'rounded'.       (default 12)
 *   mask         Any CSS clip-path value. Overrides `shape` — use this for
 *                hexagons, blobs, arbitrary polygons.
 *   fit          object-fit: cover | contain | fill.       (default 'cover')
 *                With cover (the default) double-clicking the filled slot
 *                enters a reframe mode: the whole image spills past the mask
 *                (translucent outside, opaque inside), drag to reposition,
 *                corner-drag to scale. The crop persists alongside the image
 *                in the sidecar. contain/fill stay static.
 *   position     object-position for fit=contain|fill.     (default '50% 50%')
 *   placeholder  Empty-state caption.                      (default 'Drop an image')
 *   src          Optional initial/fallback image URL. A user drop overrides
 *                it; clearing the drop reveals src again.
 *
 * Size and layout come from ordinary CSS on the element — width/height
 * inline or from a parent grid — so it composes with any layout.
 *
 * Usage:
 *   <image-slot id="hero"   style="width:800px;height:450px" shape="rounded" radius="20"
 *               placeholder="Drop a hero image"></image-slot>
 *   <image-slot id="avatar" style="width:120px;height:120px" shape="circle"></image-slot>
 *   <image-slot id="kite"   style="width:300px;height:300px"
 *               mask="polygon(50% 0, 100% 50%, 50% 100%, 0 50%)"></image-slot>
 */
/* END USAGE */

(() => {
  const STATE_FILE = '.image-slots.state.json';
  // 2× a ~600px slot in a 1920-wide deck — retina-sharp without making the
  // sidecar enormous. A 1200px WebP at q=0.85 is ~150-300KB.
  const MAX_DIM = 1200;
  // Raster formats only. SVG is excluded (can carry script; createImageBitmap
  // on SVG blobs is inconsistent). GIF is excluded because the canvas
  // re-encode keeps only the first frame, so an animated GIF would silently
  // go still — better to reject than surprise.
  const ACCEPT = ['image/png', 'image/jpeg', 'image/webp', 'image/avif'];

  // ── Shared sidecar store ────────────────────────────────────────────────
  // One fetch + immediate write-on-change for every <image-slot> on the
  // page. Reads via fetch() so viewing works anywhere the HTML and sidecar
  // are served together; writes go through window.omelette.writeFile, which
  // the host allowlists to *.state.json basenames only.
  const subs = new Set();
  let slots = {};
  // ids explicitly cleared before the sidecar fetch resolved — otherwise
  // the merge below can't tell "never set" from "just deleted" and would
  // resurrect the sidecar's stale value.
  const tombstones = new Set();
  let loaded = false;
  let loadP = null;
  function load() {
    if (loadP) return loadP;
    loadP = fetch(STATE_FILE).then(r => r.ok ? r.json() : null).then(j => {
      // Merge: sidecar loses to any in-memory change that raced ahead of
      // the fetch (drop or clear) so neither is clobbered by hydration.
      if (j && typeof j === 'object') {
        const merged = Object.assign({}, j, slots);
        // A framing-only write that raced ahead of hydration must not
        // drop a user image that's only on disk — inherit u from the
        // sidecar for any in-memory entry that lacks one.
        for (const k in slots) {
          if (merged[k] && !merged[k].u && j[k]) {
            merged[k].u = typeof j[k] === 'string' ? j[k] : j[k].u;
          }
        }
        for (const id of tombstones) delete merged[id];
        slots = merged;
      }
      tombstones.clear();
    }).catch(() => {}).then(() => {
      loaded = true;
      subs.forEach(fn => fn());
    });
    return loadP;
  }

  // Serialize writes so two near-simultaneous drops on different slots
  // can't reorder at the backend and leave the sidecar with only the
  // first. A save requested mid-flight just marks dirty and re-fires on
  // completion with the then-current slots.
  let saving = false;
  let saveDirty = false;
  function save() {
    if (saving) {
      saveDirty = true;
      return;
    }
    const w = window.omelette && window.omelette.writeFile;
    if (!w) return;
    saving = true;
    Promise.resolve(w(STATE_FILE, JSON.stringify(slots))).catch(() => {}).then(() => {
      saving = false;
      if (saveDirty) {
        saveDirty = false;
        save();
      }
    });
  }
  const S_MAX = 5;
  const clampS = s => Math.max(1, Math.min(S_MAX, s));

  // Normalize a stored slot value. Pre-reframe sidecars stored a bare
  // data-URL string; newer ones store {u, s, x, y}. Either shape is valid.
  function getSlot(id) {
    const v = slots[id];
    if (!v) return null;
    return typeof v === 'string' ? {
      u: v,
      s: 1,
      x: 0,
      y: 0
    } : v;
  }
  function setSlot(id, val) {
    if (!id) return;
    if (val) {
      slots[id] = val;
      tombstones.delete(id);
    } else {
      delete slots[id];
      if (!loaded) tombstones.add(id);
    }
    subs.forEach(fn => fn());
    // A drop is rare + high-value — write immediately so nav-away can't lose
    // it. Gate on the initial read so we don't overwrite a sidecar we haven't
    // merged yet; the merge in load() keeps this change once the read lands.
    if (loaded) save();else load().then(save);
  }

  // ── Image downscale ─────────────────────────────────────────────────────
  // Encode through a canvas so the sidecar carries resized bytes, not the
  // raw upload. Longest side is capped at 2× the slot's rendered width
  // (retina) and at MAX_DIM. WebP keeps alpha and is ~10× smaller than PNG
  // for photos, so there's no need for per-image format picking.
  async function toDataUrl(file, targetW) {
    const bitmap = await createImageBitmap(file);
    try {
      const cap = Math.min(MAX_DIM, Math.max(1, Math.round(targetW * 2)) || MAX_DIM);
      const scale = Math.min(1, cap / Math.max(bitmap.width, bitmap.height));
      const w = Math.max(1, Math.round(bitmap.width * scale));
      const h = Math.max(1, Math.round(bitmap.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d').drawImage(bitmap, 0, 0, w, h);
      return canvas.toDataURL('image/webp', 0.85);
    } finally {
      bitmap.close && bitmap.close();
    }
  }

  // ── Custom element ──────────────────────────────────────────────────────
  const stylesheet = ':host{display:inline-block;position:relative;vertical-align:top;' + '  font:13px/1.3 system-ui,-apple-system,sans-serif;color:rgba(0,0,0,.55);width:240px;height:160px}' + '.frame{position:absolute;inset:0;overflow:hidden;background:rgba(0,0,0,.04)}' +
  // .frame img (clipped) and .spill (unclipped ghost + handles) share the
  // same left/top/width/height in frame-%, computed by _applyView(), so the
  // inside-mask crop and the outside-mask spill stay pixel-aligned.
  '.frame img{position:absolute;max-width:none;transform:translate(-50%,-50%);' + '  -webkit-user-drag:none;user-select:none;touch-action:none}' +
  // Reframe mode (double-click): the full image spills past the mask. The
  // spill layer is sized to the IMAGE bounds so its corners are where the
  // resize handles belong. The ghost <img> inside is translucent; the real
  // clipped <img> underneath shows the opaque in-mask crop.
  '.spill{position:absolute;transform:translate(-50%,-50%);display:none;z-index:1;' + '  cursor:grab;touch-action:none}' + ':host([data-panning]) .spill{cursor:grabbing}' + '.spill .ghost{position:absolute;inset:0;width:100%;height:100%;opacity:.35;' + '  pointer-events:none;-webkit-user-drag:none;user-select:none;' + '  box-shadow:0 0 0 1px rgba(0,0,0,.2),0 12px 32px rgba(0,0,0,.2)}' + '.spill .handle{position:absolute;width:12px;height:12px;border-radius:50%;' + '  background:#fff;box-shadow:0 0 0 1.5px #c96442,0 1px 3px rgba(0,0,0,.3);' + '  transform:translate(-50%,-50%)}' + '.spill .handle[data-c=nw]{left:0;top:0;cursor:nwse-resize}' + '.spill .handle[data-c=ne]{left:100%;top:0;cursor:nesw-resize}' + '.spill .handle[data-c=sw]{left:0;top:100%;cursor:nesw-resize}' + '.spill .handle[data-c=se]{left:100%;top:100%;cursor:nwse-resize}' + ':host([data-reframe]){z-index:10}' + ':host([data-reframe]) .spill{display:block}' + ':host([data-reframe]) .frame{box-shadow:0 0 0 2px #c96442}' + '.empty{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;' + '  justify-content:center;gap:6px;text-align:center;padding:12px;box-sizing:border-box;' + '  cursor:pointer;user-select:none}' + '.empty svg{opacity:.45}' + '.empty .cap{max-width:90%;font-weight:500;letter-spacing:.01em}' + '.empty .sub{font-size:11px}' + '.empty .sub u{text-underline-offset:2px;text-decoration-color:rgba(0,0,0,.25)}' + '.empty:hover .sub u{color:rgba(0,0,0,.75);text-decoration-color:currentColor}' + ':host([data-over]) .frame{outline:2px solid #c96442;outline-offset:-2px;' + '  background:rgba(201,100,66,.10)}' + '.ring{position:absolute;inset:0;pointer-events:none;border:1.5px dashed rgba(0,0,0,.25);' + '  transition:border-color .12s}' + ':host([data-over]) .ring{border-color:#c96442}' + ':host([data-filled]) .ring{display:none}' +
  // Controls sit BELOW the mask (top:100%), absolutely positioned so the
  // author-declared slot height is unaffected. The gap is padding, not a
  // top offset, so the hover target stays contiguous with the frame.
  '.ctl{position:absolute;top:100%;left:50%;transform:translateX(-50%);padding-top:8px;' + '  display:flex;gap:6px;opacity:0;pointer-events:none;transition:opacity .12s;z-index:2;' + '  white-space:nowrap}' + ':host([data-filled][data-editable]:hover) .ctl,:host([data-reframe]) .ctl' + '  {opacity:1;pointer-events:auto}' + '.ctl button{appearance:none;border:0;border-radius:6px;padding:5px 10px;cursor:pointer;' + '  background:rgba(0,0,0,.65);color:#fff;font:11px/1 system-ui,-apple-system,sans-serif;' + '  backdrop-filter:blur(6px)}' + '.ctl button:hover{background:rgba(0,0,0,.8)}' + '.err{position:absolute;left:8px;bottom:8px;right:8px;color:#b3261e;font-size:11px;' + '  background:rgba(255,255,255,.85);padding:4px 6px;border-radius:5px;pointer-events:none}';
  const icon = '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' + 'stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' + '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>' + '<path d="m21 15-5-5L5 21"/></svg>';
  class ImageSlot extends HTMLElement {
    static get observedAttributes() {
      return ['shape', 'radius', 'mask', 'fit', 'position', 'placeholder', 'src', 'id'];
    }
    constructor() {
      super();
      const root = this.attachShadow({
        mode: 'open'
      });
      // .spill and .ctl sit OUTSIDE .frame so overflow:hidden + border-radius
      // on the frame (circle, pill, rounded) can't clip them.
      root.innerHTML = '<style>' + stylesheet + '</style>' + '<div class="frame" part="frame">' + '  <img part="image" alt="" draggable="false" style="display:none">' + '  <div class="empty" part="empty">' + icon + '    <div class="cap"></div>' + '    <div class="sub">or <u>browse files</u></div></div>' + '  <div class="ring" part="ring"></div>' + '</div>' + '<div class="spill">' + '  <img class="ghost" alt="" draggable="false">' + '  <div class="handle" data-c="nw"></div><div class="handle" data-c="ne"></div>' + '  <div class="handle" data-c="sw"></div><div class="handle" data-c="se"></div>' + '</div>' + '<div class="ctl"><button data-act="replace" title="Replace image">Replace</button>' + '  <button data-act="clear" title="Remove image">Remove</button></div>' + '<input type="file" accept="' + ACCEPT.join(',') + '" hidden>';
      this._frame = root.querySelector('.frame');
      this._ring = root.querySelector('.ring');
      this._img = root.querySelector('.frame img');
      this._empty = root.querySelector('.empty');
      this._cap = root.querySelector('.cap');
      this._sub = root.querySelector('.sub');
      this._spill = root.querySelector('.spill');
      this._ghost = root.querySelector('.ghost');
      this._err = null;
      this._input = root.querySelector('input');
      this._depth = 0;
      this._gen = 0;
      this._view = {
        s: 1,
        x: 0,
        y: 0
      };
      this._subFn = () => this._render();
      // Shadow-DOM listeners live with the shadow DOM — bound once here so
      // disconnect/reconnect (e.g. React remount) doesn't stack handlers.
      this._empty.addEventListener('click', () => this._input.click());
      root.addEventListener('click', e => {
        const act = e.target && e.target.getAttribute && e.target.getAttribute('data-act');
        if (act === 'replace') {
          this._exitReframe(true);
          this._input.click();
        }
        if (act === 'clear') {
          this._exitReframe(false);
          this._gen++;
          this._local = null;
          if (this.id) setSlot(this.id, null);else this._render();
        }
      });
      this._input.addEventListener('change', () => {
        const f = this._input.files && this._input.files[0];
        if (f) this._ingest(f);
        this._input.value = '';
      });
      // naturalWidth/Height aren't known until load — re-apply so the cover
      // baseline is computed from real dimensions, not the 100%×100% fallback.
      this._img.addEventListener('load', () => this._applyView());
      // Gated on editable + fit=cover so share links and contain/fill slots
      // stay static.
      this.addEventListener('dblclick', e => {
        if (!this.hasAttribute('data-editable') || !this._reframes()) return;
        e.preventDefault();
        if (this.hasAttribute('data-reframe')) this._exitReframe(true);else this._enterReframe();
      });
      // Pan + resize both originate on the spill layer. A handle pointerdown
      // drives an aspect-locked resize anchored at the opposite corner; any
      // other pointerdown on the spill pans. Offsets are frame-% so a
      // reframed slot survives responsive resize / PPTX export.
      this._spill.addEventListener('pointerdown', e => {
        if (e.button !== 0 || !this.hasAttribute('data-reframe')) return;
        e.preventDefault();
        e.stopPropagation();
        this._spill.setPointerCapture(e.pointerId);
        const rect = this.getBoundingClientRect();
        const fw = rect.width || 1,
          fh = rect.height || 1;
        const corner = e.target.getAttribute && e.target.getAttribute('data-c');
        let move;
        if (corner) {
          // Resize about the OPPOSITE corner. Viewport-px throughout (rect
          // fw/fh, not clientWidth) so the math survives a transform:scale()
          // ancestor — deck_stage renders slides scaled-to-fit.
          const iw = this._img.naturalWidth || 1,
            ih = this._img.naturalHeight || 1;
          const base = Math.max(fw / iw, fh / ih);
          const sx = corner.includes('e') ? 1 : -1;
          const sy = corner.includes('s') ? 1 : -1;
          const s0 = this._view.s;
          const w0 = iw * base * s0,
            h0 = ih * base * s0;
          const cx0 = (50 + this._view.x) / 100 * fw;
          const cy0 = (50 + this._view.y) / 100 * fh;
          const ox = cx0 - sx * w0 / 2,
            oy = cy0 - sy * h0 / 2;
          const diag0 = Math.hypot(w0, h0);
          const ux = sx * w0 / diag0,
            uy = sy * h0 / diag0;
          move = ev => {
            const proj = (ev.clientX - rect.left - ox) * ux + (ev.clientY - rect.top - oy) * uy;
            const s = clampS(s0 * proj / diag0);
            const d = diag0 * s / s0;
            this._view.s = s;
            this._view.x = (ox + ux * d / 2) / fw * 100 - 50;
            this._view.y = (oy + uy * d / 2) / fh * 100 - 50;
            this._clampView();
            this._applyView();
          };
        } else {
          this.setAttribute('data-panning', '');
          const start = {
            px: e.clientX,
            py: e.clientY,
            x: this._view.x,
            y: this._view.y
          };
          move = ev => {
            this._view.x = start.x + (ev.clientX - start.px) / fw * 100;
            this._view.y = start.y + (ev.clientY - start.py) / fh * 100;
            this._clampView();
            this._applyView();
          };
        }
        const up = () => {
          try {
            this._spill.releasePointerCapture(e.pointerId);
          } catch {}
          this._spill.removeEventListener('pointermove', move);
          this._spill.removeEventListener('pointerup', up);
          this._spill.removeEventListener('pointercancel', up);
          this.removeAttribute('data-panning');
          this._dragUp = null;
        };
        // Stashed so _exitReframe (Escape / outside-click mid-drag) can
        // tear the capture + listeners down synchronously.
        this._dragUp = up;
        this._spill.addEventListener('pointermove', move);
        this._spill.addEventListener('pointerup', up);
        this._spill.addEventListener('pointercancel', up);
      });
      // Wheel zoom stays available inside reframe mode as a trackpad nicety —
      // zooms toward the cursor (offset' = cursor·(1-k) + offset·k).
      this.addEventListener('wheel', e => {
        if (!this.hasAttribute('data-reframe')) return;
        e.preventDefault();
        const r = this.getBoundingClientRect();
        const cx = (e.clientX - r.left) / r.width * 100 - 50;
        const cy = (e.clientY - r.top) / r.height * 100 - 50;
        const prev = this._view.s;
        const next = clampS(prev * Math.pow(1.0015, -e.deltaY));
        if (next === prev) return;
        const k = next / prev;
        this._view.s = next;
        this._view.x = cx * (1 - k) + this._view.x * k;
        this._view.y = cy * (1 - k) + this._view.y * k;
        this._clampView();
        this._applyView();
      }, {
        passive: false
      });
    }
    connectedCallback() {
      // Warn once per page — an id-less slot works for the session but
      // cannot persist, and two id-less slots would share nothing.
      if (!this.id && !ImageSlot._warned) {
        ImageSlot._warned = true;
        console.warn('<image-slot> without an id will not persist its dropped image.');
      }
      this.addEventListener('dragenter', this);
      this.addEventListener('dragover', this);
      this.addEventListener('dragleave', this);
      this.addEventListener('drop', this);
      subs.add(this._subFn);
      // width%/height% in _applyView encode the frame aspect at call time —
      // a host resize (responsive grid, pane divider) would stretch the
      // image until the next _render. Re-render on size change: _render()
      // re-seeds _view from stored before clamp/apply, so a shrink→grow
      // cycle round-trips instead of ratcheting x/y toward the narrower
      // frame's clamp range.
      this._ro = new ResizeObserver(() => this._render());
      this._ro.observe(this);
      load();
      this._render();
    }
    disconnectedCallback() {
      subs.delete(this._subFn);
      this.removeEventListener('dragenter', this);
      this.removeEventListener('dragover', this);
      this.removeEventListener('dragleave', this);
      this.removeEventListener('drop', this);
      if (this._ro) {
        this._ro.disconnect();
        this._ro = null;
      }
      this._exitReframe(false);
    }
    _enterReframe() {
      if (this.hasAttribute('data-reframe')) return;
      this.setAttribute('data-reframe', '');
      this._applyView();
      // Close on click outside (the spill handler stopPropagation()s so
      // in-image drags don't reach this) and on Escape. Listeners are held
      // on the instance so _exitReframe / disconnectedCallback can detach
      // exactly what was attached.
      this._outside = e => {
        if (e.composedPath && e.composedPath().includes(this)) return;
        this._exitReframe(true);
      };
      this._esc = e => {
        if (e.key === 'Escape') this._exitReframe(true);
      };
      document.addEventListener('pointerdown', this._outside, true);
      document.addEventListener('keydown', this._esc, true);
    }
    _exitReframe(commit) {
      if (!this.hasAttribute('data-reframe')) return;
      if (this._dragUp) this._dragUp();
      this.removeAttribute('data-reframe');
      this.removeAttribute('data-panning');
      if (this._outside) document.removeEventListener('pointerdown', this._outside, true);
      if (this._esc) document.removeEventListener('keydown', this._esc, true);
      this._outside = this._esc = null;
      if (commit) this._commitView();
    }
    attributeChangedCallback() {
      if (this.shadowRoot) this._render();
    }

    // handleEvent — one listener object for all four drag events keeps the
    // add/remove symmetric and the depth counter correct.
    handleEvent(e) {
      if (e.type === 'dragenter' || e.type === 'dragover') {
        // Without preventDefault the browser never fires 'drop'.
        e.preventDefault();
        e.stopPropagation();
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
        if (e.type === 'dragenter') this._depth++;
        this.setAttribute('data-over', '');
      } else if (e.type === 'dragleave') {
        // dragenter/leave fire for every descendant crossing — count depth
        // so hovering the icon inside the empty state doesn't flicker.
        if (--this._depth <= 0) {
          this._depth = 0;
          this.removeAttribute('data-over');
        }
      } else if (e.type === 'drop') {
        e.preventDefault();
        e.stopPropagation();
        this._depth = 0;
        this.removeAttribute('data-over');
        const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
        if (f) this._ingest(f);
      }
    }
    async _ingest(file) {
      this._setError(null);
      if (!file || ACCEPT.indexOf(file.type) < 0) {
        this._setError('Drop a PNG, JPEG, WebP, or AVIF image.');
        return;
      }
      // toDataUrl can take hundreds of ms on a large photo. A Clear or a
      // newer drop during that window would be clobbered when this await
      // resumes — bump + capture a generation so stale encodes bail.
      const gen = ++this._gen;
      try {
        const w = this.clientWidth || this.offsetWidth || MAX_DIM;
        const url = await toDataUrl(file, w);
        if (gen !== this._gen) return;
        // Only exit reframe once the new image is in hand — a rejected type
        // or decode failure leaves the in-progress crop untouched.
        this._exitReframe(false);
        const val = {
          u: url,
          s: 1,
          x: 0,
          y: 0
        };
        setSlot(this.id || '', val);
        // Keep a session-local copy for id-less slots so the drop still
        // shows, even though it cannot persist.
        if (!this.id) {
          this._local = val;
          this._render();
        }
      } catch (err) {
        if (gen !== this._gen) return;
        this._setError('Could not read that image.');
        console.warn('<image-slot> ingest failed:', err);
      }
    }
    _setError(msg) {
      if (this._err) {
        this._err.remove();
        this._err = null;
      }
      if (!msg) return;
      const d = document.createElement('div');
      d.className = 'err';
      d.textContent = msg;
      this.shadowRoot.appendChild(d);
      this._err = d;
      setTimeout(() => {
        if (this._err === d) {
          d.remove();
          this._err = null;
        }
      }, 3000);
    }

    // Reframing (pan/resize) is only meaningful for fit=cover — contain/fill
    // keep the old object-fit path and double-click is a no-op.
    _reframes() {
      return this.hasAttribute('data-filled') && (this.getAttribute('fit') || 'cover') === 'cover';
    }

    // Cover-baseline geometry, shared by clamp/apply/resize. Null until the
    // img has loaded (naturalWidth is 0 before that) or when the slot has no
    // layout box — ResizeObserver fires with a 0×0 rect under display:none,
    // and clamping against a degenerate 1×1 frame would silently pull the
    // stored pan toward zero.
    _geom() {
      const iw = this._img.naturalWidth,
        ih = this._img.naturalHeight;
      const fw = this.clientWidth,
        fh = this.clientHeight;
      if (!iw || !ih || !fw || !fh) return null;
      return {
        iw,
        ih,
        fw,
        fh,
        base: Math.max(fw / iw, fh / ih)
      };
    }
    _clampView() {
      // Pan range on each axis is half the overflow past the frame edge.
      const g = this._geom();
      if (!g) return;
      const mx = Math.max(0, (g.iw * g.base * this._view.s / g.fw - 1) * 50);
      const my = Math.max(0, (g.ih * g.base * this._view.s / g.fh - 1) * 50);
      this._view.x = Math.max(-mx, Math.min(mx, this._view.x));
      this._view.y = Math.max(-my, Math.min(my, this._view.y));
    }
    _applyView() {
      const g = this._geom();
      const fit = this.getAttribute('fit') || 'cover';
      if (fit !== 'cover' || !g) {
        // Non-cover, or dimensions not known yet (before img load).
        this._img.style.width = '100%';
        this._img.style.height = '100%';
        this._img.style.left = '50%';
        this._img.style.top = '50%';
        this._img.style.objectFit = fit;
        this._img.style.objectPosition = this.getAttribute('position') || '50% 50%';
        return;
      }
      // Cover baseline: img fills the frame on its tighter axis at s=1, so
      // pan works immediately on the overflowing axis without zooming first.
      // Width/height and left/top are all frame-% — depends only on the
      // frame aspect ratio, so a responsive resize keeps the same crop. The
      // spill layer mirrors the same box so its corners = image corners.
      const k = g.base * this._view.s;
      const w = g.iw * k / g.fw * 100 + '%';
      const h = g.ih * k / g.fh * 100 + '%';
      const l = 50 + this._view.x + '%';
      const t = 50 + this._view.y + '%';
      this._img.style.width = w;
      this._img.style.height = h;
      this._img.style.left = l;
      this._img.style.top = t;
      this._img.style.objectFit = '';
      this._spill.style.width = w;
      this._spill.style.height = h;
      this._spill.style.left = l;
      this._spill.style.top = t;
    }
    _commitView() {
      const v = {
        s: this._view.s,
        x: this._view.x,
        y: this._view.y
      };
      if (this._userUrl) v.u = this._userUrl;
      // Framing-only (no u) persists too so an author-src slot remembers its
      // crop; clearing the sidecar still falls through to src=.
      if (this.id) setSlot(this.id, v);else {
        this._local = v;
      }
    }
    _render() {
      // Shape / mask. Presets use border-radius so the dashed ring can
      // follow the rounded outline; clip-path is only applied for an
      // explicit `mask` (the ring is hidden there since a rectangle
      // dashed border chopped by an arbitrary polygon looks broken).
      const mask = this.getAttribute('mask');
      const shape = (this.getAttribute('shape') || 'rounded').toLowerCase();
      let radius = '';
      if (shape === 'circle') radius = '50%';else if (shape === 'pill') radius = '9999px';else if (shape === 'rounded') {
        const n = parseFloat(this.getAttribute('radius'));
        radius = (Number.isFinite(n) ? n : 12) + 'px';
      }
      this._frame.style.borderRadius = mask ? '' : radius;
      this._frame.style.clipPath = mask || '';
      this._ring.style.borderRadius = mask ? '' : radius;
      this._ring.style.display = mask ? 'none' : '';

      // Controls and reframe entry gate on this so share links stay read-only.
      const editable = !!(window.omelette && window.omelette.writeFile);
      this.toggleAttribute('data-editable', editable);
      this._sub.style.display = editable ? '' : 'none';

      // Content. The sidecar is also writable by the agent's write_file
      // tool, so its value isn't guaranteed canvas-originated — only accept
      // data:image/ URLs from it. The `src` attribute is author-controlled
      // (Claude wrote it into the HTML) so it passes through unchanged.
      let stored = this.id ? getSlot(this.id) : this._local;
      if (stored && stored.u && !/^data:image\//i.test(stored.u)) stored = null;
      const srcAttr = this.getAttribute('src') || '';
      this._userUrl = stored && stored.u || null;
      const url = this._userUrl || srcAttr;
      // Don't clobber an in-flight reframe with a store-triggered re-render.
      if (!this.hasAttribute('data-reframe')) {
        this._view = {
          s: stored && Number.isFinite(stored.s) ? clampS(stored.s) : 1,
          x: stored && Number.isFinite(stored.x) ? stored.x : 0,
          y: stored && Number.isFinite(stored.y) ? stored.y : 0
        };
      }
      this._cap.textContent = this.getAttribute('placeholder') || 'Drop an image';
      // Toggle via style.display — the [hidden] attribute alone loses to
      // the display:flex / display:block rules in the stylesheet above.
      if (url) {
        if (this._img.getAttribute('src') !== url) {
          this._img.src = url;
          this._ghost.src = url;
        }
        this._img.style.display = 'block';
        this._empty.style.display = 'none';
        this.setAttribute('data-filled', '');
        this._clampView();
        this._applyView();
      } else {
        this._img.style.display = 'none';
        this._img.removeAttribute('src');
        this._ghost.removeAttribute('src');
        this._empty.style.display = 'flex';
        this.removeAttribute('data-filled');
      }
    }
  }
  if (!customElements.get('image-slot')) {
    customElements.define('image-slot', ImageSlot);
  }
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/image-slot.js", error: String((e && e.message) || e) }); }

// ui_kits/app/screens-map.jsx
try { (() => {
// ConqRun UI kit — Map & Dashboard screens
const {
  useState: useStateMD
} = React;

/* ── MAP ── */
function MapScreen({
  running,
  onToggleRun,
  live
}) {
  // territories: [left%, top%, w%, h%, color, label, owner]
  const terrs = [{
    x: 6,
    y: 9,
    w: 26,
    h: 18,
    c: '#FF4D6D',
    lbl: '👑 Marktplatz'
  }, {
    x: 40,
    y: 6,
    w: 30,
    h: 16,
    c: '#E6FF55',
    lbl: '👑 Dein Revier'
  }, {
    x: 66,
    y: 30,
    w: 28,
    h: 22,
    c: '#9B5DE5',
    lbl: 'Stadtpark'
  }, {
    x: 8,
    y: 58,
    w: 22,
    h: 18,
    c: '#00D4FF',
    lbl: 'Bahnhof'
  }, {
    x: 38,
    y: 54,
    w: 26,
    h: 20,
    c: '#E6FF55',
    lbl: '👑 Altstadt'
  }];
  const landmarks = [{
    x: 24,
    y: 20,
    e: '🏰',
    c: '#FFD700'
  }, {
    x: 80,
    y: 16,
    e: '🌉',
    c: '#00D4FF'
  }, {
    x: 52,
    y: 66,
    e: '🏟️',
    c: '#FF4D6D'
  }, {
    x: 16,
    y: 80,
    e: '🗿',
    c: '#9B5DE5'
  }];
  return /*#__PURE__*/React.createElement("div", {
    className: "view",
    style: {
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "map-wrap"
  }, [18, 38, 58, 78].map(t => /*#__PURE__*/React.createElement("div", {
    key: 'h' + t,
    className: "map-grid-line",
    style: {
      left: 0,
      right: 0,
      top: t + '%',
      height: 1
    }
  })), [22, 46, 70].map(l => /*#__PURE__*/React.createElement("div", {
    key: 'v' + l,
    className: "map-grid-line",
    style: {
      top: 0,
      bottom: 0,
      left: l + '%',
      width: 1
    }
  })), /*#__PURE__*/React.createElement("div", {
    className: "map-road",
    style: {
      left: 0,
      right: 0,
      top: '32%',
      height: 3
    }
  }), /*#__PURE__*/React.createElement("div", {
    className: "map-road",
    style: {
      left: 0,
      right: 0,
      top: '72%',
      height: 3
    }
  }), /*#__PURE__*/React.createElement("div", {
    className: "map-road",
    style: {
      top: 0,
      bottom: 0,
      left: '34%',
      width: 3
    }
  }), /*#__PURE__*/React.createElement("div", {
    className: "map-road",
    style: {
      top: 0,
      bottom: 0,
      left: '70%',
      width: 3
    }
  }), terrs.map((t, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    className: "terr",
    style: {
      left: t.x + '%',
      top: t.y + '%',
      width: t.w + '%',
      height: t.h + '%',
      background: t.c + '22',
      borderColor: t.c + '88'
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "terr-lbl",
    style: {
      top: 5,
      left: 5,
      color: t.c,
      background: 'rgba(0,0,0,.45)'
    }
  }, t.lbl))), landmarks.map((l, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    className: "landmark",
    style: {
      left: l.x + '%',
      top: l.y + '%',
      background: l.c
    }
  }, l.e)), /*#__PURE__*/React.createElement("svg", {
    className: "gps-trail",
    viewBox: "0 0 100 100",
    preserveAspectRatio: "none",
    style: {
      left: '18%',
      top: '40%',
      width: '48%',
      height: '34%'
    }
  }, /*#__PURE__*/React.createElement("polyline", {
    points: "5,90 25,70 40,72 55,40 78,28 95,8",
    fill: "none",
    stroke: "var(--primary)",
    strokeWidth: "2.4",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    style: {
      vectorEffect: 'non-scaling-stroke'
    }
  })), running && /*#__PURE__*/React.createElement("div", {
    className: "runner-pin",
    style: {
      left: '56%',
      top: '50%'
    }
  }, "\uD83C\uDFC3"), /*#__PURE__*/React.createElement("div", {
    className: "map-panel-arrow"
  }, /*#__PURE__*/React.createElement("i", {
    className: "fas fa-chevron-left"
  })), /*#__PURE__*/React.createElement("div", {
    className: "locate-fab",
    style: {
      bottom: running ? 224 : 84
    }
  }, /*#__PURE__*/React.createElement("i", {
    className: "fas fa-location-arrow"
  })), /*#__PURE__*/React.createElement("div", {
    className: "run-dock"
  }, running ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "live-grid"
  }, /*#__PURE__*/React.createElement("div", {
    className: "live-card"
  }, /*#__PURE__*/React.createElement("div", {
    className: "live-v"
  }, live.km), /*#__PURE__*/React.createElement("div", {
    className: "live-l"
  }, "km")), /*#__PURE__*/React.createElement("div", {
    className: "live-card"
  }, /*#__PURE__*/React.createElement("div", {
    className: "live-v"
  }, live.time), /*#__PURE__*/React.createElement("div", {
    className: "live-l"
  }, "Zeit"))), /*#__PURE__*/React.createElement("div", {
    className: "live-row"
  }, /*#__PURE__*/React.createElement("div", {
    className: "live-pill"
  }, /*#__PURE__*/React.createElement("i", {
    className: "fas fa-bolt"
  }), /*#__PURE__*/React.createElement("b", null, live.pace), " /km"), /*#__PURE__*/React.createElement("div", {
    className: "live-pill"
  }, /*#__PURE__*/React.createElement("i", {
    className: "fas fa-heart-pulse"
  }), /*#__PURE__*/React.createElement("b", null, live.hr), " bpm"), /*#__PURE__*/React.createElement("div", {
    className: "live-pill"
  }, /*#__PURE__*/React.createElement("i", {
    className: "fas fa-shoe-prints"
  }), /*#__PURE__*/React.createElement("b", null, live.cad))), /*#__PURE__*/React.createElement("div", {
    className: "dock-btns"
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn"
  }, /*#__PURE__*/React.createElement("i", {
    className: "fas fa-pause"
  }), " PAUSE"), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-p",
    onClick: onToggleRun
  }, /*#__PURE__*/React.createElement("i", {
    className: "fas fa-stop"
  }), " STOP"))) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 11
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "label"
  }, "Bereit zu laufen"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-display)',
      color: 'var(--primary)',
      letterSpacing: 1
    }
  }, "\u26A1 Energie 100%")), /*#__PURE__*/React.createElement("div", {
    className: "dock-btns"
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn btn-p glow",
    onClick: onToggleRun
  }, /*#__PURE__*/React.createElement("i", {
    className: "fas fa-play"
  }), " START"), /*#__PURE__*/React.createElement("button", {
    className: "btn"
  }, /*#__PURE__*/React.createElement("i", {
    className: "fas fa-heart"
  })))))));
}

/* ── DASHBOARD ── */
function DashboardScreen() {
  const week = [80, 45, 65, 0, 55, 30, 0];
  const wdLbl = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
  const quests = [{
    t: '🏃 Laufe 5 km',
    pct: 100,
    r: 250
  }, {
    t: '⚔️ Erobere 3 Gebiete',
    pct: 66,
    r: 400
  }, {
    t: '🛡️ Verteidige 5 Gebiete',
    pct: 40,
    r: 300
  }, {
    t: '🗺️ Wochenziel: 40 km',
    pct: 80,
    r: 500
  }];
  return /*#__PURE__*/React.createElement("div", {
    className: "view"
  }, /*#__PURE__*/React.createElement("div", {
    className: "pad"
  }, /*#__PURE__*/React.createElement("div", {
    className: "goal"
  }, /*#__PURE__*/React.createElement("div", {
    className: "goal-top"
  }, /*#__PURE__*/React.createElement("span", {
    className: "label"
  }, /*#__PURE__*/React.createElement("i", {
    className: "fas fa-bullseye",
    style: {
      marginRight: 5
    }
  }), " Wochenziel"), /*#__PURE__*/React.createElement("span", {
    className: "goal-val"
  }, "18.4 / 40 km")), /*#__PURE__*/React.createElement("div", {
    className: "bar-bg"
  }, /*#__PURE__*/React.createElement("div", {
    className: "bar-fill",
    style: {
      width: '46%'
    }
  })), /*#__PURE__*/React.createElement("div", {
    className: "week-days"
  }, week.map((h, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    className: "wd"
  }, /*#__PURE__*/React.createElement("div", {
    className: "wd-bar"
  }, /*#__PURE__*/React.createElement("div", {
    className: "wd-fill",
    style: {
      height: h + '%'
    }
  })), /*#__PURE__*/React.createElement("div", {
    className: "wd-l"
  }, wdLbl[i]))))), /*#__PURE__*/React.createElement("div", {
    className: "stat-grid",
    style: {
      marginTop: 8
    }
  }, /*#__PURE__*/React.createElement(StatCard, {
    v: "142",
    l: "km total"
  }), /*#__PURE__*/React.createElement(StatCard, {
    v: "23",
    l: "Gebiete"
  }), /*#__PURE__*/React.createElement(StatCard, {
    v: "12\uD83D\uDD25",
    l: "Streak"
  })), /*#__PURE__*/React.createElement(SectionHd, {
    icon: "fa-scroll"
  }, "Aktive Quests"), quests.map((q, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    className: "quest"
  }, /*#__PURE__*/React.createElement("div", {
    className: "quest-top"
  }, /*#__PURE__*/React.createElement("span", null, q.t), /*#__PURE__*/React.createElement("span", {
    className: "quest-pts"
  }, "\uD83C\uDF81 ", q.r)), /*#__PURE__*/React.createElement("div", {
    className: "q-bar"
  }, /*#__PURE__*/React.createElement("div", {
    className: "q-fill",
    style: {
      width: q.pct + '%'
    }
  })))), /*#__PURE__*/React.createElement(SectionHd, {
    icon: "fa-clock-rotate-left"
  }, "Letzte L\xE4ufe"), [{
    km: '8.2',
    t: '42:17',
    p: '5:09',
    w: '+3 Gebiete'
  }, {
    km: '5.0',
    t: '24:51',
    p: '4:58',
    w: 'verteidigt'
  }].map((r, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    className: "run-card"
  }, /*#__PURE__*/React.createElement("div", {
    className: "run-thumb"
  }, /*#__PURE__*/React.createElement("div", {
    className: "run-route"
  })), /*#__PURE__*/React.createElement("div", {
    className: "run-stats"
  }, /*#__PURE__*/React.createElement("div", {
    className: "run-stat"
  }, /*#__PURE__*/React.createElement("div", {
    className: "v"
  }, r.km), /*#__PURE__*/React.createElement("div", {
    className: "l"
  }, "km")), /*#__PURE__*/React.createElement("div", {
    className: "run-stat"
  }, /*#__PURE__*/React.createElement("div", {
    className: "v"
  }, r.t), /*#__PURE__*/React.createElement("div", {
    className: "l"
  }, "Zeit")), /*#__PURE__*/React.createElement("div", {
    className: "run-stat"
  }, /*#__PURE__*/React.createElement("div", {
    className: "v"
  }, r.p), /*#__PURE__*/React.createElement("div", {
    className: "l"
  }, "Pace"))), /*#__PURE__*/React.createElement("span", {
    className: "tag-win"
  }, r.w)))));
}
Object.assign(window, {
  MapScreen,
  DashboardScreen
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/screens-map.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/screens-social.jsx
try { (() => {
// ConqRun UI kit — Community & Profile screens

/* ── COMMUNITY ── */
function CommunityScreen() {
  const board = [{
    r: 1,
    av: '⚡',
    nm: 'SpeedKing',
    sub: '48.200 m² · 7🔥',
    sc: '6.840',
    rc: '#FFD700',
    title: 'Imperator'
  }, {
    r: 2,
    av: '🐺',
    nm: 'MountainGoat',
    sub: '31.500 m² · 5🔥',
    sc: '4.290',
    rc: '#c0c0c0',
    title: 'König'
  }, {
    r: 3,
    av: '🦊',
    nm: 'NightOwl',
    sub: '22.100 m² · 3🔥',
    sc: '2.915',
    rc: '#cd7f32',
    title: 'Herzog'
  }, {
    r: 4,
    av: '🏋️',
    nm: 'IronRunner',
    sub: '18.700 m² · 2🔥',
    sc: '1.780',
    rc: '#5A8A6E',
    title: 'Baron'
  }];
  const near = [{
    c: '#FF4D6D',
    nm: 'Marktplatz',
    sub: '380 m · feindlich · 👑 SpeedKing'
  }, {
    c: '#5A8A6E',
    nm: 'Bahnhof Nord',
    sub: '610 m · neutral'
  }, {
    c: '#9B5DE5',
    nm: 'Stadtpark',
    sub: '850 m · Rivale · 👑 NightOwl'
  }];
  const news = [{
    i: '⚔️',
    c: 'var(--red)',
    t: 'SpeedKing hat Marktplatz erobert',
    s: 'vor 12 Min'
  }, {
    i: '🏆',
    c: 'var(--gold)',
    t: 'Du wurdest Baron von Altstadt',
    s: 'vor 1 Std'
  }, {
    i: '🛡️',
    c: 'var(--green)',
    t: 'Dein Revier wurde verteidigt',
    s: 'vor 3 Std'
  }];
  return /*#__PURE__*/React.createElement("div", {
    className: "view"
  }, /*#__PURE__*/React.createElement("div", {
    className: "pad"
  }, /*#__PURE__*/React.createElement("div", {
    className: "comm-banner"
  }, /*#__PURE__*/React.createElement("h2", null, /*#__PURE__*/React.createElement("i", {
    className: "fas fa-earth-europe"
  }), " Community")), /*#__PURE__*/React.createElement("div", {
    className: "card",
    style: {
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement(SectionHd, {
    icon: "fa-newspaper",
    style: {
      margin: '0 0 6px'
    }
  }, "Aktuelle News"), news.map((n, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    className: "list-row"
  }, /*#__PURE__*/React.createElement("span", {
    className: "lr-av",
    style: {
      fontSize: '1.1rem'
    }
  }, n.i), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "lr-name",
    style: {
      fontSize: '.82rem'
    }
  }, n.t), /*#__PURE__*/React.createElement("div", {
    className: "lr-sub"
  }, n.s))))), /*#__PURE__*/React.createElement("div", {
    className: "card",
    style: {
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement(SectionHd, {
    icon: "fa-flag-checkered",
    style: {
      margin: '0 0 8px'
    }
  }, "Saison \xB7 Juni"), /*#__PURE__*/React.createElement("div", {
    className: "list-row",
    style: {
      borderBottom: 'none'
    }
  }, /*#__PURE__*/React.createElement("i", {
    className: "fas fa-hourglass-half",
    style: {
      color: 'var(--primary)',
      width: 22,
      textAlign: 'center'
    }
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "lr-name",
    style: {
      fontSize: '.82rem'
    }
  }, "Saison endet in 8 Tagen"), /*#__PURE__*/React.createElement("div", {
    className: "lr-sub"
  }, "Halte Platz 5 f\xFCr das Abzeichen")), /*#__PURE__*/React.createElement("span", {
    className: "lr-score"
  }, "8d"))), /*#__PURE__*/React.createElement("div", {
    className: "card"
  }, /*#__PURE__*/React.createElement(SectionHd, {
    icon: "fa-medal",
    style: {
      margin: '0 0 4px'
    }
  }, "Rangliste"), board.map(b => /*#__PURE__*/React.createElement("div", {
    key: b.r,
    className: "list-row"
  }, /*#__PURE__*/React.createElement("span", {
    className: "lr-rank",
    style: {
      color: b.rc
    }
  }, b.r), /*#__PURE__*/React.createElement("span", {
    className: "lr-av"
  }, b.av), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "lr-name"
  }, b.nm), /*#__PURE__*/React.createElement("div", {
    className: "lr-sub"
  }, /*#__PURE__*/React.createElement(RulerBadgeMini, {
    title: b.title
  }), " \xB7 ", b.sub)), /*#__PURE__*/React.createElement("span", {
    className: "lr-score"
  }, b.sc))), /*#__PURE__*/React.createElement("div", {
    className: "list-row me-row",
    style: {
      borderBottom: 'none'
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "lr-rank",
    style: {
      color: 'var(--primary)'
    }
  }, "5"), /*#__PURE__*/React.createElement("span", {
    className: "lr-av"
  }, "\uD83C\uDFC3"), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "lr-name",
    style: {
      color: 'var(--primary)'
    }
  }, "Du"), /*#__PURE__*/React.createElement("div", {
    className: "lr-sub"
  }, "14.200 m\xB2 \xB7 12\uD83D\uDD25")), /*#__PURE__*/React.createElement("span", {
    className: "lr-score"
  }, "1.640"))), /*#__PURE__*/React.createElement(SectionHd, {
    icon: "fa-location-arrow"
  }, "N\xE4chste Gebiete"), /*#__PURE__*/React.createElement("div", {
    className: "card",
    style: {
      padding: '2px 16px'
    }
  }, near.map((t, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    className: "list-row"
  }, /*#__PURE__*/React.createElement("span", {
    className: "terr-dot",
    style: {
      background: t.c
    }
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "lr-name",
    style: {
      fontSize: '.82rem'
    }
  }, t.nm), /*#__PURE__*/React.createElement("div", {
    className: "lr-sub"
  }, t.sub)), /*#__PURE__*/React.createElement("button", {
    className: "pill",
    style: {
      marginLeft: 'auto'
    }
  }, "\u2192 FLY"))))));
}
function RulerBadgeMini({
  title
}) {
  return /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--gold)',
      fontWeight: 700
    }
  }, "\uD83D\uDC51 ", title);
}

/* ── PROFILE ── */
function ProfileScreen({
  player,
  onEdit
}) {
  const ach = ['⚡ Schnellster', '🗺️ Explorer', '🔥 Unstoppable', '👑 Erster Baron', '🌉 Brücken-Herr'];
  const prs = [{
    i: '🏃',
    l: '5 km',
    v: '23:41'
  }, {
    i: '🏅',
    l: '10 km',
    v: '49:02'
  }, {
    i: '🏆',
    l: 'Halbmarathon',
    v: '1:52:18'
  }];
  const seasons = [{
    m: 'Mai 2026',
    r: '🥈 Platz 2 · Gebiete'
  }, {
    m: 'April 2026',
    r: '🥇 Platz 1 · Wahrzeichen'
  }, {
    m: 'März 2026',
    r: '🥉 Platz 3 · km'
  }];
  return /*#__PURE__*/React.createElement("div", {
    className: "view"
  }, /*#__PURE__*/React.createElement("div", {
    className: "pad"
  }, /*#__PURE__*/React.createElement("div", {
    className: "pv-banner"
  }, /*#__PURE__*/React.createElement("span", {
    className: "pv-edit",
    onClick: onEdit
  }, /*#__PURE__*/React.createElement("i", {
    className: "fas fa-pen"
  }), " Bearbeiten"), /*#__PURE__*/React.createElement("div", {
    className: "pv-crown"
  }, /*#__PURE__*/React.createElement("i", {
    className: "fas fa-crown"
  })), /*#__PURE__*/React.createElement("div", {
    className: "pv-av"
  }, player.avatar), /*#__PURE__*/React.createElement("div", {
    className: "pv-name"
  }, player.name), /*#__PURE__*/React.createElement("div", {
    className: "pv-since"
  }, "L\xE4ufer seit Jan 2025 \xB7 Level ", player.level), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 10
    }
  }, /*#__PURE__*/React.createElement(RulerBadge, {
    title: "BARON VON ALTSTADT"
  }))), /*#__PURE__*/React.createElement("div", {
    className: "pv-stats"
  }, /*#__PURE__*/React.createElement(StatCard, {
    v: "142",
    l: "km"
  }), /*#__PURE__*/React.createElement(StatCard, {
    v: "23",
    l: "Gebiete"
  }), /*#__PURE__*/React.createElement(StatCard, {
    v: "4.280",
    l: "Punkte"
  }), /*#__PURE__*/React.createElement(StatCard, {
    v: "12\uD83D\uDD25",
    l: "Streak"
  })), /*#__PURE__*/React.createElement("div", {
    className: "card"
  }, /*#__PURE__*/React.createElement(SectionHd, {
    icon: "fa-layer-group",
    style: {
      margin: '0 0 12px'
    }
  }, "Spielsystem"), /*#__PURE__*/React.createElement("div", {
    className: "lvl-row"
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-display)',
      fontSize: '1.3rem',
      color: 'var(--primary)',
      letterSpacing: 1
    }
  }, "Lv.", player.level), /*#__PURE__*/React.createElement("div", {
    className: "xp-bar"
  }, /*#__PURE__*/React.createElement("div", {
    className: "xp-fill",
    style: {
      width: '64%'
    }
  })), /*#__PURE__*/React.createElement("span", {
    className: "lr-sub"
  }, "2.840 / 4.400 XP")), /*#__PURE__*/React.createElement("div", {
    className: "lr-sub"
  }, "Noch 1.560 XP bis Level ", player.level + 1)), /*#__PURE__*/React.createElement("div", {
    className: "card",
    style: {
      marginTop: 14
    }
  }, /*#__PURE__*/React.createElement(SectionHd, {
    icon: "fa-crown",
    style: {
      margin: '0 0 12px'
    }
  }, "Herrschaft"), /*#__PURE__*/React.createElement("div", {
    className: "dominion"
  }, /*#__PURE__*/React.createElement("div", {
    className: "dom-card"
  }, /*#__PURE__*/React.createElement("div", {
    className: "dom-v"
  }, "3"), /*#__PURE__*/React.createElement("div", {
    className: "dom-l"
  }, "Gebiete regiert")), /*#__PURE__*/React.createElement("div", {
    className: "dom-card"
  }, /*#__PURE__*/React.createElement("div", {
    className: "dom-v"
  }, "2"), /*#__PURE__*/React.createElement("div", {
    className: "dom-l"
  }, "Wahrzeichen")), /*#__PURE__*/React.createElement("div", {
    className: "dom-card"
  }, /*#__PURE__*/React.createElement("div", {
    className: "dom-v"
  }, "47"), /*#__PURE__*/React.createElement("div", {
    className: "dom-l"
  }, "Verteidigt")), /*#__PURE__*/React.createElement("div", {
    className: "dom-card"
  }, /*#__PURE__*/React.createElement("div", {
    className: "dom-v"
  }, "9"), /*#__PURE__*/React.createElement("div", {
    className: "dom-l"
  }, "Raids gewonnen"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6,
      flexWrap: 'wrap',
      marginTop: 12
    }
  }, /*#__PURE__*/React.createElement(RarityTag, {
    tier: "Legend\xE4r"
  }), /*#__PURE__*/React.createElement(RarityTag, {
    tier: "Episch"
  }), /*#__PURE__*/React.createElement(RarityTag, {
    tier: "Selten"
  }))), /*#__PURE__*/React.createElement("div", {
    className: "card",
    style: {
      marginTop: 14
    }
  }, /*#__PURE__*/React.createElement(SectionHd, {
    icon: "fa-medal",
    style: {
      margin: '0 0 4px'
    }
  }, "Bestleistungen"), prs.map((p, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    className: "pr-row"
  }, /*#__PURE__*/React.createElement("span", {
    className: "pr-icon"
  }, p.i), /*#__PURE__*/React.createElement("span", {
    className: "pr-label"
  }, p.l), /*#__PURE__*/React.createElement("span", {
    className: "pr-val"
  }, p.v)))), /*#__PURE__*/React.createElement("div", {
    className: "card",
    style: {
      marginTop: 14
    }
  }, /*#__PURE__*/React.createElement(SectionHd, {
    icon: "fa-star",
    style: {
      margin: '0 0 12px'
    }
  }, "Erfolge"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 7,
      flexWrap: 'wrap'
    }
  }, ach.map((a, i) => /*#__PURE__*/React.createElement("span", {
    key: i,
    className: "ach"
  }, a)))), /*#__PURE__*/React.createElement("div", {
    className: "card",
    style: {
      marginTop: 14
    }
  }, /*#__PURE__*/React.createElement(SectionHd, {
    icon: "fa-calendar-days",
    style: {
      margin: '0 0 4px'
    }
  }, "Saisonhistorie"), seasons.map((s, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    className: "season-row"
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--muted)'
    }
  }, s.m), /*#__PURE__*/React.createElement("span", {
    style: {
      fontWeight: 600
    }
  }, s.r))))));
}
Object.assign(window, {
  CommunityScreen,
  ProfileScreen
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/screens-social.jsx", error: String((e && e.message) || e) }); }

})();
