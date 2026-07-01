/* ---------- ESTADO ---------- */
const ATTRS = ['forca','espirito','inteligencia','agilidade','carisma','constituicao'];
const ATTR_LABELS = {forca:'Força',espirito:'Espírito',inteligencia:'Inteligência',agilidade:'Agilidade',carisma:'Carisma',constituicao:'Constituição'};
const MANA_TYPES = ['negra','rubra','branca','azul'];
const MANA_LABELS = {negra:'Mana Negra',rubra:'Mana Rubra',branca:'Mana Branca',azul:'Mana Azul'};

const RELIGIONS = {
  haukenismo:{label:'Haukenismo', mult:{azul:1.5, branca:1.0, negra:0.7, rubra:1.0},
    note:'O Haukenismo venera o céu noturno: seus fiéis recebem um grande favorecimento em Mana Azul. Regra especial: Mana Branca é sempre (Mana Azul ÷ 2) + 20.'},
  danitunismo:{label:'Danitunismo', mult:{branca:1.5, negra:0.5, azul:1.0, rubra:1.0},
    note:'O Danitunismo prega a pureza: maior Mana Branca, e Mana Negra reduzida.'},
  althimos:{label:'Althimos', mult:{negra:1.4, azul:1.1, branca:0.4, rubra:1.0},
    note:'Althimos é um culto ambíguo: muita Mana Negra, Mana Azul instável (ligeiramente acima ou abaixo do normal) e pouquíssima Mana Branca.'},
  belisianismo:{label:'Belisianismo', mult:{negra:1.8, branca:0.15, azul:0.6, rubra:1.0},
    note:'O Belisianismo é um culto sombrio: enorme Mana Negra, quase nenhuma Mana Branca e pouca Mana Azul.'},
  nenhuma:{label:'Nenhuma', mult:{negra:1,branca:1,azul:1,rubra:1}, note:'Sem fé declarada — reservas de mana em seus valores-base, sem favorecimentos.'}
};

function manaBase(){
  // Base de mana escala com Espírito: 50 + 5 por ponto de Espírito.
  const espirito = (state.attrs && state.attrs.espirito) || 0;
  return 50 + espirito*5;
}

let state = null;

function defaultState(){
  return {
    nome:'Andromeda', raca:'', classe:'', povo:'', nivel:1, religiao:'haukenismo',
    althimosVariance: (Math.random()<0.5? -0.1: 0.1),
    attrs: Object.fromEntries(ATTRS.map(a=>[a, rollAttrBase()])),
    mana: { negra:{cur:null}, rubra:{cur:0}, branca:{cur:null}, azul:{cur:null} },
    manaBonus: { negra:0, branca:0, azul:0 },
    vidaAtual: null,
    vidaMax: 10,
    defesaBonus: 0,
    spells: [],
    turnUsed: 0,
    buffs: [], debuffs: [],
    inventory: []
  };
}
function rollAttrBase(){ return d20()+4; }
function d20(){ return Math.floor(Math.random()*20)+1; }
function mod(v){ return Math.floor(v/2); }

/* ---------- PERSONAGEM (chave da URL) ---------- */
function slugify(s){
  return (s||'').toString().normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');
}
function getPersonagemKey(){
  const params = new URLSearchParams(window.location.search);
  return slugify(params.get('personagem'));
}
function showGate(){
  return new Promise(resolve=>{
    const gate = document.getElementById('gate');
    const input = document.getElementById('gate-input');
    const btn = document.getElementById('gate-btn');
    gate.style.display='flex';
    function go(){
      const slug = slugify(input.value);
      if(!slug) return;
      const url = new URL(window.location.href);
      url.searchParams.set('personagem', slug);
      window.location.href = url.toString();
    }
    btn.addEventListener('click', go);
    input.addEventListener('keydown', e=>{ if(e.key==='Enter') go(); });
  });
}
let PERSONAGEM_KEY = getPersonagemKey();

/* ---------- PERSISTÊNCIA (Firebase Realtime Database) ---------- */
let db = null;
let firebaseWarningEl = null;
function showFirebaseWarning(msg){
  if(firebaseWarningEl){ firebaseWarningEl.remove(); }
  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:60;background:#5a2020;color:#f5e2d8;font-family:EB Garamond,serif;font-size:14px;text-align:center;padding:10px 16px;border-bottom:1px solid #8a3a3a;';
  el.textContent = '⚠ ' + msg + ' — a ficha funciona, mas as alterações não vão salvar até isso ser corrigido.';
  document.body.prepend(el);
  firebaseWarningEl = el;
}
function clearFirebaseWarning(){
  if(firebaseWarningEl){ firebaseWarningEl.remove(); firebaseWarningEl = null; }
}
function initFirebase(){
  try{
    if(typeof firebase==='undefined' || typeof firebaseConfig==='undefined'){
      showFirebaseWarning('Firebase não encontrado (verifique se firebase-config.js foi enviado pro GitHub)');
      return false;
    }
    if(firebaseConfig.databaseURL && firebaseConfig.databaseURL.includes('COLE_AQUI')){
      showFirebaseWarning('firebase-config.js ainda tem valores de exemplo (COLE_AQUI...)');
      return false;
    }
    if(!firebase.apps.length){ firebase.initializeApp(firebaseConfig); }
    db = firebase.database();
    return true;
  }catch(e){
    console.error('Erro ao iniciar o Firebase:', e);
    showFirebaseWarning('Não foi possível conectar ao banco de dados (' + (e.message||e) + ')');
    db = null;
    return false;
  }
}
// Testa de verdade se dá pra escrever e ler no banco, logo ao abrir a ficha.
// Isso pega problemas que "iniciar" o Firebase sozinho não detecta, como
// regras de permissão erradas no Realtime Database.
async function testFirebaseConnection(){
  if(!db) return false;
  try{
    const testRef = db.ref('fichas/_teste_conexao');
    await testRef.set({ ts: Date.now() });
    const snap = await testRef.once('value');
    if(!snap.exists()){
      showFirebaseWarning('O banco aceitou salvar mas não conseguiu ler de volta (verifique as Regras do Realtime Database)');
      return false;
    }
    await testRef.remove();
    clearFirebaseWarning();
    return true;
  }catch(e){
    console.error('Teste de conexão com o Firebase falhou:', e);
    let motivo = e.message || String(e);
    if(motivo.toLowerCase().includes('permission')){
      motivo = 'Permissão negada — vá no Firebase Console → Realtime Database → Regras, e publique { ".read": true, ".write": true }';
    }
    showFirebaseWarning('Falha ao salvar/ler no banco: ' + motivo);
    return false;
  }
}
function storagePath(){ return 'fichas/' + PERSONAGEM_KEY; }
let saveTimer=null;
function scheduleSave(){
  clearTimeout(saveTimer);
  saveTimer=setTimeout(saveState, 500);
}
async function saveState(){
  if(!db){
    showFirebaseWarning('Sem conexão com o banco de dados — a última alteração NÃO foi salva');
    return;
  }
  try{
    await db.ref(storagePath()).set(state);
    clearFirebaseWarning();
    flashSaved();
  }catch(e){
    console.error('Erro ao salvar no Firebase', e);
    let motivo = e.message || String(e);
    if(motivo.toLowerCase().includes('permission')){
      motivo = 'Permissão negada pelas Regras do Realtime Database';
    }
    showFirebaseWarning('Não foi possível salvar: ' + motivo);
  }
}
// O Firebase Realtime Database APAGA sozinho qualquer campo que seja null,
// array vazio [] ou objeto vazio {} quando salvamos com .set(). Isso significa
// que uma ficha recém-criada (spells:[], buffs:[], debuffs:[], inventory:[])
// perde essas chaves assim que é salva pela primeira vez. Sem esta função,
// no próximo carregamento state.spells (etc.) viria "undefined" e qualquer
// render que fizesse "state.spells.length" quebrava a página inteira no meio
// do init() — e por isso nenhum botão (nem os de vida) ficava funcional depois
// disso, e nada mais salvava. sanitizeState() preenche de volta tudo que faltar.
function sanitizeState(raw){
  const base = defaultState();
  const s = Object.assign({}, base, raw||{});

  s.attrs = Object.assign({}, base.attrs, raw && raw.attrs);
  s.manaBonus = Object.assign({}, base.manaBonus, raw && raw.manaBonus);

  s.mana = {};
  MANA_TYPES.forEach(t=>{
    const fallback = base.mana[t];
    const loaded = (raw && raw.mana && raw.mana[t]) || {};
    s.mana[t] = Object.assign({}, fallback, loaded);
  });

  s.spells = Array.isArray(raw && raw.spells) ? raw.spells : [];
  s.buffs = Array.isArray(raw && raw.buffs) ? raw.buffs : [];
  s.debuffs = Array.isArray(raw && raw.debuffs) ? raw.debuffs : [];
  s.inventory = Array.isArray(raw && raw.inventory) ? raw.inventory : [];

  if(!Number.isFinite(s.nivel)) s.nivel = 1;
  if(!Number.isFinite(s.turnUsed)) s.turnUsed = 0;
  if(!Number.isFinite(s.defesaBonus)) s.defesaBonus = 0;

  return s;
}
async function loadState(){
  if(!db){ state = defaultState(); return; }
  try{
    const snap = await db.ref(storagePath()).once('value');
    const val = snap.val();
    if(val){ state = sanitizeState(val); return; }
  }catch(e){
    console.error('Erro ao carregar do Firebase', e);
    showFirebaseWarning('Não foi possível carregar a ficha salva (' + (e.message||e) + ')');
  }
  state = defaultState();
}
function flashSaved(){
  const el = document.getElementById('save-ind');
  el.classList.add('show');
  clearTimeout(flashSaved._t);
  flashSaved._t = setTimeout(()=>el.classList.remove('show'), 1200);
}

/* ---------- MANA: CÁLCULO ---------- */
function manaMax(tipo){
  if(tipo==='rubra') return null; // rubra não tem teto fixo por padrão (começa em 0, sem fonte definida)
  let base;
  // Regra especial do Haukenismo: Mana Branca = (Mana Azul / 2) + 20, sempre.
  if(tipo==='branca' && state.religiao==='haukenismo'){
    base = Math.round(manaMax('azul')/2) + 20;
  } else {
    const rel = RELIGIONS[state.religiao] || RELIGIONS.nenhuma;
    let mult = rel.mult[tipo] ?? 1;
    if(state.religiao==='althimos' && tipo==='azul'){ mult = mult + state.althimosVariance; }
    base = Math.round(manaBase() * mult);
  }
  const bonus = (state.manaBonus && state.manaBonus[tipo]) || 0;
  return base + bonus;
}
function defesaBase(){
  return Math.floor((Number(state.attrs.constituicao)||0)/2);
}
function defesaTotal(){
  return defesaBase() + (Number(state.defesaBonus)||0);
}

/* ---------- VIDA: CÁLCULO POR NÍVEL ---------- */
// Vida máxima no nível 1: (Constituição + Espírito) ÷ 2 + 10 (arredondado pra baixo)
// A cada nível acima do 1º, soma-se 9 de vida.
function vidaBaseNivel1(){
  const con = Number(state.attrs && state.attrs.constituicao) || 0;
  const esp = Number(state.attrs && state.attrs.espirito) || 0;
  return Math.floor((con + esp) / 2) + 10;
}
function vidaMaxNoNivel(n){
  n = Math.max(1, Math.min(15, parseInt(n) || 1));
  return vidaBaseNivel1() + 9 * (n - 1);
}
function vidaMaxAtual(){
  return vidaMaxNoNivel(state.nivel || 1);
}
function ensureVidaInit(){
  // A vida máxima agora é sempre derivada dos atributos + nível (não é mais editada manualmente).
  state.vidaMax = vidaMaxAtual();
  if(!Number.isFinite(state.vidaAtual)){ state.vidaAtual = state.vidaMax; }
  if(state.vidaAtual > state.vidaMax){ state.vidaAtual = state.vidaMax; }
  if(state.vidaAtual < 0){ state.vidaAtual = 0; }
}
function renderVidaNiveis(){
  const grid = document.getElementById('vida-niveis-grid');
  if(!grid) return;
  const nivelAtual = state.nivel || 1;
  let html='';
  for(let n=1; n<=15; n++){
    const hp = vidaMaxNoNivel(n);
    let cls = 'vida-nivel-box';
    if(n === nivelAtual) cls += ' active';
    else if(n < nivelAtual) cls += ' past';
    html += `<div class="${cls}"><div class="lvl">Nível ${n}</div><div class="hp">${hp} HP</div></div>`;
  }
  grid.innerHTML = html;
}
function renderVidaDefesa(){
  ensureVidaInit();
  const max = state.vidaMax;
  const cur = state.vidaAtual;
  const pct = max>0 ? Math.max(0, Math.min(100, (cur/max)*100)) : 0;
  const fill = document.getElementById('vida-bar-fill');
  const curInput = document.getElementById('vida-atual-input');
  const maxLabel = document.getElementById('vida-max-label');
  const atualLabel = document.getElementById('vida-atual-label');
  if(fill) fill.style.width = pct + '%';
  if(curInput && document.activeElement!==curInput) curInput.value = cur;
  if(maxLabel) maxLabel.textContent = max;
  if(atualLabel) atualLabel.textContent = cur;
  const db_ = document.getElementById('defesa-base');
  const dt_ = document.getElementById('defesa-total');
  const dbonus = document.getElementById('defesa-bonus');
  if(db_) db_.textContent = defesaBase();
  if(dt_) dt_.textContent = defesaTotal();
  if(dbonus && document.activeElement!==dbonus) dbonus.value = state.defesaBonus||0;
  renderVidaNiveis();
}
function ensureManaInit(){
  if(!state.mana) state.mana = {};
  MANA_TYPES.forEach(t=>{
    if(!state.mana[t]) state.mana[t] = { cur: t==='rubra' ? 0 : null };
    if(t==='rubra') return;
    const max = manaMax(t);
    if(state.mana[t].cur===null || state.mana[t].cur===undefined){
      state.mana[t].cur = max;
    }
  });
}

/* ---------- RENDER: IDENTIDADE ---------- */
function renderIdentity(){
  document.getElementById('i-nome').value = state.nome;
  document.getElementById('i-raca').value = state.raca;
  document.getElementById('i-classe').value = state.classe;
  document.getElementById('i-povo').value = state.povo;
  document.getElementById('i-nivel').value = state.nivel;
  document.getElementById('i-religiao').value = state.religiao;
  document.getElementById('titulo').textContent = (state.nome || 'Andromeda').toUpperCase();
  document.getElementById('religion-note').textContent = (RELIGIONS[state.religiao]||RELIGIONS.nenhuma).note;
  updateTurnMax();
}
function updateTurnMax(){
  const max = 4 + Math.max(0, Math.floor((state.nivel-1)/2));
  document.getElementById('turn-max').textContent = max;
  document.getElementById('turn-used').textContent = state.turnUsed;
}

/* ---------- RENDER: ATRIBUTOS + CONSTELAÇÃO ---------- */
function renderAttrs(){
  const grid = document.getElementById('attr-grid');
  grid.innerHTML='';
  ATTRS.forEach(key=>{
    const val = state.attrs[key];
    const card = document.createElement('div');
    card.className='attr-card';
    card.innerHTML = `
      <div class="attr-name">${ATTR_LABELS[key]}</div>
      <div class="attr-row">
        <input class="attr-value" type="number" value="${val}" data-attr="${key}">
        <div class="attr-mod">mod: +${mod(val)}</div>
      </div>
      <div class="btn-row">
        <button class="small" data-action="roll" data-attr="${key}">Rolar (1d20+4)</button>
        <button class="small" data-action="test" data-attr="${key}">Testar</button>
      </div>
      <div class="roll-log" id="log-${key}"></div>
    `;
    grid.appendChild(card);
  });
  grid.querySelectorAll('input.attr-value').forEach(inp=>{
    inp.addEventListener('change', e=>{
      const k = e.target.dataset.attr;
      state.attrs[k] = parseInt(e.target.value)||0;
      renderAttrs(); renderConstellation(); renderVidaDefesa(); renderMana(); scheduleSave();
    });
  });
  grid.querySelectorAll('button[data-action="roll"]').forEach(b=>{
    b.addEventListener('click', e=>{
      const k = e.target.dataset.attr;
      const roll = d20();
      state.attrs[k] = roll + 4;
      document.getElementById(`log-${k}`).textContent = `Rolado: ${roll} + 4 = ${state.attrs[k]}`;
      renderAttrs(); renderConstellation(); renderVidaDefesa(); renderMana(); scheduleSave();
    });
  });
  grid.querySelectorAll('button[data-action="test"]').forEach(b=>{
    b.addEventListener('click', e=>{
      const k = e.target.dataset.attr;
      const val = state.attrs[k];
      const roll = d20();
      const total = roll + mod(val);
      const logEl = document.getElementById(`log-${k}`);
      if(logEl) logEl.textContent = `Teste: ${roll} + ${mod(val)} = ${total}`;
    });
  });
}

function renderConstellation(){
  const svg = document.getElementById('const-svg');
  const cx=300, cy=160, R=110;
  const n = ATTRS.length;
  const pts = ATTRS.map((key,i)=>{
    const angle = (-Math.PI/2) + i*(2*Math.PI/n);
    return {key, x:cx+R*Math.cos(angle), y:cy+R*Math.sin(angle), val:state.attrs[key]};
  });
  let lines='';
  for(let i=0;i<n;i++){
    const a=pts[i], b=pts[(i+1)%n];
    lines += `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="#c9a227" stroke-opacity="0.3" stroke-width="1"/>`;
  }
  // raios até o centro, opacidade proporcional ao valor
  let spokes='';
  const maxVal = Math.max(...pts.map(p=>p.val), 1);
  pts.forEach(p=>{
    spokes += `<line x1="${cx}" y1="${cy}" x2="${p.x}" y2="${p.y}" stroke="#e3c66b" stroke-opacity="${0.15+0.5*(p.val/maxVal)}" stroke-width="1"/>`;
  });
  let stars='';
  pts.forEach(p=>{
    const r = 3 + 6*(p.val/maxVal);
    stars += `
      <circle class="const-star" cx="${p.x}" cy="${p.y}" r="${r}" fill="#e3c66b"/>
      <text class="const-label" x="${p.x}" y="${p.y - r - 14}" text-anchor="middle">${ATTR_LABELS[p.key].toUpperCase()}</text>
      <text class="const-value" x="${p.x}" y="${p.y - r - 3}" text-anchor="middle">${p.val}</text>
    `;
  });
  svg.innerHTML = `${lines}${spokes}<circle cx="${cx}" cy="${cy}" r="3" fill="#c9a227"/>${stars}`;
}

/* ---------- RENDER: MANA ---------- */
function renderMana(){
  ensureManaInit();
  const grid = document.getElementById('mana-grid');
  grid.innerHTML='';
  MANA_TYPES.forEach(t=>{
    const max = manaMax(t);
    const cur = state.mana[t].cur;
    const pct = (t==='rubra') ? 100 : Math.max(0, Math.min(100, (cur/max)*100));
    const mult = (RELIGIONS[state.religiao]||RELIGIONS.nenhuma).mult[t];
    const bonus = (t!=='rubra') ? ((state.manaBonus&&state.manaBonus[t])||0) : 0;
    const card = document.createElement('div');
    card.className = `mana-card mana-${t}`;
    card.innerHTML = `
      <div class="mana-title"><span class="mana-dot"></span>${MANA_LABELS[t]}</div>
      <div class="mana-bar-track"><div class="mana-bar-fill" style="width:${pct}%"></div></div>
      <div class="mana-nums"><span>${cur}${max!==null ? ' / '+max : ''}</span><span>${t!=='rubra' ? 'x'+mult.toFixed(2) : 'especial'}</span></div>
      <div class="mana-actions">
        <button class="small" data-action="adj" data-delta="-5" data-mana="${t}">-5</button>
        <button class="small" data-action="adj" data-delta="-1" data-mana="${t}">-1</button>
        <button class="small" data-action="adj" data-delta="1" data-mana="${t}">+1</button>
        <button class="small" data-action="adj" data-delta="5" data-mana="${t}">+5</button>
        <button class="small" data-action="full" data-mana="${t}">Restaurar</button>
      </div>
      ${t!=='rubra' ? `
      <div class="field" style="margin-top:10px;">
        <label>Bônus (soma no máximo desta mana)</label>
        <input type="number" value="${bonus}" data-mana-bonus="${t}">
      </div>` : ''}
    `;
    grid.appendChild(card);
  });
  grid.querySelectorAll('button').forEach(b=>{
    b.addEventListener('click', e=>{
      const t = e.target.dataset.mana;
      const max = manaMax(t);
      if(e.target.dataset.action==='adj'){
        const delta = parseInt(e.target.dataset.delta)||0;
        let next = (state.mana[t].cur||0) + delta;
        next = Math.max(0, next);
        if(max!==null) next = Math.min(max, next);
        state.mana[t].cur = next;
      }
      if(e.target.dataset.action==='full'){ state.mana[t].cur = max!==null ? max : state.mana[t].cur; }
      renderMana(); renderSpells(); scheduleSave();
    });
  });
  grid.querySelectorAll('[data-mana-bonus]').forEach(inp=>{
    inp.addEventListener('change', e=>{
      const t = e.target.dataset.manaBonus;
      if(!state.manaBonus) state.manaBonus = {negra:0,branca:0,azul:0};
      state.manaBonus[t] = parseInt(e.target.value)||0;
      renderMana(); renderSpells(); scheduleSave();
    });
  });
}

/* ---------- RENDER: MAGIAS ---------- */
function renderSpells(){
  updateTurnMax();
  const list = document.getElementById('spell-list');
  list.innerHTML='';
  if(state.spells.length===0){
    list.innerHTML = '<div class="empty-state">Nenhuma magia conhecida ainda. Adicione uma acima.</div>';
    return;
  }
  const maxTurn = 4 + Math.max(0, Math.floor((state.nivel-1)/2));
  state.spells.forEach((sp, idx)=>{
    const max = manaMax(sp.tipo);
    const canAfford = sp.tipo==='rubra' ? true : (state.mana[sp.tipo].cur >= sp.custo);
    const turnOk = state.turnUsed < maxTurn;
    const card = document.createElement('div');
    card.className = `spell-card tipo-${sp.tipo}`;
    card.innerHTML = `
      <div class="spell-name">${sp.nome}</div>
      <div class="spell-cost">${MANA_LABELS[sp.tipo]} · custo ${sp.custo}</div>
      <div class="spell-desc">${sp.efeito||''}</div>
      <button class="small primary" data-idx="${idx}" data-action="cast" ${(!canAfford||!turnOk)?'disabled':''}>Conjurar</button>
      <button class="small" data-idx="${idx}" data-action="remove">Remover</button>
    `;
    list.appendChild(card);
  });
  list.querySelectorAll('button[data-action="cast"]').forEach(b=>{
    b.addEventListener('click', e=>{
      const idx = parseInt(e.target.dataset.idx);
      const sp = state.spells[idx];
      if(sp.tipo!=='rubra'){ state.mana[sp.tipo].cur -= sp.custo; }
      else { state.mana.rubra.cur = Math.max(0, state.mana.rubra.cur - sp.custo); }
      state.turnUsed += 1;
      renderMana(); renderSpells(); scheduleSave();
    });
  });
  list.querySelectorAll('button[data-action="remove"]').forEach(b=>{
    b.addEventListener('click', e=>{
      state.spells.splice(parseInt(e.target.dataset.idx),1);
      renderSpells(); scheduleSave();
    });
  });
}

/* ---------- RENDER: BUFFS/DEBUFFS ---------- */
function renderBD(){
  const bl = document.getElementById('buff-list');
  const dl = document.getElementById('debuff-list');
  bl.innerHTML = state.buffs.length? '' : '<div class="empty-state">Nenhum buff ativo.</div>';
  dl.innerHTML = state.debuffs.length? '' : '<div class="empty-state">Nenhum debuff ativo.</div>';
  state.buffs.forEach((b,idx)=>{
    bl.innerHTML += `<div class="bd-item"><div class="bd-info"><b>${b.nome}</b><span>${b.desc||''} ${b.dur? '· '+b.dur:''}</span></div><button class="small" data-list="buffs" data-idx="${idx}" data-action="rm">×</button></div>`;
  });
  state.debuffs.forEach((b,idx)=>{
    dl.innerHTML += `<div class="bd-item"><div class="bd-info"><b>${b.nome}</b><span>${b.desc||''} ${b.dur? '· '+b.dur:''}</span></div><button class="small" data-list="debuffs" data-idx="${idx}" data-action="rm">×</button></div>`;
  });
  document.querySelectorAll('[data-action="rm"]').forEach(btn=>{
    btn.addEventListener('click', e=>{
      const list = e.target.dataset.list, idx = parseInt(e.target.dataset.idx);
      state[list].splice(idx,1);
      renderBD(); scheduleSave();
    });
  });
}

/* ---------- RENDER: INVENTÁRIO ---------- */
function renderInv(){
  const body = document.getElementById('inv-body');
  if(state.inventory.length===0){
    body.innerHTML = `<tr><td colspan="4" class="empty-state">Inventário vazio.</td></tr>`;
    return;
  }
  body.innerHTML = state.inventory.map((it,idx)=>`
    <tr>
      <td>${it.nome}</td><td>${it.qtd}</td><td>${it.desc||''}</td>
      <td><button class="small" data-idx="${idx}" data-action="rminv">Remover</button></td>
    </tr>
  `).join('');
  body.querySelectorAll('button[data-action="rminv"]').forEach(b=>{
    b.addEventListener('click', e=>{
      state.inventory.splice(parseInt(e.target.dataset.idx),1);
      renderInv(); scheduleSave();
    });
  });
}

/* ---------- LISTENERS GERAIS ---------- */
// Liga um evento com segurança: se o elemento não existir na página,
// avisa no console em vez de travar TODOS os botões da ficha.
function on(id, evt, fn){
  const el = document.getElementById(id);
  if(el){ el.addEventListener(evt, fn); }
  else { console.error('[bind] elemento não encontrado, botão ignorado:', id); }
}
function bindIdentityEvents(){
  on('i-nome', 'input', e=>{ state.nome=e.target.value; document.getElementById('titulo').textContent=(e.target.value||'Andromeda').toUpperCase(); scheduleSave(); });
  on('i-raca', 'input', e=>{ state.raca=e.target.value; scheduleSave(); });
  on('i-classe', 'input', e=>{ state.classe=e.target.value; scheduleSave(); });
  on('i-povo', 'input', e=>{ state.povo=e.target.value; scheduleSave(); });
  on('i-nivel', 'input', e=>{
    let n = parseInt(e.target.value)||1;
    n = Math.max(1, Math.min(15, n));
    state.nivel = n;
    e.target.value = n;
    updateTurnMax(); renderSpells(); renderVidaDefesa(); scheduleSave();
  });
  on('i-religiao', 'change', e=>{
    state.religiao = e.target.value;
    if(state.religiao==='althimos'){ state.althimosVariance = (Math.random()<0.5? -0.1: 0.1); }
    // reseta a mana atual para o novo máximo (nunca grava null — o Firebase apaga chaves com valor null)
    MANA_TYPES.forEach(t=>{ if(t!=='rubra'){ if(!state.mana[t]) state.mana[t]={}; state.mana[t].cur = manaMax(t); } });
    document.getElementById('religion-note').textContent = (RELIGIONS[state.religiao]||RELIGIONS.nenhuma).note;
    renderMana(); renderSpells(); scheduleSave();
  });
  on('btn-novarodada', 'click', ()=>{
    state.turnUsed=0; renderSpells(); scheduleSave();
  });
  on('btn-addspell', 'click', ()=>{
    const nome = document.getElementById('sp-nome').value.trim();
    if(!nome) return;
    const tipo = document.getElementById('sp-tipo').value;
    const custo = parseInt(document.getElementById('sp-custo').value)||50;
    const efeito = document.getElementById('sp-efeito').value.trim();
    state.spells.push({nome,tipo,custo,efeito});
    document.getElementById('sp-nome').value=''; document.getElementById('sp-efeito').value=''; document.getElementById('sp-custo').value=50;
    renderSpells(); scheduleSave();
  });
  on('btn-addbuff', 'click', ()=>{
    const nome=document.getElementById('bf-nome').value.trim(); if(!nome) return;
    state.buffs.push({nome, dur:document.getElementById('bf-dur').value.trim(), desc:document.getElementById('bf-desc').value.trim()});
    document.getElementById('bf-nome').value=''; document.getElementById('bf-dur').value=''; document.getElementById('bf-desc').value='';
    renderBD(); scheduleSave();
  });
  on('btn-adddebuff', 'click', ()=>{
    const nome=document.getElementById('db-nome').value.trim(); if(!nome) return;
    state.debuffs.push({nome, dur:document.getElementById('db-dur').value.trim(), desc:document.getElementById('db-desc').value.trim()});
    document.getElementById('db-nome').value=''; document.getElementById('db-dur').value=''; document.getElementById('db-desc').value='';
    renderBD(); scheduleSave();
  });
  on('btn-addinv', 'click', ()=>{
    const nome=document.getElementById('inv-nome').value.trim(); if(!nome) return;
    const qtd=parseInt(document.getElementById('inv-qtd').value)||1;
    const desc=document.getElementById('inv-desc').value.trim();
    state.inventory.push({nome,qtd,desc});
    document.getElementById('inv-nome').value=''; document.getElementById('inv-qtd').value=1; document.getElementById('inv-desc').value='';
    renderInv(); scheduleSave();
  });
  on('btn-reset', 'click', ()=>{
    if(confirm('Isso vai apagar toda a ficha e recomeçar do zero. Continuar?')){
      state = defaultState();
      renderAll(); scheduleSave();
    }
  });
  document.querySelectorAll('[data-vida-adj]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      ensureVidaInit();
      const delta = parseInt(btn.dataset.vidaAdj)||0;
      state.vidaAtual = Math.max(0, Math.min(state.vidaMax, state.vidaAtual + delta));
      renderVidaDefesa(); scheduleSave();
    });
  });
  on('vida-full', 'click', ()=>{
    ensureVidaInit();
    state.vidaAtual = state.vidaMax;
    renderVidaDefesa(); scheduleSave();
  });
  on('vida-atual-input', 'change', e=>{
    ensureVidaInit();
    let v = parseInt(e.target.value);
    if(!Number.isFinite(v)) v = 0;
    state.vidaAtual = Math.max(0, Math.min(state.vidaMax, v));
    renderVidaDefesa(); scheduleSave();
  });
  on('defesa-bonus', 'change', e=>{
    state.defesaBonus = parseInt(e.target.value)||0;
    renderVidaDefesa(); scheduleSave();
  });
}

/* ---------- STARFIELD DE FUNDO ---------- */
function initStarfield(){
  const c = document.getElementById('starfield');
  const ctx = c.getContext('2d');
  function resize(){ c.width=window.innerWidth; c.height=window.innerHeight; }
  resize(); window.addEventListener('resize', resize);
  const stars = Array.from({length:140}, ()=>({
    x:Math.random()*c.width, y:Math.random()*c.height, r:Math.random()*1.3+0.2,
    a:Math.random(), speed:Math.random()*0.015+0.003
  }));
  function tick(){
    ctx.clearRect(0,0,c.width,c.height);
    stars.forEach(s=>{
      s.a += s.speed;
      const op = 0.3 + 0.5*Math.abs(Math.sin(s.a));
      ctx.fillStyle = `rgba(227,198,107,${op})`;
      ctx.beginPath(); ctx.arc(s.x,s.y,s.r,0,7); ctx.fill();
    });
    requestAnimationFrame(tick);
  }
  tick();
}

/* ---------- INIT ---------- */
function renderAll(){
  renderIdentity(); renderAttrs(); renderConstellation(); renderVidaDefesa(); renderMana(); renderSpells(); renderBD(); renderInv();
}
(async function init(){
  if(!PERSONAGEM_KEY){
    await showGate();
    return; // showGate redireciona a página com ?personagem=... ; este init não continua
  }
  document.getElementById('gate').style.display='none';
  try{
    initStarfield();
    initFirebase();
    await loadState();
    renderAll();
    bindIdentityEvents();
    const sub = document.querySelector('header .sub');
    if(sub) sub.textContent = `Ficha de Personagem · RPG Medieval · ${PERSONAGEM_KEY}`;
    testFirebaseConnection(); // roda em segundo plano; avisa na tela se o salvamento não funcionar
  }catch(e){
    // Se qualquer coisa inesperada quebrar aqui, mostramos um aviso em vez de
    // deixar a página travada em silêncio sem nenhum botão funcionando.
    console.error('Erro ao iniciar a ficha:', e);
    showFirebaseWarning('Erro ao carregar a ficha (' + (e.message||e) + '). Veja o console (F12) para detalhes.');
  }
})();
