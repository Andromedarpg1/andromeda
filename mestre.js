/* Andromeda — painel do mestre (edita as fichas ao vivo) */
const $ = id => document.getElementById(id);
let db=null, DATA={}, sel=null, hist=[], histOff=null;
const MC={negra:'var(--negra)',rubra:'var(--rubra)',branca:'var(--branca)',azul:'var(--azul)'};

(function init(){
  initStars(); db=initFB(); if(!db) return;
  db.ref('fichas').on('value',snap=>{
    const v=snap.val()||{}; DATA={};
    Object.keys(v).filter(k=>!k.startsWith('_')).forEach(k=>DATA[k]=sanitize(v[k]));
    if(sel && !DATA[sel]) closeDrawer();
    renderGrid(); if(sel) renderDrawer();
  }, e=>fbError(e,'Não foi possível ler as fichas'));
  document.addEventListener('click',e=>{ const b=e.target.closest('[data-a]'); if(b && !b.disabled) act(b.dataset.a,b.dataset); });
  document.addEventListener('change',e=>{ const t=e.target; if(t.dataset.i) inp(t.dataset.i,t); });
  document.addEventListener('keydown',e=>{ if(e.key==='Enter' && e.target.classList && e.target.classList.contains('mc')) openDrawer(e.target.dataset.k); if(e.key==='Escape' && !document.querySelector('.modal')) closeDrawer(); });
})();

/* aplica uma alteração em UMA ficha e envia só os campos que mudaram */
function M(fn,label,key=sel){
  const cur=DATA[key]; if(!cur) return;
  const nx=clone(cur); fn(nx); const s=sanitize(nx);
  const p=prepare(flatten(cur),s,'mestre',label); if(!p) return;
  DATA[key]=s; renderGrid(); if(sel===key) renderDrawer(true);
  send(db,key,p).catch(e=>fbError(e,'Não foi possível salvar'));
}

/* ---------- grade ---------- */
function renderGrid(){
  const keys=Object.keys(DATA).sort();
  $('grid').innerHTML=keys.length?keys.map(k=>{ const s=DATA[k], st=hpState(s), lk=s.travas.todos||ATTRS.some(a=>s.travas.attrs[a]);
    return `<article class="mc ${st?'s-'+st:''}" data-a="open" data-k="${k}" tabindex="0" role="button">
      <div class="mc-radar">${radarSVG(ATTRS.map(a=>s.attrs[a]),{mini:true,id:'m'+k})}</div>
      <div class="mc-body"><h3>${esc(s.nome||k)}</h3><small>${esc(s.classe||'Sem classe')} · Nível ${s.nivel}</small>
        <div class="mc-hp">${ic('heart')}${s.vidaAtual}<small>/ ${s.vidaMax}</small><small style="margin-left:auto">Defesa ${defesaTotal(s)}</small></div>
        <div class="bar"><i class="fill" style="width:${hpPct(s)}%"></i></div>
        <div class="mc-mana">${['azul','negra','branca','rubra'].map(t=>`<span style="--c:${MC[t]}"><i></i>${s.mana[t].cur}</span>`).join('')}</div>
        <div class="mc-tags">${lk?`<span class="chip">${ic('lock')} travado</span>`:''}${s.buffs.length?`<span class="chip" style="color:var(--buff)">${s.buffs.length} buff</span>`:''}${s.debuffs.length?`<span class="chip" style="color:var(--debuff)">${s.debuffs.length} debuff</span>`:''}</div></div></article>`; }).join('')
    :'<div class="empty">Nenhuma ficha criada ainda. Quando um jogador abrir a ficha, ela aparece aqui.</div>';
}

/* ---------- gaveta de edição ---------- */
function openDrawer(k){
  sel=k; $('scrim').classList.add('on'); $('drawer').classList.add('open');
  if(histOff) histOff(); histOff=histListen(db,k,l=>{ hist=l; const el=$('dhist'); if(el) el.innerHTML=histHTML(); });
  renderDrawer(); $('drawer').scrollTop=0;
}
function closeDrawer(){
  sel=null; $('scrim').classList.remove('on'); $('drawer').classList.remove('open');
  if(histOff){ histOff(); histOff=null; }
}
function histHTML(){
  return hist.length?hist.map((h,i)=>`<div class="h-row ${i?'':'now'}"><div class="h-dot ${h.por}"></div><div class="h-info"><b>${esc(h.resumo||'Alteração')}</b><small>${h.por==='mestre'?'Mestre':'Jogador'} · ${ago(h.ts)}</small></div>${i?`<button class="btn ghost" data-a="restore" data-n="${h.n}">Restaurar</button>`:'<span class="chip">atual</span>'}</div>`).join(''):'<div class="empty">Sem pontos salvos ainda.</div>';
}
function renderDrawer(force){
  const s=DATA[sel], d=$('drawer'); if(!s) return;
  if(!force && d.contains(document.activeElement) && /INPUT|TEXTAREA/.test(document.activeElement.tagName)) return;   // não atrapalha quem está digitando
  const top=d.scrollTop, st=hpState(s);
  d.innerHTML=`
  <div class="dh"><h2>${esc(s.nome||sel)}</h2><button class="ibtn" data-a="close" aria-label="Fechar">${ic('close')}</button></div>
  <div class="dsub"><span>${esc(s.classe||'Sem classe')}</span><a href="index.html?personagem=${encodeURIComponent(sel)}" target="_blank">Abrir ficha do jogador</a></div>

  <div class="dsec" style="margin-top:0"><div class="drow"><span>Nível</span><div class="stp"><button data-a="lvl" data-d="-1" aria-label="menos">−</button><input type="number" min="1" max="${MAX_NIVEL}" value="${s.nivel}" data-i="nivel" aria-label="Nível"><button data-a="lvl" data-d="1" aria-label="mais">+</button></div></div>
    <div class="drow"><span>Vida</span><div class="stp"><button data-a="hp" data-d="-1" aria-label="menos">−</button><input type="number" value="${s.vidaAtual}" data-i="vida" aria-label="Vida atual"><button data-a="hp" data-d="1" aria-label="mais">+</button></div><small style="color:var(--dim)">de ${s.vidaMax}</small></div>
    <div class="bar" style="--hp:${st==='crit'?'#d6334f':st==='low'?'#b9a05a':'#4f9d6e'}"><i class="fill" style="width:${hpPct(s)}%"></i></div>
    <div class="v-btns"><button data-a="hp" data-d="-10">−10</button><button data-a="hp" data-d="-5">−5</button><button data-a="hp" data-d="5">+5</button><button data-a="hp" data-d="10">+10</button><button class="wide" data-a="hpfull">Restaurar</button></div>
    <div class="drow" style="margin-top:14px"><span>Defesa bônus</span><div class="stp sm"><button data-a="defb" data-d="-1">−</button><input type="number" value="${s.defesaBonus}" data-i="defb"><button data-a="defb" data-d="1">+</button></div></div></div>

  <div class="dsec"><h3>Rolagem e atributos</h3>
    <div class="lockbox ${s.travas.todos?'on':''}">${ic(s.travas.todos?'lock':'unlock')}<div><b>Travar reroll de todos os atributos</b><small>O jogador não rola de novo nem digita valores.</small></div><button class="btn ${s.travas.todos?'gold':''}" data-a="lockchar">${s.travas.todos?'Travado':'Travar'}</button></div>
    <div class="dattrs">${ATTRS.map(k=>`<div class="da"><label for="a-${k}">${ATTR_LABELS[k]}</label><input id="a-${k}" type="number" value="${s.attrs[k]}" data-i="attr" data-k="${k}"><button class="${s.travas.attrs[k]?'on':''}" data-a="lockattr" data-k="${k}" title="${s.travas.attrs[k]?'Liberar':'Travar'} só este atributo" aria-label="Travar ${ATTR_LABELS[k]}">${ic(s.travas.attrs[k]?'lock':'unlock')}</button><button class="ibtn" data-a="reroll" data-k="${k}" title="Rolar de novo (d20+4)" aria-label="Rolar ${ATTR_LABELS[k]}">${ic('dice')}</button></div>`).join('')}</div></div>

  <div class="dsec"><h3>Mana</h3><div class="dmana">${MANA_TYPES.map(t=>{ const mx=manaMax(s,t); return `<div class="dm" style="--c:${MC[t]}"><b>${MANA_LABELS[t]}</b><em>${s.mana[t].cur}${mx!==null?'/'+mx:''}</em><div class="v-btns"><button data-a="mana" data-t="${t}" data-d="-5">−5</button><button data-a="mana" data-t="${t}" data-d="5">+5</button>${mx!==null?`<button data-a="manafull" data-t="${t}">Cheia</button>`:''}</div></div>`; }).join('')}</div></div>

  <div class="dsec"><h3>Inventário <button class="btn gold" style="margin-left:auto" data-a="inv-new">Dar item</button></h3>
    ${s.inventory.length?s.inventory.map(it=>`<div class="ditem"><div><b>${esc(it.nome)}</b><small>${esc((CATS.find(c=>c[0]===it.cat)||[0,'Diversos'])[1])}${it.desc?' · '+esc(it.desc):''}</small></div><div class="stp sm"><button data-a="iqty" data-id="${it.id}" data-d="-1">−</button><input type="number" min="0" value="${it.qtd}" data-i="iqty" data-id="${it.id}"><button data-a="iqty" data-id="${it.id}" data-d="1">+</button></div><button class="ibtn" data-a="inv-edit" data-id="${it.id}" aria-label="Editar">${ic('edit')}</button></div>`).join(''):'<div class="empty">Inventário vazio.</div>'}</div>

  <div class="dsec"><h3>Estados <button class="btn ghost" style="margin-left:auto" data-a="bd-new" data-kind="buffs">+ Buff</button><button class="btn ghost" data-a="bd-new" data-kind="debuffs">+ Debuff</button></h3>
    ${[...s.buffs.map((b,i)=>['buffs',b,i]),...s.debuffs.map((b,i)=>['debuffs',b,i])].map(([k,b,i])=>`<div class="ditem ${k}"><div><b>${esc(b.nome)}</b><small>${esc(b.desc)}${b.dur?' · '+esc(b.dur):''}</small></div><button class="ibtn" data-a="bd-edit" data-kind="${k}" data-i="${i}" aria-label="Editar">${ic('edit')}</button></div>`).join('')||'<div class="empty">Nenhum estado ativo.</div>'}</div>

  <div class="dsec"><h3>Histórico e rollback</h3><div class="dhist" id="dhist">${histHTML()}</div></div>`;
  d.scrollTop=top;
}

/* ---------- ações ---------- */
function act(a,d){
  const D=num(d.d);
  if(a==='open') return openDrawer(d.k);
  if(a==='close') return closeDrawer();
  if(a==='lockall'||a==='unlockall'){
    const v=a==='lockall'; if(!confirm(v?'Travar a rolagem de TODOS os personagens?':'Liberar a rolagem de todos?')) return;
    Object.keys(DATA).forEach(k=>M(s=>{ s.travas.todos=v; },v?'Rolagem travada':'Rolagem liberada',k)); return;
  }
  if(a==='lvl') return M(s=>{ s.nivel=clamp(s.nivel+D,1,MAX_NIVEL); });
  if(a==='hp') return M(s=>{ s.vidaAtual=clamp(s.vidaAtual+D,0,s.vidaMax); });
  if(a==='hpfull') return M(s=>{ s.vidaAtual=s.vidaMax; });
  if(a==='defb') return M(s=>{ s.defesaBonus+=D; });
  if(a==='lockchar') return M(s=>{ s.travas.todos=!s.travas.todos; });
  if(a==='lockattr') return M(s=>{ s.travas.attrs[d.k]=!s.travas.attrs[d.k]; });
  if(a==='reroll') return M(s=>{ s.attrs[d.k]=d20()+4; });
  if(a==='mana') return M(s=>{ const m=manaMax(s,d.t); let n=Math.max(0,s.mana[d.t].cur+D); if(m!==null) n=Math.min(m,n); s.mana[d.t].cur=n; });
  if(a==='manafull') return M(s=>{ s.mana[d.t].cur=manaMax(s,d.t); });
  if(a==='iqty') return M(s=>{ const it=s.inventory.find(x=>x.id===d.id); it.qtd=Math.max(0,it.qtd+D); });
  if(a==='inv-new') return modalItem(null);
  if(a==='inv-edit') return modalItem(DATA[sel].inventory.find(x=>x.id===d.id));
  if(a==='bd-new') return modalBD(d.kind,-1);
  if(a==='bd-edit') return modalBD(d.kind,+d.i);
  if(a==='restore'){ const h=hist.find(x=>x.n===+d.n); if(h && confirm('Restaurar esta ficha para o ponto selecionado?')) M(s=>Object.assign(s,restored(s,h.estado,true)),'Restaurado pelo Mestre: '+(h.resumo||'ponto anterior')); }
}
function inp(kind,t){
  const v=t.value;
  M(s=>{
    if(kind==='nivel') s.nivel=clamp(parseInt(v)||1,1,MAX_NIVEL);
    else if(kind==='vida') s.vidaAtual=clamp(num(v),0,s.vidaMax);
    else if(kind==='defb') s.defesaBonus=num(v);
    else if(kind==='attr') s.attrs[t.dataset.k]=num(v);
    else if(kind==='iqty') s.inventory.find(x=>x.id===t.dataset.id).qtd=Math.max(0,num(v));
  });
}
function modalItem(it){
  openModal({title:it?'Editar item':'Dar item ao jogador',okText:it?'Salvar':'Entregar',
    fields:[{k:'nome',label:'Nome'},{k:'qtd',label:'Quantidade',type:'qty'},{k:'cat',label:'Categoria',type:'select',opts:CATS,def:'diversos'},{k:'desc',label:'Descrição',type:'area'}],
    values:it||{qtd:1}, onDelete:it?()=>{ if(confirm(`Remover “${it.nome}”?`)) M(s=>{ s.inventory=s.inventory.filter(x=>x.id!==it.id); }); }:null,
    onSave:v=>M(s=>{ if(it) Object.assign(s.inventory.find(x=>x.id===it.id),v); else s.inventory.push({id:uid(),...v}); })});
}
function modalBD(kind,i){
  const b=DATA[sel][kind][i], nm=kind==='buffs'?'buff':'debuff';
  openModal({title:b?`Editar ${nm}`:`Novo ${nm}`,okText:b?'Salvar':'Aplicar',
    fields:[{k:'nome',label:'Nome'},{k:'dur',label:'Duração (ex: 3 rodadas)'},{k:'desc',label:'Efeito',type:'area'}],
    values:b||{}, onDelete:b?()=>M(s=>{ s[kind].splice(i,1); }):null,
    onSave:v=>M(s=>{ if(b) s[kind][i]=v; else s[kind].push(v); })});
}

function initStars(){
  const c=$('starfield'), x=c.getContext('2d'); let w,h;
  const size=()=>{ w=c.width=innerWidth; h=c.height=innerHeight; }; size(); addEventListener('resize',size);
  const S=Array.from({length:120},()=>({x:Math.random(),y:Math.random(),r:Math.random()*1.2+.2,a:Math.random()*6,v:Math.random()*.012+.003}));
  (function tick(){ x.clearRect(0,0,w,h); S.forEach(s=>{ s.a+=s.v; x.fillStyle=`rgba(227,198,107,${.25+.5*Math.abs(Math.sin(s.a))})`; x.beginPath(); x.arc(s.x*w,s.y*h,s.r,0,7); x.fill(); }); requestAnimationFrame(tick); })();
}
