// ============================================================
// Runners Conquer — REDESIGN · shared screens
// MapCanvas + RunDock + Dashboard + Community + Profile
// ============================================================
const { useState: useScr } = React;

/* ── Small toggle switch ── */
function Toggle({ on }) {
  return <span className={'tgl' + (on ? ' on' : '')}><span className="tgl-dot"></span></span>;
}

/* ── Reusable faux map (layers + style configurable) ── */
function MapCanvas({ running, layers, mapStyle }) {
  const L = layers || { terr: true, land: true, heatmap: false, fog: false };
  const styleBg = { dunkel: '#0a1410', satellit: '#0b1622', gelaende: '#10261a' }[mapStyle || 'dunkel'];
  const terrs = [
    { x: 6, y: 9, w: 26, h: 18, c: '#FF4D6D', lbl: '👑 Marktplatz' },
    { x: 40, y: 6, w: 30, h: 16, c: '#E6FF55', lbl: '👑 Dein Revier' },
    { x: 66, y: 30, w: 28, h: 22, c: '#9B5DE5', lbl: 'Stadtpark' },
    { x: 8, y: 58, w: 22, h: 18, c: '#00D4FF', lbl: 'Bahnhof' },
    { x: 38, y: 54, w: 26, h: 20, c: '#E6FF55', lbl: '👑 Altstadt' },
  ];
  const landmarks = [
    { x: 24, y: 20, e: '🏰', c: '#FFD700' },
    { x: 80, y: 16, e: '🌉', c: '#00D4FF' },
    { x: 52, y: 66, e: '🏟️', c: '#FF4D6D' },
    { x: 16, y: 80, e: '🗿', c: '#9B5DE5' },
  ];
  return (
    <div className="map-wrap" style={{ background: styleBg }}>
      {[18, 38, 58, 78].map(t => <div key={'h' + t} className="map-grid-line" style={{ left: 0, right: 0, top: t + '%', height: 1 }}></div>)}
      {[22, 46, 70].map(l => <div key={'v' + l} className="map-grid-line" style={{ top: 0, bottom: 0, left: l + '%', width: 1 }}></div>)}
      <div className="map-road" style={{ left: 0, right: 0, top: '32%', height: 3 }}></div>
      <div className="map-road" style={{ left: 0, right: 0, top: '72%', height: 3 }}></div>
      <div className="map-road" style={{ top: 0, bottom: 0, left: '34%', width: 3 }}></div>
      <div className="map-road" style={{ top: 0, bottom: 0, left: '70%', width: 3 }}></div>
      {L.heatmap && <div className="map-heat"></div>}
      {L.terr && terrs.map((t, i) => (
        <div key={i} className="terr" style={{ left: t.x + '%', top: t.y + '%', width: t.w + '%', height: t.h + '%', background: t.c + '22', borderColor: t.c + '88' }}>
          <span className="terr-lbl" style={{ top: 5, left: 5, color: t.c, background: 'rgba(0,0,0,.45)' }}>{t.lbl}</span>
        </div>
      ))}
      {L.land && landmarks.map((l, i) => (
        <div key={i} className="landmark" style={{ left: l.x + '%', top: l.y + '%', background: l.c }}>{l.e}</div>
      ))}
      <svg className="gps-trail" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ left: '18%', top: '40%', width: '48%', height: '34%' }}>
        <polyline points="5,90 25,70 40,72 55,40 78,28 95,8" fill="none" stroke="var(--primary)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ vectorEffect: 'non-scaling-stroke' }} />
      </svg>
      {running && <div className="runner-pin" style={{ left: '56%', top: '50%' }}>🏃</div>}
      {L.fog && <div className="map-fog"></div>}
    </div>
  );
}

/* ── Live metrics block (shared by dock + sheet) ── */
function LiveMetrics({ live }) {
  return (
    <>
      <div className="live-grid">
        <div className="live-card"><div className="live-v">{live.km}</div><div className="live-l">km</div></div>
        <div className="live-card"><div className="live-v">{live.time}</div><div className="live-l">Zeit</div></div>
      </div>
      <div className="live-row">
        <div className="live-pill"><i className="fas fa-bolt"></i><b>{live.pace}</b> /km</div>
        <div className="live-pill"><i className="fas fa-heart-pulse"></i><b>{live.hr}</b> bpm</div>
        <div className="live-pill"><i className="fas fa-shoe-prints"></i><b>{live.cad}</b></div>
      </div>
    </>
  );
}

/* ── Run dock for the Karte tab ── */
function RunDock({ running, live, onToggle }) {
  return (
    <div className="run-dock">
      {running ? (
        <>
          <LiveMetrics live={live} />
          <div className="dock-btns">
            <button className="btn"><i className="fas fa-pause"></i> PAUSE</button>
            <button className="btn btn-p" onClick={onToggle}><i className="fas fa-stop"></i> STOP</button>
          </div>
        </>
      ) : (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 11 }}>
            <span className="label">Bereit zu laufen</span>
            <span style={{ fontFamily: 'var(--font-display)', color: 'var(--primary)', letterSpacing: 1 }}>⚡ Energie {RC.energy}%</span>
          </div>
          <div className="dock-btns">
            <button className="btn btn-p glow" onClick={onToggle}><i className="fas fa-play"></i> START</button>
            <button className="btn"><i className="fas fa-heart"></i></button>
          </div>
        </>
      )}
    </div>
  );
}

/* ── KARTE tab (full-bleed map + overlay header + map settings + run dock) ── */
function MapScreen({ running, live, onToggle }) {
  const [open, setOpen] = useScr(false);
  const [mapStyle, setMapStyle] = useScr('dunkel');
  const [layers, setLayers] = useScr({ terr: true, land: true, heatmap: false, fog: false });
  const tog = (k) => setLayers(s => ({ ...s, [k]: !s[k] }));
  const LAYER_DEFS = [
    { k: 'heatmap', icon: 'fa-fire', name: 'Heatmap' },
    { k: 'fog', icon: 'fa-cloud', name: 'Nebel des Krieges' },
    { k: 'terr', icon: 'fa-vector-square', name: 'Gebiete' },
    { k: 'land', icon: 'fa-chess-rook', name: 'Wahrzeichen' },
  ];
  const STYLES = [
    { k: 'dunkel', name: 'Dunkel' },
    { k: 'satellit', name: 'Satellit' },
    { k: 'gelaende', name: 'Gelände' },
  ];
  return (
    <div className="view" style={{ overflow: 'hidden' }}>
      <MapCanvas running={running} layers={layers} mapStyle={mapStyle} />
      <div className="map-scrim"></div>

      <div className="map-topbar">
        <img className="hdr-mark" src="assets/logo-mark-t.png" alt="Runners Conquer" />
        <div className="map-title">
          <span className="mt-1">Dein Revier</span>
          <span className="mt-2">23 Gebiete · Platz 5</span>
        </div>
        <span className="hdr-flame"><i className="fas fa-fire"></i>{RC.player.streak}</span>
        <button className="icon-btn"><i className="fas fa-gear"></i></button>
      </div>

      <div className="map-legend">
        <span><i className="fas fa-square" style={{ color: 'var(--primary)' }}></i> Du</span>
        <span><i className="fas fa-square" style={{ color: 'var(--red)' }}></i> Rivale</span>
        <span><i className="fas fa-crown" style={{ color: 'var(--gold)' }}></i> Wahrzeichen</span>
      </div>

      {/* Side button → map settings (Karteneinstellungen) */}
      <button className={'map-side-btn' + (open ? ' active' : '')} onClick={() => setOpen(o => !o)} aria-label="Karteneinstellungen">
        <i className={'fas ' + (open ? 'fa-xmark' : 'fa-layer-group')}></i>
      </button>
      <div className={'map-settings' + (open ? ' open' : '')}>
        <div className="ms-head"><i className="fas fa-sliders"></i> Karte</div>
        <div className="ms-label">Ebenen</div>
        {LAYER_DEFS.map(d => (
          <div key={d.k} className="ms-row" onClick={() => tog(d.k)}>
            <span className="ms-name"><i className={'fas ' + d.icon}></i>{d.name}</span>
            <Toggle on={layers[d.k]} />
          </div>
        ))}
        <div className="ms-label">Kartenstil</div>
        <div className="ms-styles">
          {STYLES.map(s => (
            <button key={s.k} className={'ms-style' + (mapStyle === s.k ? ' on' : '')} onClick={() => setMapStyle(s.k)}>{s.name}</button>
          ))}
        </div>
      </div>

      <div className="locate-fab" style={{ bottom: running ? 200 : 30 }}><i className="fas fa-location-arrow"></i></div>

      {running && (
        <div className="run-dock" style={{ bottom: 26 }}>
          <LiveMetrics live={live} />
          <button className="btn" style={{ width: '100%' }}><i className="fas fa-pause"></i> PAUSE</button>
        </div>
      )}
    </div>
  );
}

/* ── COMMUNITY tab ── */
function CommunityScreen() {
  const news = [
    { i: '⚔️', t: 'SpeedKing hat Marktplatz erobert', s: 'vor 12 Min' },
    { i: '🏆', t: 'Du wurdest Baron von Altstadt', s: 'vor 1 Std' },
    { i: '🛡️', t: 'Dein Revier wurde verteidigt', s: 'vor 3 Std' },
  ];
  return (
    <div className="view"><div className="pad">
      <div className="card" style={{ marginBottom: 16 }}>
        <SectionHd icon="fa-flag-checkered" style={{ margin: '0 0 6px' }}>Saison · Juni</SectionHd>
        <div className="list-row" style={{ borderBottom: 'none' }}>
          <i className="fas fa-hourglass-half" style={{ color: 'var(--primary)', width: 22, textAlign: 'center' }}></i>
          <div><div className="lr-name" style={{ fontSize: '.85rem' }}>Saison endet in 8 Tagen</div><div className="lr-sub">Halte Platz 5 für das Abzeichen</div></div>
          <span className="lr-score">8d</span>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <SectionHd icon="fa-medal" style={{ margin: '0 0 4px' }}>Rangliste</SectionHd>
        <Leaderboard />
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <SectionHd icon="fa-newspaper" style={{ margin: '0 0 6px' }}>Aktuelle News</SectionHd>
        {news.map((n, i) => (
          <div key={i} className="list-row">
            <span className="lr-av" style={{ fontSize: '1.1rem' }}>{n.i}</span>
            <div><div className="lr-name" style={{ fontSize: '.84rem' }}>{n.t}</div><div className="lr-sub">{n.s}</div></div>
          </div>
        ))}
      </div>

      <SectionHd icon="fa-location-arrow">Nächste Gebiete</SectionHd>
      <div className="card" style={{ padding: '2px 16px' }}>
        {RC.near.map((t, i) => (
          <div key={i} className="list-row">
            <span className="terr-dot" style={{ background: t.c }}></span>
            <div><div className="lr-name" style={{ fontSize: '.84rem' }}>{t.nm}</div><div className="lr-sub">{t.sub}</div></div>
            <button className="pill" style={{ marginLeft: 'auto' }}>→ FLY</button>
          </div>
        ))}
      </div>
    </div></div>
  );
}

/* ── PROFIL tab ── */
function ProfileScreen() {
  const prs = [
    { i: '🏃', l: '5 km', v: '23:41' },
    { i: '🏅', l: '10 km', v: '49:02' },
    { i: '🏆', l: 'Halbmarathon', v: '1:52:18' },
  ];
  const ach = ['⚡ Schnellster', '🗺️ Explorer', '🔥 Unstoppable', '👑 Erster Baron', '🌉 Brücken-Herr'];
  return (
    <div className="view"><div className="pad">
      <div className="pv-banner">
        <div className="pv-crown"><i className="fas fa-crown"></i></div>
        <div className="pv-av">{RC.player.avatar}</div>
        <div className="pv-name">{RC.player.full}</div>
        <div className="pv-since">Läufer seit Jan 2025 · Level {RC.player.level}</div>
        <div style={{ marginTop: 10 }}><RulerBadge title="BARON VON ALTSTADT" /></div>
      </div>
      <div className="pv-stats">
        <StatCard v="142" l="km" />
        <StatCard v="23" l="Gebiete" />
        <StatCard v="4.280" l="Punkte" />
        <StatCard v="12🔥" l="Streak" />
      </div>
      <div className="card">
        <SectionHd icon="fa-layer-group" style={{ margin: '0 0 12px' }}>Level-Fortschritt</SectionHd>
        <div className="lvl-row">
          <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', color: 'var(--primary)', letterSpacing: 1 }}>Lv.{RC.player.level}</span>
          <div className="xp-bar"><div className="xp-fill" style={{ width: '64%' }}></div></div>
          <span className="lr-sub">2.840 / 4.400 XP</span>
        </div>
        <div className="lr-sub">Noch 1.560 XP bis Level {RC.player.level + 1}</div>
      </div>
      <div className="card" style={{ marginTop: 14 }}>
        <SectionHd icon="fa-crown" style={{ margin: '0 0 12px' }}>Herrschaft</SectionHd>
        <div className="dominion">
          <div className="dom-card"><div className="dom-v">3</div><div className="dom-l">Gebiete regiert</div></div>
          <div className="dom-card"><div className="dom-v">2</div><div className="dom-l">Wahrzeichen</div></div>
          <div className="dom-card"><div className="dom-v">47</div><div className="dom-l">Verteidigt</div></div>
          <div className="dom-card"><div className="dom-v">9</div><div className="dom-l">Raids gewonnen</div></div>
        </div>
        <div className="chips" style={{ marginTop: 12 }}>
          <RarityTag tier="Legendär" /><RarityTag tier="Episch" /><RarityTag tier="Selten" />
        </div>
      </div>
      <div className="card" style={{ marginTop: 14 }}>
        <SectionHd icon="fa-medal" style={{ margin: '0 0 4px' }}>Bestleistungen</SectionHd>
        {prs.map((p, i) => (
          <div key={i} className="pr-row"><span className="pr-icon">{p.i}</span><span className="pr-label">{p.l}</span><span className="pr-val">{p.v}</span></div>
        ))}
      </div>
      <div className="card" style={{ marginTop: 14 }}>
        <SectionHd icon="fa-star" style={{ margin: '0 0 12px' }}>Erfolge</SectionHd>
        <div className="chips">{ach.map((a, i) => <span key={i} className="ach">{a}</span>)}</div>
      </div>
    </div></div>
  );
}

Object.assign(window, { MapCanvas, Toggle, LiveMetrics, RunDock, MapScreen, CommunityScreen, ProfileScreen });
