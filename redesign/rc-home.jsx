// ============================================================
// Runners Conquer — REDESIGN · one app, unified navigation
// Bottom nav everywhere: Karte · Start · Community · Profil
// "Aktivität" is folded into Start. Each area has a clear structure.
// ============================================================
const { useState: useHomeState, useEffect: useHomeEffect, useRef: useHomeRef } = React;

/* Single, consistent bottom navigation (same on every screen) */
const NAV = [
  { id: 'karte', icon: 'fa-map', label: 'Karte' },
  { id: 'start', icon: 'fa-house', label: 'Start' },
  { id: 'community', icon: 'fa-globe', label: 'Community' },
  { id: 'profil', icon: 'fa-user', label: 'Profil' },
];

/* ── Header: greeting mode (Start) or title mode (Community/Profil) ── */
function AppHeader({ greeting, title, sub }) {
  return (
    <header className="app-hdr">
      {greeting ? (
        <>
          <img className="hdr-mark" src="assets/logo-mark-t.png" alt="Runners Conquer" />
          <div className="hdr-greet">
            <span className="hg-hi">{title}</span>
            <span className="hg-sub">{sub}</span>
          </div>
        </>
      ) : (
        <div className="hdr-titlewrap">
          <span className="hdr-title">{title}</span>
          {sub && <span className="hdr-title-sub">{sub}</span>}
        </div>
      )}
      <div className="hdr-right">
        <span className="hdr-flame"><i className="fas fa-fire"></i>{RC.player.streak}</span>
        <button className="icon-btn"><i className="fas fa-gear"></i></button>
      </div>
    </header>
  );
}

/* ── Bottom nav (4 items + central Play/Stop FAB, identical everywhere) ── */
function BottomNav({ view, onNav, running, onToggle }) {
  return (
    <nav className="bottom-nav with-fab">
      {NAV.slice(0, 2).map(n => (
        <div key={n.id} className={'nav-item' + (view === n.id ? ' active' : '')} onClick={() => onNav(n.id)}>
          <div className="nav-ind"></div>
          <i className={'fas ' + n.icon}></i><span>{n.label}</span>
        </div>
      ))}
      <button className={'nav-fab' + (running ? ' is-running' : '')} onClick={onToggle}
        aria-label={running ? 'Lauf stoppen' : 'Lauf starten'}>
        <i className={'fas ' + (running ? 'fa-stop' : 'fa-play')}></i>
      </button>
      {NAV.slice(2).map(n => (
        <div key={n.id} className={'nav-item' + (view === n.id ? ' active' : '')} onClick={() => onNav(n.id)}>
          <div className="nav-ind"></div>
          <i className={'fas ' + n.icon}></i><span>{n.label}</span>
        </div>
      ))}
    </nav>
  );
}

/* ── START — home + activity hub ──
   Aufbau: Hero (START) → Diese Woche → Kernzahlen → Heute (Quests) → Letzte Läufe */
function StartHome({ running, onToggle, onNav }) {
  return (
    <div className="view"><div className="home">
      <div className="hero">
        <div className="hero-eyebrow">Heute</div>
        <div className="hero-line">Bereit, {RC.player.name}?</div>
        <div className="hero-sub">Starte deinen Lauf und sichere dir neue Gebiete für dein Revier.</div>
        <div className="hero-row">
          <button className="hero-start" onClick={running ? () => onNav('karte') : onToggle}>
            <i className={'fas ' + (running ? 'fa-location-arrow' : 'fa-play')}></i>{running ? 'LAUF ANSEHEN' : 'START'}
          </button>
          <div className="hero-energy"><div className="he-v">⚡{RC.energy}</div><div className="he-l">Energie</div></div>
        </div>
      </div>

      <SectionHd icon="fa-chart-simple">Diese Woche</SectionHd>
      <WeekGoal />

      <div className="stat-grid" style={{ marginTop: 8 }}>
        {RC.stats.map((s, i) => <StatCard key={i} v={s.v} l={s.l} />)}
      </div>

      <SectionHd icon="fa-gift">Heute zu tun</SectionHd>
      <QuestGrid />

      <SectionHd icon="fa-clock-rotate-left">Letzte Läufe</SectionHd>
      {RC.recent.map((r, i) => (
        <div key={i} className="run-card">
          <div className="run-thumb"><div className="run-route"></div></div>
          <div className="run-stats">
            <div className="run-stat"><div className="v">{r.km}</div><div className="l">km</div></div>
            <div className="run-stat"><div className="v">{r.t}</div><div className="l">Zeit</div></div>
            <div className="run-stat"><div className="v">{r.p}</div><div className="l">Pace</div></div>
          </div>
          <span className="tag-win">{r.w}</span>
        </div>
      ))}
    </div></div>
  );
}

/* ── App wrapper (one interactive phone) ── */
function ConqApp({ initialView }) {
  const [view, setView] = useHomeState(initialView || 'start');
  const [running, setRunning] = useHomeState(false);
  const [live, setLive] = useHomeState({ km: '0.00', time: '00:00', pace: '5:14', hr: 152, cad: 172 });
  const [toast, setToast] = useHomeState('');
  const tRef = useHomeRef(null);

  function showToast(msg) {
    setToast(msg);
    clearTimeout(tRef.current);
    tRef.current = setTimeout(() => setToast(''), 2400);
  }
  useHomeEffect(() => {
    if (!running) return;
    let t = 0, km = 0;
    const id = setInterval(() => {
      t += 1; km += 0.0042 * (3 + Math.random());
      const m = String(Math.floor(t / 60)).padStart(2, '0'), s = String(t % 60).padStart(2, '0');
      const pSec = 270 + Math.floor(Math.random() * 50);
      setLive({
        km: km.toFixed(2), time: `${m}:${s}`,
        pace: `${Math.floor(pSec / 60)}:${String(pSec % 60).padStart(2, '0')}`,
        hr: 150 + Math.floor(Math.random() * 20),
        cad: 168 + Math.floor(Math.random() * 10),
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
      setLive({ km: '0.00', time: '00:00', pace: '5:14', hr: 152, cad: 172 });
      showToast('🏃 Lauf gestartet · GPS aktiv');
      setView('karte');
    }
  }

  const isMap = view === 'karte';

  return (
    <div className="screen">
      <StatusBar />
      {view === 'start' && <AppHeader greeting title={`Hallo, ${RC.player.name}`} sub="Samstag · 14. Juni" />}
      {view === 'community' && <AppHeader title="Community" sub="Saison Juni" />}
      {view === 'profil' && <AppHeader title="Profil" />}
      <div className={'toast' + (toast ? ' show' : '')}>{toast}</div>

      {view === 'start' && <StartHome running={running} onToggle={toggleRun} onNav={setView} />}
      {isMap && <MapScreen running={running} live={live} onToggle={toggleRun} />}
      {view === 'community' && <CommunityScreen />}
      {view === 'profil' && <ProfileScreen />}

      <BottomNav view={view} onNav={setView} running={running} onToggle={toggleRun} />
    </div>
  );
}

Object.assign(window, { NAV, AppHeader, BottomNav, StartHome, ConqApp });
