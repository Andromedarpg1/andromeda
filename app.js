/* Andromeda — ficha do jogador */
const $ = id => document.getElementById(id);
const PKEY = slugify(new URLSearchParams(location.search).get('personagem'));
let state=null, synced={}, db=null, created=false;
let page='ficha', invCat='todos', hist=[], histOff=null, saveTimer=null, rafR=0;
let shownAttrs=null, shownHp=null, vidaBuilt=false;
const undoStack=[], rollLog={};
const PAGES=[['ficha','Ficha'],['magia','Magia'],['inventario','Itens'],['estados','Estados'],['historico','Histórico']];

/* ---------- entrada ---------- */
function showGate(){
  const go=()=>{ const slug=slugify($('gate-input').value); if(!slug) return;
    const u=new URL(location.href); u.searchParams.set('personagem',slug); location.href=u.toString(); };
  $('gate').style.display='flex'; $('gate-btn').onclick=go;
  $('gate-input').onkeydown=e=>{ if(e.key==='Enter') go(); };
}
(async function init(){
  if(!PKEY){ showGate(); return; }
  $('gate').style.display='none';
  try{
    initStars(); buildNav(); db=initFB();
    await load(); bind(); renderAll(); go(location.hash.slice(1)||'ficha');
    if(created) await firstSave();
    if(db){ listen(); testConn(); }
  }catch(e){ console.error(e); banner('Erro ao carregar a ficha ('+(e.message||e)+'). Veja o console (F12).'); }
})();

async function load(){
  if(db){
    try{ const v=(await db.ref('fichas/'+PKEY).once('value')).val();
      if(v){ state=sanitize(v); synced=flatten(state); return; }
    }catch(e){ fbError(e,'Não foi possível carregar a ficha'); }
  }
  state=sanitize(defaultState()); synced={}; created=true;   // ficha nova: grava já, para os atributos não rolarem de novo a cada abertura
}
async function firstSave(){
  const p=prepare({},state,'jogador','Ficha criada'); if(!p) return;
  synced=p.flat; if(db){ try{ await send(db,PKEY,p); }catch(e){ fbError(e,'Não foi possível salvar'); } }
}
async function testConn(){
  try{ const r=db.ref('fichas/_teste_conexao'); await r.set({ts:Date.now()}); if(!(await r.once('value')).exists()) throw new Error('permission: não leu de volta'); await r.remove(); clearBanner(); }
  catch(e){ fbError(e,'Falha ao salvar/ler no banco'); }
}

/* ---------- salvar / ao vivo / desfazer ---------- */
function touch(){ clearTimeout(saveTimer); saveTimer=setTimeout(save,450); }
async function save(){
  state=sanitize(clone(state));
  const p=prepare(synced,state,'jogador'); if(!p) return;
  undoStack.push({inv:p.inv,resumo:p.resumo}); if(undoStack.length>40) undoStack.shift();
  synced=p.flat;                       // antes de enviar, para o eco do Firebase não parecer alteração do mestre
  if(!db){ banner('Sem conexão com o banco — a última alteração NÃO foi salva'); return; }
  try{ await send(db,PKEY,p); clearBanner(); const s=$('save-ind'); s.classList.add('on'); clearTimeout(s._t); s._t=setTimeout(()=>s.classList.remove('on'),1400); }
  catch(e){ fbError(e,'Não foi possível salvar'); }
}
function listen(){
  db.ref('fichas/'+PKEY).on('value',snap=>{
    const v=snap.val(); if(!v) return;
    const R=flatten(sanitize(v)), ch=diffFlat(synced,R), ks=Object.keys(ch);
    if(!ks.length) return;
    synced=R; ks.forEach(k=>setPath(state,k,ch[k])); state=sanitize(state);
    if(ch['edicao/ts'] && R['edicao/por']==='mestre') toast('Mestre: '+R['edicao/resumo'],'mestre');
    renderAll(); ks.forEach(k=>flashPath(k));
  });
}
function flashPath(k){ document.querySelectorAll(`[data-p="${k}"]`).forEach(el=>{ el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); }); }
function undo(){
  const u=undoStack.pop(); if(!u) return toast('Nada para desfazer');
  for(const k in u.inv) if(!lockedAttrPath(k)) setPath(state,k,u.inv[k]);
  state=sanitize(state); renderAll(); touch(); toast('Desfeito: '+u.resumo);
}
const lockedAttrPath = k => k.startsWith('attrs/') && lockedAttr(state,k.slice(6));
function change(){ state=sanitize(state); renderAll(); touch(); }

/* ---------- navegação ---------- */
function buildNav(){
  $('nav').innerHTML=PAGES.map(([k,l])=>`<button data-a="go" data-p="${k}" id="nav-${k}">${ic(k)}<span>${l}</span></button>`).join('');
  ['btn-undo','btn-undo2'].forEach(i=>{ if($(i)) $(i).innerHTML=ic('undo')+'<span>Desfazer</span>'; });
}
function go(p){
  if(!PAGES.some(x=>x[0]===p)) p='ficha'; page=p; history.replaceState(null,'','#'+p);
  document.querySelectorAll('.page').forEach(s=>s.classList.toggle('on',s.id==='p-'+p));
  document.querySelectorAll('#nav button').forEach(b=>b.classList.toggle('on',b.dataset.p===p));
  if(histOff){ histOff(); histOff=null; }
  if(p==='historico' && db) histOff=histListen(db,PKEY,l=>{ hist=l; renderHist(); });
  if(p==='ficha') drawRadar();
  scrollTo(0,0);
}

/* ---------- render ---------- */
function renderAll(){
  renderSide(); renderIdentity(); renderCard(); renderVida(); renderDefesa(); renderAttrs();
  renderMana(); renderSpells(); renderInv(); renderBD(); applyHp();
  document.querySelectorAll('#btn-undo,#btn-undo2').forEach(b=>b.disabled=!undoStack.length);
}
function renderSide(){
  $('side-nome').textContent=state.nome||'Sem nome';
  $('side-sub').textContent=`Nível ${state.nivel}`+(state.classe?` · ${state.classe}`:'');
  $('titulo').textContent=state.nome||'Sem nome'; document.title=`${state.nome||'Ficha'} — Andromeda`;
}
function setVal(id,v){ const el=$(id); if(el && document.activeElement!==el) el.value=v; }
function renderIdentity(){
  setVal('i-nome',state.nome); setVal('i-raca',state.raca); setVal('i-classe',state.classe); setVal('i-povo',state.povo);
  setVal('i-nivel',state.nivel); setVal('i-religiao',state.religiao);
  $('rel-note').textContent=(RELIGIONS[state.religiao]||RELIGIONS.nenhuma).note;
}
function renderCard(){
  const vals=ATTRS.map(a=>state.attrs[a]), avg=Math.round(vals.reduce((a,b)=>a+b,0)/vals.length);
  const rel=(RELIGIONS[state.religiao]||RELIGIONS.nenhuma).label;
  $('starcard').innerHTML=`<div class="sc-top"><div class="sc-ovr"><b>${avg}</b><i>média</i></div>
    <div class="sc-id"><h3>${esc(state.nome||'Sem nome')}</h3><p>${esc(state.classe||'Sem classe')}</p><p>${esc(state.raca||'')}</p></div>
    <div class="sc-lvl"><b>${state.nivel}</b><i>nível</i></div></div>
    <div id="radar" class="sc-radar"></div>
    <div class="sc-foot"><span>${esc(rel)}</span><span>${esc(state.povo||'')}</span></div>`;
  drawRadar();
}
function drawRadar(){
  const to=ATTRS.map(a=>num(state.attrs[a])), from=shownAttrs||to.map(()=>0), t0=performance.now();
  cancelAnimationFrame(rafR);
  const step=t=>{
    const k=reduced?1:Math.min(1,(t-t0)/650), e=1-Math.pow(1-k,3), cur=to.map((v,i)=>from[i]+(v-from[i])*e), el=$('radar');
    if(el) el.innerHTML=radarSVG(cur,{id:'main',labelVals:to});
    shownAttrs=k<1?cur:to; if(k<1) rafR=requestAnimationFrame(step);
  };
  rafR=requestAnimationFrame(step);
}
const HP_LABEL={'':'Em forma',low:'Ferido',crit:'À beira da morte',zero:'Caído'};
function renderVida(){
  const el=$('vida'), max=state.vidaMax, cur=state.vidaAtual, pct=max?cur/max*100:0, st=hpState(state);
  if(!vidaBuilt){
    el.innerHTML=`<div class="v-head"><span class="heart">${ic('heart')}</span><h3>Vida</h3><span class="v-state" id="v-state"></span></div>
      <div class="v-num"><input id="vida-in" type="number" data-i="vida" aria-label="Vida atual"><span>/ <b id="v-max"></b></span></div>
      <div class="bar"><i class="trail" id="v-trail"></i><i class="fill" id="v-fill"></i></div>
      <div class="v-btns"><button data-a="hp" data-d="-5">−5</button><button data-a="hp" data-d="-1">−1</button><button data-a="hp" data-d="1">+1</button><button data-a="hp" data-d="5">+5</button><button data-a="hpfull" class="wide">Restaurar</button></div>`;
    vidaBuilt=true;
  }
  setVal('vida-in',cur); $('v-max').textContent=max; $('v-state').textContent=HP_LABEL[st];
  $('v-fill').style.width=pct+'%'; $('v-trail').style.width=pct+'%';
  if(shownHp!==null && shownHp!==cur){ const c=cur<shownHp?'hit':'heal'; el.classList.remove('hit','heal'); void el.offsetWidth; el.classList.add(c); }
  shownHp=cur;
}
function renderDefesa(){
  $('defesa').innerHTML=`<div class="d-head">${ic('shield')}<h3>Defesa</h3></div><div class="d-num">${defesaTotal(state)}</div>
    <div class="d-bonus"><span>Bônus de armadura e magia</span><div class="stp sm"><button data-a="defb" data-d="-1" aria-label="menos">−</button><input type="number" value="${state.defesaBonus}" data-i="defb" aria-label="Bônus de defesa"><button data-a="defb" data-d="1" aria-label="mais">+</button></div></div>`;
}
function applyHp(){
  const st=hpState(state), b=document.body.classList; b.remove('hp-low','hp-crit','hp-zero'); if(st) b.add('hp-'+st);
}
function renderAttrs(){
  const sc=Math.max(30,Math.ceil(Math.max(...ATTRS.map(a=>state.attrs[a]))/5)*5);
  $('attrs').innerHTML=ATTRS.map(k=>{ const v=state.attrs[k], lk=lockedAttr(state,k);
    return `<div class="attr" data-p="attrs/${k}">
      <div class="a-top"><span>${ATTR_LABELS[k]}</span>${lk?`<em title="Travado pelo Mestre">${ic('lock')}</em>`:''}</div>
      <input class="a-val" type="number" value="${v}" data-i="attr" data-k="${k}" ${lk?'readonly':''} style="color:${tier(v)}" aria-label="${ATTR_LABELS[k]}">
      <div class="a-bar"><i style="width:${Math.min(100,v/sc*100)}%;background:${tier(v)}"></i></div>
      <div class="a-res" id="res-${k}">${rollLog[k]||''}</div>
      <div class="a-btns"><button data-a="test" data-k="${k}">${ic('dice')}Testar</button><button data-a="roll" data-k="${k}" ${lk?'disabled title="Travado pelo Mestre"':''}>${ic(lk?'lock':'dice')}Rolar de novo</button></div></div>`; }).join('');
}
function renderMana(){
  $('mana').innerHTML=MANA_TYPES.map(t=>{ const max=manaMax(state,t), cur=state.mana[t].cur, pct=max===null?100:max?cur/max*100:0;
    return `<div class="mana m-${t}" data-p="mana/${t}/cur"><div class="m-head"><i></i><h3>${MANA_LABELS[t]}</h3><b>${cur}${max!==null?`<small> / ${max}</small>`:''}</b></div>
      <div class="bar"><i class="fill" style="width:${pct}%"></i></div>
      <div class="v-btns"><button data-a="mana" data-t="${t}" data-d="-5">−5</button><button data-a="mana" data-t="${t}" data-d="-1">−1</button><button data-a="mana" data-t="${t}" data-d="1">+1</button><button data-a="mana" data-t="${t}" data-d="5">+5</button>${max!==null?`<button data-a="manafull" data-t="${t}" class="wide">Restaurar</button>`:''}</div>
      ${t!=='rubra'?`<label class="m-bonus"><span>Bônus de reserva</span><input type="number" value="${num(state.manaBonus[t])}" data-i="mbonus" data-t="${t}"></label>`:''}</div>`; }).join('');
}
function renderSpells(){
  const max=turnMax(state), used=state.turnUsed;
  $('turn-dots').innerHTML=Array.from({length:max},(_,i)=>`<i class="${i<used?'used':''}"></i>`).join('');
  $('turn-txt').textContent=`${used} de ${max} nesta rodada`;
  $('spells').innerHTML=state.spells.length?state.spells.map((sp,i)=>{
    const ok=sp.tipo==='rubra'||state.mana[sp.tipo].cur>=sp.custo, turn=used<max;
    return `<div class="spell m-${sp.tipo}"><div class="sp-top"><h3>${esc(sp.nome)}</h3><button class="ibtn" data-a="spell-edit" data-i="${i}" aria-label="Editar">${ic('edit')}</button></div>
      <small>${MANA_LABELS[sp.tipo]} · custo ${sp.custo}</small><p>${esc(sp.efeito)}</p>
      <button class="btn gold" data-a="cast" data-i="${i}" ${ok&&turn?'':'disabled'}>${!turn?'Sem ações na rodada':ok?'Conjurar':'Mana insuficiente'}</button></div>`; }).join('')
    :'<div class="empty">Nenhum feitiço ainda. Use “Novo feitiço” para adicionar o primeiro.</div>';
}
function renderInv(){
  const items=state.inventory, total=items.reduce((a,x)=>a+x.qtd,0);
  $('inv-count').textContent=`${items.length} ${items.length===1?'item':'itens'} · ${total} no total`;
  const tabs=[['todos','Todos',items.length],...CATS.map(c=>[c[0],c[1],items.filter(x=>x.cat===c[0]).length])];
  $('inv-tabs').innerHTML=tabs.map(([k,l,n])=>`<button data-a="invcat" data-c="${k}" class="${invCat===k?'on':''}">${l}<em>${n}</em></button>`).join('');
  const list=items.filter(x=>invCat==='todos'||x.cat===invCat);
  $('inv-list').innerHTML=list.length?list.map(it=>`<div class="item ${it.qtd?'':'zero'}" data-p="inventory"><div class="it-info"><h3>${esc(it.nome)}</h3><small>${esc((CATS.find(c=>c[0]===it.cat)||[0,'Diversos'])[1])}</small>${it.desc?`<p>${esc(it.desc)}</p>`:''}</div>
    <div class="stp"><button data-a="iqty" data-id="${it.id}" data-d="-1" aria-label="menos">−</button><input type="number" min="0" value="${it.qtd}" data-i="iqty" data-id="${it.id}" aria-label="Quantidade"><button data-a="iqty" data-id="${it.id}" data-d="1" aria-label="mais">+</button></div>
    <button class="ibtn" data-a="inv-edit" data-id="${it.id}" aria-label="Editar item">${ic('edit')}</button></div>`).join('')
    :`<div class="empty">${items.length?'Nada nesta categoria.':'Inventário vazio. Use “Novo item” para guardar o primeiro.'}</div>`;
}
function renderBD(){
  [['buffs','buff-list','Nenhum buff ativo.'],['debuffs','debuff-list','Nenhum debuff ativo.']].forEach(([k,id,empty])=>{
    $(id).innerHTML=state[k].length?state[k].map((b,i)=>`<div class="bd-item ${k}"><div><h3>${esc(b.nome)}</h3><p>${esc(b.desc)}</p></div>${b.dur?`<span class="chip">${esc(b.dur)}</span>`:''}<button class="ibtn" data-a="bd-edit" data-kind="${k}" data-i="${i}" aria-label="Editar">${ic('edit')}</button></div>`).join(''):`<div class="empty">${empty}</div>`; });
}
function renderHist(){
  $('hist-list').innerHTML=hist.length?hist.map((h,i)=>`<div class="h-row ${i?'':'now'}"><div class="h-dot ${h.por}"></div><div class="h-info"><b>${esc(h.resumo||'Alteração')}</b><small>${h.por==='mestre'?'Mestre':'Você'} · ${ago(h.ts)} · ${new Date(h.ts).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</small></div>${i?`<button class="btn ghost" data-a="restore" data-n="${h.n}">Restaurar</button>`:'<span class="chip">atual</span>'}</div>`).join(''):'<div class="empty">Ainda não há pontos salvos.</div>';
}

/* ---------- rolagens ---------- */
async function tumble(el,final){ if(reduced) return; for(let i=0;i<8;i++){ el.textContent='d20 · '+d20(); await sleep(45); } }
async function doRoll(k){
  if(lockedAttr(state,k)) return toast('Rolagem travada pelo Mestre');
  const r=d20(); await tumble($('res-'+k),r);
  state.attrs[k]=r+4; rollLog[k]=`Rolou ${r}, atributo vira <b>${r+4}</b>`; change();
}
async function doTest(k){
  const r=d20(), m=mod(state.attrs[k]), t=r+m, el=$('res-'+k);
  await tumble(el,r); rollLog[k]=`<b>${t}</b> <small>d20 ${r} + ${m}</small>${r===20?' <em class="crit">crítico</em>':r===1?' <em class="fail">falha</em>':''}`;
  const e=$('res-'+k); if(e) e.innerHTML=rollLog[k];
}

/* ---------- modais ---------- */
const MANA_OPTS=MANA_TYPES.map(t=>[t,MANA_LABELS[t]]);
function modalItem(it){
  openModal({title:it?'Editar item':'Novo item',okText:it?'Salvar':'Adicionar',
    fields:[{k:'nome',label:'Nome'},{k:'qtd',label:'Quantidade',type:'qty'},{k:'cat',label:'Categoria',type:'select',opts:CATS,def:invCat!=='todos'?invCat:'diversos'},{k:'desc',label:'Descrição',type:'area'}],
    values:it||{qtd:1}, onDelete:it?()=>{ if(confirm(`Remover “${it.nome}” do inventário?`)){ state.inventory=state.inventory.filter(x=>x.id!==it.id); change(); } }:null,
    onSave:v=>{ if(it) Object.assign(state.inventory.find(x=>x.id===it.id),v); else state.inventory.push({id:uid(),...v}); change(); }});
}
function modalSpell(i){
  const sp=state.spells[i];
  openModal({title:sp?'Editar feitiço':'Novo feitiço',okText:sp?'Salvar':'Adicionar',
    fields:[{k:'nome',label:'Nome'},{k:'tipo',label:'Mana',type:'select',opts:MANA_OPTS,def:'azul'},{k:'custo',label:'Custo',type:'qty'},{k:'efeito',label:'Efeito',type:'area'}],
    values:sp||{custo:50}, onDelete:sp?()=>{ state.spells.splice(i,1); change(); }:null,
    onSave:v=>{ if(sp) state.spells[i]=v; else state.spells.push(v); change(); }});
}
function modalBD(kind,i){
  const b=state[kind][i], nm=kind==='buffs'?'buff':'debuff';
  openModal({title:b?`Editar ${nm}`:`Novo ${nm}`,okText:b?'Salvar':'Adicionar',
    fields:[{k:'nome',label:'Nome'},{k:'dur',label:'Duração (ex: 3 rodadas)'},{k:'desc',label:'Efeito',type:'area'}],
    values:b||{}, onDelete:b?()=>{ state[kind].splice(i,1); change(); }:null,
    onSave:v=>{ if(b) state[kind][i]=v; else state[kind].push(v); change(); }});
}

/* ---------- eventos ---------- */
function bind(){
  document.addEventListener('click',e=>{ const b=e.target.closest('[data-a]'); if(b && !b.disabled) act(b.dataset.a,b.dataset); });
  document.addEventListener('change',e=>{ const t=e.target; if(t.dataset.i) inp(t.dataset.i,t); });
  document.addEventListener('input',e=>{ const t=e.target, k=t.dataset.live; if(k){ state[k]=t.value; renderSide(); renderCard(); touch(); } });
  document.addEventListener('keydown',e=>{ if((e.ctrlKey||e.metaKey)&&e.key==='z'&&!/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)){ e.preventDefault(); undo(); } });
}
function act(a,d){
  const D=num(d.d);
  if(a==='go') return go(d.p);
  if(a==='undo') return undo();
  if(a==='lvl'){ state.nivel=clamp(state.nivel+D,1,MAX_NIVEL); return change(); }
  if(a==='hp'){ state.vidaAtual=clamp(state.vidaAtual+D,0,state.vidaMax); return change(); }
  if(a==='hpfull'){ state.vidaAtual=state.vidaMax; return change(); }
  if(a==='defb'){ state.defesaBonus+=D; return change(); }
  if(a==='roll') return doRoll(d.k);
  if(a==='test') return doTest(d.k);
  if(a==='mana'){ const m=manaMax(state,d.t); let n=Math.max(0,state.mana[d.t].cur+D); if(m!==null) n=Math.min(m,n); state.mana[d.t].cur=n; return change(); }
  if(a==='manafull'){ state.mana[d.t].cur=manaMax(state,d.t); return change(); }
  if(a==='newround'){ state.turnUsed=0; return change(); }
  if(a==='cast'){ const sp=state.spells[+d.i]; state.mana[sp.tipo].cur=Math.max(0,state.mana[sp.tipo].cur-sp.custo); state.turnUsed++; return change(); }
  if(a==='spell-new') return modalSpell(-1);
  if(a==='spell-edit') return modalSpell(+d.i);
  if(a==='invcat'){ invCat=d.c; return renderInv(); }
  if(a==='inv-new') return modalItem(null);
  if(a==='inv-edit') return modalItem(state.inventory.find(x=>x.id===d.id));
  if(a==='iqty'){ const it=state.inventory.find(x=>x.id===d.id); it.qtd=Math.max(0,it.qtd+D); return change(); }
  if(a==='bd-new') return modalBD(d.kind,-1);
  if(a==='bd-edit') return modalBD(d.kind,+d.i);
  if(a==='restore'){ const h=hist.find(x=>x.n===+d.n); if(h && confirm('Voltar a ficha para este ponto?')){ state=restored(state,h.estado); renderAll(); touch(); toast('Ficha restaurada'); } return; }
  if(a==='reset'){ if(confirm('Apagar toda a ficha e recomeçar? Dá para voltar pelo Histórico.')){ const keep=state.travas, fresh=sanitize(defaultState()); fresh.travas=keep; ATTRS.forEach(k=>{ if(lockedAttr(state,k)) fresh.attrs[k]=state.attrs[k]; }); state=sanitize(fresh); shownHp=null; renderAll(); touch(); } }
}
function inp(kind,t){
  const v=t.value;
  if(kind==='nivel') state.nivel=clamp(parseInt(v)||1,1,MAX_NIVEL);
  else if(kind==='religiao'){ state.religiao=v; if(v==='althimos') state.althimosVariance=Math.random()<.5?-.1:.1; MANA_TYPES.forEach(m=>{ if(m!=='rubra') state.mana[m].cur=null; }); }
  else if(kind==='vida') state.vidaAtual=clamp(num(v),0,state.vidaMax);
  else if(kind==='defb') state.defesaBonus=num(v);
  else if(kind==='attr'){ if(lockedAttr(state,t.dataset.k)) return renderAttrs(); state.attrs[t.dataset.k]=num(v); }
  else if(kind==='mbonus') state.manaBonus[t.dataset.t]=num(v);
  else if(kind==='iqty') state.inventory.find(x=>x.id===t.dataset.id).qtd=Math.max(0,num(v));
  change();
}

/* ---------- estrelas ---------- */
function initStars(){
  const c=$('starfield'), x=c.getContext('2d'); let w,h;
  const size=()=>{ w=c.width=innerWidth; h=c.height=innerHeight; }; size(); addEventListener('resize',size);
  const S=Array.from({length:150},()=>({x:Math.random(),y:Math.random(),r:Math.random()*1.3+.2,a:Math.random()*6,v:Math.random()*.012+.003,d:Math.random()*.00008+.00002}));
  (function tick(){
    const cl=document.body.classList, rgb=cl.contains('hp-crit')?'214,80,100':cl.contains('hp-low')?'170,160,150':'227,198,107';
    x.clearRect(0,0,w,h);
    S.forEach(s=>{ s.a+=s.v; if(!reduced){ s.y=(s.y+s.d)%1; } x.fillStyle=`rgba(${rgb},${.25+.55*Math.abs(Math.sin(s.a))})`; x.beginPath(); x.arc(s.x*w,s.y*h,s.r,0,7); x.fill(); });
    requestAnimationFrame(tick);
  })();
}
