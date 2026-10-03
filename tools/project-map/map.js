// 純離線 DOM / SVG；不呼叫產品 API，也不依賴外部程式庫。
const $ = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const layerLabels = DATA.layers;
const state = {flow:DATA.flows[0],selected:null,view:'graph',query:'',source:null,scale:1,x:0,y:0,fitted:true};
const cardSize = {width:276,height:196};
document.documentElement.dataset.product=DATA.meta.product;
document.documentElement.dataset.theme=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';
function renderTheme() { $('theme-toggle').textContent=document.documentElement.dataset.theme==='dark'?'亮色':'深色'; }
$('theme-toggle').onclick=()=>{document.documentElement.dataset.theme=document.documentElement.dataset.theme==='dark'?'light':'dark';renderTheme();};
renderTheme();
function icon(name) { return DATA.icons[name]; }
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
  let sectionGap=0;
  return state.flow.nodes.map((node,i)=>{
    if(i>0&&node.pathStart)sectionGap+=100;
    if(window.innerWidth<=640) return {x:0,y:i*316+sectionGap};
    return {x:i*456+sectionGap,y:0};
  });
}
function dimensions() {
  const points=positions();
  return {width:Math.max(...points.map(p=>p.x))+cardSize.width,height:Math.max(...points.map(p=>p.y))+cardSize.height};
}
function edgeMarkup(edge,points) {
  const a=points[edge.from],b=points[edge.to];
  const mobile=window.innerWidth<=640;
  const start=mobile?{x:a.x+cardSize.width/2,y:a.y+cardSize.height}:{x:a.x+cardSize.width,y:a.y+cardSize.height/2};
  const end=mobile?{x:b.x+cardSize.width/2,y:b.y}:{x:b.x,y:b.y+cardSize.height/2};
  const lines=wrapLabel(edge.label,mobile?10:14);
  const labelX=mobile?start.x+14:(start.x+end.x)/2;
  const labelY=mobile?(start.y+end.y)/2-(lines.length-1)*7:start.y-12-(lines.length-1)*14;
  const spans=lines.map((line,i)=>'<tspan x="'+labelX+'" y="'+(labelY+i*14)+'">'+esc(line)+'</tspan>').join('');
  return '<path class="connection'+(edge.async?' async':'')+'" data-from="'+edge.from+'" data-to="'+edge.to+'" d="M'+start.x+','+start.y+' L'+end.x+','+end.y+'" marker-end="url(#arrow)"/><text class="edge-label" text-anchor="'+(mobile?'start':'middle')+'"><title>'+esc(edge.label)+'</title>'+spans+'</text>';
}
function wrapLabel(text,width) {
  const lines=[];let line='',units=0;
  for(const character of text) {
    const size=character.codePointAt(0)<=127 ? 0.55 : 1;
    if(units+size>width&&line){lines.push(line.trim());line='';units=0;}
    line+=character;units+=size;
  }
  if(line)lines.push(line.trim());
  return lines;
}
function renderGraph() {
  const points=positions(),size=dimensions();
  $('cards').innerHTML=state.flow.nodes.map((n,i)=>{
    const step=n.pathStep||i+1,split=n.title.indexOf('：');
    const title=split<0?'<span class="node-task">'+esc(n.title)+'</span>':'<span class="node-owner">'+esc(n.title.slice(0,split))+'</span><span class="node-task">'+esc(n.title.slice(split+1))+'</span>';
    return (n.pathStart?'<div class="path-label" style="left:'+points[i].x+'px;top:'+(points[i].y-48)+'px">'+esc(n.pathTitle)+'</div>':'')+'<button class="node" data-node="'+i+'" style="left:'+points[i].x+'px;top:'+points[i].y+'px" aria-pressed="false" aria-label="'+esc('步驟 '+step+'：'+n.title)+'"><span class="node-meta"><span>'+step+'</span><span class="layer '+n.layer+'">'+layerLabels[n.layer]+'</span></span><span class="node-title">'+title+'</span><span class="node-text">'+esc(n.text)+'</span></button>';
  }).join('');
  $('connections').setAttribute('width',size.width);
  $('connections').setAttribute('height',size.height);
  $('connections').innerHTML='<defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0L8 4L0 8" fill="context-stroke"/></marker></defs>'+state.flow.edges.map(e=>edgeMarkup(e,points)).join('');
  paintSelection();
}
function paintSelection() {
  $('cards').querySelectorAll('.node').forEach((card,i)=>{card.classList.toggle('selected',i===state.selected);card.setAttribute('aria-pressed',String(i===state.selected));});
  $('connections').querySelectorAll('.connection').forEach(edge=>edge.classList.toggle('current',state.selected!==null&&(Number(edge.dataset.from)===state.selected||Number(edge.dataset.to)===state.selected)));
}
function selectFlow(id) {
  state.flow=DATA.flows.find(f=>f.id===id);
  state.view='graph'; state.source=null; state.selected=null;
  closeInspector(); $('document').hidden=true; $('canvas').hidden=false;
  $('flow-title').textContent=state.flow.title;
  $('flow-summary').textContent=state.flow.summary;
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
  state.y=window.innerWidth<=640?156:Math.max(172,(area.height-cardSize.height)/2-12);
  applyCamera(true);
}
function centerNode(index=state.selected) {
  const point=positions()[index],area=viewport();
  state.x=(area.width-cardSize.width*state.scale)/2-point.x*state.scale;
  state.y=(window.innerWidth<=640?Math.max(88,(area.height-cardSize.height*state.scale)/2-24):(area.height-cardSize.height*state.scale)/2-24)-point.y*state.scale;
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
  $('inspector-context').textContent=state.flow.title+(n.pathTitle?' · '+n.pathTitle:'')+' · 步驟 '+(n.pathStep||index+1);
  let html='<h2>'+esc(n.title)+'</h2><p>'+esc(n.text)+'</p>';
  if (n.code) html+='<pre class="sql-snippet">'+esc(n.code)+'</pre>';
  if (state.flow.setting) {
    const s=DATA.settings.find(s=>s.key===state.flow.setting);
    html+=detail('這個設定',paragraphs([s.key,'儲存：'+s.store,...(s.initial!==undefined?['程式初值：'+String(s.initial)+'；允許範圍：'+s.range]:[])]));
  }
  if (n.details) for (const d of n.details) html+=detail(d.title,paragraphs([d.text]));
  if (n.model) {
    const m=DATA.models.find(m=>m.name===n.model);
    html+=detail('資料表／View',paragraphs([m.name+' · '+m.title]));
    html+=detail('身份鍵與時間條件',paragraphs(['身份鍵：'+m.key,m.lifecycle]));
    html+=detail('完整欄位 · '+m.columns.length+' 欄','<table class="model-fields"><thead><tr><th scope="col">欄位</th><th scope="col">型別</th></tr></thead><tbody>'+m.columns.map(c=>'<tr><td><code>'+esc(c.name)+'</code></td><td><code>'+esc(c.type)+'</code></td></tr>').join('')+'</tbody></table>');
    html+=detail('資料關聯',paragraphs(m.foreignKeys.length?m.foreignKeys.map(k=>'FK：'+k.label+'；ON DELETE '+k.delete):[DATA.meta.product==='novae'||m.origin==='d1'?'目前 schema 沒有此模型的實體 FK；其他關係見程式來源。':'此模型使用程式身份參照，沒有 SQL FK。']));
    if(m.related.length)html+=paragraphs(['程式關聯：'+m.related.join('、')]);
  }
  if (state.flow.rateGroup) html+=detail('觸發此 action',paragraphs([state.flow.id+' · '+state.flow.rateGroup,state.flow.permission?'固定權限：'+state.flow.permission:'目標權限由 domain handler 檢查。']));
  if (n.refs?.length) html+=detail('對照原碼快照',sourceLinks(n.refs));
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
  $('previous').textContent=n.pathStart&&index>0?'上一段':topology?'上一節點':'上一步';
  $('next').textContent=state.flow.nodes[index+1]?.pathStart?'下一段':topology?'下一節點':'下一步';
  $('step-count').value=(n.pathStep||index+1)+' / '+(n.pathLength||state.flow.nodes.length);
}
function selectNode(index,{center=true}={}) {
  state.selected=index;
  $('inspector').hidden=false; $('workspace').classList.add('inspecting');
  paintSelection();
  $('locate').disabled=false;
  renderInspector();
  if(center)requestAnimationFrame(()=>{state.scale=Math.max(state.scale,.9);state.fitted=false;centerNode(index);});
  $('announce').textContent=state.flow.nodes[index].title+'；已開啟右側解說。';
}
function closeInspector() {
  $('inspector').hidden=true; $('workspace').classList.remove('inspecting');
  state.selected=null; $('locate').disabled=true;
  paintSelection();
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
  let html='<h2>完整盤點與版本範圍</h2><p>'+esc(DATA.inventory.intro)+'</p>';
  html+='<section class="inventory-group"><h3>快照與更新方法</h3>'+paragraphs(['程式版本：'+DATA.meta.head,'產生時間：'+DATA.meta.date+'（臺灣）',DATA.meta.scope,'重新產生：'+DATA.meta.regenerate,'資料來自已追蹤程式碼、設定契約及 migrations；不讀 .env、secret、資料庫或個人 seed。Wrangler 連線 ID 已省略。'])+'</section>';
  for(const section of DATA.inventory.sections) html+='<section class="inventory-group"><h3>'+esc(section.title)+'</h3>'+paragraphs(section.paragraphs)+(section.headers?table(section.headers,section.rows):'')+'</section>';
  html+='<section class="inventory-group"><h3>HTTP 與 WebSocket 入口</h3>'+table(['入口','方法','責任'],DATA.endpoints.map(e=>e.slice(0,3)))+'</section>';
  html+='<section class="inventory-group"><h3>Next.js page 路由 · '+DATA.routes.length+'</h3>'+table(['路由','原碼','呈現'],DATA.routes.map(r=>[r.route,r.path,r.sheet?'攔截詳情 sheet':'page']))+'</section>';
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
  $('nav-footer').innerHTML='<details><summary>原碼快照 '+DATA.meta.head.slice(0,8)+'</summary>'+paragraphs([DATA.meta.date+'（臺灣）',DATA.meta.stats,DATA.meta.scope,'更新指令：'+DATA.meta.regenerate])+'</details>';
renderNavigation();selectFlow('overview');
