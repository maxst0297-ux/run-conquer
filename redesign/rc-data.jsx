// ============================================================
// Runners Conquer — REDESIGN · shared data & primitives
// Same visual language as the DS app kit; cleaner composition.
// ============================================================
const { useState: useRcState, useEffect: useRcEffect, useRef: useRcRef } = React;

/* ── Shared content ── */
const RC = {
  player: { name: 'Max', full: 'Max_Runner', avatar: '🏃', level: 7, streak: 12 },
  energy: 100,
  weekKm: 18.4, weekGoal: 40,
  week: [80, 45, 65, 0, 55, 30, 0],
  wdLbl: ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'],
  stats: [
    { v: '142', l: 'km gesamt' },
    { v: '23', l: 'Gebiete' },
    { v: '12🔥', l: 'Streak' },
  ],
  quests: [
    { e: '🏃', name: 'Laufe 5 km', meta: 'Heute', pct: 100, pts: 250, done: true },
    { e: '⚔️', name: 'Erobere 3 Gebiete', meta: '2 von 3', pct: 66, pts: 400, done: false },
    { e: '🛡️', name: 'Verteidige dein Revier', meta: '2 von 5', pct: 40, pts: 300, done: false },
  ],
  board: [
    { r: 1, av: '⚡', nm: 'SpeedKing', area: '48.200', streak: 7, sc: '6.840', rc: '#FFD700', title: 'Imperator' },
    { r: 2, av: '🐺', nm: 'MountainGoat', area: '31.500', streak: 5, sc: '4.290', rc: '#C0C0C0', title: 'König' },
    { r: 3, av: '🦊', nm: 'NightOwl', area: '22.100', streak: 3, sc: '2.915', rc: '#CD7F32', title: 'Herzog' },
    { r: 4, av: '🏋️', nm: 'IronRunner', area: '18.700', streak: 2, sc: '1.780', rc: '#5A8A6E', title: 'Baron' },
  ],
  me: { r: 5, area: '14.200', streak: 12, sc: '1.640' },
  near: [
    { c: '#FF4D6D', nm: 'Marktplatz', sub: '380 m · feindlich · 👑 SpeedKing' },
    { c: '#5A8A6E', nm: 'Bahnhof Nord', sub: '610 m · neutral' },
    { c: '#9B5DE5', nm: 'Stadtpark', sub: '850 m · Rivale · 👑 NightOwl' },
  ],
  recent: [
    { km: '8.2', t: '42:17', p: '5:09', w: '+3 Gebiete' },
    { km: '5.0', t: '24:51', p: '4:58', w: 'verteidigt' },
  ],
};

const RULER_TIERS = ['Neuling', 'Besitzer', 'Baron', 'Herzog', 'König', 'Imperator'];

/* ── Status bar (faux iOS) ── */
function StatusBar() {
  return (
    <div className="statusbar">
      <span>9:41</span>
      <span className="sb-r">
        <i className="fas fa-signal"></i>
        <i className="fas fa-wifi"></i>
        <i className="fas fa-battery-three-quarters"></i>
      </span>
    </div>
  );
}

/* ── Primitives ── */
function SectionHd({ icon, children, style }) {
  return <div className="sec-hd" style={style}><i className={'fas ' + icon}></i>{children}</div>;
}
function StatCard({ v, l }) {
  return <div className="stat-card"><div className="sv">{v}</div><div className="sl">{l}</div></div>;
}
function RulerBadge({ title }) {
  return <span className="ruler-badge"><i className="fas fa-crown"></i>{title}</span>;
}
function RarityTag({ tier }) {
  const map = { Selten: '#00D4FF', Episch: '#9B5DE5', 'Legendär': '#FFD700', 'Gewöhnlich': '#5A8A6E' };
  const c = map[tier];
  return <span className="rar-tag" style={{ color: c, borderColor: c + '70', background: c + '1a' }}>{tier}</span>;
}

/* ── Weekly goal bar + day columns (shared) ── */
function WeekGoal({ compact }) {
  const pct = Math.round((RC.weekKm / RC.weekGoal) * 100);
  return (
    <div className="focus">
      <div className="focus-top">
        <span className="ft-l"><i className="fas fa-bullseye" style={{ marginRight: 6 }}></i>Wochenziel</span>
        <span className="ft-v"><b>{RC.weekKm.toString().replace('.', ',')}</b> / {RC.weekGoal} km</span>
      </div>
      <div className="bar-bg"><div className="bar-fill" style={{ width: pct + '%' }}></div></div>
      {!compact && (
        <div className="week-days">
          {RC.week.map((h, i) => (
            <div key={i} className="wd">
              <div className="wd-bar"><div className="wd-fill" style={{ height: h + '%' }}></div></div>
              <div className="wd-l">{RC.wdLbl[i]}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Clean quest row (Klar/shared) ── */
function QuestRow({ q }) {
  return (
    <div className="tquest">
      <div className={'tq-check' + (q.done ? ' done' : '')}>
        {q.done ? <i className="fas fa-check"></i> : q.e}
      </div>
      <div className="tq-body">
        <div className="tq-name">{q.name}</div>
        <div className="tq-meta">{q.meta} · 🎁 {q.pts}</div>
        {!q.done && <div className="mini-bar"><span style={{ width: q.pct + '%' }}></span></div>}
      </div>
      {q.done && <span className="tq-pts">✓</span>}
    </div>
  );
}

/* ── Quest cards (Liga-style reward grid) ── */
function QuestGrid({ quests = RC.quests, more = true }) {
  return (
    <div className="reward-grid">
      {quests.map((q, i) => (
        <div key={i} className={'reward' + (q.done ? ' done' : '')}>
          <div className="reward-top">
            <span className="reward-emoji">{q.e}</span>
            <span className="reward-gift">{q.done ? '✓ Fertig' : '🎁 ' + q.pts}</span>
          </div>
          <div className="reward-name">{q.name}</div>
          <div className="reward-meta">{q.meta}</div>
          <div className="reward-bar"><span style={{ width: q.pct + '%' }}></span></div>
        </div>
      ))}
      {more && (
        <div className="reward reward-more">
          <span className="reward-emoji">➕</span>
          <div className="reward-name" style={{ minHeight: 0 }}>Mehr Quests</div>
        </div>
      )}
    </div>
  );
}

/* ── Leaderboard (shared, slightly cleaner) ── */
function Leaderboard({ rows = RC.board, showMe = true }) {
  return (
    <>
      {rows.map(b => (
        <div key={b.r} className="list-row">
          <span className="lr-rank" style={{ color: b.rc }}>{b.r}</span>
          <span className="lr-av">{b.av}</span>
          <div>
            <div className="lr-name">{b.nm}</div>
            <div className="lr-sub"><span style={{ color: 'var(--gold)', fontWeight: 700 }}>👑 {b.title}</span> · {b.area} m²</div>
          </div>
          <span className="lr-score">{b.sc}</span>
        </div>
      ))}
      {showMe && (
        <div className="list-row me-row" style={{ borderBottom: 'none' }}>
          <span className="lr-rank" style={{ color: 'var(--primary)' }}>{RC.me.r}</span>
          <span className="lr-av">🏃</span>
          <div>
            <div className="lr-name" style={{ color: 'var(--primary)' }}>Du</div>
            <div className="lr-sub">{RC.me.area} m² · {RC.me.streak}🔥</div>
          </div>
          <span className="lr-score">{RC.me.sc}</span>
        </div>
      )}
    </>
  );
}

Object.assign(window, {
  RC, RULER_TIERS, StatusBar, SectionHd, StatCard, RulerBadge, RarityTag,
  WeekGoal, QuestRow, QuestGrid, Leaderboard,
});
