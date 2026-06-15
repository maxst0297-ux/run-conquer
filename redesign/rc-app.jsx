// ============================================================
// Runners Conquer — REDESIGN · runnable app mount
// Renders one full-screen ConqApp (Karte · Start · Community · Profil)
// plus a small launcher to preview the 4 standalone flow screens.
// ============================================================
const { useState: useApp } = React;

const RC_FLOWS = [
  { id: 'onboarding', label: 'Onboarding',     icon: 'fa-right-to-bracket', render: () => <OnboardingScreen /> },
  { id: 'summary',    label: 'Lauf-Ende',      icon: 'fa-flag-checkered',   render: () => <RunSummaryScreen /> },
  { id: 'territory',  label: 'Gebiet-Detail',  icon: 'fa-location-dot',     render: () => <TerritoryScreen /> },
  { id: 'settings',   label: 'Einstellungen',  icon: 'fa-gear',            render: () => <SettingsScreen /> },
];

function RCApp() {
  const [flow, setFlow] = useApp(null);
  const [menu, setMenu] = useApp(false);
  const cur = RC_FLOWS.find(f => f.id === flow);

  return (
    <div className="rc-stage">
      <div className="rc-phone rc-app-phone"><ConqApp initialView="start" /></div>

      {cur && (
        <div className="rc-flow">
          {cur.render()}
          <button className="rc-flow-close" onClick={() => setFlow(null)}>
            <i className="fas fa-arrow-left"></i> Zurück zur App
          </button>
        </div>
      )}

      <div className="rc-launch">
        {menu && (
          <div className="rc-launch-menu">
            <div className="rc-launch-hd">Weitere Screens</div>
            {RC_FLOWS.map(f => (
              <button key={f.id} onClick={() => { setFlow(f.id); setMenu(false); }}>
                <i className={'fas ' + f.icon}></i>{f.label}
              </button>
            ))}
          </div>
        )}
        <button className="rc-launch-btn" onClick={() => setMenu(m => !m)} aria-label="Screens">
          <i className={'fas ' + (menu ? 'fa-xmark' : 'fa-table-cells-large')}></i>
        </button>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<RCApp />);
