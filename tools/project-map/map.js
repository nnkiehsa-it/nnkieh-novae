// 純離線 DOM / SVG；不呼叫產品 API，也不依賴外部程式庫。
const $ = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const layerLabels = {browser:'瀏覽器',worker:'Worker / DO',database:'PostgreSQL',async:'背景工作',external:'外部服務',build:'建置 / 部署'};
const state = {flow:DATA.flows[0],selected:null,view:'graph',query:'',source:null,scale:1,x:0,y:0,fitted:true};
const cardSize = {width:276,height:176};
const icons = {
  close:'<path d="m5 5 14 14M19 5 5 19"/>',
  menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',
  plus:'<path d="M5 12h14M12 5v14"/>',
  minus:'<path d="M5 12h14"/>',
};
function icon(name) { return '<svg viewBox="0 0 24 24" aria-hidden="true">'+icons[name]+'</svg>'; }
for (const [id,name] of [['close-nav','close'],['close-inspector','close'],['clear-search','close'],['open-nav','menu'],['zoom-in','plus'],['zoom-out','minus']]) $(id).innerHTML=icon(name);

const flowSearch = new Map(DATA.flows.map(f=>[f.id,[f.title,f.summary,f.section,f.id,f.logic,f.db,f.entry,...(f.id.startsWith('trigger:')||f.setting?[]:f.nodes.map(n=>n.text))].join(' ').toLowerCase()]));
const sources = Object.keys(DATA.sources).sort();
const openGroups = new Set(['程式架構']);
const openSections = new Set();
function navButton(id,title,subtitle='') {
  return '<button class="nav-item'+(state.view==='graph'&&state.flow.id===id?' active':'')+'" data-flow="'+esc(id)+'"'+(state.view==='graph'&&state.flow.id===id?' aria-current="true"':'')+'>'+esc(title)+(subtitle?'<small>'+esc(subtitle)+'</small>':'')+'</button>';
}
function renderNavigation() {
  const q=state.query.toLowerCase().trim();
  const matching=DATA.flows.filter(f=>!q||flowSearch.get(f.id).includes(q));
  let html='';
  for (const group of DATA.groups.filter(g=>g!=='原碼與盤點')) {
    const entries=matching.filter(f=>f.group===group);
    if (!entries.length) continue;
    const sections=[...new Set(entries.map(f=>f.section||''))];
    let body='';
    for (const section of sections) {
      const items=entries.filter(f=>(f.section||'')===section);
      const buttons=items.map(f=>navButton(f.id,f.title,f.rateGroup?f.id:f.setting?f.setting:'')).join('');
      const key=group+'|'+section;
      body+=section?'<details class="nav-section" data-section="'+esc(key)+'"'+(q||openSections.has(key)?' open':'')+'><summary>'+esc(section)+'<span class="count">'+items.length+'</span></summary>'+buttons+'</details>':buttons;
    }
    html+='<details class="nav-group" data-group="'+esc(group)+'"'+(q||openGroups.has(group)?' open':'')+'><summary>'+esc(group)+'<span class="count">'+entries.length+'</span></summary>'+body+'</details>';
  }
  const sourceMatches=q?sources.filter(p=>p.toLowerCase().includes(q)||DATA.sources[p].text.toLowerCase().includes(q)):sources;
  const inventoryMatches=!q||'完整盤點路由api時間anchors'.includes(q);
  if (sourceMatches.length||inventoryMatches) {
    html+='<details class="nav-group" data-group="原碼與盤點"'+(q||openGroups.has('原碼與盤點')?' open':'')+'><summary>原碼與盤點<span class="count">'+sourceMatches.length+'</span></summary>';
    if (inventoryMatches) html+='<button class="nav-item'+(state.view==='inventory'?' active':'')+'" data-inventory>完整盤點與版本範圍</button>';
    html+='<details class="nav-section" data-section="source-index"'+(q||openSections.has('source-index')?' open':'')+'><summary>原碼快照<span class="count">'+sourceMatches.length+'</span></summary>'+sourceMatches.map(p=>'<button class="nav-item'+(state.view==='source'&&state.source===p?' active':'')+'" data-source="'+esc(p)+'">'+esc(p)+'</button>').join('')+'</details></details>';
  }
  $('nav-tree').innerHTML=html||'<p class="empty-search">找不到相符項目。換個操作、欄位或檔名搜尋。</p>';
  $('clear-search').hidden=!state.query;
  $('nav-tree').querySelectorAll('details').forEach(details=>details.addEventListener('toggle',()=>{
    if (state.query) return;
    const set=details.dataset.group?openGroups:openSections;
    const key=details.dataset.group||details.dataset.section;
    if (details.open) set.add(key); else set.delete(key);
  }));
}
function closeNavigation() { $('navigation').classList.remove('open'); $('nav-scrim').hidden=true; $('navigation').inert=window.innerWidth<=640; }
function openNavigation() { $('navigation').inert=false; $('navigation').classList.add('open'); $('nav-scrim').hidden=false; $('search').focus(); }
$('open-nav').onclick=openNavigation;
$('close-nav').onclick=closeNavigation;
$('nav-scrim').onclick=closeNavigation;
$('search').oninput=event=>{state.query=event.target.value;renderNavigation();};
$('clear-search').onclick=()=>{state.query='';$('search').value='';renderNavigation();$('search').focus();};
$('nav-tree').onclick=event=>{
  const button=event.target.closest('button');
  if (!button) return;
  if (button.dataset.flow) selectFlow(button.dataset.flow);
  else if (button.dataset.source) showSource(button.dataset.source,1,false);
  else if (button.hasAttribute('data-inventory')) showInventory();
  closeNavigation();
};

function positions() {
  return state.flow.nodes.map((_,i)=>{
    if(window.innerWidth<=640) return {x:0,y:i*250};
    return {x:i*370,y:0};
  });
}
function dimensions() {
  const points=positions();
  return {width:Math.max(...points.map(p=>p.x))+cardSize.width,height:Math.max(...points.map(p=>p.y))+cardSize.height};
}
function edgeMarkup(edge,points) {
  const a=points[edge.from],b=points[edge.to];
  const ac={x:a.x+cardSize.width/2,y:a.y+cardSize.height/2};
  const bc={x:b.x+cardSize.width/2,y:b.y+cardSize.height/2};
  let start,end,d;
  if(Math.abs(edge.to-edge.from)>1) {
    // 關係圖的跨節點連線繞過卡片；操作順序本身仍只有向右／向下。
    const lane=window.innerWidth<=640?28+((edge.from+edge.to)%4)*8:56+((edge.from+edge.to)%4)*28;
    if(window.innerWidth<=640) {
      start={x:a.x+cardSize.width,y:ac.y};end={x:b.x+cardSize.width,y:bc.y};
      d=`M${start.x},${start.y} C${start.x+lane},${start.y} ${end.x+lane},${end.y} ${end.x},${end.y}`;
    } else {
      start={x:ac.x,y:a.y+cardSize.height};end={x:bc.x,y:b.y+cardSize.height};
      d=`M${start.x},${start.y} C${start.x},${start.y+lane} ${end.x},${end.y+lane} ${end.x},${end.y}`;
    }
  } else if (Math.abs(bc.x-ac.x)>Math.abs(bc.y-ac.y)) {
    const direction=bc.x>ac.x?1:-1;
    start={x:ac.x+direction*cardSize.width/2,y:ac.y};
    end={x:bc.x-direction*cardSize.width/2,y:bc.y};
    const bend=Math.max(38,Math.abs(end.x-start.x)/2);
    d=`M${start.x},${start.y} C${start.x+direction*bend},${start.y} ${end.x-direction*bend},${end.y} ${end.x},${end.y}`;
  } else {
    const direction=bc.y>ac.y?1:-1;
    start={x:ac.x,y:ac.y+direction*cardSize.height/2};
    end={x:bc.x,y:bc.y-direction*cardSize.height/2};
    const bend=Math.max(38,Math.abs(end.y-start.y)/2);
    d=`M${start.x},${start.y} C${start.x},${start.y+direction*bend} ${end.x},${end.y-direction*bend} ${end.x},${end.y}`;
  }
  const labelX=window.innerWidth<=640&&Math.abs(edge.to-edge.from)>1?cardSize.width-24:(start.x+end.x)/2;
  const labelY=(start.y+end.y)/2-8;
  return '<path class="connection'+(edge.async?' async':'')+'" d="'+d+'" marker-end="url(#arrow)"/><text class="edge-label" x="'+labelX+'" y="'+labelY+'">'+esc(edge.label)+'</text>';
}
function renderGraph() {
  const points=positions(),size=dimensions();
  $('cards').innerHTML=state.flow.nodes.map((n,i)=>'<button class="node" data-node="'+i+'" style="left:'+points[i].x+'px;top:'+points[i].y+'px" aria-pressed="false" aria-label="'+esc((state.flow.kind==='topology'?'節點 ':'步驟 ')+(i+1)+'：'+n.title)+'"><span class="node-meta">'+(state.flow.kind==='topology'?'':'<span>'+(i+1)+'</span>')+'<span class="layer '+n.layer+'">'+layerLabels[n.layer]+'</span></span><span class="node-title">'+esc(n.title)+'</span><span class="node-text">'+esc(n.text)+'</span></button>').join('');
  $('connections').setAttribute('width',size.width);
  $('connections').setAttribute('height',size.height);
  $('connections').innerHTML='<defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0L8 4L0 8" fill="#8c9cab"/></marker></defs>'+state.flow.edges.map(e=>edgeMarkup(e,points)).join('');
}
function selectFlow(id) {
  state.flow=DATA.flows.find(f=>f.id===id);
  state.view='graph'; state.source=null; state.selected=null;
  closeInspector(); $('document').hidden=true; $('canvas').hidden=false;
  renderGraph(); renderNavigation();
  requestAnimationFrame(()=>{
    startGraph();
  });
  $('announce').textContent='已開啟 '+state.flow.title+'；點選卡片查看解說。';
}
function viewport() {
  const rect=$('canvas').getBoundingClientRect();
  const height=rect.height-(window.innerWidth<=640&&!$('inspector').hidden?$('inspector').offsetHeight+24:0);
  const width=rect.width-(window.innerWidth>640&&!$('inspector').hidden?$('inspector').offsetWidth+48:0);
  return {width,height};
}
function applyCamera(smooth=false) {
  $('world').classList.toggle('camera-motion',smooth);
  $('world').style.transform=`translate(${state.x}px,${state.y}px) scale(${state.scale})`;
  $('zoom-level').value=Math.round(state.scale*100)+'%';
}
function fitGraph() {
  const size=dimensions(),area=viewport();
  state.scale=Math.min(1,(area.width-64)/size.width,(area.height-112)/size.height);
  state.scale=Math.max(.15,state.scale);
  state.x=(area.width-size.width*state.scale)/2;
  state.y=(area.height-64-size.height*state.scale)/2;
  state.fitted=true; applyCamera(true);
}
function startGraph() {
  const area=viewport();
  state.scale=1;state.fitted=false;
  state.x=window.innerWidth<=640?(area.width-cardSize.width)/2:40;
  state.y=window.innerWidth<=640?80:(area.height-cardSize.height)/2-24;
  applyCamera(true);
}
function centerNode(index=state.selected) {
  const point=positions()[index],area=viewport();
  state.x=(area.width-cardSize.width*state.scale)/2-point.x*state.scale;
  state.y=(area.height-cardSize.height*state.scale)/2-point.y*state.scale-24;
  applyCamera(true);
}
function zoom(factor,x,y) {
  const area=viewport(); x??=area.width/2; y??=area.height/2;
  const scale=Math.max(.15,Math.min(2.5,state.scale*factor));
  state.x=x-(x-state.x)*scale/state.scale; state.y=y-(y-state.y)*scale/state.scale;
  state.scale=scale; state.fitted=false; applyCamera();
}
$('fit').onclick=fitGraph;
$('zoom-in').onclick=()=>zoom(1.2);
$('zoom-out').onclick=()=>zoom(1/1.2);
$('locate').onclick=()=>{state.scale=1;state.fitted=false;centerNode();};

function detail(title,html) { return '<section class="detail-section"><h3>'+esc(title)+'</h3>'+html+'</section>'; }
function paragraphs(values) { return values.map(text=>'<p>'+esc(text)+'</p>').join(''); }
function sourceLinks(refs) {
  return [...new Map(refs.map(r=>[r.path+':'+r.line,r])).values()].map(r=>'<button class="source-link" data-ref="'+esc(r.path)+'" data-line="'+r.line+'">'+esc(r.path)+':'+r.line+'</button>').join('');
}
function renderInspector() {
  const index=state.selected,n=state.flow.nodes[index];
  $('inspector-context').textContent=state.flow.title+' · '+(state.flow.kind==='topology'?'節點':'步驟')+' '+(index+1);
  let html='<h2>'+esc(n.title)+'</h2><p>'+esc(n.text)+'</p>';
  if (n.code) html+='<pre class="sql-snippet">'+esc(n.code)+'</pre>';
  if (state.flow.setting) {
    const s=DATA.settings.find(s=>s.key===state.flow.setting);
    html+=detail('這個設定',paragraphs([s.key,'儲存：'+s.store,...(s.initial!==undefined?['程式初值：'+String(s.initial)+'；允許範圍：'+s.range]:[])]));
  }
  if (n.details) for (const d of n.details) html+=detail(d.title,paragraphs([d.text]));
  if (n.model) {
    const m=DATA.models.find(m=>m.name===n.model);
    html+=detail('身份鍵與時間條件',paragraphs(['身份鍵：'+m.key,m.lifecycle]));
    html+=detail('完整欄位 · '+m.columns.length+' 欄','<table class="model-fields"><thead><tr><th scope="col">欄位</th><th scope="col">型別</th></tr></thead><tbody>'+m.columns.map(c=>'<tr><td><code>'+esc(c.name)+'</code></td><td><code>'+esc(c.type)+'</code></td></tr>').join('')+'</tbody></table>');
    html+=detail('資料關聯',paragraphs(m.foreignKeys.length?m.foreignKeys.map(k=>'FK：'+k.label+'；ON DELETE '+k.delete):['本卡片列出的關聯由程式解析；沒有從 migrations 盤點到本圖所列的實體 FK。']));
    if(m.related.length)html+=paragraphs(['程式關聯：'+m.related.join('、')]);
  }
  if (state.flow.rateGroup) html+=detail('觸發此 action',paragraphs([state.flow.id+' · '+state.flow.rateGroup,state.flow.permission?'固定權限：'+state.flow.permission:'目標權限由 domain handler 檢查。']));
  if (n.refs?.length) html+=detail('對照最新原碼',sourceLinks(n.refs));
  if (state.flow.notes?.length) html+=detail('生效時機與注意點',paragraphs(state.flow.notes));
  if (state.flow.edges.length) {
    const connections=state.flow.edges.filter(e=>e.from===index||e.to===index);
    if(connections.length)html+=detail('這張卡片的連線',paragraphs(connections.map(e=>state.flow.nodes[e.from].title+' → '+state.flow.nodes[e.to].title+'：'+e.label+(e.async?'（非同步）':''))));
  }
  $('inspector-body').innerHTML=html; $('inspector-body').scrollTop=0;
  $('step-controls').hidden=false;
  $('previous').disabled=index===0;
  $('next').disabled=index===state.flow.nodes.length-1;
  const topology=state.flow.kind==='topology';
  $('previous').textContent=topology?'上一節點':'上一步';
  $('next').textContent=topology?'下一節點':'下一步';
  $('step-count').value=(index+1)+' / '+state.flow.nodes.length;
}
function selectNode(index,{center=true}={}) {
  state.selected=index;
  $('inspector').hidden=false; $('workspace').classList.add('inspecting');
  $('cards').querySelectorAll('.node').forEach((card,i)=>{card.classList.toggle('selected',i===index);card.setAttribute('aria-pressed',String(i===index));});
  $('locate').disabled=false;
  renderInspector();
  if(center)requestAnimationFrame(()=>{state.scale=Math.max(state.scale,.9);state.fitted=false;centerNode(index);});
  $('announce').textContent=state.flow.nodes[index].title+'；已開啟右側解說。';
}
function closeInspector() {
  $('inspector').hidden=true; $('workspace').classList.remove('inspecting');
  state.selected=null; $('locate').disabled=true;
  $('cards').querySelectorAll('.node').forEach(card=>{card.classList.remove('selected');card.setAttribute('aria-pressed','false');});
}
$('close-inspector').onclick=closeInspector;
$('cards').onclick=event=>{const card=event.target.closest('[data-node]');if(card)selectNode(Number(card.dataset.node));};
$('previous').onclick=()=>selectNode(state.selected-1);
$('next').onclick=()=>selectNode(state.selected+1);
$('inspector-body').onclick=event=>{
  const ref=event.target.closest('[data-ref]');
  if(ref)showSource(ref.dataset.ref,Number(ref.dataset.line),true);
  if(event.target.closest('[data-return-card]'))renderInspector();
};

function sourceHtml(path,line) {
  const source=DATA.sources[path];
  return '<h2>'+esc(path)+'</h2><div class="source-meta">'+esc(source.note||'建立地圖當下的原碼快照')+(source.sha256?'<br>SHA-256 '+source.sha256:'')+'</div><div class="source-code">'+source.text.split('\n').map((text,i)=>'<span class="code-line'+(i+1===line?' highlight':'')+'" data-code-line="'+(i+1)+'"><span class="line-number">'+(i+1)+'</span>'+esc(text)+'</span>').join('')+'</div>';
}
function showSource(path,line,insideInspector) {
  const container=insideInspector?$('inspector-body'):$('document');
  if(insideInspector) {
    $('inspector-context').textContent='原碼 · '+path+':'+line;
    container.innerHTML='<button data-return-card>回到卡片解說</button><div class="detail-section">'+sourceHtml(path,line)+'</div>';
  } else {
    closeInspector();state.view='source';state.source=path;$('canvas').hidden=true;container.hidden=false;
    container.innerHTML=sourceHtml(path,line);renderNavigation();
  }
  container.querySelector('[data-code-line="'+line+'"]').scrollIntoView({block:'center',inline:'nearest'});
}
function table(headers,rows) {
  return '<table><thead><tr>'+headers.map(h=>'<th scope="col">'+esc(h)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(row=>'<tr>'+row.map(c=>'<td>'+esc(c)+'</td>').join('')+'</tr>').join('')+'</tbody></table>';
}
function showInventory() {
  closeInspector();state.view='inventory';$('canvas').hidden=true;$('document').hidden=false;
  let html='<h2>完整盤點與版本範圍</h2><p>'+DATA.meta.actionCount+' 個 registry actions、'+DATA.settings.length+' 組設定、'+DATA.meta.modelCount+' 個表／view、'+DATA.meta.triggerCount+' 個現存 triggers。每個 action、設定、模型與 trigger 都有左側入口。端點與路由是不同層，不能把同名 page 計為新 action。</p>';
  html+='<section class="inventory-group"><h3>快照與更新方法</h3>'+paragraphs(['程式版本：'+DATA.meta.head,'產生時間：'+DATA.meta.date+'（臺灣）',DATA.meta.scope,'重新產生：'+DATA.meta.regenerate,'資料來自已追蹤程式碼、設定契約及 migrations；不讀 .env、secret、資料庫或個人 seed。Wrangler 連線 ID 已省略。'])+'</section>';
  html+='<section class="inventory-group"><h3>本次大變更 · 0054–0059</h3>'+paragraphs(['管理設定與規則儲存核對版本，衝突保留草稿；分類嚴格驗型別與可見性身份。','0054 保留變更只處理選定 cleanupScopes；0055 通知 expiry 回到事件時間，未完成修復可接續。','帳號規則以 target_type+uid 複合鍵儲存／清理，0058 跳過被續期交易鎖住的列。','saveScopeMembers 整批授權／撤銷，回完整名單 revision；0059 只 reconcile 被編輯帳號正式管理員身份。','管理七區以摘要→選區域→編輯，區域切換保留草稿；活動分頁失敗保留紀錄和同游標重試；容量頁重開做完整讀取。'])+'</section>';
  html+='<section class="inventory-group"><h3>HTTP 與 WebSocket 入口</h3>'+table(['入口','方法','責任'],DATA.endpoints.map(e=>e.slice(0,3)))+'</section>';
  html+='<section class="inventory-group"><h3>Next.js page 路由 · '+DATA.routes.length+'</h3>'+table(['路由','原碼','呈現'],DATA.routes.map(r=>['/'+(r.route==='/'?'':r.route),r.path,r.sheet?'攔截詳情 sheet':'page']))+'</section>';
  html+='<section class="inventory-group"><h3>時間邏輯原碼錨點 · '+DATA.timers.length+'</h3><p>這是 timer／到期欄位的原碼索引，不代表每一行都是獨立排程；實際條件從左側「自動化與時間」閱讀。</p>'+table(['原碼位置','時間／到期邏輯'],DATA.timers.map(t=>[t.path+':'+t.line,t.text]))+'</section>';
  $('document').innerHTML=html;$('document').scrollTop=0;renderNavigation();
}

// Pointer Events 同時處理空白拖曳與雙指縮放；卡片點按不會變成拖曳。
const pointers=new Map();let gesture=null;
function distance() {const [a,b]=[...pointers.values()];return Math.hypot(a.x-b.x,a.y-b.y);}
$('canvas').addEventListener('pointerdown',event=>{
  if(event.target.closest('button')||event.button>0)return;
  $('canvas').focus();$('canvas').setPointerCapture(event.pointerId);
  pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
  gesture=pointers.size===2?{distance:distance()}: {x:event.clientX,y:event.clientY,cameraX:state.x,cameraY:state.y};
  $('canvas').classList.add('dragging');state.fitted=false;
});
$('canvas').addEventListener('pointermove',event=>{
  if(!pointers.has(event.pointerId))return;
  pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
  if(pointers.size===2) {
    const nextDistance=distance(),rect=$('canvas').getBoundingClientRect(),points=[...pointers.values()];
    zoom(nextDistance/gesture.distance,(points[0].x+points[1].x)/2-rect.left,(points[0].y+points[1].y)/2-rect.top);
    gesture={distance:nextDistance};
  } else {state.x=gesture.cameraX+event.clientX-gesture.x;state.y=gesture.cameraY+event.clientY-gesture.y;applyCamera();}
});
function endPointer(event) {
  pointers.delete(event.pointerId);
  if(pointers.size===1){const point=[...pointers.values()][0];gesture={x:point.x,y:point.y,cameraX:state.x,cameraY:state.y};}
  else if(!pointers.size){gesture=null;$('canvas').classList.remove('dragging');}
}
$('canvas').addEventListener('pointerup',endPointer);$('canvas').addEventListener('pointercancel',endPointer);
$('canvas').addEventListener('wheel',event=>{event.preventDefault();const rect=$('canvas').getBoundingClientRect();zoom(Math.exp(-event.deltaY*.0015),event.clientX-rect.left,event.clientY-rect.top);},{passive:false});
$('canvas').addEventListener('keydown',event=>{
  if(event.target.closest('button'))return;
  if(event.key==='+'||event.key==='='){event.preventDefault();zoom(1.2);}
  else if(event.key==='-'){event.preventDefault();zoom(1/1.2);}
  else if(event.key==='0'){event.preventDefault();fitGraph();}
  else if(state.selected!==null&&event.key==='ArrowRight'){event.preventDefault();selectNode(Math.min(state.flow.nodes.length-1,state.selected+1));}
  else if(state.selected!==null&&event.key==='ArrowLeft'){event.preventDefault();selectNode(Math.max(0,state.selected-1));}
});
document.addEventListener('keydown',event=>{if(event.key==='Escape'){if($('navigation').classList.contains('open'))closeNavigation();else closeInspector();}});
let previousWidth=window.innerWidth;
new ResizeObserver(()=>{
  $('navigation').inert=window.innerWidth<=640&&!$('navigation').classList.contains('open');
  if(state.view!=='graph')return;
  if((previousWidth<=640)!==(window.innerWidth<=640))renderGraph();
  previousWidth=window.innerWidth;
  if(state.selected!==null)centerNode();
  else if(state.fitted)fitGraph();
  else startGraph();
}).observe($('canvas'));
$('nav-footer').innerHTML='<details><summary>快照 '+DATA.meta.head.slice(0,8)+' · '+DATA.meta.actionCount+' actions</summary>'+paragraphs([DATA.meta.date+'（臺灣）',DATA.meta.modelCount+' 模型 · '+DATA.settings.length+' 組設定 · '+DATA.meta.triggerCount+' triggers',DATA.meta.scope,'更新指令：'+DATA.meta.regenerate])+'</details>';
renderNavigation();selectFlow('overview');
