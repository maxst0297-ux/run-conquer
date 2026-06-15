/* ============================================================
   WAPPEN-SCHMIEDE — Builder app (phone screen)
   Two tabs: SCHMIEDE (build) · GALERIE (overview of saved crests)
   Persistence: localStorage. cfg = single source of truth (see crest.jsx)
   ============================================================ */
const { useState, useEffect, useRef } = React;

const EXTRAS = [
  { id:'crown',  fa:'fa-crown',  label:'Krone' },
  { id:'banner', fa:'fa-ribbon', label:'Banner' },
  { id:'stars',  fa:'fa-star',   label:'Sterne' },
  { id:'laurel', fa:'fa-leaf',   label:'Lorbeer' },
  { id:'swords', fa:'fa-khanda', label:'Schwerter' },
];
const EFFECTS = [
  { id:'lime',     fa:'fa-bolt',               label:'Lime-Glow' },
  { id:'gold',     fa:'fa-crown',              label:'Gold-Glanz', gold:true },
  { id:'metallic', fa:'fa-gem',                label:'Metallic' },
  { id:'inner',    fa:'fa-circle-half-stroke', label:'Tiefe' },
];

const STORE = 'rc_wappen_v1';
const SAVED = 'rc_wappen_saved_v2';

const DEFAULT = {
  name:'Sturmläufer',
  shape:'heater', division:'voll', pattern:'topo', symbol:'run', symColor:'auto',
  bg:'#0D3D2C', bg2:'#042D22', border:'#E6FF55',
  extras:{ crown:true, banner:true, stars:true, laurel:true, swords:true },
  effects:{ lime:true, gold:false, metallic:false, inner:true },
};

function load(){
  try{ const j=JSON.parse(localStorage.getItem(STORE)); if(j&&j.shape) return {...DEFAULT,...j,
        extras:{...DEFAULT.extras,...(j.extras||{})}, effects:{...DEFAULT.effects,...(j.effects||{})}}; }catch(e){}
  return DEFAULT;
}
function loadSaved(){ try{ return JSON.parse(localStorage.getItem(SAVED))||[]; }catch(e){ return []; } }

/* ── Small building blocks ── */
function Section({ icon, title, hint, children }){
  return (
    <div className="sec">
      <div className="sec-hd"><i className={'fa-solid '+icon}></i><span>{title}</span>
        {hint && <span className="sec-hint">{hint}</span>}</div>
      {children}
    </div>
  );
}
function Swatches({ value, onChange, auto }){
  return (
    <div className="sw-row">
      {auto && (
        <button className={'sw sw-auto'+(value==='auto'?' sel':'')} title="Automatisch (Kontrast)"
                onClick={()=>onChange('auto')}>
          <i className="fa-solid fa-wand-magic-sparkles"></i>
        </button>
      )}
      {PALETTE.map(c=>(
        <button key={c.hex} className={'sw'+(value===c.hex?' sel':'')} title={c.name}
                style={{ background:c.hex }} onClick={()=>onChange(c.hex)}>
          {value===c.hex && <i className="fa-solid fa-check"
            style={{ color: isLight(c.hex)?'#10271d':'#fff' }}></i>}
        </button>
      ))}
    </div>
  );
}

/* ── Gallery card ── */
function GalleryCard({ item, onLoad, onDelete }){
  return (
    <div className="gal-card">
      <button className="gal-del" title="Löschen" onClick={onDelete}><i className="fa-solid fa-xmark"></i></button>
      <div className="gal-crest"><Crest cfg={item} size={132}/></div>
      <div className="gal-name">{(item.name||'Wappen').trim()||'Wappen'}</div>
      <button className="gal-load" onClick={onLoad}><i className="fa-solid fa-pen"></i> Bearbeiten</button>
    </div>
  );
}

function App(){
  const [tab, setTab]   = useState('build');
  const [cfg, setCfg]   = useState(load);
  const [toast, setToast] = useState('');
  const [saved, setSaved] = useState(loadSaved);
  const tRef = useRef(null);

  useEffect(()=>{ localStorage.setItem(STORE, JSON.stringify(cfg)); }, [cfg]);
  useEffect(()=>{ localStorage.setItem(SAVED, JSON.stringify(saved)); }, [saved]);

  const set = (k,v)=>setCfg(c=>({ ...c, [k]:v }));
  const toggle = (group,id)=>setCfg(c=>({ ...c, [group]:{ ...c[group], [id]:!c[group][id] } }));

  function flash(msg){
    setToast(msg); clearTimeout(tRef.current);
    tRef.current = setTimeout(()=>setToast(''), 2200);
  }
  function save(){
    setSaved(arr=>[{ ...cfg, ts:Date.now() }, ...arr].slice(0,24));
    flash('🛡️ „'+(cfg.name||'Wappen').trim()+'“ gesichert!');
  }
  function dice(){ setCfg(c=>randomCfg(c)); flash('🎲 Neu gewürfelt!'); }

  return (
    <React.Fragment>
      {/* header */}
      <div className="app-hdr">
        <button className="icon-btn"><i className="fa-solid fa-chevron-left"></i></button>
        <div className="hdr-title">WAPPEN-SCHMIEDE</div>
        {tab==='build' && (
          <button className="icon-btn dice-btn" style={{ marginLeft:'auto' }} onClick={dice} title="Zufall">
            <i className="fa-solid fa-dice"></i></button>
        )}
      </div>

      {/* tabs */}
      <div className="tabs">
        <button className={'tab'+(tab==='build'?' on':'')} onClick={()=>setTab('build')}>
          <i className="fa-solid fa-hammer"></i> Schmiede</button>
        <button className={'tab'+(tab==='gallery'?' on':'')} onClick={()=>setTab('gallery')}>
          <i className="fa-solid fa-layer-group"></i> Galerie{saved.length>0 && <span className="tab-badge">{saved.length}</span>}</button>
      </div>

      <div className="view">
        {tab==='build' ? (
          <div className="bld">
            {/* live preview */}
            <div className="bld-stage">
              <div className="stage-glow"></div>
              <Crest cfg={cfg} size={216}/>
              {!cfg.extras.banner &&
                <div className="crest-name-out">{(cfg.name||'DEIN CLUB').trim()||'DEIN CLUB'}</div>}
              <div className="stage-tag"><i className="fa-solid fa-bolt"></i> Live-Vorschau</div>
            </div>

            {/* name */}
            <div className="field2">
              <label className="lbl2">Vereinsname</label>
              <input value={cfg.name} maxLength={18} placeholder="z.B. Sturmläufer"
                     onChange={e=>set('name', e.target.value)}/>
            </div>

            {/* form */}
            <Section icon="fa-shapes" title="Form" hint={SHAPES.length+' Formen'}>
              <div className="grid-row">
                {SHAPES.map(s=>(
                  <button key={s.id} className={'chip'+(cfg.shape===s.id?' sel':'')} onClick={()=>set('shape',s.id)}>
                    <ShapeMini d={s.d} sel={cfg.shape===s.id}/><span>{s.label}</span>
                  </button>
                ))}
              </div>
            </Section>

            {/* division */}
            <Section icon="fa-table-columns" title="Teilung" hint="2 Farben">
              <div className="grid-row">
                {DIVISIONS.map(d=>(
                  <button key={d.id} className={'chip'+(cfg.division===d.id?' sel':'')} onClick={()=>set('division',d.id)}>
                    <DivisionMini div={d.id} sel={cfg.division===d.id}/><span>{d.label}</span>
                  </button>
                ))}
              </div>
            </Section>

            {/* pattern */}
            <Section icon="fa-border-all" title="Muster" hint={PATTERNS.length+' Muster'}>
              <div className="grid-row">
                {PATTERNS.map(p=>(
                  <button key={p.id} className={'chip'+(cfg.pattern===p.id?' sel':'')} onClick={()=>set('pattern',p.id)}>
                    <PatternMini pat={p.id} sel={cfg.pattern===p.id}/><span>{p.label}</span>
                  </button>
                ))}
              </div>
            </Section>

            {/* symbol */}
            <Section icon="fa-icons" title="Symbol" hint={SYMBOLS.length+' Symbole'}>
              <div className="icon-grid">
                {SYMBOLS.map(s=>(
                  <button key={s.id} className={'icon-chip'+(cfg.symbol===s.id?' sel':'')} title={s.label}
                          onClick={()=>set('symbol',s.id)}>
                    <i className={'fa-solid '+s.fa}></i>
                  </button>
                ))}
              </div>
            </Section>

            {/* symbol colour */}
            <Section icon="fa-palette" title="Symbol-Farbe">
              <Swatches value={cfg.symColor} onChange={v=>set('symColor',v)} auto/>
            </Section>

            {/* background colour A */}
            <Section icon="fa-fill-drip" title="Hintergrund-Farbe">
              <Swatches value={cfg.bg} onChange={v=>set('bg',v)}/>
            </Section>

            {/* background colour B (division) */}
            {cfg.division!=='voll' && (
              <Section icon="fa-fill-drip" title="Zweitfarbe" hint="für Teilung">
                <Swatches value={cfg.bg2} onChange={v=>set('bg2',v)}/>
              </Section>
            )}

            {/* border colour */}
            <Section icon="fa-circle-notch" title="Rahmen-Farbe">
              <Swatches value={cfg.border} onChange={v=>set('border',v)}/>
            </Section>

            {/* extras */}
            <Section icon="fa-plus" title="Extras">
              <div className="tog-row">
                {EXTRAS.map(x=>(
                  <button key={x.id} className={'tog'+(cfg.extras[x.id]?' on':'')} onClick={()=>toggle('extras',x.id)}>
                    <i className={'fa-solid '+x.fa}></i>{x.label}
                  </button>
                ))}
              </div>
            </Section>

            {/* effects */}
            <Section icon="fa-wand-magic-sparkles" title="Effekte">
              <div className="tog-row">
                {EFFECTS.map(x=>(
                  <button key={x.id} className={'tog'+(x.gold?' gold':'')+(cfg.effects[x.id]?' on':'')}
                          onClick={()=>toggle('effects',x.id)}>
                    <i className={'fa-solid '+x.fa}></i>{x.label}
                  </button>
                ))}
              </div>
            </Section>

            <button className="btn btn-p glow save-btn" onClick={save}>
              <i className="fa-solid fa-shield-halved"></i> WAPPEN SICHERN
            </button>
            <button className="reset-btn" onClick={()=>{ setCfg(DEFAULT); flash('Zurückgesetzt'); }}>
              <i className="fa-solid fa-rotate-left"></i> Zurücksetzen
            </button>
          </div>
        ) : (
          /* ── GALERIE ── */
          <div className="gal">
            {saved.length===0 ? (
              <div className="gal-empty">
                <i className="fa-solid fa-shield-halved"></i>
                <div className="gal-empty-h">Noch keine Wappen</div>
                <p>Baue dein erstes Club-Wappen in der Schmiede und sichere es — hier siehst du dann alle im Überblick.</p>
                <button className="btn btn-p" onClick={()=>setTab('build')}>
                  <i className="fa-solid fa-hammer"></i> Zur Schmiede</button>
              </div>
            ) : (
              <React.Fragment>
                <div className="gal-hd">
                  <span>{saved.length} {saved.length===1?'Wappen':'Wappen'} in deiner Schmiede</span>
                </div>
                <div className="gal-grid">
                  {saved.map((it,i)=>(
                    <GalleryCard key={it.ts||i} item={it}
                      onLoad={()=>{ setCfg({...DEFAULT, ...it}); setTab('build'); flash('In Schmiede geladen'); }}
                      onDelete={()=>setSaved(arr=>arr.filter((_,j)=>j!==i))}/>
                  ))}
                </div>
              </React.Fragment>
            )}
          </div>
        )}
      </div>

      {/* bottom nav (decor — context) */}
      <div className="bottom-nav">
        {[['fa-map','Karte',false],['fa-chart-pie','Stats',false],['fa-globe','Community',false],
          ['fa-user','Profil',true],['fa-bars','Menü',false]].map((n,i)=>(
          <div key={i} className={'nav-item'+(n[2]?' active':'')}>
            <span className="nav-ind"></span><i className={'fa-solid '+n[0]}></i><span>{n[1]}</span>
          </div>
        ))}
      </div>

      <div className={'toast'+(toast?' show':'')}>{toast}</div>
    </React.Fragment>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
