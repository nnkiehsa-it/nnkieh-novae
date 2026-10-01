import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { Script } from 'node:vm';
import { parse as babelParse } from '@babel/parser';
import { actions, flows, groups, categorySettings, policyDescriptions, retentionDescriptions, triggerDescriptions } from './content.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
const output = path.resolve(process.argv[2] || path.join(process.env.USERPROFILE, 'Desktop/Novae-程式流程地圖.html'));
const sourcePaths = git('ls-files', 'src', 'cloudflare/src', 'cloudflare/generated', 'config', 'database/migrations', 'scripts', '.github/workflows', 'next.config.mjs', 'package.json')
  .split('\n').filter(p => /\.(?:ts|tsx|mjs|json|sql|yml|css|cjs)$/.test(p));
// 僅已追蹤程式／設定；不讀 .env、credential、DB、使用者資料或 seed。
const sources = Object.fromEntries(sourcePaths.map(p => [p, { text: read(p), sha256: createHash('sha256').update(read(p)).digest('hex') }]));
const wrangler = JSON.parse(read('cloudflare/wrangler.json'));
const safeWrangler = { ...wrangler, hyperdrive: wrangler.hyperdrive.map(({ binding }) => ({ binding, note: '部署 ID 與連線字串未嵌入' })) };
sources['cloudflare/wrangler.json'] = { text: JSON.stringify(safeWrangler, null, 2), note: '連線設定已省略；其餘是程式快照' };
const ref = (p, anchor) => {
  if (!sources[p]) throw new Error('來源不存在：' + p);
  const line = anchor ? sources[p].text.slice(0, Math.max(0, sources[p].text.indexOf(anchor))).split('\n').length : 1;
  return { path: p, line };
};
const registryPath = 'cloudflare/src/backend/actions/action-registry.ts';
const registry = read(registryPath);
const definitions = [...registry.matchAll(/action\("([^"]+)",\s*"([^"]+)",\s*"([^"]+)"[^\n]*/g)]
  .map(m => ({ id: m[1], domain: m[2], rateGroup: m[3], permission: /requiredPermission: "([^"]+)"/.exec(m[0])?.[1], line: registry.slice(0, m.index).split('\n').length }));
const policies = JSON.parse(read('config/backend-actions.config.json'));
if (definitions.length !== Object.keys(policies).length) throw new Error('action registry 與 config 數量不一致');
for (const d of definitions) if (!actions[d.id] || !policies[d.id]) throw new Error('尚未解說 action：' + d.id);
for (const id of Object.keys(actions)) if (!policies[id]) throw new Error('已移除的 action 解說：' + id);
// 這三個 action 的實作在 users.ts，其他指派操作在 user-access.ts。
for (const id of ['getCurrentUserRole', 'getUserPublicProfiles', 'cacheUserAvatar']) actions[id].refs = ['cloudflare/src/backend/actions/users.ts'];

function parse(p) { return babelParse(sources[p].text, { sourceType: 'module', plugins: ['typescript', 'jsx'] }); }
function visit(node, fn) {
  if (!node || typeof node !== 'object') return;
  if (node.type) fn(node);
  for (const [key, value] of Object.entries(node)) {
    if (['loc','start','end','comments','tokens'].includes(key)) continue;
    if (Array.isArray(value)) value.forEach(child => visit(child, fn));
    else if (value && typeof value === 'object') visit(value, fn);
  }
}
const eventMap = {};
for (const p of sourcePaths.filter(p => p.includes('/backend/events/') && p.endsWith('-events.ts') && !p.endsWith('/domain-events.ts'))) {
  const source = parse(p);
  visit(source, node => {
    if (node.type !== 'SwitchStatement') return;
    const clauses = node.cases;
    clauses.forEach((clause, i) => {
      if (clause.test?.type !== 'StringLiteral') return;
      let body = clause;
      while (!body.consequent.length && i + 1 < clauses.length) body = clauses[++i];
      const events = [];
      visit(body, candidate => {
        if (candidate.type !== 'ObjectExpression') return;
        const field = name => candidate.properties.find(p => p.type === 'ObjectProperty' && (p.key.name || p.key.value) === name)?.value;
        const type = field('eventType'), destinations = field('destinations');
        if (type?.type === 'StringLiteral') events.push({ type: type.value, destinations: destinations?.type === 'ArrayExpression' ? destinations.elements.map(x => x.value) : [] });
      });
      if (sources[p].text.slice(body.start,body.end).includes('resultUpdated(')) events.push({ type: 'issue.result_updated', destinations: ['notion', 'realtime'] });
      eventMap[clause.test.value] = { events, ref: ref(p, sources[p].text.slice(clause.start,clause.start+30)) };
    });
  });
}
const actionReferences = Object.fromEntries(definitions.map(({ id }) => [id, sourcePaths.filter(p => p.startsWith('src/') && !p.includes('/generated/') && (sources[p].text.includes("'" + id + "'") || sources[p].text.includes('"' + id + '"'))).map(p => ref(p, id))]));
const node = (title, text, layer, refs) => ({ title, text, layer, refs });
const actionFlows = definitions.map(d => {
  const a = actions[d.id], readOnly = ['read', 'upload-resolve'].includes(d.rateGroup), policy = policies[d.id];
  const handlerRefs = a.refs.map(p => ref(p, d.id));
  const events = eventMap[d.id]?.events ?? [];
  const nodes = [
    node(a.title, a.entry + '。' + (actionReferences[d.id].length ? '以下來源可檢視 service 呼叫位置。' : '目前沒有直接 browser 呼叫位置；此後端 action 仍保留於 registry。'), 'browser', actionReferences[d.id]),
    node('Service 發出請求', readOnly ? '用目前 UID 的 ID token + App Check 送 POST /v1/actions；依 readTimeoutMs/特定timeout等待。相同讀取可由 service 合併。' : '同 UID/action 冷卻 → 取 ID token/App Check → 以同一 UUID operationId 送 request；timeout/retry 沿用該 ID。', 'browser', [ref('src/services/backend-action.ts', 'invokeBackendAction'), ref('src/lib/request.ts')]),
    node('Worker 驗證身份', 'Origin、App Check、Firebase ID token、native ingress；每次從 DB resolveAuthContext 讀有效限制、角色與 scope。blocked 拒絕受保護請求。', 'worker', [ref('cloudflare/src/index.ts', 'async function handleAction'), ref('cloudflare/src/backend/actions/auth.ts')]),
    node('操作權限與配額', (d.permission ? 'Registry 必須有 ' + d.permission + '。' : 'Registry 沒有固定 permission；domain handler 檢查自己的 owner/scope/身份規則。') + 'read_only/reaction_only 依 accessClass 限制。每 UID 的 ' + d.rateGroup + ' 10 秒 burst。' + (policy.extraLimit ? '另有 ' + policy.extraLimit + (policy.unitsPath ? '，按圖片張數扣額。' : '。') : ''), 'worker', [ref(registryPath, 'action("' + d.id + '"'), ref('cloudflare/src/backend/actions/execution.ts'), ref('cloudflare/src/backend/actions/rate-limit.ts')]),
    node('此操作的業務規則', a.logic, 'worker', handlerRefs),
    node(readOnly ? '資料讀取' : '交易中的資料變更', a.db + '。' + (readOnly ? 'read/upload-resolve 不 claim operation，也不開 mutation transaction。' : '先 claim_operation；已完成則重播舊 response，執行中回 request-in-progress，過期回 operation-expired；變更、audit、event、complete_operation 同 transaction。'), 'database', [...handlerRefs, ref('cloudflare/src/backend/actions/execution.ts', 'client.transaction')]),
    node('原發起畫面收到結果', 'NDJSON start/part/end；失敗可以是 HTTP error 或串流 error。service 驗仍是同一 Firebase User，舊 session 回應不套入。' + a.effect, 'browser', [ref('src/services/backend-action.ts', 'async function readAnswer'), ...actionReferences[d.id].slice(0, 3)]),
  ];
  if (!readOnly) {
    if (!eventMap[d.id]) throw new Error('缺事件盤點：' + d.id);
    nodes.push(node('提交後的非同步工作', events.length ? events.map(e => e.type + ' → ' + (e.destinations.join(' / ') || '只有事件紀錄，無外部destination')).join('；') + '。admin-write 另記 admin.audit_recorded → Notion。成功寫入由 Worker 送 drain；背景完成可晚於原畫面成功。' : '這個 action 沒有額外 domain delivery。admin-write 仍會寫管理 audit 與 admin.audit_recorded → Notion；成功 write 仍會喚醒 drain 處理待辦。', 'async', [eventMap[d.id].ref, ref('cloudflare/src/backend/jobs/consumer.ts')]));
  }
  return { ...a, ...d, id: d.id, summary: a.logic, timing: a.timing, nodes, refs: undefined, edges: nodes.slice(1).map((_, i) => ({ from: i, to: i + 1, label: i === 6 ? '提交後非同步' : '接著', async: i === 6 })), notes: [a.timing, ...(events.some(e => e.destinations.includes('realtime')) && ['platform', 'category', 'user'].includes(d.domain) ? ['注意：platform／category／user 的部分事件雖設 realtime destination，現有 consumer 沒有對應訊息；看「管理設定：立即、快照、批次與重新載入」。'] : [])] };
});
for (const f of flows) {
  f.nodes.forEach(n => n.refs = n.refs.map(p => ref(p)));
  f.edges = f.nodes.slice(1).map((_, i) => ({ from: i, to: i + 1, label: '接著', async: f.nodes[i + 1].layer === 'async' }));
}
// overview 在回應與 Queue 之間是分岔，不讓讀者誤以為 browser 送 Queue。
flows[0].edges = [ [0,1,'操作'],[1,2,'I/O'],[2,3,'HTTPS'],[3,4,'授權後查/寫'],[4,5,'同transaction'],[5,6,'提交後回應'],[5,7,'write成功喚醒',true],[7,8,'claim工作',true],[8,9,'訊號與通知',true],[9,2,'必要時再讀'] ].map(([from,to,label,async=false])=>({from,to,label,async}));
// 對其他操作圖，原response與Queue也是由交易分岔。
for (const f of actionFlows) if (f.nodes.length === 8) f.edges[f.edges.length - 1] = { from: 5, to: 7, label: '交易提交後', async: true };

const operationText = read('src/generated/operations.ts');
const operationSpecs = JSON.parse(operationText.match(/OPERATION_POLICIES = (\{[\s\S]*?\n\}) as const/)[1]);
const settings = categorySettings.map(([key,title,store,effect,timing,target])=>({key,title,store,effect,timing,target,section:'分類、帳號與平台',refs:[]}));
for (const [key, spec] of Object.entries(operationSpecs)) {
  if (!policyDescriptions[key]) throw new Error('缺政策解說：' + key);
  const matches = sourcePaths.filter(p => !p.includes('/generated/') && !p.endsWith('.sql') && sources[p].text.includes(key));
  settings.push({ key, title: policyDescriptions[key], store: 'runtime_settings.operations_settings', effect: policyDescriptions[key], timing: spec.group === 'client' ? 'Worker snapshot最多60秒；browser在下一次成功回應遇到新revision後重新整理，後續讀取／計時使用新值' : spec.group === 'logs' ? 'Worker政策snapshot更新後，下一次maintenance執行清理' : spec.group === 'jobs' ? 'Worker政策snapshot更新後，下一次Queue sweep採新batch大小' : 'Worker isolate最多60秒重新整理；已執行request使用原snapshot，後續操作使用新值', initial: spec.value, range: spec.min + '–' + spec.max, target: 'saveOperationPolicies', section: '營運政策 · ' + spec.group, refs: matches.slice(0, 5).map(p => ref(p, key)) });
}
for (const [key, initial] of Object.entries(JSON.parse(read('config/data-retention.config.json')))) {
  if (!retentionDescriptions[key]) throw new Error('缺retention解說：' + key);
  settings.push({ key, title: retentionDescriptions[key], store:'runtime_settings.data_retention_settings', effect:retentionDescriptions[key], timing: key === 'pushTokenConfirmationDays' ? 'browser下次bootstrap種入runtime；後續heartbeat判斷' : '儲存後排retention_cleanup；既有到期欄位分批重算，新紀錄在建立／完成／失敗時以當時政策設expires_at；job完成與外部刪除分開', initial, range:typeof initial === 'boolean' ? '開／關' : key.endsWith('Hours') ? '1–87600小時' : '1–3650天', target:'retention',section:'資料保留', refs:[ref('config/data-retention.config.json', '"'+key+'"')] });
}
for (const item of settings.filter(s=>!s.refs.length)) {
  const action = actions[item.target];
  if (action) {
    item.refs = action.refs.map(p=>ref(p));
    if (item.target === 'saveCategoryManagement') item.refs.push(ref('database/migrations/0053_category_image_policies.sql'));
    if (item.target === 'savePlatformSettings') item.refs.push(ref('cloudflare/src/backend/shared/platform-settings.ts'));
  } else {
    const target = flows.find(f=>f.id===item.target);
    item.refs = [...new Map(target.nodes.flatMap(n=>n.refs).map(r=>[r.path,r])).values()].slice(0,4);
  }
}
// 以 migration 的 CREATE/DROP 次序重建現存 triggers；舊 baseline 中退役的觸發器不列為現在存在。
const triggerMap = new Map();
const functionRefs = new Map();
for (const p of sourcePaths.filter(p=>p.endsWith('.sql')).sort()) {
  const text = sources[p].text;
  for (const match of text.matchAll(/CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+((?:"?\w+"?\.)?"?\w+"?)\s*\(/gi)) {
    functionRefs.set(match[1].replaceAll('"',''), { path: p, line: text.slice(0,match.index).split('\n').length });
  }
  const pattern = /CREATE\s+(?:CONSTRAINT\s+)?TRIGGER\s+("?\w+"?)[\s\S]*?\sON\s+((?:"?\w+"?\.)?"?\w+"?)[\s\S]*?EXECUTE\s+(?:FUNCTION|PROCEDURE)\s+((?:"?\w+"?\.)?"?\w+"?)\s*\([^;]*?\);|DROP\s+TRIGGER\s+(?:IF\s+EXISTS\s+)?("?\w+"?)\s+ON\s+((?:"?\w+"?\.)?"?\w+"?)/gi;
  for (const match of text.matchAll(pattern)) {
    const unquote=s=>s.replaceAll('"','');
    if (match[4]) triggerMap.delete(unquote(match[5])+'.'+unquote(match[4]));
    else { const name=unquote(match[1]),table=unquote(match[2]),func=unquote(match[3]);triggerMap.set(table+'.'+name,{name,table,func,description:triggerDescriptions[func.split('.').at(-1)]||'見觸發函式原碼；在來源標示的row/statement時點執行',refs:[ref(p,match[0])]}); }
  }
  // DROP TABLE 也會一併移除其 triggers；0016 退役舊 deletion_jobs 等表。
  for (const match of text.matchAll(/DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?((?:"?\w+"?\.)?"?\w+"?)/gi)) {
    const table = match[1].replaceAll('"','');
    for (const [key, trigger] of triggerMap) if (trigger.table === table) triggerMap.delete(key);
  }
}
for (const trigger of triggerMap.values()) {
  const latest = functionRefs.get(trigger.func);
  if (latest && !trigger.refs.some(r=>r.path===latest.path&&r.line===latest.line)) trigger.refs.unshift(latest);
}
const timers = [];
for (const p of sourcePaths.filter(p=>(p.startsWith('src/')||p.startsWith('cloudflare/src/')) && !p.includes('/i18n/') && !p.includes('/generated/'))) {
  sources[p].text.split('\n').forEach((line,i)=>{
    if (/setInterval|setTimeout|\balarm\(|expiresAt|next_attempt_at|AbortSignal\.timeout|TTL_MS|_TIMEOUT_MS|_INTERVAL_MS|_LIFETIME_SECONDS|_SPACING_MS/.test(line)) timers.push({path:p,line:i+1,text:line.trim()});
  });
}
const routes = sourcePaths.filter(p=>p.startsWith('src/app/')&&p.endsWith('/page.tsx')).map(p=>({path:p,route:p.slice(7,-9).split('/').filter(s=>s&&!/^\([^)]*\)$/.test(s)&&!s.startsWith('@')).map(s=>s.replace(/^\(\.\)/,'')).join('/')||'/',sheet:p.includes('/@sheet/'),refs:[ref(p)]}));
const endpoints = [
  ['/v1/actions','POST','全部' + definitions.length + '種 action 與額外 healthcheck','overview'],
  ['/v1/auth/login-check','POST','Origin/IP限流 + auth_login Turnstile','auth-login'],
  ['/v1/auth/session-check','POST','Origin/IP限流 + auth_restore Turnstile','auth-login'],
  ['/v1/auth/sync','POST','新登入profile同步／平台admin reconciliation','auth-login'],
  ['/v1/realtime/ticket','POST','驗Firebase/AppCheck/DB授權，簽UID/topics','realtime'],
  ['/v1/realtime','GET/WebSocket','Origin + ticket，RealtimeHub DO','realtime'],
  ['/v1/webhooks/cloudinary','POST','原始bytes/signature→upload lifecycle/cleanup','image-lifecycle'],
  ['/v1/media/{token}/{variant}','GET/HEAD','HMAC/expiry/限流→edge/Cloudinary','image-lifecycle'],
  ['/version.json','GET (Next)','新build版本，no-cache','update'],
  ['OPTIONS','Worker CORS','Origin允許才204，不是業務寫入','overview'],
];
const specialFlows = [
  {id:'healthcheck',title:'部署健康檢查與錯誤自動聚合',group:'管理觀測',summary:'沒有Firebase使用者的healthcheck仍須secret；應用失敗自動留下可查紀錄。',nodes:[node('healthcheck請求','POST /v1/actions action=healthcheck；Origin允許；X-Healthcheck-Secret必須匹配HEALTHCHECK_SECRET。','worker',[ref('cloudflare/src/backend/actions/auth.ts','handleHealthcheck')]),node('檢查必需配置與DB','requireEnv檢查Firebase/Turnstile/domain/admin/media等；SELECT roles；全域second/minute配額。只證明這次檢查透過，不代表所有供應商正常。','database',[ref('cloudflare/src/backend/actions/auth.ts','requireEnv("FIREBASE_WEB_API_KEY")')]),node('一般action失敗','handler記status/code/operationId；5xx產生failureId；recordOperationalError按日聚合；429是正常配額拒絕，不納入聚合。串流已送第一段後仍可送error line。','worker',[ref('cloudflare/src/backend/actions/handler.ts','recordFailure'),ref('cloudflare/src/backend/shared/operational-telemetry.ts')]),node('管理員檢視／維護','getOperationsConsole讀errors、metrics、job/delivery失敗；清聚合不會清外部logs；maintenance依errorRetentionDays/metricsRetentionDays清舊桶。','browser',[ref('cloudflare/src/backend/actions/operations.ts'),ref('cloudflare/src/backend/jobs/maintenance.ts')])],notes:[],edges:[{from:0,to:1,label:'healthcheck'}, {from:2,to:3,label:'失敗觀測'}]},
  {id:'notion-auto',title:'Notion 同步、節流與續跑',group:'時間與自動',summary:'Notion啟用且有token/database設定才出站；不替代主要DB。',nodes:[node('Notion delivery','事件有 notion destination 才 claim。NOTION_ENABLED=false 或缺 token/database 時 sync 直接返回，delivery 仍標 completed，表示此通道跳過，不代表外部已有副本。非內容事件超過 notionArchiveDays 也直接完成並跳過。','async',[ref('cloudflare/src/backend/jobs/notion-deliveries.ts')]),node('API節流與重試','同isolate出站間隔350ms；429/5xx退避與Retry-After；真正每次fetch才開始15秒timeout，最多5次refusal retries。','async',[ref('cloudflare/src/backend/shared/notion-api.ts')]),node('同步或重建','對映notion_pages；事件更新對應page與timeline。reconcile分段訪問issue/facility/announcement/operation，request budget用完存cursor，下次drain接續。','database',[ref('cloudflare/src/backend/shared/notion-reconcile.ts'),ref('cloudflare/src/backend/jobs/background-jobs.ts')]),node('封存與失敗責任','內容刪除／mapping保留到期排archive；provider未配置不能宣稱完成archive；deletion到期失敗轉cleanup backlog，需retry。','async',[ref('cloudflare/src/backend/jobs/background-jobs.ts'),ref('database/migrations/0029_archive_and_backup_policies.sql')])],notes:['repo預設NOTION_ENABLED=false；這份HTML沒有執行任何外部同步。'],edges:[{from:0,to:1,label:'出站'}, {from:1,to:2,label:'更新/續跑'}, {from:2,to:3,label:'生命週期'}]},
];
const allFlows = [...flows,...specialFlows,...actionFlows];
const allIds = new Set(allFlows.map(f=>f.id));
if (allIds.size !== allFlows.length) throw new Error('重複流程ID');
for (const setting of settings) if (!allIds.has(setting.target)) throw new Error('無法連結設定流程：' + setting.key);
const data = {
  meta:{repo:root.replaceAll('\\','/'),head:git('rev-parse','HEAD'),date:new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Taipei',dateStyle:'short',timeStyle:'medium'}).format(new Date()),scope:'目前程式快照；非正式環境設定、非外部服務實測',actionCount:definitions.length,flowCount:allFlows.length,sourceCount:Object.keys(sources).length,triggerCount:triggerMap.size,regenerate:'node tools/project-map/build.mjs'},
  groups,flows:allFlows,settings,triggers:[...triggerMap.values()],timers,routes,endpoints,sources,
};
const template = fs.readFileSync(path.join(here,'template.html'),'utf8');
const serialized=JSON.stringify(data).replaceAll('<','\\u003c').replaceAll('\u2028','\\u2028').replaceAll('\u2029','\\u2029');
fs.mkdirSync(path.dirname(output),{recursive:true});
const html = template.replace('/*__PROJECT_DATA__*/', () => serialized);
const inlineScript = html.slice(html.indexOf('<script>') + 8, html.lastIndexOf('</script>'));
new Script(inlineScript, { filename: 'project-map-inline.js' });
fs.writeFileSync(output,html,'utf8');
console.log(JSON.stringify({output,actions:definitions.length,flows:allFlows.length,settings:settings.length,triggers:triggerMap.size,sources:Object.keys(sources).length,timerAnchors:timers.length,bytes:fs.statSync(output).size,head:data.meta.head},null,2));
