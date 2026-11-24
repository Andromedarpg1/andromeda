/* Andromeda — código compartilhado (ficha do jogador + painel do mestre) */
const MAX_NIVEL = 15;      // troque aqui se quiser mais níveis
const HIST_MAX = 60;       // quantos pontos de rollback ficam guardados
const ATTRS = ['forca','espirito','inteligencia','agilidade','carisma','constituicao'];
const ATTR_LABELS = {forca:'Força',espirito:'Espírito',inteligencia:'Inteligência',agilidade:'Agilidade',carisma:'Carisma',constituicao:'Constituição'};
const ABBR = {forca:'FOR',espirito:'ESP',inteligencia:'INT',agilidade:'AGI',carisma:'CAR',constituicao:'CON'};
const MANA_TYPES = ['negra','rubra','branca','azul'];
const MANA_LABELS = {negra:'Mana Negra',rubra:'Mana Rubra',branca:'Mana Branca',azul:'Mana Azul'};
const CATS = [['armas','Armas'],['armaduras','Armaduras'],['consumiveis','Consumíveis'],['tesouros','Tesouros'],['diversos','Diversos']];
const RELIGIONS = {
  haukenismo:{label:'Haukenismo', mult:{azul:1.5,branca:1,negra:.7,rubra:1}, note:'Venera o céu noturno. Seus fiéis são muito favorecidos em Mana Azul.'},
  danitunismo:{label:'Danitunismo', mult:{branca:1.5,negra:.5,azul:1,rubra:1}, note:'Prega a pureza: mais Mana Branca e pouca Mana Negra.'},
  althimos:{label:'Althimos', mult:{negra:1.4,azul:1.1,branca:.4,rubra:1}, note:'Culto ambíguo: muita Mana Negra, Mana Azul instável e quase nada de Mana Branca.'},
  belisianismo:{label:'Belisianismo', mult:{negra:1.8,branca:.15,azul:.6,rubra:1}, note:'Culto sombrio: enorme Mana Negra e quase nenhuma Mana Branca.'},
  nenhuma:{label:'Sem fé', mult:{negra:1,branca:1,azul:1,rubra:1}, note:'Sem fé declarada, sem favorecimentos.'}
};

/* ---------- utilidades ---------- */
const esc = s => String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
const d20 = () => Math.floor(Math.random()*20)+1;
const mod = v => Math.floor(v/2);
const num = (v,f=0) => (v===''||v==null||!Number.isFinite(+v)) ? f : +v;
const clone = o => JSON.parse(JSON.stringify(o));
const uid = () => Math.random().toString(36).slice(2,9);
const arr = x => Array.isArray(x) ? x : (x && typeof x==='object' ? Object.values(x) : []);
const sleep = ms => new Promise(r=>setTimeout(r,ms));
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
function slugify(s){ return (s||'').toString().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,''); }
function ago(ts){ const s=Math.round((Date.now()-ts)/1000); if(s<45) return 'agora'; if(s<3600) return `há ${Math.round(s/60)} min`; if(s<86400) return `há ${Math.round(s/3600)} h`; return new Date(ts).toLocaleDateString('pt-BR',{day:'2-digit',month:'short'}); }
function tier(v){ return v<10?'#b5524f':v<15?'#c98a3a':v<20?'#e3c66b':'#8fc7a0'; }

const ICONS = {
  ficha:'<path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.5 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z"/>',
  magia:'<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M18 6l-2.5 2.5M8.5 15.5L6 18"/>',
  inventario:'<path d="M6 8h12l1 12H5L6 8zM9 8V6a3 3 0 016 0v2"/>',
  estados:'<path d="M13 2L5 14h6l-1 8 8-12h-6z"/>',
  historico:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  lock:'<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/>',
  unlock:'<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 017.5-2"/>',
  heart:'<path d="M12 21s-7.5-4.6-9.5-9.2C1 8 3.4 4.5 7 4.5c2 0 3.7 1.1 5 3 1.3-1.9 3-3 5-3 3.6 0 6 3.5 4.5 7.3C19.5 16.4 12 21 12 21z"/>',
  shield:'<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>',
  undo:'<path d="M9 14L4 9l5-5M4 9h10a6 6 0 010 12h-3"/>',
  plus:'<path d="M12 5v14M5 12h14"/>', minus:'<path d="M5 12h14"/>',
  edit:'<path d="M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4"/>',
  trash:'<path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13"/>',
  dice:'<path d="M12 2l9 5v10l-9 5-9-5V7z"/><path d="M12 22V12M3 7l9 5 9-5"/>',
  close:'<path d="M6 6l12 12M18 6L6 18"/>', back:'<path d="M15 5l-7 7 7 7"/>'
};
const ic = (n,c='') => `<svg class="ic ${c}" viewBox="0 0 24 24" fill="${n==='heart'?'currentColor':'none'}" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n]||''}</svg>`;

/* ---------- regras ---------- */
function manaBase(s){ return 50 + num(s.attrs.espirito)*5; }
function manaMax(s,t){
  if(t==='rubra') return null;
  let base;
  if(t==='branca' && s.religiao==='haukenismo') base = Math.round(manaMax(s,'azul')/2)+20;
  else {
    const rel = RELIGIONS[s.religiao]||RELIGIONS.nenhuma;
    let m = rel.mult[t] ?? 1;
    if(s.religiao==='althimos' && t==='azul') m += num(s.althimosVariance);
    base = Math.round(manaBase(s)*m);
  }
  return base + num(s.manaBonus && s.manaBonus[t]);
}
const vidaMaxOf = s => Math.floor((num(s.attrs.constituicao)+num(s.attrs.espirito))/2)+10 + 9*(clamp(parseInt(s.nivel)||1,1,MAX_NIVEL)-1);
const defesaTotal = s => Math.floor(num(s.attrs.constituicao)/2) + num(s.defesaBonus);
const turnMax = s => 4 + Math.max(0,Math.floor((s.nivel-1)/2));
const hpPct = s => s.vidaMax>0 ? s.vidaAtual/s.vidaMax*100 : 0;
const hpState = s => { const p=hpPct(s); return s.vidaAtual<=0?'zero':p<25?'crit':p<=50?'low':''; };
const lockedAttr = (s,k) => !!(s.travas && (s.travas.todos || (s.travas.attrs && s.travas.attrs[k])));

function defaultState(){
  return {
    nome:'Andromeda', raca:'', classe:'', povo:'', nivel:1, religiao:'haukenismo',
    althimosVariance: Math.random()<.5?-.1:.1,
    attrs:Object.fromEntries(ATTRS.map(a=>[a,d20()+4])),
    mana:{negra:{cur:null},rubra:{cur:0},branca:{cur:null},azul:{cur:null}},
    manaBonus:{negra:0,branca:0,azul:0},
    vidaAtual:null, vidaMax:10, defesaBonus:0,
    spells:[], turnUsed:0, buffs:[], debuffs:[], inventory:[],
    travas:{todos:false, attrs:Object.fromEntries(ATTRS.map(a=>[a,false]))},
    edicao:{por:'',ts:0,resumo:''}
  };
}
// O Firebase apaga null/[]/{} ao salvar. sanitize() devolve tudo ao lugar e recalcula o que é derivado.
function sanitize(raw){
  raw = raw||{};
  const b = defaultState(), s = Object.assign({}, b, raw);
  s.attrs = Object.assign({}, b.attrs, raw.attrs);
  ATTRS.forEach(a=>s.attrs[a]=num(s.attrs[a]));
  s.manaBonus = Object.assign({}, b.manaBonus, raw.manaBonus);
  s.mana = {}; MANA_TYPES.forEach(t=>s.mana[t]=Object.assign({}, b.mana[t], raw.mana&&raw.mana[t]));
  s.travas = {todos:!!(raw.travas&&raw.travas.todos), attrs:Object.assign({}, b.travas.attrs, raw.travas&&raw.travas.attrs)};
  s.edicao = Object.assign({}, b.edicao, raw.edicao);
  s.spells = arr(raw.spells).map(x=>({nome:x.nome||'',tipo:x.tipo||'azul',custo:num(x.custo,1),efeito:x.efeito||''}));
  s.buffs = arr(raw.buffs).map(x=>({nome:x.nome||'',dur:x.dur||'',desc:x.desc||''}));
  s.debuffs = arr(raw.debuffs).map(x=>({nome:x.nome||'',dur:x.dur||'',desc:x.desc||''}));
  s.inventory = arr(raw.inventory).map((x,i)=>({id:x.id||('i'+i+'_'+slugify(x.nome)),nome:x.nome||'',qtd:Math.max(0,num(x.qtd,1)),desc:x.desc||'',cat:CATS.some(c=>c[0]===x.cat)?x.cat:'diversos'}));
  s.nivel = clamp(parseInt(s.nivel)||1,1,MAX_NIVEL);
  s.turnUsed = Math.max(0,num(s.turnUsed)); s.defesaBonus = num(s.defesaBonus);
  s.vidaMax = vidaMaxOf(s);
  s.vidaAtual = (s.vidaAtual==null||!Number.isFinite(+s.vidaAtual)) ? s.vidaMax : clamp(+s.vidaAtual,0,s.vidaMax);
  MANA_TYPES.forEach(t=>{
    const m = manaMax(s,t); let c = s.mana[t].cur;
    c = (c==null||!Number.isFinite(+c)) ? (t==='rubra'?0:m) : +c;
    s.mana[t].cur = t==='rubra' ? Math.max(0,c) : clamp(c,0,m);
  });
  return s;
}
// rollback nunca burla a trava: travas ficam como estão e atributos travados não voltam atrás
function restored(cur,estado,force){
  const r = sanitize(JSON.parse(estado));
  r.travas = clone(cur.travas);
  if(!force) ATTRS.forEach(a=>{ if(lockedAttr(cur,a)) r.attrs[a]=cur.attrs[a]; });
  return sanitize(r);
}

/* ---------- diff por caminho (sincronização sem sobrescrever o outro lado) ---------- */
function flatten(o,p='',out={}){
  for(const k in o){ const v=o[k], q=p?p+'/'+k:k;
    if(v && typeof v==='object' && !Array.isArray(v)) flatten(v,q,out);
    else if(v!==undefined && v!==null) out[q]=v; }
  return out;
}
const same = (a,b) => JSON.stringify(a)===JSON.stringify(b);
function diffFlat(a,b){ const ch={}; for(const k in b) if(!same(a[k],b[k])) ch[k]=b[k]; for(const k in a) if(!(k in b)) ch[k]=null; return ch; }
function setPath(o,path,v){
  const ks=path.split('/'); let c=o;
  ks.slice(0,-1).forEach(k=>{ if(typeof c[k]!=='object'||c[k]===null) c[k]={}; c=c[k]; });
  const last=ks[ks.length-1]; if(v===null) delete c[last]; else c[last]=v;
}
function listDiff(label,o,n){
  const out=[]; const key=x=>x.id||x.nome;
  const om=new Map(o.map(x=>[key(x),x])), nm=new Map(n.map(x=>[key(x),x]));
  n.forEach(x=>{ const y=om.get(key(x));
    if(!y) out.push(`+ ${x.nome}`);
    else if(x.qtd!==y.qtd) out.push(`${x.nome}: ${y.qtd} → ${x.qtd}`);
    else if(!same(x,y)) out.push(`${x.nome} editado`); });
  o.forEach(y=>{ if(!nm.has(key(y))) out.push(`− ${y.nome}`); });
  return out.join(', ') || label;
}
function summarize(a,b){
  const out=[], ch=diffFlat(a,b);
  for(const p in ch){ const o=a[p], n=b[p]; let m;
    if(p==='vidaAtual') out.push(`Vida ${o} → ${n}`);
    else if(p==='nivel') out.push(`Nível ${o} → ${n}`);
    else if(p==='defesaBonus') out.push(`Defesa bônus ${o} → ${n}`);
    else if(p.startsWith('attrs/')) out.push(`${ATTR_LABELS[p.slice(6)]} ${o} → ${n}`);
    else if((m=p.match(/^mana\/(\w+)\/cur$/))) out.push(`${MANA_LABELS[m[1]]} ${o} → ${n}`);
    else if(p.startsWith('manaBonus/')) out.push(`Bônus ${MANA_LABELS[p.slice(10)]} → ${n}`);
    else if(p==='inventory') out.push(listDiff('Inventário',o||[],n||[]));
    else if(p==='spells') out.push('Magias: '+listDiff('alteradas',o||[],n||[]));
    else if(p==='buffs'||p==='debuffs') out.push((p==='buffs'?'Buffs: ':'Debuffs: ')+listDiff('alterados',o||[],n||[]));
    else if(p.startsWith('travas/')) out.push(n?'Rolagem travada':'Rolagem liberada');
    else if(p==='religiao') out.push(`Religião → ${RELIGIONS[n]?RELIGIONS[n].label:n}`);
    else if(['nome','raca','classe','povo'].includes(p)) out.push(`${p[0].toUpperCase()+p.slice(1)} → ${n||'vazio'}`);
    else if(p==='turnUsed') out.push(n?`Rodada: ${n} magia(s)`:'Nova rodada');
  }
  const u=[...new Set(out)];
  return u.slice(0,3).join(' · ') + (u.length>3?` · +${u.length-3}`:'');
}

/* ---------- gravação + histórico (rollback) ---------- */
function prepare(before,s,por,label){
  const a0=flatten(s), ch0=diffFlat(before,a0);
  const paths=Object.keys(ch0).filter(k=>!k.startsWith('edicao/'));
  if(!paths.length) return null;
  const resumo = label || summarize(before,a0) || 'Ficha atualizada';
  s.edicao={por,ts:Date.now(),resumo};
  const flat=flatten(s), ch=diffFlat(before,flat);
  for(const k in ch) if(ch[k]!==null) ch[k]=clone(ch[k]);
  const inv={}; paths.forEach(k=>inv[k]=before[k]===undefined?null:before[k]);
  return {ch,resumo,paths,flat,inv,s,before,por};
}
async function send(db,key,p){
  await db.ref('fichas/'+key).update(p.ch);
  histPush(db,key,p.s,p.resumo,p.por,p.paths,p.before).catch(e=>console.error('histórico',e));
}
const _hl={};
async function histPush(db,key,s,resumo,por,paths,before){
  const L=_hl[key], now=Date.now(), pk=paths.join('|'); let n, base=before, txt=resumo;
  if(L && L.por===por && L.pk===pk && now-L.ts<8000){ n=L.n; base=L.base; txt=summarize(base,flatten(s))||resumo; }  // cliques seguidos viram 1 ponto
  else n=(await db.ref(`historico/${key}/n`).transaction(c=>(c||0)+1)).snapshot.val();
  _hl[key]={n,ts:now,por,pk,base};
  await db.ref(`historico/${key}/slots/${n%HIST_MAX}`).set({n,ts:now,por,resumo:txt,estado:JSON.stringify(s)});
}
function histListen(db,key,cb){
  const ref=db.ref(`historico/${key}/slots`);
  const fn=snap=>cb(arr(snap.val()).sort((a,b)=>b.n-a.n));
  ref.on('value',fn); return ()=>ref.off('value',fn);
}

/* ---------- Firebase ---------- */
let _banner=null;
function banner(msg){
  clearBanner(); const el=document.createElement('div'); el.className='banner';
  el.textContent='⚠ '+msg; document.body.prepend(el); _banner=el;
}
function clearBanner(){ if(_banner){_banner.remove();_banner=null;} }
function initFB(){
  try{
    if(typeof firebase==='undefined'||typeof firebaseConfig==='undefined'){ banner('Firebase não encontrado — confira se o firebase-config.js foi enviado.'); return null; }
    if(!firebase.apps.length) firebase.initializeApp(firebaseConfig);
    return firebase.database();
  }catch(e){ banner('Não foi possível conectar ao banco de dados ('+(e.message||e)+')'); return null; }
}
function fbError(e,what){
  let m=e.message||String(e);
  if(m.toLowerCase().includes('permission')) m='permissão negada — publique as regras { ".read": true, ".write": true } no Realtime Database';
  banner(`${what}: ${m}`);
}

/* ---------- UI: radar estilo FIFA ---------- */
function radarSVG(v,o={}){
  const W=360,H=330,cx=180,cy=170,R=o.mini?104:100, lv=o.labelVals||v;
  const sc=Math.max(30,Math.ceil(Math.max(...lv)/5)*5), id='rg'+(o.id||'x');
  const P=(i,f)=>{const a=-Math.PI/2+i*Math.PI/3;return [cx+R*f*Math.cos(a),cy+R*f*Math.sin(a)];};
  const pts=f=>v.map((_,i)=>P(i,f).map(n=>n.toFixed(1)).join(',')).join(' ');
  let s=`<svg viewBox="${o.mini?'62 62 236 216':`0 0 ${W} ${H}`}" class="radar" role="img" aria-label="Gráfico de atributos"><defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e3c66b" stop-opacity=".55"/><stop offset="1" stop-color="#7b4fb5" stop-opacity=".45"/></linearGradient></defs>`;
  [.25,.5,.75,1].forEach((f,i)=>s+=`<polygon points="${pts(f)}" fill="${i%2?'rgba(201,162,39,.05)':'none'}" stroke="rgba(201,162,39,${f===1?.5:.2})"/>`);
  v.forEach((_,i)=>{const [x,y]=P(i,1);s+=`<line x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="rgba(201,162,39,.2)"/>`;});
  s+=`<polygon points="${v.map((x,i)=>P(i,Math.min(1,x/sc)).map(n=>n.toFixed(1)).join(',')).join(' ')}" fill="url(#${id})" stroke="#e3c66b" stroke-width="2" stroke-linejoin="round"/>`;
  v.forEach((x,i)=>{const [px,py]=P(i,Math.min(1,x/sc));s+=`<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="3.6" fill="#e9e2cf" stroke="#c9a227" stroke-width="1.5"/>`;});
  if(!o.mini) ATTRS.forEach((a,i)=>{const [x,y]=P(i,1.31),val=Math.round(lv[i]);s+=`<text x="${x.toFixed(1)}" y="${(y+5).toFixed(1)}" class="rv" fill="${tier(val)}" text-anchor="middle">${val}</text><text x="${x.toFixed(1)}" y="${(y+20).toFixed(1)}" class="rl" text-anchor="middle">${ABBR[a]}</text>`;});
  return s+'</svg>';
}

/* ---------- UI: modal e aviso ---------- */
function openModal({title,fields,values={},okText='Salvar',onSave,onDelete}){
  const m=document.createElement('div'); m.className='modal';
  const f=fields.map(x=>`<label class="fld"><span>${x.label}</span>${
    x.type==='select' ? `<select name="${x.k}">${x.opts.map(o=>`<option value="${o[0]}">${o[1]}</option>`).join('')}</select>`
    : x.type==='area' ? `<textarea name="${x.k}" rows="3"></textarea>`
    : x.type==='qty' ? `<div class="stp"><button type="button" data-d="-1" aria-label="menos">${ic('minus')}</button><input name="${x.k}" type="number" min="0"><button type="button" data-d="1" aria-label="mais">${ic('plus')}</button></div>`
    : `<input name="${x.k}" type="text" autocomplete="off">`}</label>`).join('');
  m.innerHTML=`<form class="mbox"><h3>${title}</h3>${f}<div class="mact">${onDelete?`<button type="button" class="btn danger" data-del>${ic('trash')}Remover</button>`:''}<span></span><button type="button" class="btn ghost" data-x>Cancelar</button><button class="btn gold">${okText}</button></div></form>`;
  document.body.appendChild(m);
  const form=m.firstChild; fields.forEach(x=>{ form.elements[x.k].value = values[x.k] ?? x.def ?? (x.type==='qty'?1:''); });
  const close=()=>m.remove();
  m.addEventListener('mousedown',e=>{ if(e.target===m) close(); });
  m.addEventListener('keydown',e=>{ if(e.key==='Escape') close(); });
  m.querySelector('[data-x]').onclick=close;
  m.querySelectorAll('.stp button').forEach(b=>b.onclick=()=>{ const i=b.parentNode.querySelector('input'); i.value=Math.max(0,num(i.value)+num(b.dataset.d)); });
  if(onDelete) m.querySelector('[data-del]').onclick=()=>{ close(); onDelete(); };
  form.onsubmit=e=>{ e.preventDefault(); const v={}; fields.forEach(x=>{ v[x.k]=x.type==='qty'?num(form.elements[x.k].value):form.elements[x.k].value.trim(); }); if(fields[0].req!==false && !v[fields[0].k]) { form.elements[fields[0].k].focus(); return; } close(); onSave(v); };
  form.elements[fields[0].k].focus();
}
function toast(msg,kind=''){
  let box=document.getElementById('toasts'); if(!box){ box=document.createElement('div'); box.id='toasts'; document.body.appendChild(box); }
  const t=document.createElement('div'); t.className='toast '+kind; t.textContent=msg; box.appendChild(t);
  setTimeout(()=>{ t.classList.add('out'); setTimeout(()=>t.remove(),300); }, kind==='mestre'?5000:2600);
}
