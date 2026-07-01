const MANA_TYPES = ['negra','rubra','branca','azul'];
const MANA_LABELS = {negra:'Negra',rubra:'Rubra',branca:'Branca',azul:'Azul'};
const MANA_COLOR = {negra:'#7b4fb5',rubra:'#a13340',branca:'#e8e2d0',azul:'#4f8fc0'};
const RELIGIONS = {
  haukenismo:{label:'Haukenismo', mult:{azul:1.5, branca:1.0, negra:0.7, rubra:1.0}},
  danitunismo:{label:'Danitunismo', mult:{branca:1.5, negra:0.5, azul:1.0, rubra:1.0}},
  althimos:{label:'Althimos', mult:{negra:1.4, azul:1.1, branca:0.4, rubra:1.0}},
  belisianismo:{label:'Belisianismo', mult:{negra:1.8, branca:0.15, azul:0.6, rubra:1.0}},
  nenhuma:{label:'Nenhuma', mult:{negra:1,branca:1,azul:1,rubra:1}}
};
function manaBase(ficha){
  const espirito = (ficha.attrs && ficha.attrs.espirito) || 0;
  return 50 + espirito*5;
}
function manaMax(ficha, tipo){
  if(tipo==='rubra') return null;
  if(tipo==='branca' && ficha.religiao==='haukenismo'){
    return Math.round(manaMax(ficha,'azul')/2) + 20;
  }
  const rel = RELIGIONS[ficha.religiao] || RELIGIONS.nenhuma;
  let mult = rel.mult[tipo] ?? 1;
  if(ficha.religiao==='althimos' && tipo==='azul'){ mult = mult + (ficha.althimosVariance||0); }
  return Math.round(manaBase(ficha) * mult);
}
function vidaMax(ficha){
  const c = (ficha.attrs && ficha.attrs.constituicao) || 0;
  const e = (ficha.attrs && ficha.attrs.espirito) || 0;
  const nivel = ficha.nivel || 1;
  return Math.floor((c+e)/2) + 10 + 9*(nivel-1);
}

function cardHTML(key, f){
  const religiaoLabel = (RELIGIONS[f.religiao]||{label:f.religiao||'—'}).label;
  const manaRows = MANA_TYPES.map(t=>{
    const max = manaMax(f, t);
    const cur = (f.mana && f.mana[t] && f.mana[t].cur!=null) ? f.mana[t].cur : (t==='rubra'?0:max);
    const pct = (t==='rubra') ? 100 : Math.max(0, Math.min(100, max? (cur/max)*100 : 0));
    return `<div class="mana-mini-row">
      <span class="dot" style="background:${MANA_COLOR[t]}"></span>
      <span style="min-width:42px;">${MANA_LABELS[t]}</span>
      <span class="mana-mini-track"><span class="mana-mini-fill" style="width:${pct}%;background:${MANA_COLOR[t]}"></span></span>
      <span>${cur}${max!=null?'/'+max:''}</span>
    </div>`;
  }).join('');
  const buffs = (f.buffs||[]).map(b=>`<span class="bd-tag buff">${b.nome}</span>`).join('');
  const debuffs = (f.debuffs||[]).map(b=>`<span class="bd-tag debuff">${b.nome}</span>`).join('');
  const vMax = vidaMax(f);
  const vCur = (f.vidaAtual!=null) ? f.vidaAtual : vMax;
  const defesa = Math.floor(((f.attrs&&f.attrs.constituicao)||0)/2) + (f.defesaBonus||0);
  return `
  <div class="card">
    <h2>${f.nome||key}</h2>
    <div class="meta">${[f.raca,f.classe,f.povo].filter(Boolean).join(' · ')||'sem raça/classe definidas'}</div>
    <div class="statrow">
      <div class="stat"><div class="v">${f.nivel||1}</div><div class="l">Nível</div></div>
      <div class="stat"><div class="v">${vCur}/${vMax}</div><div class="l">Vida</div></div>
      <div class="stat"><div class="v">${defesa}</div><div class="l">Defesa</div></div>
      <div class="stat"><div class="v" style="font-size:13px;">${religiaoLabel}</div><div class="l">Religião</div></div>
    </div>
    <div class="mana-mini">${manaRows}</div>
    ${(buffs||debuffs) ? `<div class="bd-tags">${buffs}${debuffs}</div>` : ''}
    <a class="open" href="index.html?personagem=${encodeURIComponent(key)}" target="_blank">Abrir ficha completa</a>
  </div>`;
}

function renderFichas(data){
  const content = document.getElementById('content');
  if(!data){
    content.innerHTML = '<div class="empty-state">Nenhuma ficha foi criada ainda. Peça para os jogadores abrirem o link da ficha e escolherem um nome.</div>';
    return;
  }
  const cards = Object.keys(data).sort().map(key=>cardHTML(key, data[key])).join('');
  content.innerHTML = `<div class="grid">${cards}</div>`;
}

(function init(){
  if(typeof firebase==='undefined' || typeof firebaseConfig==='undefined'){
    document.getElementById('content').innerHTML = '<div class="empty-state">Firebase não configurado. Preencha o arquivo firebase-config.js.</div>';
    return;
  }
  if(!firebase.apps.length){ firebase.initializeApp(firebaseConfig); }
  const db = firebase.database();
  db.ref('fichas').on('value', snap=>{ renderFichas(snap.val()); });
})();
