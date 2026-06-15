/* ============================================================
   WAPPEN-SCHMIEDE — Crest renderer + data
   --------------------------------------------------------------
   The whole crest is described by ONE plain config object (cfg):
     {
       name:    string,            // club name (banner / label)
       shape:   SHAPES[].id,       // shield silhouette
       division:DIVISIONS[].id,    // field division (uses bg + bg2)
       pattern: PATTERNS[].id,     // overlay texture
       symbol:  SYMBOLS[].id,      // central charge (Font Awesome)
       symColor:'auto' | hex,      // charge colour
       bg:      hex,               // field colour A
       bg2:     hex,               // field colour B (for divisions)
       border:  hex,               // rim colour
       extras:  { crown,banner,stars,laurel,swords : bool },
       effects: { lime,gold,metallic,inner : bool },
     }
   This object is the single source of truth — store it per club,
   pass it to <Crest cfg=… size=…/> to render. Easy to port.
   Exports to window: SHAPES, DIVISIONS, PATTERNS, SYMBOLS, PALETTE,
     Crest, ShapeMini, PatternMini, DivisionMini, isLight, randomCfg
   ============================================================ */

/* ── Shield silhouettes (viewBox 0 0 100 116) ── */
const SHAPES = [
  { id:'heater',   label:'Klassisch',  d:'M10 8 H90 V58 C90 88 72 104 50 112 C28 104 10 88 10 58 Z' },
  { id:'mandel',   label:'Mandel',     d:'M50 2 C78 22 88 40 88 58 C88 86 70 106 50 114 C30 106 12 86 12 58 C12 40 22 22 50 2 Z' },
  { id:'rund',     label:'Rund',       d:'M0 58 A50 50 0 1 0 100 58 A50 50 0 1 0 0 58 Z' },
  { id:'hexagon',  label:'Hexagon',    d:'M50 4 L92 30 L92 86 L50 112 L8 86 L8 30 Z' },
  { id:'french',   label:'Französisch',d:'M12 8 H88 V62 C88 92 66 106 50 112 C34 106 12 92 12 62 Z' },
  { id:'swallow',  label:'Schwalbe',   d:'M12 10 H88 V94 L66 82 L50 100 L34 82 L12 94 Z' },
  { id:'oval',     label:'Oval',       d:'M8 58 A42 54 0 1 0 92 58 A42 54 0 1 0 8 58 Z' },
  { id:'raute',    label:'Raute',      d:'M50 4 L94 58 L50 112 L6 58 Z' },
  { id:'altdeut',  label:'Altdeutsch', d:'M14 14 C32 4 68 4 86 14 V58 C86 90 66 104 50 112 C34 104 14 90 14 58 Z' },
  { id:'plaque',   label:'Plakette',   d:'M22 10 H78 Q90 10 90 22 V94 Q90 106 78 106 H22 Q10 106 10 94 V22 Q10 10 22 10 Z' },
];

/* ── Teilungen / field divisions (use bg = field A, bg2 = field B) ── */
const DIVISIONS = [
  { id:'voll',    label:'Voll' },
  { id:'pfahl',   label:'Pfahl' },   /* per pale  — vertical split  */
  { id:'balken',  label:'Balken' },  /* per fess  — horizontal split*/
  { id:'schraeg', label:'Schräg' },  /* per bend  — diagonal split  */
  { id:'geviert', label:'Geviert' }, /* quarterly — four quarters   */
];
/* Field-B regions, drawn over field A inside the shield clip (viewBox 0..100 / 0..116). */
const DIV_B = {
  voll:    ()=>null,
  pfahl:   c=><rect x="50" y="-3" width="55" height="122" fill={c}/>,
  balken:  c=><rect x="-3" y="58" width="106" height="61" fill={c}/>,
  schraeg: c=><polygon points="-3,-3 102,119 -3,119" fill={c}/>,
  geviert: c=><g fill={c}><rect x="50" y="-3" width="55" height="61"/><rect x="-3" y="58" width="53" height="61"/></g>,
};

/* ── Muster / patterns ── */
const PATTERNS = [
  { id:'keine',    label:'Keine' },
  { id:'streifen', label:'Streifen' },
  { id:'schraeg',  label:'Schräg' },
  { id:'karos',    label:'Karos' },
  { id:'punkte',   label:'Punkte' },
  { id:'topo',     label:'Topo' },
  { id:'schuppen', label:'Schuppen' },
  { id:'gitter',   label:'Gitter' },
  { id:'chevron',  label:'Chevron' },
  { id:'waben',    label:'Waben' },
];

/* ── Symbole / charges (Font Awesome 6 solid) ── */
const SYMBOLS = [
  { id:'run',      fa:'fa-person-running',  label:'Läufer' },
  { id:'crown',    fa:'fa-crown',           label:'Krone' },
  { id:'trophy',   fa:'fa-trophy',          label:'Pokal' },
  { id:'bolt',     fa:'fa-bolt',            label:'Blitz' },
  { id:'fire',     fa:'fa-fire',            label:'Feuer' },
  { id:'shield',   fa:'fa-shield-halved',   label:'Schild' },
  { id:'mountain', fa:'fa-mountain',        label:'Berg' },
  { id:'compass',  fa:'fa-compass',         label:'Kompass' },
  { id:'star',     fa:'fa-star',            label:'Stern' },
  { id:'heart',    fa:'fa-heart',           label:'Herz' },
  { id:'arrow',    fa:'fa-location-arrow',  label:'Pfeil' },
  { id:'route',    fa:'fa-route',           label:'Route' },
  { id:'paw',      fa:'fa-paw',             label:'Pfote' },
  { id:'dragon',   fa:'fa-dragon',          label:'Drache' },
  { id:'feather',  fa:'fa-feather',         label:'Feder' },
  { id:'gem',      fa:'fa-gem',             label:'Juwel' },
  { id:'skull',    fa:'fa-skull',           label:'Totenkopf' },
  { id:'tower',    fa:'fa-chess-rook',      label:'Turm' },
  { id:'target',   fa:'fa-bullseye',        label:'Ziel' },
  { id:'flag',     fa:'fa-flag-checkered',  label:'Flagge' },
];

/* ── Erweiterte Palette (im Marken-Stil) ── */
const PALETTE = [
  { name:'Tiefgrün',  hex:'#042D22' },
  { name:'Wald',      hex:'#0D3D2C' },
  { name:'Smaragd',   hex:'#10B981' },
  { name:'Petrol',    hex:'#1F7A8C' },
  { name:'Cyan',      hex:'#00D4FF' },
  { name:'Mitternacht',hex:'#102A4A' },
  { name:'Lila',      hex:'#9B5DE5' },
  { name:'Magenta',   hex:'#E84AA7' },
  { name:'Rubin',     hex:'#C0143C' },
  { name:'Rot',       hex:'#FF4D6D' },
  { name:'Orange',    hex:'#FF9F1C' },
  { name:'Lime',      hex:'#E6FF55' },
  { name:'Gold',      hex:'#FFD700' },
  { name:'Bronze',    hex:'#B0793A' },
  { name:'Silber',    hex:'#C7D0CE' },
  { name:'Sand',      hex:'#E9D8A6' },
  { name:'Weiß',      hex:'#F4FBEF' },
  { name:'Anthrazit', hex:'#18211C' },
];

function isLight(hex){
  const c=(hex||'#000').replace('#','');
  const r=parseInt(c.slice(0,2),16),g=parseInt(c.slice(2,4),16),b=parseInt(c.slice(4,6),16);
  return (0.299*r+0.587*g+0.114*b) > 150;
}

/* ── Random crest generator (for the dice button) ── */
function randomCfg(prev){
  const pick=a=>a[Math.floor(Math.random()*a.length)];
  const col=()=>pick(PALETTE).hex;
  const names=['Sturmläufer','Wald Wölfe','Asphalt Kings','Nordwind','Revier Hüter',
    'Tempo Titanen','Eisen Beine','Phoenix Pace','Granit Garde','Meilen Meute'];
  return {
    ...prev,
    name: pick(names),
    shape: pick(SHAPES).id,
    division: pick(DIVISIONS).id,
    pattern: pick(PATTERNS).id,
    symbol: pick(SYMBOLS).id,
    symColor: Math.random()<0.5 ? 'auto' : col(),
    bg: col(), bg2: col(), border: col(),
    extras: { crown:Math.random()<.5, banner:Math.random()<.7, stars:Math.random()<.5,
              laurel:Math.random()<.4, swords:Math.random()<.4 },
    effects:{ lime:Math.random()<.5, gold:Math.random()<.35, metallic:Math.random()<.45,
              inner:Math.random()<.6 },
  };
}

/* ── Pattern <defs> builder. Returns a <pattern> element or null. ── */
function PatternDef(pat, uid, tone){
  const id='pat'+uid;
  if(pat==='keine') return null;
  if(pat==='streifen')
    return <pattern id={id} patternUnits="userSpaceOnUse" width="16" height="16">
      <rect x="0" y="0" width="8" height="16" fill={tone}/></pattern>;
  if(pat==='schraeg')
    return <pattern id={id} patternUnits="userSpaceOnUse" width="16" height="16" patternTransform="rotate(45)">
      <rect x="0" y="0" width="8" height="16" fill={tone}/></pattern>;
  if(pat==='karos')
    return <pattern id={id} patternUnits="userSpaceOnUse" width="16" height="16">
      <rect x="0" y="0" width="8" height="8" fill={tone}/>
      <rect x="8" y="8" width="8" height="8" fill={tone}/></pattern>;
  if(pat==='punkte')
    return <pattern id={id} patternUnits="userSpaceOnUse" width="14" height="14">
      <circle cx="7" cy="7" r="2.3" fill={tone}/></pattern>;
  if(pat==='topo')
    return <pattern id={id} patternUnits="userSpaceOnUse" width="34" height="16">
      <path d="M0 9 Q8.5 1 17 9 T34 9" fill="none" stroke={tone} strokeWidth="1.8"/></pattern>;
  if(pat==='schuppen')
    return <pattern id={id} patternUnits="userSpaceOnUse" width="18" height="9">
      <path d="M0 9 A9 9 0 0 1 18 9" fill="none" stroke={tone} strokeWidth="1.6"/>
      <path d="M-9 9 A9 9 0 0 1 9 9" fill="none" stroke={tone} strokeWidth="1.6"/>
      <path d="M9 9 A9 9 0 0 1 27 9" fill="none" stroke={tone} strokeWidth="1.6"/></pattern>;
  if(pat==='gitter')
    return <pattern id={id} patternUnits="userSpaceOnUse" width="15" height="15">
      <path d="M0 0 H15 M0 0 V15" stroke={tone} strokeWidth="1" fill="none"/></pattern>;
  if(pat==='chevron')
    return <pattern id={id} patternUnits="userSpaceOnUse" width="18" height="12">
      <path d="M0 11 L9 3 L18 11" fill="none" stroke={tone} strokeWidth="1.8"/></pattern>;
  if(pat==='waben')
    return <pattern id={id} patternUnits="userSpaceOnUse" width="20" height="17.32" patternTransform="scale(.9)">
      <path d="M10 0 L20 5.77 L20 11.55 L10 17.32 L0 11.55 L0 5.77 Z" fill="none" stroke={tone} strokeWidth="1.4"/></pattern>;
  return null;
}

/* ── Main crest ── */
function Crest({ cfg, size=216 }){
  const uid = React.useMemo(()=>'c'+Math.random().toString(36).slice(2,8),[]);
  const sc = size/220;
  const sh = SHAPES.find(s=>s.id===cfg.shape) || SHAPES[0];
  const sym = SYMBOLS.find(s=>s.id===cfg.symbol) || SYMBOLS[0];
  const ex = cfg.extras||{}, eff = cfg.effects||{};
  const div = cfg.division||'voll';
  const light = isLight(cfg.bg);
  const tone = light ? 'rgba(0,0,0,.20)' : 'rgba(255,255,255,.15)';
  const autoSym = eff.gold ? '#FFD700' : (light ? '#10271d' : '#F4FBEF');
  const symColor = (!cfg.symColor || cfg.symColor==='auto') ? autoSym : cfg.symColor;

  const glow=[];
  if(eff.lime) glow.push('drop-shadow(0 0 9px rgba(230,255,85,.7))');
  if(eff.gold) glow.push('drop-shadow(0 0 12px rgba(255,215,0,.62))');
  glow.push('drop-shadow(0 6px 10px rgba(0,0,0,.45))');

  const goldStops = [['0','#FFE9A0'],['.28','#FFD24A'],['.5','#9A7415'],['.72','#FFD24A'],['1','#C9A227']];
  const silverStops = [['0','#FFFFFF'],['.28','#D6DEDB'],['.5','#7E8A84'],['.74','#E2E9E6'],['1','#A7B2AD']];
  const metalStops = eff.gold ? goldStops : silverStops;
  const strokeCol = eff.metallic ? `url(#metal${uid})` : cfg.border;

  /* laurel leaves along a quadratic bezier (left branch) */
  function laurel(suffix){
    const P0=[106,250],P1=[4,250],P2=[42,96];
    const bez=t=>{const u=1-t;return [u*u*P0[0]+2*u*t*P1[0]+t*t*P2[0], u*u*P0[1]+2*u*t*P1[1]+t*t*P2[1]];};
    const leaves=[]; const N=8;
    for(let i=0;i<N;i++){
      const t=0.08 + (i/(N-1))*0.86;
      const [x,y]=bez(t); const [x2,y2]=bez(Math.min(1,t+0.001));
      const ang=Math.atan2(y2-y,x2-x)*180/Math.PI;
      leaves.push(<ellipse key={i} cx={x} cy={y} rx="9" ry="3.5" fill={`url(#leaf${uid})`} transform={`rotate(${ang-34} ${x} ${y})`}/>);
    }
    return <g key={suffix}>
      <path d={`M${P0[0]} ${P0[1]} Q${P1[0]} ${P1[1]} ${P2[0]} ${P2[1]}`} fill="none" stroke="#9c7a22" strokeWidth="2.4" strokeLinecap="round"/>
      {leaves}
    </g>;
  }

  const sword = (
    <g>
      <path d="M110 8 L106 220 L114 220 Z" fill={`url(#blade${uid})`} stroke="#6c756f" strokeWidth=".6"/>
      <line x1="110" y1="24" x2="110" y2="214" stroke="rgba(255,255,255,.55)" strokeWidth="1"/>
      <rect x="95" y="218" width="30" height="7" rx="2" fill="#E8C34A" stroke="#9c7a22" strokeWidth=".6"/>
      <rect x="106" y="224" width="8" height="30" rx="3" fill="#5d3f23"/>
      <circle cx="110" cy="260" r="6.5" fill="#E8C34A" stroke="#9c7a22" strokeWidth=".6"/>
    </g>
  );

  const nameTxt = (cfg.name||'DEIN CLUB').trim() || 'DEIN CLUB';
  const bannerFont = (nameTxt.length>14 ? 14.5 : nameTxt.length>10 ? 16 : 19) * sc;

  return (
    <div className="crest" style={{ position:'relative', width:size, height:300*sc }}>

      {/* back decor: shadow, swords, laurel */}
      <svg viewBox="0 0 220 300" width={size} height={300*sc}
           style={{ position:'absolute', inset:0, overflow:'visible', zIndex:1 }}>
        <defs>
          <linearGradient id={`blade${uid}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#9aa6a0"/><stop offset=".5" stopColor="#EFF4F2"/><stop offset="1" stopColor="#7d877f"/>
          </linearGradient>
          <linearGradient id={`leaf${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#F0D67A"/><stop offset="1" stopColor="#A9821f"/>
          </linearGradient>
        </defs>
        <ellipse cx="110" cy="292" rx="64" ry="7" fill="rgba(0,0,0,.32)"/>
        {ex.swords && <g>
          <g transform="rotate(30 110 140)">{sword}</g>
          <g transform="rotate(-30 110 140)">{sword}</g>
        </g>}
        {ex.laurel && <g>
          {laurel('L')}
          <g transform="translate(220,0) scale(-1,1)">{laurel('R')}</g>
        </g>}
      </svg>

      {/* shield */}
      <svg viewBox="0 0 100 116"
           style={{ position:'absolute', left:25*sc, top:40*sc, width:170*sc, height:198*sc,
                    overflow:'visible', filter:glow.join(' '), zIndex:2 }}>
        <defs>
          <clipPath id={`clip${uid}`}><path d={sh.d}/></clipPath>
          {PatternDef(cfg.pattern, uid, tone)}
          <linearGradient id={`gloss${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fff" stopOpacity=".30"/>
            <stop offset=".44" stopColor="#fff" stopOpacity="0"/>
            <stop offset=".74" stopColor="#000" stopOpacity="0"/>
            <stop offset="1" stopColor="#000" stopOpacity=".18"/>
          </linearGradient>
          {eff.metallic && <linearGradient id={`metal${uid}`} x1="0" y1="0" x2="0" y2="1">
            {metalStops.map((s,i)=><stop key={i} offset={s[0]} stopColor={s[1]}/>)}
          </linearGradient>}
          {eff.inner && <filter id={`ins${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feComponentTransfer in="SourceAlpha" result="a"><feFuncA type="table" tableValues="1 0"/></feComponentTransfer>
            <feGaussianBlur in="a" stdDeviation="3.6"/>
            <feOffset dy="1.8" result="b"/>
            <feFlood floodColor="#000" floodOpacity="0.55"/>
            <feComposite in2="b" operator="in" result="s"/>
            <feComposite in="s" in2="SourceAlpha" operator="in"/>
          </filter>}
        </defs>

        {/* field — colour A, optional division colour B, pattern, gloss (clipped to shape) */}
        <g clipPath={`url(#clip${uid})`}>
          <rect x="-3" y="-3" width="106" height="122" fill={cfg.bg}/>
          {DIV_B[div] && DIV_B[div](cfg.bg2)}
          {cfg.pattern!=='keine' && <rect x="-3" y="-3" width="106" height="122" fill={`url(#pat${uid})`}/>}
          {eff.metallic && <rect x="-3" y="-3" width="106" height="122" fill={`url(#gloss${uid})`}/>}
        </g>
        {/* inner-shadow overlay (shadow only, clipped to shape) */}
        {eff.inner && <path d={sh.d} fill="#000" filter={`url(#ins${uid})`}/>}
        {/* rim */}
        <path d={sh.d} fill="none" stroke={strokeCol} strokeWidth="5" strokeLinejoin="round"/>
        {eff.gold && <path d={sh.d} fill="none" stroke="rgba(255,215,0,.92)" strokeWidth="1.6"
              style={{ transformBox:'fill-box', transformOrigin:'center', transform:'scale(.9)' }}/>}
      </svg>

      {/* central symbol */}
      <i className={'fa-solid '+sym.fa}
         style={{ position:'absolute', left:'50%', top:128*sc, transform:'translate(-50%,-50%)',
                  fontSize:58*sc, color:symColor, zIndex:4,
                  textShadow: isLight(symColor) ? '0 1px 2px rgba(0,0,0,.35)' : '0 2px 6px rgba(0,0,0,.5)' }}/>

      {/* crown */}
      {ex.crown && <i className="fa-solid fa-crown"
         style={{ position:'absolute', top:0, left:'50%', transform:'translateX(-50%)',
                  fontSize:38*sc, color:'#FFD700', filter:'drop-shadow(0 0 8px rgba(255,215,0,.6))', zIndex:6 }}/>}

      {/* banner */}
      {ex.banner && <div className="crest-banner"
         style={{ position:'absolute', left:'50%', top:206*sc, transform:'translateX(-50%)',
                  width:212*sc, zIndex:5 }}>
        <span style={{ fontSize:bannerFont }}>{nameTxt}</span>
      </div>}

      {/* stars / rank */}
      {ex.stars && <div style={{ position:'absolute', top:264*sc, left:'50%', transform:'translateX(-50%)',
                  display:'flex', gap:7*sc, zIndex:5 }}>
        {[0,1,2].map(i=><i key={i} className="fa-solid fa-star"
           style={{ fontSize:13*sc, color:'#FFD700', filter:'drop-shadow(0 0 5px rgba(255,215,0,.55))' }}/>)}
      </div>}
    </div>
  );
}

/* ── Mini previews for the control chips ── */
function ShapeMini({ d, sel }){
  return <svg width="38" height="44" viewBox="0 0 100 116">
    <path d={d} fill={sel?'rgba(230,255,85,.16)':'rgba(255,255,255,.07)'}
          stroke={sel?'#E6FF55':'#5A8A6E'} strokeWidth="5" strokeLinejoin="round"/>
  </svg>;
}
function PatternMini({ pat, sel }){
  const uid = React.useMemo(()=>'pm'+Math.random().toString(36).slice(2,7),[]);
  const tone = 'rgba(230,255,85,.55)';
  return <svg width="40" height="40" viewBox="0 0 40 40">
    <defs>{PatternDef(pat, uid, tone)}</defs>
    <rect x="1" y="1" width="38" height="38" rx="9"
          fill={sel?'rgba(230,255,85,.12)':'#0a2f22'} stroke={sel?'#E6FF55':'rgba(255,255,255,.15)'}/>
    {pat!=='keine' && <rect x="1" y="1" width="38" height="38" rx="9" fill={`url(#pat${uid})`}/>}
    {pat==='keine' && <text x="20" y="24" textAnchor="middle" fontSize="9" fill="#5A8A6E" fontFamily="Poppins">leer</text>}
  </svg>;
}
function DivisionMini({ div, sel }){
  const uid = React.useMemo(()=>'dm'+Math.random().toString(36).slice(2,7),[]);
  const A = sel ? '#103a2a' : '#0a2f22';
  const B = sel ? 'rgba(230,255,85,.5)' : 'rgba(255,255,255,.2)';
  return <svg width="40" height="40" viewBox="0 0 40 40">
    <defs><clipPath id={`dm${uid}`}><rect x="2" y="2" width="36" height="36" rx="9"/></clipPath></defs>
    <g clipPath={`url(#dm${uid})`}>
      <rect x="2" y="2" width="36" height="36" fill={A}/>
      {div==='pfahl'   && <rect x="20" y="2" width="20" height="36" fill={B}/>}
      {div==='balken'  && <rect x="2" y="20" width="36" height="20" fill={B}/>}
      {div==='schraeg' && <polygon points="2,2 38,38 2,38" fill={B}/>}
      {div==='geviert' && <g fill={B}><rect x="20" y="2" width="20" height="18"/><rect x="2" y="20" width="18" height="18"/></g>}
    </g>
    <rect x="2" y="2" width="36" height="36" rx="9" fill="none"
          stroke={sel?'#E6FF55':'rgba(255,255,255,.15)'} strokeWidth="1.5"/>
  </svg>;
}

Object.assign(window, { SHAPES, DIVISIONS, PATTERNS, SYMBOLS, PALETTE,
  Crest, ShapeMini, PatternMini, DivisionMini, isLight, randomCfg });
