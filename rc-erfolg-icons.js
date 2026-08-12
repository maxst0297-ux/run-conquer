/*!
 * Runners Conquer — Erfolgs-Icons (v3)
 * Reine SVG-Generierung, keine Abhängigkeiten, kein Build-Schritt.
 *
 *   <script src="rc-erfolg-icons.js"></script>
 *   document.body.insertAdjacentHTML('afterbegin', RCIcons.defsHost());   // EINMAL pro Seite
 *   el.innerHTML = RCIcons.render('erster-schritt');
 *
 * Alle Icons zeichnen in eine 128x128-Box (viewBox "-7 -7 142 142") und skalieren
 * verlustfrei auf jede Größe. Empfohlen: 96-192px Kantenlänge.
 */
(function(global){
'use strict';

class RCErfolgIcons {

  MET={
    gold:{l:'#FFF3C4',m:'#FFC93C',d:'#9A6B08',k:'#3A2600'},
    silver:{l:'#FFFFFF',m:'#C9D6DE',d:'#6C7A85',k:'#1E262C'},
    bronze:{l:'#F5CE9C',m:'#CC8A4E',d:'#7A4A1C',k:'#2E1B08'},
    steel:{l:'#DCEBFF',m:'#8FA9C4',d:'#3E566E',k:'#111C26'},
    lime:{l:'#F6FFC0',m:'#D8F63C',d:'#7E9410',k:'#2B3403'},
    cyan:{l:'#D8FBFF',m:'#3FE0FF',d:'#0A6E8C',k:'#02222C'},
    violet:{l:'#EFDCFF',m:'#A66BFF',d:'#4B238E',k:'#190A33'},
    ember:{l:'#FFE7B0',m:'#FF9A2E',d:'#B23A10',k:'#3A0D02'},
    rose:{l:'#FFD3DC',m:'#FF5C7A',d:'#96122F',k:'#33020D'},
    jade:{l:'#CFF7DC',m:'#2FD489',d:'#0B6B45',k:'#022418'},
  };

  defs(){
    const html='<svg width="0" height="0" xmlns="http://www.w3.org/2000/svg" focusable="false"><defs>'
      +'<filter id="rcBevel" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur in="SourceAlpha" stdDeviation="0.55" result="b"/><feSpecularLighting in="b" surfaceScale="1.1" specularConstant="0.42" specularExponent="26" lighting-color="#ffffff" result="s"><feDistantLight azimuth="230" elevation="58"/></feSpecularLighting><feComposite in="s" in2="SourceAlpha" operator="in" result="si"/><feComposite in="SourceGraphic" in2="si" operator="arithmetic" k1="0" k2="1" k3="0.85" k4="0"/></filter>'
      +'<filter id="rcShadow" x="-40%" y="-40%" width="180%" height="180%"><feDropShadow dx="0" dy="1.6" stdDeviation="1.4" flood-color="#000000" flood-opacity="0.62"/></filter>'
      +'<filter id="rcGlow" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="1.7" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>'
      +'<filter id="rcGlow2" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="3.6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>'
      +'<filter id="rcRing" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="2.6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>'
      +'</defs></svg>';
    return html;
  }

  /* ============ chassis ============ */
  wrap(d,b){return `<svg viewBox="-7 -7 142 142" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">${d?`<defs>${d}</defs>`:''}${b}</svg>`;}
  bev(b){return `<g filter="url(#rcShadow)"><g filter="url(#rcBevel)">${b}</g></g>`;}
  glo(b){return `<g filter="url(#rcGlow)">${b}</g>`;}
  glo2(b){return `<g filter="url(#rcGlow2)">${b}</g>`;}

  gDefs(u,M,sky,rib,aura){
    const R=rib||[M.l,M.m,M.d];
    return `<linearGradient id="M${u}" x1="10%" y1="0%" x2="90%" y2="100%"><stop offset="0%" stop-color="${M.l}"/><stop offset="20%" stop-color="${M.m}"/><stop offset="45%" stop-color="${M.d}"/><stop offset="62%" stop-color="${M.m}"/><stop offset="82%" stop-color="${M.l}"/><stop offset="100%" stop-color="${M.d}"/></linearGradient>`
      +`<linearGradient id="V${u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${M.l}"/><stop offset="50%" stop-color="${M.m}"/><stop offset="100%" stop-color="${M.d}"/></linearGradient>`
      +`<radialGradient id="S${u}" cx="50%" cy="26%" r="84%"><stop offset="0%" stop-color="${sky[0]}"/><stop offset="30%" stop-color="${sky[1]}"/><stop offset="100%" stop-color="${sky[2]}"/></radialGradient>`
      +`<linearGradient id="B${u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${R[0]}"/><stop offset="52%" stop-color="${R[1]}"/><stop offset="100%" stop-color="${R[2]}"/></linearGradient>`
      +`<radialGradient id="A${u}" cx="50%" cy="50%" r="50%"><stop offset="45%" stop-color="${aura||M.m}" stop-opacity=".34"/><stop offset="76%" stop-color="${aura||M.m}" stop-opacity=".14"/><stop offset="100%" stop-color="${aura||M.m}" stop-opacity="0"/></radialGradient>`
      +`<radialGradient id="G${u}" cx="50%" cy="42%" r="64%"><stop offset="56%" stop-color="#000000" stop-opacity="0"/><stop offset="88%" stop-color="#000000" stop-opacity=".26"/><stop offset="100%" stop-color="#000000" stop-opacity=".48"/></radialGradient>`
      +`<linearGradient id="H${u}" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="#ffffff" stop-opacity="0"/><stop offset="50%" stop-color="#ffffff" stop-opacity=".26"/><stop offset="100%" stop-color="#ffffff" stop-opacity="0"/></linearGradient>`
      +`<clipPath id="C${u}"><circle cx="64" cy="64" r="48"/></clipPath>`
      +`<clipPath id="CR${u}"><circle cx="64" cy="64" r="56.4"/></clipPath>`;
  }
  vignette(u){return `<circle cx="64" cy="64" r="48" fill="url(#G${u})"/>`;}
  shine(u,dur=5.5,delay=0){return `<g clip-path="url(#CR${u})"><g style="animation:rcShine ${dur}s ease-in-out ${delay}s infinite"><rect x="34" y="-14" width="17" height="156" transform="rotate(18 64 64)" fill="url(#H${u})"/><rect x="58" y="-14" width="7" height="156" transform="rotate(18 64 64)" fill="url(#H${u})" opacity=".7"/></g></g>`;}
  shafts(c='#ffffff',op=.09){return `<g><path d="M 46 14 L 36 104 L 48 104 L 56 14 Z" fill="${c}" opacity="${op*.6}"/><path d="M 72 14 L 84 104 L 92 104 L 79 14 Z" fill="${c}" opacity="${op*.45}"/></g>`;}
  ground(y=80,rx=26,op=.4){return `<ellipse cx="64" cy="${y}" rx="${rx}" ry="${(rx*.17).toFixed(1)}" fill="#000000" opacity="${op}"/>`;}

  frame(u,M){
    return `<circle cx="64" cy="64" r="66" fill="url(#A${u})"/>`
      +this.glo(`<circle cx="64" cy="64" r="59" fill="none" stroke="#8FE31B" stroke-width="4.4" opacity=".85"/>`)
      +`<circle cx="64" cy="64" r="59" fill="none" stroke="#E6FF55" stroke-width="2.4"/>`
      +`<circle cx="64" cy="64" r="56.6" fill="#03150E"/>`
      +this.bev(`<circle cx="64" cy="64" r="52.6" fill="none" stroke="url(#M${u})" stroke-width="7.2"/>`)
      +this.rivets(M)
      +`<path d="M 20 48 A 52.6 52.6 0 0 1 108 48" fill="none" stroke="#ffffff" stroke-width="2.2" opacity=".3" stroke-linecap="round"/>`
      +`<path d="M 24 88 A 52.6 52.6 0 0 0 104 88" fill="none" stroke="#000000" stroke-width="2.6" opacity=".28" stroke-linecap="round"/>`
      +`<circle cx="64" cy="64" r="56.3" fill="none" stroke="${M.k}" stroke-width="1.1" opacity=".8"/>`
      +`<circle cx="64" cy="64" r="48.9" fill="${M.k}"/>`
      +`<circle cx="64" cy="64" r="48" fill="url(#S${u})"/>`;
  }
  gloss(){return `<path d="M 17 60 A 47 47 0 0 1 111 60 A 62 62 0 0 0 17 60 Z" fill="#ffffff" opacity=".10"/>`;}
  rivets(M,n=16,r=52.6){let s='';for(let i=0;i<n;i++){const a=i/n*Math.PI*2-Math.PI/2;const x=64+Math.cos(a)*r,y=64+Math.sin(a)*r;
    s+=`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="1.5" fill="${M.k}" opacity=".55"/><circle cx="${(x-.4).toFixed(1)}" cy="${(y-.5).toFixed(1)}" r=".9" fill="${M.l}" opacity=".75"/>`;}return s;}

  txt(s,x,y,size,fill,o={}){
    const st=o.stroke===null?'':`stroke="${o.stroke||'#000000'}" stroke-width="${(size*(o.sw??0.15)).toFixed(2)}" stroke-linejoin="round" paint-order="stroke"`;
    return `<text x="${x}" y="${y}" text-anchor="middle" font-family="Bebas Neue, Oswald, Arial Narrow, sans-serif" font-size="${size}" letter-spacing="${o.ls??1}" fill="${fill}" ${st}>${s}</text>`;
  }
  st5(cx,cy,r,f,o=1){let p='';for(let i=0;i<10;i++){const rr=i%2?r*.42:r;const a=-Math.PI/2+i*Math.PI/5;p+=`${(cx+Math.cos(a)*rr).toFixed(1)},${(cy+Math.sin(a)*rr).toFixed(1)} `;}return `<polygon points="${p.trim()}" fill="${f}" opacity="${o}"/>`;}
  hexP(cx,cy,r){let p='';for(let i=0;i<6;i++){const a=-Math.PI/2+i*Math.PI/3;p+=`${(cx+Math.cos(a)*r).toFixed(1)},${(cy+Math.sin(a)*r).toFixed(1)} `;}return p.trim();}

  crest(u,M){
    return `<polygon points="${this.hexP(64,16,17.5)}" fill="#02100B" opacity=".95"/>`
      +this.bev(`<polygon points="${this.hexP(64,16,15)}" fill="#05201A" stroke="url(#M${u})" stroke-width="3" stroke-linejoin="round"/>`)
      +`<polygon points="${this.hexP(64,16,11.2)}" fill="none" stroke="${M.l}" stroke-width=".8" opacity=".45"/>`
      +`<path d="M 53 11 L 75 11" stroke="#ffffff" stroke-width="1.4" opacity=".22" stroke-linecap="round"/>`
      +this.txt('RC',64,21.4,15,'#E6FF55',{ls:.4,stroke:'#04150F',sw:.2});
  }
  ribbon(u,label,M,o={}){
    const cy=o.y??90,h=o.h??15,w=o.w??58;
    const x0=64-w/2,x1=64+w/2,yt=cy-h/2,yb=cy+h/2;
    const tail=(s)=>{const x=s>0?x1:x0,xe=x+s*12.5;
      return `<path d="M ${x} ${yt+1} L ${xe} ${yt-3.4} L ${(xe-s*4.4).toFixed(1)} ${cy} L ${xe} ${yb+4} L ${x} ${yb-1} Z" fill="${M.d}" stroke="${M.k}" stroke-width="1"/>`;};
    const n=label.length;
    const fs=n<=6?14:n<=9?12.2:n<=12?10.4:n<=15?8.8:7.6;
    return this.bev(tail(1)+tail(-1))
      +this.bev(`<path d="M ${x0} ${yt} Q 64 ${(yt-3.2).toFixed(1)} ${x1} ${yt} L ${x1} ${yb} Q 64 ${(yb+3.2).toFixed(1)} ${x0} ${yb} Z" fill="url(#B${u})" stroke="${M.k}" stroke-width="1.2"/>`)
      +`<path d="M ${x0+2} ${yt+2.8} Q 64 ${(yt-.4).toFixed(1)} ${x1-2} ${yt+2.8}" fill="none" stroke="#ffffff" stroke-width=".8" opacity=".28"/>`
      +this.txt(label,64,cy+fs*.36,fs,o.tc??'#FFFFFF',{ls:1,stroke:o.ts??M.k,sw:.16});
  }
  starRow(n,c,y=102){let s='';const g=8.4,x0=64-(n-1)*g/2;for(let i=0;i<n;i++)s+=this.st5(x0+i*g,y,3.2,c,.95);return s;}
  crown(x,y,sc,fill,lite){return `<g transform="translate(${x} ${y}) scale(${sc})"><path d="M -12 6 L -12 0 L -6 3 L 0 -7 L 6 3 L 12 0 L 12 6 Z" fill="${fill}" stroke="${lite}" stroke-width=".7"/><rect x="-12" y="6" width="24" height="3.6" rx="1.2" fill="${fill}" stroke="${lite}" stroke-width=".7"/><circle cx="0" cy="-7" r="1.7" fill="${lite}"/><circle cx="-12" cy="0" r="1.3" fill="${lite}"/><circle cx="12" cy="0" r="1.3" fill="${lite}"/></g>`;}
  laurel(u,M,o={}){
    const cx=o.cx??64,cy=o.cy??60,r=o.r??41,n=o.n??8;
    let s='';
    const leaf=(deg,tilt,sc,rr)=>{const a=deg*Math.PI/180,x=cx+Math.cos(a)*rr,y=cy+Math.sin(a)*rr;
      return `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${(deg+90+tilt).toFixed(1)}) scale(${sc.toFixed(2)})"><path d="M0 -5.2 Q 3 -1.3 0 4.2 Q -3 -1.3 0 -5.2 Z" fill="url(#M${u})" stroke="${M.k}" stroke-width=".5"/></g>`;};
    for(let i=0;i<n;i++){const t=i/(n-1),sc=1.12-.34*t;
      s+=leaf(74-t*118,(i%2?14:-12),sc,r+(i%2?1.8:-.6));
      s+=leaf(106+t*118,(i%2?-14:12),sc,r+(i%2?1.8:-.6));}
    return s;
  }
  spks(pts,c='#ffffff'){let s='';pts.forEach(p=>{s+=`<g transform="translate(${p[0]} ${p[1]}) scale(${p[2]})"><path d="M0 -4.4 L1.1 -1.1 L4.4 0 L1.1 1.1 L0 4.4 L-1.1 1.1 L-4.4 0 L-1.1 -1.1 Z" fill="${c}" opacity="${p[3]??.85}"/></g>`;});return s;}

  /* ============ scene backgrounds (clipped to disc) ============ */
  scRays(c,op=.3,n=18,r0=6,r1=50){let s='';for(let i=0;i<n;i++){const a=i/n*Math.PI*2;s+=`<line x1="${(64+Math.cos(a)*r0).toFixed(1)}" y1="${(60+Math.sin(a)*r0).toFixed(1)}" x2="${(64+Math.cos(a)*r1).toFixed(1)}" y2="${(60+Math.sin(a)*r1).toFixed(1)}" stroke="${c}" stroke-width="${i%2?2.6:1.2}" opacity="${op}"/>`;}return s;}
  scHills(c1,c2,c3){let s='';
    if(c3)s+=`<path d="M 8 62 Q 28 46 50 58 Q 72 72 120 50 L 120 118 L 8 118 Z" fill="${c3}" opacity=".85"/>`;
    s+=`<path d="M 8 72 Q 32 54 56 68 Q 80 82 120 60 L 120 118 L 8 118 Z" fill="${c1}"/>`;
    s+=`<path d="M 8 86 Q 36 70 62 82 Q 92 94 120 78 L 120 118 L 8 118 Z" fill="${c2}"/>`;return s;}
  scGrid(c,op=.45){let s='';
    for(let i=1;i<=6;i++){const y=68+i*7.2,w=8+i*15;s+=`<line x1="${64-w}" y1="${y}" x2="${64+w}" y2="${y}" stroke="${c}" stroke-width=".9" opacity="${op}"/>`;}
    for(let i=-4;i<=4;i++){s+=`<line x1="${64+i*4.5}" y1="68" x2="${64+i*30}" y2="118" stroke="${c}" stroke-width=".8" opacity="${op*.7}"/>`;}return s;}
  scTopo(c,op=.32){let s='';for(let i=0;i<6;i++){const r=9+i*8;s+=`<ellipse cx="${56+i*1.6}" cy="${64-i*1.2}" rx="${r}" ry="${(r*.68).toFixed(1)}" fill="none" stroke="${c}" stroke-width=".9" opacity="${op}"/>`;}return s;}
  scStars(c,list){let s='';list.forEach(p=>{s+=`<circle cx="${p[0]}" cy="${p[1]}" r="${p[2]}" fill="${c}" opacity="${p[3]??.85}"/>`;});return s;}
  scCity(c,op=1){return `<path d="M 12 84 L 12 66 L 20 66 L 20 54 L 28 54 L 28 70 L 36 70 L 36 46 L 44 46 L 44 62 L 52 62 L 52 52 L 60 52 L 60 72 L 70 72 L 70 48 L 78 48 L 78 64 L 86 64 L 86 56 L 94 56 L 94 72 L 104 72 L 104 80 L 116 80 L 116 118 L 12 118 Z" fill="${c}" opacity="${op}"/>`;}
  scHexField(c,op=.5){let s='';const rows=[[64,86,10],[46,96,10],[82,96,10],[28,86,9],[100,86,9],[64,106,9]];
    rows.forEach(h=>{s+=`<polygon points="${this.hexP(h[0],h[1],h[2])}" fill="none" stroke="${c}" stroke-width="1.2" opacity="${op}"/>`;});return s;}
  scHaze(c,y=92,op=.35){return `<ellipse cx="64" cy="${y}" rx="52" ry="20" fill="${c}" opacity="${op}"/>`;}
  scSun(x,y,r,c1,c2){return `<circle cx="${x}" cy="${y}" r="${r*2.6}" fill="${c2}" opacity=".14"/><circle cx="${x}" cy="${y}" r="${r*1.7}" fill="${c2}" opacity=".26"/><circle cx="${x}" cy="${y}" r="${r*1.15}" fill="${c1}" opacity=".55"/><circle cx="${x}" cy="${y}" r="${r}" fill="${c1}" style="animation:rcPulse 4.2s ease-in-out infinite"/>`;}
  scClouds(c,op=.5,y=44){return `<g style="animation:rcDrift 9s ease-in-out infinite" opacity="${op}"><path d="M 22 ${y} q 5 -7 12 -4 q 4 -8 13 -4 q 7 -1 8 5 z" fill="${c}"/><path d="M 78 ${y-9} q 4 -6 10 -3 q 4 -6 11 -3 q 6 -1 6 4 z" fill="${c}" opacity=".75"/><path d="M 46 ${y+13} q 6 -6 12 -3 q 5 -5 11 -2 q 5 0 5 4 z" fill="${c}" opacity=".5"/></g>`;}
  scBirds(c,op=.75){return `<g fill="none" stroke="${c}" stroke-width="1.2" stroke-linecap="round" opacity="${op}" style="animation:rcBob 5s ease-in-out infinite"><path d="M 84 34 q 3 -3 6 0 q 3 -3 6 0"/><path d="M 30 42 q 2.4 -2.4 4.8 0 q 2.4 -2.4 4.8 0"/><path d="M 96 48 q 2 -2 4 0 q 2 -2 4 0"/></g>`;}
  scRoad(c1,c2,c3){return `<path d="M 50 66 L 78 66 L 108 118 L 20 118 Z" fill="${c1}"/><path d="M 50 66 L 54 66 L 40 118 L 24 118 Z" fill="${c2}" opacity=".5"/><g fill="${c3}"><rect x="62" y="70" width="4" height="6"/><rect x="61.4" y="82" width="5.2" height="8"/><rect x="60.4" y="97" width="7.2" height="11"/></g>`;}
  scWindows(c){let s='';[[16,72],[22,72],[32,60],[38,60],[40,74],[46,52],[52,52],[48,66],[74,54],[80,54],[76,68],[88,62],[94,62],[98,76]].forEach((p,i)=>{s+=`<rect x="${p[0]}" y="${p[1]}" width="3" height="4" fill="${c}" opacity="${.4+((i*37)%5)/8}" style="animation:rcTwinkle ${(3+(i%4)*1.3).toFixed(1)}s ease-in-out ${(i%5)*.4}s infinite"/>`;});return s;}
  scParticles(c,list){let s='';list.forEach((p,i)=>{s+=`<circle cx="${p[0]}" cy="${p[1]}" r="${p[2]}" fill="${c}" style="animation:rcTwinkle ${(2.4+(i%5)*.7).toFixed(1)}s ease-in-out ${(i%4)*.5}s infinite"/>`;});return s;}
  scWater(c,y=84,op=.5){let s='';for(let i=0;i<6;i++){const w=30-i*3.4;s+=`<line x1="${64-w}" y1="${y+i*5}" x2="${64+w}" y2="${y+i*5}" stroke="${c}" stroke-width="1.6" stroke-linecap="round" opacity="${(op-i*.06).toFixed(2)}"/>`;}return s;}
  scMountains(far,mid,near,snow){return `<path d="M -2 88 L 26 42 L 44 66 L 62 34 L 82 68 L 100 44 L 130 88 Z" fill="${far}"/>`
    +`<path d="M 62 34 L 72 52 L 62 48 L 53 53 Z" fill="${snow}" opacity=".95"/><path d="M 26 42 L 34 56 L 26 53 L 19 57 Z" fill="${snow}" opacity=".8"/><path d="M 100 44 L 107 57 L 100 54 L 94 58 Z" fill="${snow}" opacity=".75"/>`
    +`<path d="M -2 118 L 22 70 L 42 92 L 62 62 L 86 96 L 108 74 L 130 118 Z" fill="${mid}"/>`
    +`<path d="M -2 118 L 30 88 L 56 106 L 84 86 L 130 118 Z" fill="${near}"/>`;}
  scForest(c,y=92,op=1){let s='';for(let i=0;i<11;i++){const x=14+i*10,h=9+((i*7)%5)*2.2;s+=`<path d="M ${x} ${y+4} L ${(x+4.4).toFixed(1)} ${y-h} L ${(x+8.8).toFixed(1)} ${y+4} Z" fill="${c}" opacity="${op}"/>`;}return s;}
  scSpeed(c,op=.5){let s='';[[20,44,26],[14,56,32],[20,68,24],[26,80,18]].forEach(l=>{s+=`<line x1="${l[0]}" y1="${l[1]}" x2="${l[0]+l[2]}" y2="${l[1]}" stroke="${c}" stroke-width="2.4" stroke-linecap="round" opacity="${op}"/>`;});return s;}

  /* ============ motif parts ============ */
  sole(x,y,rot,sc,c,edge,detail){
    return `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${sc})">
      <path d="M -6.6 -12.6 Q -1 -16.4 5.4 -13.6 Q 8.2 -8.8 6.8 -3.4 Q 0 -0.4 -6.4 -3 Q -8 -8 -6.6 -12.6 Z" fill="${c}" stroke="${edge}" stroke-width="1"/>
      <path d="M -4.8 2.6 Q 0 0.8 4.8 2.6 Q 6 8 4.2 12.2 Q 0 14.4 -4.2 12.2 Q -6 8 -4.8 2.6 Z" fill="${c}" stroke="${edge}" stroke-width="1"/>
      <path d="M -5.4 -9.6 Q 0 -7.4 5.6 -9.8 M -5.4 -6 Q 0 -3.8 5.8 -6.2" fill="none" stroke="${detail}" stroke-width="1.1" opacity=".7"/>
      <path d="M -3.4 6.6 Q 0 8 3.4 6.6" fill="none" stroke="${detail}" stroke-width="1.1" opacity=".65"/>
      <circle cx="-3.4" cy="-14.4" r="1.5" fill="${c}" stroke="${edge}" stroke-width=".7"/>
      <circle cx="0.6" cy="-16" r="1.4" fill="${c}" stroke="${edge}" stroke-width=".7"/>
      <circle cx="4.4" cy="-15.6" r="1.2" fill="${c}" stroke="${edge}" stroke-width=".7"/></g>`;
  }
  trail(pts,c,edge,detail){let s='';pts.forEach(p=>{s+=this.sole(p[0],p[1],p[2],p[3],c,edge,detail);});return s;}

  lb(x1,y1,x2,y2,w1,w2,c){
    const dx=x2-x1,dy=y2-y1,L=Math.hypot(dx,dy)||1,px=-dy/L,py=dx/L;
    return `<path d="M ${(x1+px*w1).toFixed(1)} ${(y1+py*w1).toFixed(1)} L ${(x2+px*w2).toFixed(1)} ${(y2+py*w2).toFixed(1)} L ${(x2-px*w2).toFixed(1)} ${(y2-py*w2).toFixed(1)} L ${(x1-px*w1).toFixed(1)} ${(y1-py*w1).toFixed(1)} Z" fill="${c}"/><circle cx="${x2}" cy="${y2}" r="${w2}" fill="${c}"/>`;
  }
  runner2(x,y,sc,skin,kit,kit2,shoeC,edge){
    const P=(a,b,c,d,w1,w2,col)=>this.lb(a,b,c,d,w1,w2,col);
    let s=`<g transform="translate(${x} ${y}) scale(${sc})">`;
    s+=P(-2,0,-13,10,3.6,3.1,skin)+P(-13,10,-22,20,3.1,2.5,skin);
    s+=`<path d="M -25.5 22.6 Q -22.5 18.6 -20.4 19.6 L -18 22.4 Q -20 25.4 -25.6 25 Z" fill="${shoeC}" stroke="${edge}" stroke-width=".7"/>`;
    s+=P(2,-22,-11,-15,3.2,2.6,skin)+P(-11,-15,-16,-24,2.6,2.1,skin);
    s+=`<circle cx="-17" cy="-25.6" r="2.6" fill="${skin}"/>`;
    s+=`<path d="M -8 -26 Q 2 -30 9 -25 L 11 -12 Q 8 -6 4 -3 L -4 -2 Q -8 -8 -8 -16 Z" fill="${kit}" stroke="${edge}" stroke-width=".9"/>`;
    s+=`<path d="M -6 -4 L 8 -5 L 10 4 Q 2 8 -6 5 Z" fill="${kit2}" stroke="${edge}" stroke-width=".9"/>`;
    s+=`<path d="M -8 -26 Q 2 -30 9 -25 L 9.6 -21 Q 1 -25 -7.6 -22 Z" fill="#ffffff" opacity=".2"/>`;
    s+=P(3,0,15,7,3.7,3.2,skin)+P(15,7,11,19,3.2,2.6,skin);
    s+=`<path d="M 7.6 21.4 Q 11 17.4 14 18.4 L 17 21 Q 14.6 24.4 8 24 Z" fill="${shoeC}" stroke="${edge}" stroke-width=".7"/>`;
    s+=P(7,-23,19,-15,3.3,2.7,skin)+P(19,-15,16,-24,2.7,2.2,skin);
    s+=`<circle cx="15.6" cy="-25.4" r="2.6" fill="${skin}"/>`;
    s+=`<path d="M 5 -27 Q 8 -32 12 -31" fill="none" stroke="${skin}" stroke-width="4.6" stroke-linecap="round"/>`;
    s+=`<circle cx="12.6" cy="-34" r="6.2" fill="${skin}" stroke="${edge}" stroke-width=".8"/>`;
    s+=`<path d="M 7 -37.6 Q 12 -42.4 18.4 -38 Q 18.6 -35.4 17 -35.6 Q 12.4 -38.6 7.6 -35.8 Z" fill="${edge}"/>`;
    s+=`<circle cx="15.4" cy="-33.4" r="1" fill="${edge}"/></g>`;
    return s;
  }
  castle2(u,M,x,y,sc){
    const g=`url(#V${u})`,k=M.k,l=M.l,d=M.d;
    const merlon=(bx,by,n,w,step)=>{let s='';for(let i=0;i<n;i++){s+=`<rect x="${(bx+i*step).toFixed(1)}" y="${by}" width="${w}" height="${(w*1.05).toFixed(1)}" fill="${g}" stroke="${k}" stroke-width=".7"/>`;}return s;};
    const stones=(bx,by,bw,bh,rows,cols)=>{let s='';for(let r=0;r<rows;r++){for(let c=0;c<cols;c++){const off=(r%2)*(bw/cols/2);s+=`<rect x="${(bx+off+c*bw/cols).toFixed(1)}" y="${(by+r*bh/rows).toFixed(1)}" width="${(bw/cols-.8).toFixed(1)}" height="${(bh/rows-.8).toFixed(1)}" fill="none" stroke="${k}" stroke-width=".45" opacity=".5"/>`;}}return s;};
    let s=`<g transform="translate(${x} ${y}) scale(${sc})">`;
    s+=`<rect x="-22" y="-10" width="10" height="26" fill="${g}" stroke="${k}" stroke-width="1"/>`+stones(-22,-10,10,26,5,2)+merlon(-23.5,-14.5,3,4.4,5.2);
    s+=`<rect x="-19.5" y="-5" width="3.4" height="5.6" fill="#0A0603" stroke="${k}" stroke-width=".5"/>`;
    s+=`<rect x="12" y="-10" width="10" height="26" fill="${g}" stroke="${k}" stroke-width="1"/>`+stones(12,-10,10,26,5,2)+merlon(10.5,-14.5,3,4.4,5.2);
    s+=`<rect x="16.2" y="-5" width="3.4" height="5.6" fill="#0A0603" stroke="${k}" stroke-width=".5"/>`;
    s+=`<rect x="-13" y="2" width="26" height="14" fill="${g}" stroke="${k}" stroke-width="1"/>`+stones(-13,2,26,14,3,5)+merlon(-13.5,-1.6,5,4,5.4);
    s+=`<path d="M -5 16 L -5 7.5 Q 0 3 5 7.5 L 5 16 Z" fill="#0A0603" stroke="${k}" stroke-width=".8"/>`;
    s+=`<path d="M -5 9 L 5 9 M -3.4 16 L -3.4 8 M 3.4 16 L 3.4 8" stroke="${d}" stroke-width=".7" opacity=".7"/>`;
    s+=`<rect x="-8" y="-20" width="16" height="22" fill="${g}" stroke="${k}" stroke-width="1"/>`+stones(-8,-20,16,22,4,3)+merlon(-8.6,-24.4,4,4.2,4.7);
    s+=`<rect x="-2" y="-16" width="4" height="6.4" fill="#0A0603" stroke="${k}" stroke-width=".5"/>`;
    s+=`<path d="M -22 16 L 22 16 L 24 19 L -24 19 Z" fill="${d}" stroke="${k}" stroke-width=".8"/>`;
    s+=`<path d="M -22 -10 L -12 -10 M 12 -10 L 22 -10" stroke="${l}" stroke-width=".9" opacity=".45"/>`;
    s+=`<line x1="-17" y1="-30" x2="-17" y2="-15" stroke="${k}" stroke-width="1.1"/><path d="M -17 -30 L -9 -28 L -17 -25.6 Z" fill="#FF5C7A"/>`;
    s+=`<line x1="17" y1="-30" x2="17" y2="-15" stroke="${k}" stroke-width="1.1"/><path d="M 17 -30 L 25 -28 L 17 -25.6 Z" fill="#FF5C7A"/></g>`;
    return s;
  }
  trophy2(u,M,x,y,sc){
    const g=`url(#V${u})`,mg=`url(#M${u})`,k=M.k,l=M.l;
    let s=`<g transform="translate(${x} ${y}) scale(${sc})">`;
    s+=`<path d="M -13 -14 Q -23 -14 -23 -7 Q -23 1 -14 3" fill="none" stroke="${mg}" stroke-width="3.2"/>`;
    s+=`<path d="M 13 -14 Q 23 -14 23 -7 Q 23 1 14 3" fill="none" stroke="${mg}" stroke-width="3.2"/>`;
    s+=`<path d="M -13.5 -18 L 13.5 -18 L 11.6 -2 Q 10 8.6 0 10.6 Q -10 8.6 -11.6 -2 Z" fill="${g}" stroke="${k}" stroke-width="1"/>`;
    s+=`<path d="M -9 -15.4 Q -10.4 -4.6 -5.2 2.2" fill="none" stroke="${l}" stroke-width="1.7" opacity=".7"/>`;
    s+=`<path d="M 6.6 -15.4 Q 8.4 -6 5 0" fill="none" stroke="${k}" stroke-width="1.2" opacity=".45"/>`;
    s+=`<ellipse cx="0" cy="-18" rx="13.5" ry="3" fill="${l}" stroke="${k}" stroke-width=".8"/>`;
    s+=`<ellipse cx="0" cy="-18" rx="10.4" ry="2" fill="${M.m}" opacity=".55"/>`;
    s+=`<path d="M -8.6 -12.6 L 8.6 -12.6 L 7.6 -8.6 L -7.6 -8.6 Z" fill="${k}" opacity=".28"/>`;
    s+=this.st5(0,-4.6,4.6,l);
    s+=`<rect x="-3" y="10.6" width="6" height="6" fill="${g}" stroke="${k}" stroke-width=".8"/>`;
    s+=`<path d="M -9 16.6 L 9 16.6 L 9 19.6 L 11.6 19.6 L 11.6 24.6 L -11.6 24.6 L -11.6 19.6 L -9 19.6 Z" fill="${g}" stroke="${k}" stroke-width=".9"/>`;
    s+=`<rect x="-8.4" y="20.4" width="16.8" height="3.4" fill="${k}" opacity=".35"/>`;
    s+=`<path d="M -7 22.2 L 7 22.2" stroke="${l}" stroke-width=".9" opacity=".55"/></g>`;
    return s;
  }

  runner(c,x,y,sc,sw=4.6){return `<g transform="translate(${x} ${y}) scale(${sc})" stroke="${c}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" fill="none"><circle cx="6" cy="-23" r="5.4" fill="${c}" stroke="none"/><path d="M 3 -16 L -6 1"/><path d="M 1 -12 L 12 -7 L 21 -15"/><path d="M 0 -9 L -12 -5 L -19 -13"/><path d="M -6 1 L 6 8 L 13 22"/><path d="M -6 1 L -16 11 L -27 5"/></g>`;}
  shoe(u,M,x=64,y=56,sc=1,gid){const g=`url(#${gid||'V'+u})`;return `<g transform="translate(${x} ${y}) scale(${sc})">
    <path d="M -26 8 Q 0 16 26 6 L 27.5 12 Q 0 20.5 -27.5 14 Z" fill="${g}" stroke="${M.k}" stroke-width="1.1"/>
    <path d="M -25 6 Q -22.5 -12 -8 -14.5 Q 0.5 -15.5 4.5 -9 Q 12 0.5 24 2.4 L 26 6 Q 0 14.5 -25 6 Z" fill="${g}" stroke="${M.k}" stroke-width="1.2"/>
    <path d="M 6 -8 Q 14 0.5 24.2 2.2 L 25.6 5.4 Q 14 3.4 4.6 -6 Z" fill="${M.d}" opacity=".5"/>
    <path d="M -25 6 Q -24.4 -2 -22 -8 Q -18 -5.6 -16.5 2 Q -17.5 7 -25 6 Z" fill="${M.d}" opacity=".45"/>
    <path d="M -8.5 -14.6 Q -2 -14.2 1.4 -10 L -3.4 -6.2 Q -6 -11 -10.6 -11.6 Z" fill="${M.l}" opacity=".75" stroke="${M.k}" stroke-width=".6"/>
    <path d="M -21 -7.5 Q -14 -12.5 -7.5 -12" fill="none" stroke="${M.l}" stroke-width="1.5" opacity=".7"/>
    <path d="M -17 3 Q -2 8.5 20 4" fill="none" stroke="${M.l}" stroke-width="1.4" opacity=".5"/>
    <path d="M -26 5.4 Q 0 13.4 26 3 L 26.6 7.4 Q 0 17.4 -26.6 9.8 Z" fill="#F4F4EE" stroke="${M.k}" stroke-width=".9"/>
    <path d="M -26.5 9 Q 0 17.4 26.5 6.4 L 28 12.4 Q 0 21.8 -28 14.8 Z" fill="#15130E" stroke="${M.k}" stroke-width="1"/>
    ${(()=>{let t='';for(let i=0;i<9;i++){const tx=-22.5+i*5.6;t+=`<line x1="${tx.toFixed(1)}" y1="11.6" x2="${(tx+1.8).toFixed(1)}" y2="17" stroke="#5A5A52" stroke-width="1.4" opacity=".9"/>`;}return t;})()}
    <path d="M -5.6 -9.4 L 3 -4.8 M -9.2 -5.4 L -0.4 -0.8 M -12.8 -1.4 L -3.4 2.6" stroke="#F7F7F0" stroke-width="1.8" stroke-linecap="round"/>
    <path d="M -6.6 -5.2 L 1.6 -9.6 M -10.2 -1.2 L -1.8 -5.6" stroke="#F7F7F0" stroke-width="1.5" stroke-linecap="round" opacity=".8"/>
    <circle cx="-5.6" cy="-9.4" r="1.1" fill="${M.k}"/><circle cx="-9.2" cy="-5.4" r="1.1" fill="${M.k}"/><circle cx="-12.8" cy="-1.4" r="1.1" fill="${M.k}"/>
    <path d="M -22 -8.4 Q -25 -5.6 -25.2 -1" fill="none" stroke="${M.k}" stroke-width=".9" opacity=".6"/></g>`;}
  shPath(cx,cy,w,h){const x0=cx-w/2,x1=cx+w/2,yt=cy-h*.46,ys=cy+h*.04;return `M ${x0} ${yt} L ${x1} ${yt} L ${x1} ${ys} Q ${x1} ${ys+h*.3} ${cx} ${cy+h*.54} Q ${x0} ${ys+h*.3} ${x0} ${ys} Z`;}
  shield(u,M,panel,cx,cy,w,h){
    let s=`<path d="${this.shPath(cx,cy,w,h)}" fill="url(#M${u})" stroke="${M.k}" stroke-width="1.3"/>`;
    s+=`<path d="${this.shPath(cx,cy+.5,w-10,h-10)}" fill="${panel}" stroke="rgba(0,0,0,.5)" stroke-width="1"/>`;
    [[cx-w/2+4.4,cy-h*.46+4.4],[cx+w/2-4.4,cy-h*.46+4.4],[cx,cy+h*.49]].forEach(p=>{s+=`<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="1.4" fill="${M.l}" opacity=".9"/>`;});
    return s;}
  sword(fill,k,rot,cx=64,cy=54,len=26){return `<g transform="rotate(${rot} ${cx} ${cy})"><polygon points="${cx},${cy-len} ${cx+2.5},${cy-len+4.6} ${cx+2.5},${cy+len-10} ${cx},${cy+len-6} ${cx-2.5},${cy+len-10} ${cx-2.5},${cy-len+4.6}" fill="${fill}" stroke="${k}" stroke-width=".5"/><rect x="${cx-7}" y="${cy+len-11}" width="14" height="3.2" rx="1.3" fill="${fill}"/><rect x="${cx-1.5}" y="${cy+len-8}" width="3" height="7" fill="${k}"/><circle cx="${cx}" cy="${cy+len}" r="2.2" fill="${fill}"/></g>`;}
  wing(fill,s,sc=1,cx=64,cy=52){return `<g transform="translate(${cx+s*13} ${cy}) scale(${s} 1) scale(${sc})"><path d="M0 -5 Q 15 -15 32 -12 Q 21 -7 16 -3 Q 25 -4 30 0 Q 19 2 13 4 Q 6 6 1 4 Z" fill="${fill}"/><path d="M 3 -4 Q 13 -9 25 -9" fill="none" stroke="#ffffff" stroke-width=".8" opacity=".5"/></g>`;}
  flag(u,M,x,y,h=24,w=17){return `<line x1="${x}" y1="${y}" x2="${x}" y2="${y-h}" stroke="url(#M${u})" stroke-width="2.6" stroke-linecap="round"/><path d="M ${x} ${y-h} L ${x+w} ${y-h+4.5} L ${x+w-5} ${y-h+9} L ${x+w} ${y-h+13.5} L ${x} ${y-h+18} Z" fill="url(#V${u})" stroke="${M.k}" stroke-width="1"/><circle cx="${x}" cy="${y-h-2}" r="2" fill="${M.l}"/><ellipse cx="${x}" cy="${y+1}" rx="7" ry="2.4" fill="${M.d}" opacity=".8"/>`;}
  castle(u,M,x,y,sc=1){return `<g transform="translate(${x} ${y}) scale(${sc})">
    <rect x="-20" y="-10" width="9" height="24" fill="url(#V${u})" stroke="${M.k}" stroke-width="1"/><rect x="11" y="-10" width="9" height="24" fill="url(#V${u})" stroke="${M.k}" stroke-width="1"/>
    <rect x="-21.5" y="-13.5" width="4.4" height="4.4" fill="url(#V${u})"/><rect x="-15" y="-13.5" width="4.4" height="4.4" fill="url(#V${u})"/><rect x="10.5" y="-13.5" width="4.4" height="4.4" fill="url(#V${u})"/><rect x="17" y="-13.5" width="4.4" height="4.4" fill="url(#V${u})"/>
    <rect x="-12" y="0" width="24" height="14" fill="url(#V${u})" stroke="${M.k}" stroke-width="1"/>
    <rect x="-7" y="-19" width="14" height="20" fill="url(#V${u})" stroke="${M.k}" stroke-width="1"/><rect x="-8" y="-22.5" width="4.4" height="4.4" fill="url(#V${u})"/><rect x="-2.2" y="-22.5" width="4.4" height="4.4" fill="url(#V${u})"/><rect x="3.6" y="-22.5" width="4.4" height="4.4" fill="url(#V${u})"/>
    <path d="M -4 14 L -4 6 Q 0 2 4 6 L 4 14 Z" fill="#05070a"/>
    <rect x="-17.5" y="-6" width="3" height="5" fill="#05070a"/><rect x="14.5" y="-6" width="3" height="5" fill="#05070a"/></g>`;}
  trophy(u,M,x,y,sc=1){const g=`url(#V${u})`,l=M.l,k=M.k;return `<g transform="translate(${x} ${y}) scale(${sc})">
    <path d="M-13 -13 Q -21.5 -13 -21.5 -7 Q -21.5 -1 -14 0" fill="none" stroke="${g}" stroke-width="2.8"/>
    <path d="M13 -13 Q 21.5 -13 21.5 -7 Q 21.5 -1 14 0" fill="none" stroke="${g}" stroke-width="2.8"/>
    <path d="M -12.5 -17.5 L 12.5 -17.5 L 11 -3 Q 9.5 7 0 9 Q -9.5 7 -11 -3 Z" fill="${g}" stroke="${k}" stroke-width="1"/>
    <ellipse cx="0" cy="-17.5" rx="12.5" ry="2.7" fill="${l}" stroke="${k}" stroke-width=".8"/>
    <path d="M -8.5 -15 Q -9.5 -5 -5 1" stroke="${l}" stroke-width="1.5" fill="none" opacity=".65"/>
    ${this.st5(0,-6,4.8,l)}
    <rect x="-2.7" y="9" width="5.4" height="6" fill="${g}" stroke="${k}" stroke-width=".8"/>
    <path d="M -8 15 L 8 15 L 8 18 L 10.5 18 L 10.5 22.5 L -10.5 22.5 L -10.5 18 L -8 18 Z" fill="${g}" stroke="${k}" stroke-width=".8"/></g>`;}

  /* ============ generic badge composer ============ */
  mk(u,o){
    const M=this.MET[o.met];
    const A=o.acc?this.MET[o.acc]:null;
    const d=this.gDefs(u,M,o.sky,o.rib,o.aura)+(o.defs||'')
      +(A?`<linearGradient id="MX${u}" x1="10%" y1="0%" x2="90%" y2="100%"><stop offset="0%" stop-color="${A.l}"/><stop offset="24%" stop-color="${A.m}"/><stop offset="52%" stop-color="${A.d}"/><stop offset="76%" stop-color="${A.m}"/><stop offset="100%" stop-color="${A.l}"/></linearGradient><linearGradient id="VX${u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${A.l}"/><stop offset="50%" stop-color="${A.m}"/><stop offset="100%" stop-color="${A.d}"/></linearGradient>`:'');
    let b=this.frame(u,M);
    b+=`<g clip-path="url(#C${u})">${o.scene||''}${o.shafts===false?'':this.shafts(o.shaftC||'#ffffff',o.shaftO??.08)}${this.vignette(u)}</g>`+this.gloss();
    if(o.laurel) b+=this.bev(this.laurel(u,this.MET[o.laurel],{r:o.laurelR??41,n:o.laurelN??8}));
    if(o.ground!==false) b+=this.ground(o.groundY??78,o.groundR??24,o.groundO??.38);
    b+=o.body||'';
    b+=this.shine(u,o.shineD??5.6,o.shineDelay??0);
    if(o.big) b+=this.txt(o.big,64,o.bigY??70,o.bigS??22,`url(#V${u})`,{ls:1.4,stroke:M.k,sw:.14});
    if(o.label) b+=this.ribbon(u,o.label,M,{y:o.ribY??88,w:o.ribW,tc:o.tc,ts:o.ts});
    b+=this.crest(u,M);
    if(o.stars!==0) b+=this.starRow(o.stars??3,o.starC??M.l);
    if(o.sparks) b+=this.spks(o.sparks,o.sparkC||'#ffffff');
    return this.wrap(d,b);
  }

  /* ============ 24 Einzelerfolge ============ */
  b1(u){const M=this.MET.gold;return this.mk(u,{met:'gold',sky:['#FFD48A','#E9702C','#5C1A06'],rib:['#3E1A06','#7A3208','#2A0F02'],aura:'#FF9A2E',
    scene:this.scRays('#FFE7B0',.18,20)+this.scSun(64,44,17,'#FFFDF0','#FFB24A')+this.scClouds('#FFD9A8',.45,38)+this.scBirds('#5C2408')
      +this.scHills('#8A3A10','#4A1A05','#B4571C')+this.scRoad('#3A1608','#5A2410','#FFD48A'),
    acc:'lime',body:this.bev(this.shoe(u,M,64,56,1.2,'VX'+u)),label:'ERSTER LAUF',tc:'#FFE7B0',stars:3});}
  b2(u){const M=this.MET.silver;return this.mk(u,{met:'silver',sky:['#2AA7C4','#0B5570','#02202E'],rib:['#0B5570','#083A4E','#021A24'],aura:'#3FE0FF',
    scene:this.scTopo('#7FE3FF',.3)+this.scGrid('#7FE3FF',.18)+this.scHaze('#0A3D52',98,.55)
      +this.scParticles('#D8FBFF',[[34,36,1.2],[96,32,1],[100,54,.9],[28,58,.9],[46,26,.8],[86,72,1]])
      +`<path d="M 16 70 Q 40 62 64 68 Q 90 74 112 66" fill="none" stroke="#9FE8FF" stroke-width="1.2" stroke-dasharray="4 4" opacity=".55"/>`,
    acc:'lime',body:this.bev(`<g transform="translate(64 52) scale(1.24)"><path d="M0 -18 C 8.6 -18 14 -12 14 -4.4 C 14 5 0 20 0 20 C 0 20 -14 5 -14 -4.4 C -14 -12 -8.6 -18 0 -18 Z" fill="url(#VX${u})" stroke="#1E3A04" stroke-width="1.2"/><circle cx="0" cy="-4.4" r="5" fill="#0B3B4E"/><circle cx="0" cy="-4.4" r="2.4" fill="#D8FBFF"/></g>`)
      +this.glo(`<path d="M 34 40 L 44 36 L 40 46 Z" fill="#D8FBFF" opacity=".9"/><path d="M 94 44 L 84 40 L 88 50 Z" fill="#7FE3FF" opacity=".7"/>`),
    label:'ENTDECKER',tc:'#D8FBFF',stars:3});}
  b3(u){const M=this.MET.bronze;return this.mk(u,{met:'bronze',sky:['#FFC98A','#B4571C','#3A1405'],rib:['#4A2008','#7A3B12','#2A1004'],aura:'#CC8A4E',
    scene:this.scRays('#FFD9A8',.16,16)+this.scSun(88,40,11,'#FFF3C4','#FF8A2E')+this.scClouds('#E8B07A',.4,34)+this.scBirds('#4A1E06')
      +this.scHills('#6E3110','#3E1706','#9A4A16')+this.scForest('#2E1204',82,.9),
    body:this.bev(this.castle2(u,M,62,56,1.02))+this.glo(`<path d="M 84 26 L 99 30.5 L 92.5 35.5 L 99 40.5 L 84 45 Z" fill="#FF5C7A"/><line x1="84" y1="22" x2="84" y2="50" stroke="#8A4A18" stroke-width="1.8"/>`),
    label:'EROBERT',tc:'#FFE0B8',stars:3});}
  b4(u){const M=this.MET.steel;return this.mk(u,{met:'steel',sky:['#9FE8FF','#1E6E96','#04202E'],rib:['#08344A','#0C5578','#031824'],aura:'#3FE0FF',
    scene:this.scGrid('#7FE3FF',.4)+this.scHexField('#9FE8FF',.5)+this.scStars('#D8FBFF',[[36,34,1.2],[92,30,1],[100,48,.9],[28,52,.9]]),
    body:this.bev(this.flag(u,M,56,74,30,20)),
    label:'GRENZPIONIER',tc:'#D8FBFF',stars:3});}
  b5(u){const M=this.MET.violet;return this.mk(u,{met:'violet',sky:['#C69BFF','#5B2A9E','#170733'],rib:['#2A0E52','#4B238E','#150629'],aura:'#A66BFF',
    scene:this.scStars('#EFDCFF',[[32,36,1.3],[96,32,1.1],[42,26,.9],[88,50,1],[30,66,.9],[100,72,1.1],[52,30,.8]])+this.scRays('#C69BFF',.14,14),
    laurel:'violet',
    body:this.bev(`<polygon points="${this.hexP(64,52,13)}" fill="url(#M${u})" stroke="${M.k}" stroke-width="1.2"/><polygon points="${this.hexP(48,62,10)}" fill="url(#V${u})" stroke="${M.k}" stroke-width="1"/><polygon points="${this.hexP(80,62,10)}" fill="url(#V${u})" stroke="${M.k}" stroke-width="1"/><polygon points="${this.hexP(64,52,9)}" fill="none" stroke="${M.l}" stroke-width=".7" opacity=".5"/>`)
      +this.crown(64,34,.72,`url(#M${u})`,M.l),
    label:'20 GEBIETE',tc:'#EFDCFF',stars:4});}
  b6(u){const M=this.MET.gold;return this.mk(u,{met:'gold',sky:['#FFE9A8','#B23A10','#3A0D02'],rib:['#4A1004','#8A2A08','#2A0802'],aura:'#FFC93C',
    scene:this.scRays('#FFE7B0',.3,20)+this.scHexField('#FFD48A',.45)+this.scHaze('#7A2408',100,.45),
    laurel:'gold',
    body:this.bev(this.crown(64,48,1.95,`url(#M${u})`,M.l))+this.glo(this.st5(64,72,5,'#FFF3C4',.95)),
    label:'KÖNIG',tc:'#FFF3C4',stars:5,starC:'#FFF3C4'});}
  b7(u){const M=this.MET.lime;return this.mk(u,{met:'lime',sky:['#E4FF7A','#3E7A12','#0A2A08'],rib:['#1E3A04','#4A7A0A','#0E2202'],aura:'#D8F63C',
    scene:this.scSpeed('#E4FF7A',.55)+this.scRays('#D8F63C',.12,12)+this.scHaze('#1E4A0A',98,.5),
    body:this.glo(`<path d="M 92 28 L 76 54 L 86 54 L 78 82 L 100 50 L 89 50 Z" fill="#F6FFC0" opacity=".85"/>`)+this.bev(this.shoe(u,M,62,56,1.06)),
    label:'TEMPO',tc:'#F6FFC0',stars:3});}
  b8(u){const M=this.MET.gold;return this.mk(u,{met:'gold',sky:['#4A76C4','#132C64','#050E26'],rib:['#0A1A40','#1E3A78','#050D20'],aura:'#FFC93C',
    scene:this.scStars('#DCEBFF',[[34,34,1.2],[94,30,1],[100,52,.9],[30,58,.9],[46,26,.8],[84,72,1]])+this.scRays('#FFC93C',.14,16),
    body:this.bev(this.wing(`url(#V${u})`,1,.9,64,52)+this.wing(`url(#V${u})`,-1,.9,64,52))
      +this.bev(`<circle cx="64" cy="54" r="17" fill="url(#M${u})" stroke="${M.k}" stroke-width="1.2"/><circle cx="64" cy="54" r="13" fill="#101A38"/>`)
      +`<line x1="64" y1="54" x2="64" y2="45" stroke="#FFF3C4" stroke-width="2" stroke-linecap="round"/><line x1="64" y1="54" x2="70" y2="57" stroke="#FFF3C4" stroke-width="1.6" stroke-linecap="round"/><circle cx="64" cy="54" r="1.6" fill="#FFF3C4"/>`,
    label:'60 MINUTEN',tc:'#FFF3C4',stars:3});}
  b9(u){const M=this.MET.steel;return this.mk(u,{met:'steel',sky:['#D7EEFF','#4C7BA6','#0C2438'],rib:['#0E2A44','#215070','#08182A'],aura:'#8FA9C4',
    scene:this.scSun(96,32,10,'#FFF6DC','#FFD48A')+this.scClouds('#C6DCEE',.4,40)+this.scMountains('#3E6A94','#28496B','#16304A','#F2FAFF')+this.scBirds('#0E2438',.6),
    body:this.bev(this.flag(u,M,74,40,22,16)),label:'1000 HM',tc:'#DCEBFF',stars:3});}
  b10(u){const M=this.MET.ember;const fl=(s,f,o=1)=>`<path transform="translate(64 78) scale(${s})" d="M0 0 C -13 -7 -11 -23 -2 -37 C 0 -28 4.5 -27 5.5 -19 C 6.5 -13 13 -11 12 -2 C 11 6 5 5 0 0 Z" fill="${f}" opacity="${o}"/>`;
    return this.mk(u,{met:'ember',sky:['#FFD48A','#C4380C','#3A0802'],rib:['#4A0F02','#8A2A06','#2A0601'],aura:'#FF9A2E',
    scene:this.scRays('#FFC98A',.2,18)+this.scHaze('#8A2408',102,.5),
    body:`<g style="animation:rcFlicker 2.4s ease-in-out infinite;transform-origin:64px 78px">${this.glo2(fl(1.05,`url(#V${u})`)+fl(.72,'#FFB53C')+fl(.44,'#FFF3B0'))}</g>`+this.txt('7',64,58,24,'#3A0802',{stroke:'#FFE7B0',sw:.16}),
    label:'7 TAGE',tc:'#FFE7B0',stars:3});}
  b11(u){const M=this.MET.cyan;return this.mk(u,{met:'cyan',sky:['#9FF3FF','#0A5A78','#021A26'],rib:['#03303F','#0A6E8C','#021620'],aura:'#3FE0FF',
    scene:this.scGrid('#7FE3FF',.35)+this.scRays('#9FF3FF',.14,14),
    body:this.glo(`<path d="M 26 60 A 38 38 0 0 1 102 60" fill="none" stroke="#9FF3FF" stroke-width="2" opacity=".55"/><path d="M 32 62 A 32 32 0 0 1 96 62" fill="none" stroke="#D8FBFF" stroke-width="1.2" opacity=".4"/>`)
      +this.bev(this.shield(u,M,'#03303F',64,54,42,50))
      +this.glo(`<path d="M 52 52 L 62 62 L 78 44" fill="none" stroke="#D8FBFF" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`),
    label:'VERTEIDIGT',tc:'#D8FBFF',stars:3});}
  b12(u){const M=this.MET.violet;const arw=(x,y,r)=>`<g transform="rotate(${r} ${x} ${y})"><line x1="${x}" y1="${y-17}" x2="${x}" y2="${y+11}" stroke="#EFDCFF" stroke-width="2.4"/><polygon points="${x},${y+17} ${x-4.2},${y+8} ${x+4.2},${y+8}" fill="#EFDCFF"/><polygon points="${x},${y-18} ${x-4},${y-10} ${x+4},${y-10}" fill="#A66BFF"/></g>`;
    return this.mk(u,{met:'violet',sky:['#B98BFF','#3E1878','#100428'],rib:['#25094A','#4B238E','#12042A'],aura:'#A66BFF',
    scene:this.scRays('#C69BFF',.14,14)+`<rect x="14" y="76" width="100" height="42" fill="#2A0E52"/><g fill="#3E1878">${[18,32,46,60,74,88,102].map(x=>`<rect x="${x}" y="70" width="9" height="8"/>`).join('')}</g><rect x="14" y="76" width="100" height="4" fill="#5B2A9E"/>`,
    body:this.bev(arw(42,44,14)+arw(64,36,-4)+arw(86,46,-18))+this.glo(`<circle cx="64" cy="74" r="7" fill="#EFDCFF" opacity=".35"/>`),
    label:'BELAGERT',tc:'#EFDCFF',stars:3});}
  b13(u){const M=this.MET.bronze;return this.mk(u,{met:'bronze',sky:['#FFDCA8','#A8551E','#331204'],rib:['#3E1806','#7A3B12','#240E03'],aura:'#CC8A4E',
    scene:this.scSun(64,40,12,'#FFF3C4','#FFA84A')+this.scRays('#FFD9A8',.14,14)+this.scClouds('#E8B07A',.35,32)
      +this.scHills('#6E3110','#3E1706','#9A4A16')+this.scForest('#2E1204',80,.85),
    body:this.bev(this.sole(42,56,-16,1.02,'#7A4A1C','#2E1B08','#F5CE9C')+this.sole(86,56,16,1.02,'#7A4A1C','#2E1B08','#F5CE9C'))+this.bev(this.sole(64,50,0,1.24,`url(#V${u})`,'#2E1B08','#2E1B08')),
    label:'TEAM',tc:'#FFE0B8',stars:3});}
  b14(u){const M=this.MET.gold;return this.mk(u,{met:'gold',sky:['#5B7CC4','#182A64','#050C22'],rib:['#0A1636','#22336E','#04091C'],aura:'#FFC93C',
    scene:this.scStars('#DCEBFF',[[32,34,1.2],[96,30,1],[100,54,.9],[28,58,.9],[48,24,.8],[82,74,1],[40,80,.9]])+this.scRays('#FFC93C',.16,16),
    body:this.bev(this.st5(36,44,8,`url(#M${u})`)+this.st5(92,44,8,`url(#M${u})`)+this.st5(42,74,7,`url(#M${u})`)+this.st5(86,74,7,`url(#M${u})`))
      +this.bev(this.st5(64,54,18,`url(#M${u})`))+this.glo(this.st5(64,54,9,'#FFF3C4',.95)),
    label:'ALLROUNDER',tc:'#FFF3C4',stars:5,starC:'#FFF3C4'});}
  b15(u){const M=this.MET.cyan;return this.mk(u,{met:'cyan',sky:['#9FF3FF','#0B4E78','#02182A'],rib:['#032B44','#0A6E8C','#02141F'],aura:'#3FE0FF',
    scene:this.scStars('#D8FBFF',[[30,36,1.1],[96,32,1],[100,60,.9],[26,64,.9]]),
    body:this.bev(`<circle cx="64" cy="54" r="20" fill="#0B4E78" stroke="${M.d}" stroke-width="1.4"/>`)
      +`<g clip-path="url(#C${u})"><path d="M 50 46 Q 60 40 68 46 Q 74 51 68 56 Q 58 58 52 53 Z" fill="#2FD489" opacity=".9"/><path d="M 70 60 Q 78 58 81 63 Q 78 69 70 68 Z" fill="#2FD489" opacity=".85"/><path d="M 52 62 Q 57 61 58 66 Q 54 69 51 66 Z" fill="#2FD489" opacity=".8"/></g>`
      +`<ellipse cx="64" cy="54" rx="8" ry="20" fill="none" stroke="#D8FBFF" stroke-width=".8" opacity=".4"/><ellipse cx="64" cy="54" rx="20" ry="7" fill="none" stroke="#D8FBFF" stroke-width=".8" opacity=".35"/>`
      +this.bev(`<ellipse cx="64" cy="54" rx="28" ry="9" transform="rotate(-18 64 54)" fill="none" stroke="url(#M${u})" stroke-width="2.4"/>`),
    label:'100 KM',tc:'#D8FBFF',stars:3});}
  b16(u){const M=this.MET.steel;return this.mk(u,{met:'steel',sky:['#B8CFE4','#3E566E','#0B1620'],rib:['#0E1E2C','#2C4560','#070F18'],aura:'#8FA9C4',
    scene:this.scGrid('#B8CFE4',.2)+this.scCity('#16283A',.9)+this.scWindows('#FFD48A')+this.scHaze('#1B2E40',102,.5)+this.scClouds('#5E7683',.3,32),
    body:this.bev(this.castle2(u,M,64,56,1.0))+this.bev(`<g transform="translate(64 56)"><rect x="-6" y="-2" width="12" height="10" rx="2" fill="url(#M${u})" stroke="${M.k}" stroke-width=".8"/><path d="M -3.6 -2 v-3 a3.6 3.6 0 0 1 7.2 0 v3" fill="none" stroke="url(#M${u})" stroke-width="2.2"/><circle cx="0" cy="2.6" r="1.5" fill="#0B1620"/></g>`),
    label:'FESTUNG',tc:'#DCEBFF',stars:3});}
  b17(u){const M=this.MET.jade;return this.mk(u,{met:'jade',sky:['#8CF0C0','#0E7A50','#02291B'],rib:['#043524','#0B6B45','#021A11'],aura:'#2FD489',
    scene:this.scTopo('#8CF0C0',.28)+`<path d="M 64 16 L 56 40 L 70 58 L 52 78 L 66 112 L 118 112 L 118 16 Z" fill="#0A5B3B" opacity=".85"/>`,
    body:`<path d="M 64 22 L 56 40 L 70 58 L 52 78 L 66 106" fill="none" stroke="#E6FF55" stroke-width="2.6" stroke-dasharray="5 4"/>`
      +this.bev(`<g transform="translate(64 56) rotate(-18)"><polygon points="-20,-8 16,6 12,10 -22,-3" fill="url(#M${u})"/><polygon points="-20,8 16,-6 12,-10 -22,3" fill="url(#M${u})"/><circle cx="-2" cy="0" r="2" fill="url(#M${u})"/><circle cx="20" cy="9" r="4.4" fill="none" stroke="#FF5C7A" stroke-width="2.6"/><circle cx="20" cy="-9" r="4.4" fill="none" stroke="#FF5C7A" stroke-width="2.6"/></g>`),
    label:'GRENZE',tc:'#CFF7DC',stars:3});}
  b18(u){const M=this.MET.gold;return this.mk(u,{met:'gold',sky:['#FFE9A8','#A82A12','#33060A'],rib:['#42060C','#8A1A20','#260306'],aura:'#FFC93C',
    scene:this.scRays('#FFE7B0',.3,22)+this.scHaze('#6E1010',104,.4),
    laurel:'gold',
    body:this.bev(`<rect x="52" y="46" width="24" height="34" fill="url(#M${u})" stroke="${M.k}" stroke-width="1.2"/><rect x="30" y="60" width="22" height="20" fill="url(#V${u})" stroke="${M.k}" stroke-width="1"/><rect x="76" y="66" width="22" height="14" fill="url(#V${u})" stroke="${M.k}" stroke-width="1"/>`)
      +this.txt('1',64,72,26,'#42060C',{stroke:'#FFF3C4',sw:.14})+this.txt('2',41,76,13,'#42060C',{stroke:'#FFE7B0',sw:.16})+this.txt('3',87,77,13,'#42060C',{stroke:'#FFE7B0',sw:.16}),
    label:'PLATZ 1',tc:'#FFF3C4',stars:5,starC:'#FFF3C4'});}
  b19(u){const M=this.MET.cyan;return this.mk(u,{met:'cyan',sky:['#5BE6FF','#07485E','#01141C'],rib:['#02222C','#0A6E8C','#01131A'],aura:'#3FE0FF',
    scene:this.scSpeed('#7FE3FF',.4)+this.scRays('#9FF3FF',.12,12),
    body:this.glo2(this.trail([[44,74,-24,.7],[58,60,-14,.88],[74,46,-4,1.04]],'rgba(63,224,255,.45)','rgba(63,224,255,.45)','rgba(63,224,255,.45)'))+this.glo(this.trail([[44,74,-24,.7],[58,60,-14,.88],[74,46,-4,1.04]],'#9FF3FF','#0A5A78','#02222C')),
    label:'100 TAGE',tc:'#D8FBFF',stars:4});}
  b20(u){const M=this.MET.violet;return this.mk(u,{met:'violet',sky:['#7C6CFF','#241A6E','#080522'],rib:['#150C3E','#3A2A8E','#0A0522',],aura:'#A66BFF',
    scene:this.scParticles('#EFDCFF',[[34,32,1.3],[96,28,1.1],[44,24,.9],[88,46,1],[28,56,.9],[102,66,1],[54,28,.8],[36,74,.9],[70,22,.9],[24,44,.8]])
      +`<circle cx="92" cy="38" r="18" fill="#EFDCFF" opacity=".12"/><path d="M 92 32 a 11 11 0 1 0 8 18 a 8.6 8.6 0 1 1 -8 -18 Z" fill="#EFDCFF" opacity=".95"/>`
      +this.scHills('#180F52','#0B0630','#221566')+this.scForest('#0B0630',82,.95)+this.scWater('#7C6CFF',86,.3),
    body:this.bev(this.sole(48,64,-20,1,'#4B238E','#12042C','#EFDCFF')+this.sole(76,50,8,1.16,`url(#V${u})`,'#12042C','#4B238E')),
    label:'NACHTLAUF',tc:'#EFDCFF',stars:3});}
  b21(u){const M=this.MET.jade;return this.mk(u,{met:'jade',sky:['#B6FFD8','#12885A','#032A1C'],rib:['#053A26','#0B6B45','#021C12'],aura:'#2FD489',
    scene:this.scSun(88,38,10,'#F2FFE8','#8CF0C0')+this.scRays('#B6FFD8',.12,14)+this.scClouds('#8CF0C0',.28,32)
      +this.scHills('#0A5B3B','#04331F','#0E7A50')+this.scForest('#052E1E',82,.9)+this.scParticles('#CFF7DC',[[34,50,1],[92,58,.9],[46,40,.8]]),
    body:this.bev(`<g transform="translate(64 58)"><path d="M -3 22 L -2 2 L 2 2 L 3 22 Z" fill="#4A2E12" stroke="${M.k}" stroke-width=".8"/><path d="M -2.4 8 Q -7 10 -9.5 14 M 2.4 8 Q 7 10 9.5 14" fill="none" stroke="#4A2E12" stroke-width="1.6"/><circle cx="-10" cy="-6" r="11.5" fill="url(#V${u})" stroke="${M.k}" stroke-width=".9"/><circle cx="10" cy="-5" r="10.5" fill="url(#V${u})" stroke="${M.k}" stroke-width=".9"/><circle cx="0" cy="-15" r="12.5" fill="url(#V${u})" stroke="${M.k}" stroke-width=".9"/><circle cx="-4" cy="-18" r="1.2" fill="${M.l}"/><circle cx="6" cy="-13" r="1.1" fill="${M.l}"/><circle cx="-12" cy="-9" r="1.1" fill="${M.l}"/></g>`),
    label:'NATUR',tc:'#CFF7DC',stars:3});}
  b22(u){const M=this.MET.gold;return this.mk(u,{met:'gold',sky:['#FFF3C4','#C48A0A','#3A2600'],rib:['#3A2600','#8A6208','#261800'],aura:'#FFC93C',
    scene:this.scRays('#FFF3C4',.3,24)+this.scSun(64,50,17,'#FFFDF0','#FFD86A')+this.scCity('#6E4806',.45)+this.scHaze('#8A6208',102,.4)
      +this.scParticles('#FFFDF0',[[32,34,1.3],[98,30,1.2],[38,72,1],[92,70,1.1],[64,26,1],[26,54,.9],[104,56,.9]]),
    laurel:'gold',laurelN:9,
    body:this.glo(this.bev(this.trophy2(u,M,64,54,1.14))),
    label:'LEGENDÄR',tc:'#FFF3C4',stars:5,starC:'#FFF3C4',sparks:[[26,30,1],[102,28,1],[30,90,.8],[98,88,.9]],sparkC:'#FFF6DC'});}
  b23(u){const M=this.MET.rose;return this.mk(u,{met:'rose',sky:['#FF9AAE','#8A0F2A','#2A0209'],rib:['#3A020C','#8A1030','#220106'],aura:'#FF5C7A',
    scene:this.scRays('#FF9AAE',.2,18)+this.scHaze('#5E0A1E',102,.45),
    body:this.bev(`<g transform="translate(64 54)"><path d="M -16 -6 Q -16 -22 0 -22 Q 16 -22 16 -6 L 16 6 L 10 12 L -10 12 L -16 6 Z" fill="url(#V${u})" stroke="${M.k}" stroke-width="1.2"/><path d="M -16 -4 L 16 -4" stroke="${M.k}" stroke-width="1"/><path d="M -9 -2 L -3 -2 L -3 4 L -9 4 Z M 3 -2 L 9 -2 L 9 4 L 3 4 Z" fill="#2A0209"/><path d="M -2 -20 L 0 -30 L 2 -20 Z" fill="${M.l}"/></g>`)
      +this.txt('30',64,80,17,'#FFD3DC',{stroke:'#2A0209',sw:.18}),
    label:'30 TAGE',tc:'#FFD3DC',stars:3});}
  b24(u){const M=this.MET.violet;return this.mk(u,{met:'violet',sky:['#D8C0FF','#4B238E','#0E0429'],rib:['#1C0740','#4B238E','#0C0322'],aura:'#A66BFF',
    scene:this.scRays('#D8C0FF',.2,20)+this.scStars('#F2E9FF',[[32,36,1.2],[98,34,1],[30,72,.9],[96,74,1]]),
    body:this.bev(`<polygon points="64,28 78,44 78,66 64,82 50,66 50,44" fill="url(#V${u})" stroke="#F2E9FF" stroke-width="1.2"/><polygon points="64,34 73,46 73,64 64,76 55,64 55,46" fill="none" stroke="#F2E9FF" stroke-width=".8" opacity=".55"/>`)
      +this.glo(`<path d="M 57 55 a 5 5 0 1 1 7 4 a 5 5 0 1 0 7 -4 a 5 5 0 1 0 -7 4 a 5 5 0 1 1 -7 -4 Z" fill="none" stroke="#F2E9FF" stroke-width="2.2"/>`),
    label:'UNSTERBLICH',tc:'#EFDCFF',stars:5});}

  /* ============ Meisterklasse ============ */
  b25(u){const M=this.MET.gold;return this.mk(u,{met:'gold',sky:['#FFE9A8','#B4610E','#3A1A02'],rib:['#3E1604','#8A4A08','#260F02'],aura:'#FFC93C',
    scene:this.scRays('#FFE7B0',.28,22)+this.scHills('#7A3A0A','#421C04'),laurel:'gold',laurelN:9,
    body:this.bev(this.wing(`url(#V${u})`,1,.85,64,48)+this.wing(`url(#V${u})`,-1,.85,64,48))+this.bev(this.shoe(u,M,64,56,.86))+this.crown(64,30,.72,`url(#M${u})`,M.l),
    label:'42,2 KM',tc:'#FFF3C4',stars:5,starC:'#FFF3C4'});}
  b26(u){const M=this.MET.violet;return this.mk(u,{met:'violet',sky:['#C69BFF','#4B238E','#12042C'],rib:['#22084A','#4B238E','#10032A'],aura:'#A66BFF',
    scene:this.scStars('#EFDCFF',[[32,34,1.3],[96,30,1.1],[42,24,.9],[90,50,1],[28,62,.9],[100,70,1]])+this.scRays('#C69BFF',.16,16),laurel:'violet',laurelN:9,
    body:this.bev(this.wing(`url(#V${u})`,1,.95,64,48)+this.wing(`url(#V${u})`,-1,.95,64,48))+this.bev(this.shoe(u,M,64,56,.86))+this.crown(64,30,.7,`url(#M${u})`,M.l),
    label:'100 KM',tc:'#EFDCFF',stars:5});}
  b27(u){const M=this.MET.cyan;return this.mk(u,{met:'cyan',sky:['#9FF3FF','#0A5A82','#02182A'],rib:['#032B44','#0A6E8C','#02141F'],aura:'#3FE0FF',
    scene:this.scStars('#D8FBFF',[[30,34,1.1],[98,30,1],[100,62,.9],[26,66,.9],[44,22,.8]]),laurel:'gold',laurelN:9,
    body:this.bev(`<circle cx="64" cy="52" r="18" fill="#0A5A82" stroke="${M.d}" stroke-width="1.3"/>`)
      +`<path d="M 51 45 Q 60 40 67 45 Q 72 50 66 54 Q 57 56 52 51 Z" fill="#2FD489" opacity=".9"/><path d="M 68 58 Q 75 56 78 61 Q 75 66 68 65 Z" fill="#2FD489" opacity=".85"/>`
      +`<ellipse cx="64" cy="52" rx="7" ry="18" fill="none" stroke="#D8FBFF" stroke-width=".8" opacity=".4"/><ellipse cx="64" cy="52" rx="18" ry="6" fill="none" stroke="#D8FBFF" stroke-width=".8" opacity=".35"/>`
      +this.bev(`<ellipse cx="64" cy="52" rx="26" ry="8.6" transform="rotate(-18 64 52)" fill="none" stroke="url(#M${u})" stroke-width="2.4"/>`)+this.crown(64,26,.68,'url(#MG'+u+')',this.MET.gold.l),
    defs:`<linearGradient id="MG${u}" x1="10%" y1="0%" x2="90%" y2="100%"><stop offset="0%" stop-color="#FFF3C4"/><stop offset="45%" stop-color="#FFC93C"/><stop offset="100%" stop-color="#9A6B08"/></linearGradient>`,
    label:'5.000 KM',tc:'#D8FBFF',stars:5});}
  b28(u){const M=this.MET.ember;const fl=(s,f,o=1)=>`<path transform="translate(64 76) scale(${s})" d="M0 0 C -13 -7 -11 -23 -2 -37 C 0 -28 4.5 -27 5.5 -19 C 6.5 -13 13 -11 12 -2 C 11 6 5 5 0 0 Z" fill="${f}" opacity="${o}"/>`;
    return this.mk(u,{met:'ember',sky:['#FFD48A','#C4380C','#3A0802'],rib:['#4A0F02','#8A2A06','#2A0601'],aura:'#FF9A2E',
    scene:this.scRays('#FFC98A',.24,20)+this.scHaze('#8A2408',104,.45),laurel:'gold',laurelN:9,
    body:`<g style="animation:rcFlicker 2.8s ease-in-out infinite;transform-origin:64px 76px">${this.glo2(fl(1,`url(#V${u})`)+fl(.68,'#FFB53C')+fl(.42,'#FFF3B0'))}</g>`+this.crown(64,30,.68,`url(#M${u})`,M.l),
    label:'365 TAGE',tc:'#FFE7B0',stars:5,starC:'#FFE7B0'});}
  b29(u){const M=this.MET.gold;return this.mk(u,{met:'gold',sky:['#FFE9A8','#A84A0E','#331002'],rib:['#3E1204','#8A3A08','#260A02'],aura:'#FFC93C',
    scene:this.scRays('#FFE7B0',.3,24)+this.scHexField('#FFD48A',.5)+this.scHaze('#7A2E08',102,.4),laurel:'gold',laurelN:9,
    body:this.bev(this.sword(`url(#M${u})`,M.k,34,64,52,25)+this.sword(`url(#M${u})`,M.k,-34,64,52,25))
      +this.bev(this.shield(u,M,'#3E1204',64,52,36,42))+this.st5(64,52,6.4,M.l)+this.crown(64,26,.78,`url(#M${u})`,M.l),
    label:'500 ZONEN',tc:'#FFF3C4',stars:5,starC:'#FFF3C4'});}
  b30(u){const M=this.MET.steel;return this.mk(u,{met:'steel',sky:['#C6DCEE','#3E566E','#0A141E'],rib:['#0C1C2A','#2C4560','#060E16'],aura:'#8FA9C4',
    scene:this.scGrid('#C6DCEE',.22)+this.scHaze('#182A3C',102,.5),laurel:'gold',laurelN:8,
    body:this.bev(this.castle2(u,M,64,54,1.0))+this.crown(64,26,.66,'url(#MG'+u+')',this.MET.gold.l),
    defs:`<linearGradient id="MG${u}" x1="10%" y1="0%" x2="90%" y2="100%"><stop offset="0%" stop-color="#FFF3C4"/><stop offset="45%" stop-color="#FFC93C"/><stop offset="100%" stop-color="#9A6B08"/></linearGradient>`,
    label:'100 TAGE',tc:'#DCEBFF',stars:5});}
  b31(u){const M=this.MET.cyan;return this.mk(u,{met:'cyan',sky:['#B0F6FF','#0A6E96','#02182A'],rib:['#03303F','#0A6E8C','#021620'],aura:'#3FE0FF',
    scene:this.scSpeed('#B0F6FF',.5)+this.scRays('#9FF3FF',.16,16),laurel:'cyan',laurelN:9,
    body:this.bev(this.wing(`url(#V${u})`,1,1.05,66,48)+this.wing(`url(#V${u})`,-1,1.05,66,48))
      +this.glo2(`<path d="M 70 26 L 50 60 L 60 60 L 54 86 L 78 48 L 67 48 Z" fill="url(#V${u})" stroke="#D8FBFF" stroke-width="1" stroke-linejoin="round"/>`),
    label:'3:00 /KM',tc:'#D8FBFF',stars:5});}
  b32(u){const M=this.MET.gold;return this.mk(u,{met:'gold',sky:['#FFF3C4','#B4780A','#332000'],rib:['#33200 0','#8A6208','#221500'],aura:'#FFC93C',
    scene:this.scRays('#FFF3C4',.3,24)+this.scHaze('#8A6208',102,.4),laurel:'gold',laurelN:9,
    body:this.bev(this.sword(`url(#M${u})`,M.k,32,64,52,25)+this.sword(`url(#M${u})`,M.k,-32,64,52,25))
      +this.bev(this.shield(u,M,'#33200A',64,52,38,44))+this.st5(64,52,7,M.l)+this.crown(64,26,.74,`url(#M${u})`,M.l),
    label:'100 SIEGE',tc:'#FFF3C4',stars:5,starC:'#FFF3C4'});}

  /* ============ Saison-Sieg ============ */
  bSeason(u){const M=this.MET.gold;
    const d=this.gDefs(u,M,['#FFF3C4','#C48A0A','#331F00'],['#331F00','#8A6208','#221400'],'#FFC93C');
    let rays='';for(let i=0;i<36;i++){const a=i/36*Math.PI*2,lng=i%3===0;
      rays+=`<line x1="${(64+Math.cos(a)*30).toFixed(1)}" y1="${(60+Math.sin(a)*30).toFixed(1)}" x2="${(64+Math.cos(a)*(lng?52:46)).toFixed(1)}" y2="${(60+Math.sin(a)*(lng?52:46)).toFixed(1)}" stroke="#FFE7B0" stroke-width="${lng?1.8:1}" opacity="${lng?.4:.22}"/>`;}
    let gems='';[[64,104],[20,64],[108,64]].forEach(p=>{gems+=`<g transform="translate(${p[0]} ${p[1]}) rotate(45)"><rect x="-3" y="-3" width="6" height="6" fill="#FFF6DC" stroke="${M.d}" stroke-width=".8"/></g>`;});
    let b=this.frame(u,M)
      +`<g clip-path="url(#C${u})">${rays}${this.scSun(64,52,18,'#FFFDF0','#FFD86A')}${this.scCity('#6E4806',.6)}${this.scWindows('#FFF3C4')}${this.scHaze('#8A6208',104,.35)}${this.scParticles('#FFFDF0',[[30,32,1.3],[100,30,1.2],[36,74,1],[94,72,1.1],[64,24,1],[24,56,.9],[106,58,.9]])}${this.shafts('#FFF6DC',.1)}${this.vignette(u)}</g>`+this.gloss()
      +this.bev(this.laurel(u,M,{r:43,n:10}))
      +this.bev(gems)
      +this.ground(80,26,.35)
      +this.glo(this.bev(this.trophy2(u,M,64,54,1.3)))
      +this.shine(u,5,0)
      +this.ribbon(u,'SAISON-SIEG',M,{y:90,w:64,tc:'#FFF3C4'})
      +this.crest(u,M)
      +this.starRow(5,'#FFF6DC',103)
      +this.spks([[26,28,1.1],[104,26,1],[28,94,.9],[100,92,1]],'#FFF6DC');
    return this.wrap(d,b);}

  /* ============ Kategorie-Stufen ============ */
  TIER=['bronze','silver','lime','cyan','violet','gold'];
  TSKY={
    bronze:['#FFD9A8','#8A4A18','#2E1608'],
    silver:['#EAF4FA','#5E7683','#141D24'],
    lime:['#E4FF7A','#4A7A12','#132A06'],
    cyan:['#9FF3FF','#0A5A78','#02202C'],
    violet:['#C69BFF','#4B238E','#12042C'],
    gold:['#FFE9A8','#B4780A','#33200A'],
  };
  tierScene(key,M,t,mk){
    const c=M.l;
    if(key==='def')return this.scGrid(c,.16+t*.04)+this.scRays(c,.06+t*.03,12);
    if(key==='atk')return this.scRays(c,.08+t*.04,14+t)+this.scHaze(M.k,102,.35);
    if(key==='conq')return this.scGrid(c,.14+t*.04)+this.scHexField(c,.2+t*.06);
    if(key==='km')return this.scHills(M.d,M.k)+this.scRays(c,.06+t*.02,10);
    if(key==='terr')return this.scHexField(c,.2+t*.07)+this.scGrid(c,.1+t*.03);
    return this.scSpeed(c,.2+t*.07)+this.scRays(c,.06+t*.03,12);
  }
  tierMotif(u,key,M,t){
    if(key==='def'){let s='';
      if(t>=4)s+=this.sword(`url(#M${u})`,M.k,34,64,46,20)+this.sword(`url(#M${u})`,M.k,-34,64,46,20);
      s+=this.shield(u,M,M.k,64,46,26+t*1.6,30+t*1.8);
      if(t>=3)s+=`<path d="M 56 44 L 63 51 L 74 38" fill="none" stroke="${M.l}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>`;
      if(t>=6)s+=this.st5(64,58,4,M.l,.95);
      return s;}
    if(key==='atk'){let s='';
      if(t===1)s+=this.sword(`url(#M${u})`,M.k,0,64,46,21);
      else s+=this.sword(`url(#M${u})`,M.k,32,64,46,21)+this.sword(`url(#M${u})`,M.k,-32,64,46,21);
      if(t>=4)s+=this.sword(`url(#M${u})`,M.k,0,64,46,23);
      if(t>=3)s+=this.st5(64,46,4,'#ffffff',.95);
      if(t>=6){let g='';for(let i=0;i<8;i++){const a=i/8*Math.PI*2+Math.PI/8;g+=`<line x1="${(64+Math.cos(a)*12).toFixed(1)}" y1="${(46+Math.sin(a)*12).toFixed(1)}" x2="${(64+Math.cos(a)*17).toFixed(1)}" y2="${(46+Math.sin(a)*17).toFixed(1)}" stroke="${M.l}" stroke-width="1.1" opacity=".7"/>`;}s+=g;}
      return s;}
    if(key==='conq'){let s='';
      if(t>=4)s+=this.castle2(u,M,64,46,.68);
      else s+=this.flag(u,M,58,58,22,15);
      if(t>=5)s+=this.crown(64,26,.52,`url(#M${u})`,M.l);
      return s;}
    if(key==='km'){let s='';
      if(t>=4)s+=this.wing(`url(#V${u})`,1,.62,64,42)+this.wing(`url(#V${u})`,-1,.62,64,42);
      s+=this.shoe(u,M,64,48,.56+t*.03);
      if(t>=6)s+=this.st5(64,24,3.4,M.l,.95);
      return s;}
    if(key==='terr'){const pos=[[64,46],[76,39],[76,53],[64,60],[52,53],[52,39],[64,32]];
      const n=t===6?7:t;let s='';
      for(let i=0;i<n;i++){const p=pos[i],main=i===0;
        s+=`<polygon points="${this.hexP(p[0],p[1],7.6)}" fill="${main?`url(#M${u})`:`url(#V${u})`}" stroke="${M.k}" stroke-width="1" opacity="${main?1:.9}"/>`;}
      return s;}
    let s='';
    if(t>=4)s+=this.wing(`url(#V${u})`,1,.78,64,42)+this.wing(`url(#V${u})`,-1,.78,64,42);
    const bolt='M 72 24 L 54 54 L 63 54 L 57 76 L 78 44 L 68 44 Z';
    if(t===1)s+=`<path d="${bolt}" fill="none" stroke="url(#M${u})" stroke-width="2.6" stroke-linejoin="round"/>`;
    else s+=`<path d="${bolt}" fill="url(#V${u})" stroke="${M.k}" stroke-width="1" stroke-linejoin="round"/>`;
    return s;
  }
  tierIcon(u,key,label,goal,t){
    const mk=this.TIER[t-1],M=this.MET[mk];
    const d=this.gDefs(u,M,this.TSKY[mk],[M.k,M.d,M.k],M.m);
    const big=goal.split(' ')[0].replace('×','');
    let b=this.frame(u,M)
      +`<g clip-path="url(#C${u})">${this.tierScene(key,M,t,mk)}${this.shafts('#ffffff',.07)}${this.vignette(u)}</g>`+this.gloss();
    if(t>=3)b+=this.bev(this.laurel(u,M,{r:41,n:t>=5?9:8}));
    if(t>=6){let rays='';for(let i=0;i<16;i++){const a=i/16*Math.PI*2;rays+=`<line x1="${(64+Math.cos(a)*45).toFixed(1)}" y1="${(64+Math.sin(a)*45).toFixed(1)}" x2="${(64+Math.cos(a)*47.6).toFixed(1)}" y2="${(64+Math.sin(a)*47.6).toFixed(1)}" stroke="${M.l}" stroke-width="1.4" opacity=".55"/>`;}b+=rays;}
    b+=this.ground(70,20,.32)+this.bev(this.tierMotif(u,key,M,t))+this.shine(u,6.2,t*.25);
    b+=this.txt(big,64,76,big.length>5?17:big.length>3?20:23,`url(#V${u})`,{ls:1.2,stroke:M.k,sw:.15});
    b+=this.ribbon(u,label,M,{y:92,w:52,h:13,tc:M.l});
    if(t>=5)b+=this.bev(`<g transform="translate(20 64) rotate(45)"><rect x="-3" y="-3" width="6" height="6" fill="url(#M${u})" stroke="${M.k}" stroke-width=".7"/></g><g transform="translate(108 64) rotate(45)"><rect x="-3" y="-3" width="6" height="6" fill="url(#M${u})" stroke="${M.k}" stroke-width=".7"/></g>`);
    b+=this.crest(u,M);
    b+=this.starRow(Math.min(t,5),M.l,104);
    return this.wrap(d,b);
  }


  /* ================= Öffentliche API ================= */

  /** Einmal pro Seite ins DOM hängen: gemeinsame SVG-Filter (Bevel, Schatten, Glow). */
  defsHost(){
    return '<div id="rc-icon-defs" aria-hidden="true" style="position:absolute;width:0;height:0;overflow:hidden">'+this.defs()+'</div>';
  }
  /** Filter idempotent injizieren (Browser). */
  installDefs(doc){
    doc=doc||global.document;
    if(!doc||doc.getElementById('rc-icon-defs'))return;
    const d=doc.createElement('div');
    d.id='rc-icon-defs';d.setAttribute('aria-hidden','true');
    d.style.cssText='position:absolute;width:0;height:0;overflow:hidden';
    d.innerHTML=this.defs();
    doc.body.appendChild(d);
  }

  /** Katalog aller Einzel- und Meisterklasse-Erfolge. */
  list(){return CATALOG.map(x=>({id:x.id,name:x.name,desc:x.desc,tint:x.tint,group:x.group}));}
  /** Katalog der Stufen-Kategorien inkl. Schwellenwerte. */
  categories(){return TIERS.map(c=>({id:c.id,name:c.name,desc:c.desc,unit:c.unit,goals:c.goals.slice(),thresholds:c.thresholds.slice()}));}

  /**
   * SVG-String eines Erfolgs.
   * @param {string} id   Katalog-Id, z.B. 'erster-schritt'
   * @param {object} [o]  {uid} eigener Gradient-Namespace (nötig, wenn dasselbe Icon mehrfach im DOM steht)
   */
  render(id,o){
    const e=CATALOG.find(x=>x.id===id);
    if(!e)throw new Error('Unbekannter Erfolg: '+id);
    return this[e.fn]((o&&o.uid)||e.fn+(uid++));
  }

  /**
   * SVG-String einer Kategorie-Stufe.
   * @param {string} category 'def'|'atk'|'conq'|'km'|'terr'|'pace'
   * @param {number} tier     1..6
   */
  tier(category,tier,o){
    const c=TIERS.find(x=>x.id===category);
    if(!c)throw new Error('Unbekannte Kategorie: '+category);
    const t=Math.min(6,Math.max(1,tier|0));
    return this.tierIcon((o&&o.uid)||category+t+'_'+(uid++),category,c.short,c.goals[t-1],t);
  }

  /** Saison-Sieg-Medaillon (Einzelstück). */
  season(o){return this.bSeason((o&&o.uid)||'season'+(uid++));}

  /**
   * Aus einem echten Spielwert Stufe, Fortschritt und Icon berechnen.
   * Pace wird in Sekunden/km erwartet (kleiner = besser).
   * @returns {{tier:number,locked:boolean,reached:string|null,next:string|null,progress:number,svg:string}}
   */
  tierForValue(category,value,o){
    const c=TIERS.find(x=>x.id===category);
    if(!c)throw new Error('Unbekannte Kategorie: '+category);
    const better=(v,th)=>c.lowerIsBetter?v<=th:v>=th;
    let t=0;
    for(let i=0;i<c.thresholds.length;i++){if(better(value,c.thresholds[i]))t=i+1;}
    const shown=Math.max(1,t);
    const from=t===0?c.start:c.thresholds[t-1];
    const to=c.thresholds[Math.min(t,5)];
    let p=t>=6?1:(value-from)/((to-from)||1);
    if(c.lowerIsBetter)p=t>=6?1:(from-value)/((from-to)||1);
    return{
      tier:t,
      locked:t===0,
      reached:t?c.goals[t-1]:null,
      next:t<6?c.goals[t]:null,
      progress:Math.max(0,Math.min(1,p)),
      svg:this.tier(category,shown,o)
    };
  }

  /** Icon direkt in ein Element rendern. */
  mount(el,id,o){
    this.installDefs(el.ownerDocument);
    el.innerHTML=id==='saison'?this.season(o):this.render(id,o);
    return el;
  }
  /** Für <img src> / CSS url(): Data-URI. Filter sind dann eingebettet. */
  dataUri(svg){
    const withDefs=svg.replace('>',' >').replace(/^(<svg[^>]*>)/,'$1'+this.defs().replace(/^<svg[^>]*>|<\/svg>$/g,''));
    return 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(withDefs);
  }
}

let uid=0;

/* ================= Katalog ================= */
const CATALOG=[
  {id:'erster-schritt',fn:'b1',name:'Erster Schritt',desc:'Dein erster Lauf',tint:'#FFC93C',group:'erfolg'},
  {id:'entdecker',fn:'b2',name:'Entdecker',desc:'10 Gebiete besucht',tint:'#7FE3FF',group:'erfolg'},
  {id:'eroberer',fn:'b3',name:'Eroberer',desc:'Dein erstes Gebiet erobert',tint:'#F5CE9C',group:'erfolg'},
  {id:'grenzpionier',fn:'b4',name:'Grenzpionier',desc:'5 Gebiete erobert',tint:'#9FE8FF',group:'erfolg'},
  {id:'territoriumsheld',fn:'b5',name:'Territoriumsheld',desc:'20 Gebiete erobert',tint:'#C69BFF',group:'erfolg'},
  {id:'koenig-der-laeufer',fn:'b6',name:'König der Läufer',desc:'50 Gebiete erobert',tint:'#FFC93C',group:'erfolg'},
  {id:'tempojaeger',fn:'b7',name:'Tempojäger',desc:'Lauf mit 16+ km/h',tint:'#D8F63C',group:'erfolg'},
  {id:'dauerbrenner',fn:'b8',name:'Dauerbrenner',desc:'60 Minuten am Stück gelaufen',tint:'#FFC93C',group:'erfolg'},
  {id:'hoehenstuermer',fn:'b9',name:'Höhenstürmer',desc:'1.000 Höhenmeter gesammelt',tint:'#B8CFE4',group:'erfolg'},
  {id:'unaufhaltsam',fn:'b10',name:'Unaufhaltsam',desc:'7 Tage in Folge gelaufen',tint:'#FF9A2E',group:'erfolg'},
  {id:'verteidiger',fn:'b11',name:'Verteidiger',desc:'Gebiet verteidigt',tint:'#3FE0FF',group:'erfolg'},
  {id:'belagerer',fn:'b12',name:'Belagerer',desc:'Gebiet stark angegriffen',tint:'#A66BFF',group:'erfolg'},
  {id:'teamplayer',fn:'b13',name:'Teamplayer',desc:'Mit 5 Spielern gelaufen',tint:'#F5CE9C',group:'erfolg'},
  {id:'allrounder',fn:'b14',name:'Allrounder',desc:'5 verschiedene Erfolge',tint:'#FFC93C',group:'erfolg'},
  {id:'weltenbummler',fn:'b15',name:'Weltenbummler',desc:'100 km Gesamtstrecke',tint:'#3FE0FF',group:'erfolg'},
  {id:'festungsbauer',fn:'b16',name:'Festungsbauer',desc:'Verteidigung auf 300 erhöht',tint:'#B8CFE4',group:'erfolg'},
  {id:'grenzierer',fn:'b17',name:'Grenzierer',desc:'Gebiet erfolgreich geteilt',tint:'#2FD489',group:'erfolg'},
  {id:'champion',fn:'b18',name:'Champion',desc:'Top 1 der Rangliste',tint:'#FFC93C',group:'erfolg'},
  {id:'geist-des-laufens',fn:'b19',name:'Geist des Laufens',desc:'100 Tage aktiv',tint:'#3FE0FF',group:'erfolg'},
  {id:'nachtlaeufer',fn:'b20',name:'Nachtläufer',desc:'10 Läufe zwischen 22–5 Uhr',tint:'#A66BFF',group:'erfolg'},
  {id:'naturliebhaber',fn:'b21',name:'Naturliebhaber',desc:'Lauf in 10 Naturschutzgebieten',tint:'#2FD489',group:'erfolg'},
  {id:'legendaer',fn:'b22',name:'Legendär',desc:'Alle Erfolge abgeschlossen',tint:'#FFC93C',group:'erfolg'},
  {id:'conqueror',fn:'b23',name:'Conqueror',desc:'Besitze ein Gebiet für 30 Tage',tint:'#FF5C7A',group:'erfolg'},
  {id:'unsterblich',fn:'b24',name:'Unsterblich',desc:'Maximale Stufe erreicht',tint:'#C69BFF',group:'erfolg'},
  {id:'marathon-finisher',fn:'b25',name:'Marathon-Finisher',desc:'42,2 km in einem Lauf',tint:'#FFC93C',group:'meisterklasse'},
  {id:'ultra-laeufer',fn:'b26',name:'Ultra-Läufer',desc:'100 km in einem Lauf',tint:'#C69BFF',group:'meisterklasse'},
  {id:'weltumrunder',fn:'b27',name:'Weltumrunder',desc:'5.000 km Gesamtstrecke',tint:'#3FE0FF',group:'meisterklasse'},
  {id:'ewige-flamme',fn:'b28',name:'Ewige Flamme',desc:'365 Tage in Folge gelaufen',tint:'#FF9A2E',group:'meisterklasse'},
  {id:'gross-imperator',fn:'b29',name:'Groß-Imperator',desc:'500 Gebiete erobert',tint:'#FFC93C',group:'meisterklasse'},
  {id:'eiserne-festung',fn:'b30',name:'Eiserne Festung',desc:'Gebiet 100 Tage ohne Niederlage gehalten',tint:'#B8CFE4',group:'meisterklasse'},
  {id:'schallmauer',fn:'b31',name:'Schallmauer',desc:'Pace unter 3:00 /km',tint:'#3FE0FF',group:'meisterklasse'},
  {id:'unbesiegbar',fn:'b32',name:'Unbesiegbar',desc:'100 Verteidigungen in Folge gewonnen',tint:'#FFC93C',group:'meisterklasse'},
];

/* ================= Stufen-Kategorien =================
 * thresholds = Wert, ab dem die jeweilige Stufe erreicht ist (Index 0 = Stufe 1).
 * Werte sind Design-Vorschläge — nach echtem Balancing hier anpassen.
 */
const TIERS=[
  {id:'def', short:'VERTEIDIGT', name:'Verteidigung', desc:'Erfolgreich abgewehrte Angriffe', unit:'Abwehr',
   goals:['5×','25×','75×','200×','500×','1.500×'], thresholds:[5,25,75,200,500,1500], start:0},
  {id:'atk', short:'ANGRIFFE', name:'Angriffe', desc:'Erfolgreiche Angriffe auf fremde Gebiete', unit:'Angriff',
   goals:['10×','50×','150×','400×','1.000×','2.500×'], thresholds:[10,50,150,400,1000,2500], start:0},
  {id:'conq', short:'EROBERT', name:'Erobert', desc:'Insgesamt eroberte Gebiete', unit:'Gebiete',
   goals:['3','10','30','75','150','300'], thresholds:[3,10,30,75,150,300], start:0},
  {id:'km', short:'KILOMETER', name:'Kilometer', desc:'Gesamtdistanz gelaufen', unit:'km',
   goals:['50 km','250 km','750 km','2.000 km','5.000 km','10.000 km'], thresholds:[50,250,750,2000,5000,10000], start:0},
  {id:'terr', short:'GEBIETE', name:'Gebiete', desc:'Gleichzeitig gehaltene Gebiete', unit:'Gebiete',
   goals:['1','5','15','40','100','250'], thresholds:[1,5,15,40,100,250], start:0},
  {id:'pace', short:'PACE /KM', name:'Pace', desc:'Beste Pace über 1 km (Sekunden/km, kleiner ist besser)', unit:'s/km',
   goals:['6:00 /km','5:30 /km','5:00 /km','4:30 /km','4:00 /km','3:30 /km'], thresholds:[360,330,300,270,240,210], start:420, lowerIsBetter:true},
];

const RCIcons=new RCErfolgIcons();
RCIcons.CATALOG=CATALOG;
RCIcons.TIERS=TIERS;

if(typeof module!=='undefined'&&module.exports)module.exports=RCIcons;
global.RCIcons=RCIcons;
})(typeof window!=='undefined'?window:globalThis);
