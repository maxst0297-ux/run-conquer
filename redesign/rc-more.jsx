// ============================================================
// Runners Conquer — REDESIGN · weitere Bestandteile
// Onboarding · Lauf-Zusammenfassung · Gebiet-Detail · Einstellungen
// Same visual language (Citrus theme), same primitives.
// ============================================================
const { useState: useMore } = React;

/* Small phone shell for non-tab parts (full-screen states) */
function Shell({ children, className }) {
  return (
    <div className="rc-phone">
      <div className={'screen' + (className ? ' ' + className : '')}>
        <StatusBar />
        {children}
      </div>
    </div>
  );
}

/* ── 5 · ONBOARDING / ANMELDUNG ───────────────────────────── */
const OB_AV = ['🏃', '🤸', '🏋️', '⚡', '🦊', '🐺', '🦅', '🔥'];
const OB_COL = ['#E6FF55', '#FF4D6D', '#00D4FF', '#9B5DE5', '#FF9F1C'];

function OnboardingScreen() {
  const [tab, setTab] = useMore('create');
  const [name, setName] = useMore('Max_Runner');
  const [avatar, setAvatar] = useMore('🏃');
  const [color, setColor] = useMore('#E6FF55');
  return (
    <Shell className="ob-screen">
      <div className="ob2">
        <div className="ob2-brand">
          <img className="ob2-logo" src="assets/logo-mark-t.png" alt="Runners Conquer" />
          <div className="ob2-word">Runners<br />Conquer</div>
          <div className="ob2-tag">Lauf · Erobere · Verteidige</div>
        </div>

        <div className="ob2-card">
          <div className="seg">
            <button className={tab === 'create' ? 'on' : ''} onClick={() => setTab('create')}>NEU</button>
            <button className={tab === 'login' ? 'on' : ''} onClick={() => setTab('login')}>ANMELDEN</button>
          </div>

          {tab === 'create' ? (
            <>
              <div className="field">
                <div className="label">Spielername</div>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="z.B. Max_Runner" />
              </div>
              <div className="field">
                <div className="label">Avatar</div>
                <div className="av-row">
                  {OB_AV.map(a => (
                    <div key={a} className={'av-opt' + (avatar === a ? ' sel' : '')} onClick={() => setAvatar(a)}>{a}</div>
                  ))}
                </div>
              </div>
              <div className="field">
                <div className="label">Deine Farbe</div>
                <div className="col-row">
                  {OB_COL.map(c => (
                    <div key={c} className={'col-opt' + (color === c ? ' sel' : '')} style={{ background: c }} onClick={() => setColor(c)}></div>
                  ))}
                </div>
              </div>
              <button className="hero-start ob2-cta"><i className="fas fa-flag"></i>LOSLEGEN</button>
            </>
          ) : (
            <>
              <div className="field">
                <div className="label">E-Mail</div>
                <input placeholder="du@email.de" />
              </div>
              <div className="field">
                <div className="label">Passwort</div>
                <input type="password" placeholder="••••••••" />
              </div>
              <a className="ob2-forgot">Passwort vergessen?</a>
              <button className="hero-start ob2-cta"><i className="fas fa-right-to-bracket"></i>ANMELDEN</button>
            </>
          )}
        </div>
        <div className="ob2-foot">Tritt einer Saison bei und sichere dir dein erstes Revier.</div>
      </div>
    </Shell>
  );
}

/* ── 6 · LAUF-ZUSAMMENFASSUNG (nach STOP) ─────────────────── */
function RunSummaryScreen() {
  const stats = [
    { v: '8,24', l: 'km' },
    { v: '42:17', l: 'Zeit' },
    { v: '5:09', l: 'Pace' },
    { v: '152', l: '⌀ Puls' },
  ];
  const splits = [62, 80, 54, 71, 88, 46, 75, 60];
  return (
    <Shell className="sum-screen">
      <div className="summary">
        <div className="sum-bar">
          <button className="icon-btn"><i className="fas fa-xmark"></i></button>
          <span className="sum-date">Samstag · 14. Juni</span>
          <button className="icon-btn"><i className="fas fa-ellipsis"></i></button>
        </div>

        <div className="sum-hero">
          <div className="sum-badge"><i className="fas fa-flag-checkered"></i></div>
          <div className="sum-eyebrow">Neues Gebiet erobert</div>
          <div className="sum-title">Altstadt</div>
          <div className="sum-reward">
            <span><b>+200</b> Punkte</span><span className="dot">·</span>
            <span><b>+1</b> Gebiet</span><span className="dot">·</span>
            <span><b>7.400</b> m²</span>
          </div>
        </div>

        <div className="sum-map">
          <MapCanvas running={false} layers={{ terr: true, land: false, heatmap: false, fog: false }} mapStyle="dunkel" />
          <div className="sum-map-cap"><i className="fas fa-location-dot"></i> Innenstadt-Runde</div>
        </div>

        <div className="sum-stats">
          {stats.map((s, i) => <div key={i} className="sum-stat"><div className="sv">{s.v}</div><div className="sl">{s.l}</div></div>)}
        </div>

        <div className="sum-block">
          <div className="sum-block-hd"><span>Splits / km</span><span className="sum-best">Schnellste: 4:46</span></div>
          <div className="sum-splits">
            {splits.map((h, i) => <div key={i} className="sum-spl"><span style={{ height: h + '%' }}></span></div>)}
          </div>
        </div>

        <div className="sum-tier">
          <div className="sum-tier-top">
            <span className="sum-tier-now"><i className="fas fa-crown"></i> Baron</span>
            <span className="tier-next">noch 2 Gebiete → Herzog</span>
          </div>
          <div className="tier-track">
            {[1, 1, 1, 0, 0].map((on, i) => <div key={i} className={'tier-pip' + (on ? ' on' : '')}></div>)}
          </div>
        </div>

        <div className="sum-actions">
          <button className="btn"><i className="fas fa-share-nodes"></i> TEILEN</button>
          <button className="btn btn-p glow"><i className="fas fa-check"></i> SPEICHERN</button>
        </div>
      </div>
    </Shell>
  );
}

/* ── 7 · GEBIET-DETAIL (antippen / Raid) ──────────────────── */
function TerritoryScreen() {
  const [defended, setDefended] = useMore(false);
  const threats = [
    { av: '⚡', nm: 'SpeedKing', sub: 'Imperator · 480 m', c: '#FF4D6D' },
    { av: '🦊', nm: 'NightOwl', sub: 'Herzog · 720 m', c: '#9B5DE5' },
  ];
  return (
    <Shell className="td-screen">
      <div className="td">
        <div className="td-map">
          <MapCanvas running={false} layers={{ terr: true, land: true, heatmap: false, fog: false }} mapStyle="dunkel" />
          <div className="map-scrim" style={{ height: 120 }}></div>
          <button className="td-back"><i className="fas fa-arrow-left"></i></button>
          <span className="td-flag"><i className="fas fa-crown"></i> Dein Revier</span>
        </div>

        <div className="td-sheet">
          <div className="sheet-grab"></div>
          <div className="td-head">
            <div className="td-titlewrap">
              <div className="td-name">Altstadt</div>
              <div className="td-sub">Innenstadt · 380 m entfernt</div>
            </div>
            <RarityTag tier="Legendär" />
          </div>

          <div className="td-owner">
            <span className="td-owner-av">🏃</span>
            <div className="td-owner-meta">
              <div className="lr-name">Du regierst hier</div>
              <div className="lr-sub"><span style={{ color: 'var(--gold)', fontWeight: 700 }}>👑 Baron</span> · seit 6 Tagen</div>
            </div>
            <span className={'td-state' + (defended ? ' safe' : '')}>
              <i className={'fas ' + (defended ? 'fa-shield-halved' : 'fa-triangle-exclamation')}></i>
              {defended ? 'Sicher' : 'Bedroht'}
            </span>
          </div>

          <div className="td-stats">
            <div className="dom-card"><div className="dom-v">7.400</div><div className="dom-l">m² Fläche</div></div>
            <div className="dom-card"><div className="dom-v">12</div><div className="dom-l">Verteidigt</div></div>
            <div className="dom-card"><div className="dom-v">+38</div><div className="dom-l">Punkte / Tag</div></div>
          </div>

          <SectionHd icon="fa-skull" style={{ margin: '18px 0 6px' }}>Bedroht von</SectionHd>
          <div className="td-threats">
            {threats.map((t, i) => (
              <div key={i} className="list-row">
                <span className="terr-dot" style={{ background: t.c }}></span>
                <span className="lr-av">{t.av}</span>
                <div><div className="lr-name" style={{ fontSize: '.86rem' }}>{t.nm}</div><div className="lr-sub">{t.sub}</div></div>
                <i className="fas fa-location-arrow" style={{ marginLeft: 'auto', color: 'var(--muted)' }}></i>
              </div>
            ))}
          </div>

          <div className="td-actions">
            <button className="btn"><i className="fas fa-route"></i> ROUTE</button>
            <button className={'btn btn-p' + (defended ? '' : ' glow')} onClick={() => setDefended(d => !d)}>
              <i className={'fas ' + (defended ? 'fa-shield' : 'fa-shield-halved')}></i>
              {defended ? 'VERTEIDIGT' : 'VERTEIDIGEN'}
            </button>
          </div>
        </div>
      </div>
    </Shell>
  );
}

/* ── 8 · EINSTELLUNGEN ────────────────────────────────────── */
const SET_THEMES = [
  { id: 'theme-citrus', name: 'Citrus', bg: '#042D22', dot: '#E6FF55' },
  { id: 'theme-stone', name: 'Stone', bg: '#F0EBE9', dot: '#36A372' },
  { id: 'theme-pine', name: 'Pine', bg: '#455B51', dot: '#FFF0A4' },
  { id: 'theme-petrol', name: 'Petrol', bg: '#F4E9D4', dot: '#326586' },
];
const SET_TEAMS = [
  { id: 'lime', name: 'Limonen', color: '#E8FF47', txt: '#042' },
  { id: 'red', name: 'Rote', color: '#FF4D6D', txt: '#fff' },
  { id: 'cyan', name: 'Cyane', color: '#00D4FF', txt: '#042' },
  { id: 'purple', name: 'Lila', color: '#9B5DE5', txt: '#fff' },
];

function SettingsScreen() {
  const [theme, setTheme] = useMore('theme-citrus');
  const [team, setTeam] = useMore('lime');
  const [push, setPush] = useMore(true);
  const [raidAlert, setRaidAlert] = useMore(true);
  const [sound, setSound] = useMore(false);
  return (
    <Shell className="set-screen">
      <header className="app-hdr">
        <button className="icon-btn"><i className="fas fa-arrow-left"></i></button>
        <span className="hdr-title" style={{ marginLeft: 4 }}>Einstellungen</span>
      </header>
      <div className="view"><div className="pad set-pad">
        <SectionHd icon="fa-palette" style={{ marginTop: 2 }}>Erscheinungsbild</SectionHd>
        <div className="theme-grid">
          {SET_THEMES.map(t => (
            <div key={t.id} className={'theme-opt' + (theme === t.id ? ' sel' : '')} onClick={() => setTheme(t.id)}>
              <div className="theme-sw" style={{ background: t.bg }}><div className="dot" style={{ background: t.dot }}></div></div>
              <div className="theme-cap" style={{ color: 'var(--primary)' }}>{t.name}</div>
            </div>
          ))}
        </div>

        <SectionHd icon="fa-shield-halved">Dein Team</SectionHd>
        <div className="team-grid">
          {SET_TEAMS.map(t => (
            <div key={t.id} className={'team-opt' + (team === t.id ? ' sel' : '')} style={{ background: t.color, color: t.txt }} onClick={() => setTeam(t.id)}>
              ⚔️ {t.name}
            </div>
          ))}
        </div>

        <SectionHd icon="fa-bell">Benachrichtigungen</SectionHd>
        <div className="card" style={{ padding: '4px 16px' }}>
          <div className="ms-row" onClick={() => setPush(v => !v)} style={{ cursor: 'pointer' }}>
            <span className="ms-name"><i className="fas fa-mobile-screen"></i>Push aktiv</span><Toggle on={push} />
          </div>
          <div className="ms-row" onClick={() => setRaidAlert(v => !v)} style={{ cursor: 'pointer' }}>
            <span className="ms-name"><i className="fas fa-tower-broadcast"></i>Raid-Alarm</span><Toggle on={raidAlert} />
          </div>
          <div className="ms-row" onClick={() => setSound(v => !v)} style={{ cursor: 'pointer', borderBottom: 'none' }}>
            <span className="ms-name"><i className="fas fa-volume-high"></i>Soundeffekte</span><Toggle on={sound} />
          </div>
        </div>

        <SectionHd icon="fa-gear">Konto</SectionHd>
        <div className="card" style={{ padding: '2px 16px' }}>
          <div className="menu-row"><i className="fas fa-user-pen"></i> Profil bearbeiten <i className="fas fa-chevron-right chev"></i></div>
          <div className="menu-row"><i className="fas fa-share-nodes"></i> Erfolge teilen <i className="fas fa-chevron-right chev"></i></div>
          <div className="menu-row"><i className="fas fa-circle-question"></i> Support <i className="fas fa-chevron-right chev"></i></div>
          <div className="menu-row" style={{ borderBottom: 'none', color: 'var(--red)' }}>
            <i className="fas fa-right-from-bracket" style={{ color: 'var(--red)' }}></i> Abmelden
          </div>
        </div>
        <div className="set-ver">Runners Conquer · Version 2.4.0 · Saison Juni</div>
      </div></div>
    </Shell>
  );
}

Object.assign(window, { OnboardingScreen, RunSummaryScreen, TerritoryScreen, SettingsScreen });
