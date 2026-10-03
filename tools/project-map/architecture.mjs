import { separatePaths } from './narration.mjs';
// 以下保留各模組的原碼與責任資料；最後組成不共用卡片的閱讀路徑。
const n = (title, text, layer, x, y, refs) => ({ title, text, layer, x, y, refs });
const edge = (from, to, label, async = false) => ({ from, to, label, async });
const A = 'cloudflare/src/backend/actions/';
const architectureCatalog = [
  {
    id: 'overview', title: '整個專案：執行架構', group: '程式架構', kind: 'topology',
    summary: '依 README 與 architecture 文件，補上真實程式中的安全、資料與背景工作邊界。',
    notes: ['此圖是服務關係；同一個操作只走相關分支。實線是請求／資料關係，虛線是背景或外部事件。', 'Next.js 在 Vercel；Worker、Queue、Durable Objects、cron 在 Cloudflare；Neon 是主要資料庫。數值與配置為 checkout 快照。'],
    nodes: [
      n('瀏覽器 · Next.js / PWA', 'page、component、hook、service 與 UID 分區快取；SW 接收 Push。使用者和管理員都從這裡操作，瀏覽器不直連 Neon。', 'browser', 0, 240, ['README.md', 'src/components/app-shell.tsx', 'src/app/sw.ts']),
      n('Firebase / Google / Turnstile', 'Google 身分登入 Firebase；ID token 驗 UID，App Check 驗客戶端，Turnstile 驗登入／恢復挑戰。平台角色與有效限制仍由 Novae DB 決定。', 'external', 0, 0, ['src/services/session-auth.ts', 'cloudflare/src/app-check.ts', 'cloudflare/src/backend/actions/auth.ts']),
      n('Cloudflare Worker API', 'index.ts 路由；actions registry → 身分／scope／限制／配額 → domain handler。POST /v1/actions 回 NDJSON；另有 auth、realtime ticket、媒體與 webhook 入口。', 'worker', 360, 240, ['cloudflare/src/index.ts', A+'action-registry.ts', A+'execution.ts']),
      n('BusinessRateLimiter DO', '每 UID 的產品配額與 burst；SQLite 原子 claim。固定時間桶到期由 DO alarm 清理；native binding 另保護 ingress。', 'worker', 360, 0, ['cloudflare/src/durable/business-rate-limiter.ts', A+'rate-limit.ts']),
      n('Hyperdrive · pg client', 'Worker 的 PostgreSQL 連線邊界。只使用 novae_runtime 權限；read 走 SQL/RPC，write 由 client.transaction 包覆，失敗 rollback。', 'worker', 720, 240, ['cloudflare/src/backend/database/client.ts', A+'execution.ts']),
      n('Neon · PostgreSQL', 'app_private 儲存主要資料；app_api 提供授權 RPC。operation、變更、稽核、domain event、delivery 同交易，triggers 同步處理快照／計數／版本／工作排程。', 'database', 1080, 240, ['database/migrations/0016_system_data_consistency.sql', 'cloudflare/src/backend/database/schema.generated.ts']),
      n('Cloudinary · 圖片實體', 'browser 用 Worker 簽名直傳 authenticated asset。webhook 回 Worker；顯示由媒體代理驗可見性；刪圖由背景 job 執行。內容只保留 srp-upload://id。', 'external', 0, 480, ['src/services/uploads.ts', 'cloudflare/src/backend/cloudinary-webhook.ts', 'cloudflare/src/media.ts']),
      n('cron · 每 30 分鐘', 'scheduled handler 只送 maintenance Queue，consumer 才做 DB 維護、逾期附議處理與完整保留清理。不是管理設定的生效倒數。', 'async', 720, 0, ['cloudflare/wrangler.json', 'cloudflare/src/index.ts', 'cloudflare/src/backend/jobs/maintenance.ts']),
      n('Queue · 工作執行器', 'write 提交、webhook 或 cron 喚醒 bounded sweep。claim DB delivery/job，用 attempt UUID 防舊工作完成；失敗留待重試，工作量由 runtime policy 限制。', 'async', 720, 480, ['cloudflare/src/backend/jobs/consumer.ts', 'cloudflare/src/backend/jobs/background-jobs.ts']),
      n('站內通知 · PostgreSQL', 'consumer 依事件解析收件者、寫 notifications 與水位。created_at 是事件 occurred_at；期限按事件時間算。站內通知寫入後再發布 realtime 提示。', 'database', 1080, 480, ['cloudflare/src/backend/jobs/notification-deliveries.ts', 'database/migrations/0055_notification_expiry_event_time.sql']),
      n('RealtimeHub DO · WebSocket', '短效 ticket 驗 topics/UID；推計數或快取失效訊號。browser 遇 revision gap 再讀 Worker；DO 不儲存整份提案。管理設定事件目前部分沒有輸出訊息。', 'async', 360, 720, ['cloudflare/src/durable/realtime-hub.ts', 'cloudflare/src/backend/jobs/realtime-deliveries.ts', 'src/services/realtime-events.ts']),
      n('FCM · 裝置 Push', 'consumer 讀裝置 token，按 delivery/token_hash 去重；SW 或前景 handler 接訊息。點通知後仍由 Worker 重新檢查目標存取權。', 'external', 720, 720, ['cloudflare/src/backend/jobs/notification-deliveries.ts', 'src/app/sw.ts']),
      n('Notion · 可選封存', 'Queue 依事件同步外部頁、維護 notion_pages mapping；分批重建與封存可續跑。repo NOTION_ENABLED=false；它不取代 Neon。', 'external', 1080, 720, ['cloudflare/src/backend/jobs/notion-deliveries.ts', 'cloudflare/src/backend/shared/notion-reconcile.ts']),
    ],
    edges: [edge(0,1,'登入 / token'),edge(0,2,'HTTPS / NDJSON'),edge(2,3,'claim 配額'),edge(2,4,'SQL / transaction'),edge(4,5,'主資料'),edge(0,6,'簽名直傳'),edge(6,2,'webhook',true),edge(7,8,'maintenance',true),edge(2,8,'提交後 drain',true),edge(8,5,'claim / 完成'),edge(8,6,'刪圖片',true),edge(8,9,'寫通知'),edge(8,10,'publish',true),edge(10,0,'訊號 → 再讀',true),edge(8,11,'Push',true),edge(8,12,'同步 / 封存',true)],
  },
  {
    id: 'source-architecture', title: '程式目錄：責任與依賴', group: '程式架構', kind: 'topology',
    summary: '從頁面到資料庫的目錄責任；共用契約、產生器、測試與部署也列在同一張圖。', notes: ['線表示程式依賴／產生關係；不是每次操作都跑建置或 migration。'],
    nodes: [
      n('src/app · 路由', 'Next.js route、protected layout、@sheet 詳情攔截、version.json、SW；路由決定可見的 page，守門元件再驗 session/features。', 'browser', 0, 0, ['docs/architecture.md','src/app/(protected)/layout.tsx']),
      n('src/components · 畫面', '產品元件與 admin 的七個管理區域；點按／表單／sheet 將事件交給 hook。摘要與欄位呈現依正式 baseline 和草稿狀態。', 'browser', 340, 0, ['src/components/admin/admin-page.tsx','src/components/protected-app.tsx']),
      n('src/hooks · 行為', '登入、feed、詳情、composer、optimistic、設定草稿、unsaved changes、polling。控制 request 版本與目前 UID，避免舊讀取覆蓋新畫面。', 'browser', 680, 0, ['src/hooks/use-draft.ts','src/hooks/use-admin-reading.ts','src/hooks/use-paged-request-guard.ts']),
      n('src/services · I/O', 'API 呼叫、NDJSON、operationId、同讀取合併、內容快取及 realtime transport。寫入與 UI 呈現分開；lib/types/generated 支援共享資料與政策。', 'browser', 680, 240, ['src/services/backend-action.ts','src/services/content-read-cache.ts','src/lib/content-entity-store.ts']),
      n('backend/actions · 業務', 'registry/execution 共用安全與交易；domain handler 實作提案、設備、公告、通知、圖片、角色、分類與政策。events/ 明確產生事件與 destination。', 'worker', 340, 240, ['cloudflare/src/backend/actions/action-registry.ts','cloudflare/src/backend/actions/execution.ts','cloudflare/src/backend/events/domain-events.ts']),
      n('database + migrations', 'pg client、生成型別；SQL app_api/app_private 的函式、表、索引、FK 與 triggers。0054–0059 是本次保留範圍、通知時間與管理一致性變更。', 'database', 0, 240, ['cloudflare/src/backend/database/schema.generated.ts','database/migrations/0054_scoped_retention_policy_changes.sql','database/migrations/0059_scope_target_admin_identity.sql']),
      n('jobs / shared / durable', 'Queue consumer、notification/realtime/Notion deliveries、background jobs、maintenance；shared 放 provider API 與政策快取；durable 放配額與 socket hub。', 'async', 340, 480, ['cloudflare/src/backend/jobs/consumer.ts','cloudflare/src/backend/shared/operation-policies.ts','cloudflare/src/durable/realtime-hub.ts']),
      n('config → scripts → generated', 'action/rate-limit/operations/retention JSON 是產生與驗證契約。scripts 產生 src/generated、cloudflare/generated 與 DB 型別；改契約需跑生成與一致性檢查。', 'build', 0, 480, ['config/backend-actions.config.json','config/operations.config.json','config/data-retention.config.json','package.json']),
      n('tests / workflows · 發佈', '單元、integration、瀏覽器驗證；migration、生成、typecheck/build 等 gate。GitHub workflow 部署 Worker/Vercel；版本端點讓既有 PWA 延後更新。地圖未重跑產品 gate 或部署。', 'build', 680, 480, ['README.md','.github/workflows/verify-and-deploy.yml','package.json']),
    ],
    edges: [edge(0,1,'組頁'),edge(1,2,'事件'),edge(2,3,'讀 / 寫'),edge(3,4,'POST actions'),edge(4,5,'SQL / RPC'),edge(4,6,'事件提交後',true),edge(6,5,'工作狀態'),edge(7,3,'前端政策'),edge(7,4,'後端契約'),edge(7,5,'schema 生成'),edge(8,7,'驗證生成'),edge(8,0,'build / deploy')],
  },
];

const runtime=architectureCatalog[0].nodes;
const modules=architectureCatalog[1].nodes;
const copy=(items,index,title,text,refs=[])=>({...items[index],title:title||items[index].title,text:text||items[index].text,refs:[...items[index].refs,...refs]});
const runtimeTitles=['瀏覽器：接操作並管理畫面狀態','身分服務：簽發與驗證登入 token','Worker：路由、授權並執行 API','Rate limiter：原子驗頻率與額度','Hyperdrive：連接 PostgreSQL','PostgreSQL：保存正式內容與工作','Cloudinary：儲存與交付圖片','Cloudflare cron：每半小時喚醒維護','Queue：領取並執行背景待辦','PostgreSQL：寫入通知與事件時間','RealtimeHub：推送內容變更訊號','FCM：交付通知給已登記裝置','Notion：同步外部封存頁面'];
const r=(index,title,text,refs=[])=>copy(runtime,index,title||runtimeTitles[index],text,refs);
const moduleTitles=['src/app：選路由並組頁面','src/components：呈現表單並接操作','src/hooks：管理草稿與請求狀態','src/services：送 API 並管理快取','backend/actions：驗規則並執行操作','database：執行 SQL 與一致性規則','jobs／durable：執行背景與即時工作','config／generated：定義共用契約','tests／workflows：驗證並發布新版'];
const m=(index,title,text,refs=[])=>copy(modules,index,title||moduleTitles[index],text,refs);
const diagram=(id,title,summary,paths,notes=[])=>separatePaths({id,title,summary,group:'程式架構',notes},paths);
export const architectureFlows=[
  diagram('overview','整個專案：一次請求到畫面更新','依實際請求順序走過前端、身分服務、Worker、配額與 PostgreSQL；返回同一服務時再放一張卡片。',[
    {title:'主流程：已登入帳號發起操作',nodes:[
      r(0,'瀏覽器：人操作畫面','page、component、hook 接收點按或輸入，整理 action、欄位與目前 UID。',['src/hooks/use-entry-composer.ts']),
      r(0,'Service：準備請求','backend-action 收 action／payload。寫入產生 operationId，重試沿用同 ID；讀取可合併相同 in-flight request。',['src/services/backend-action.ts']),
      r(1,'身分 SDK：取得有效 token','已登入帳號取得 Firebase ID token 與 App Check；仍有效可用快取，需要時刷新。Google／Turnstile 登入與恢復是左側另一個完整流程。',['src/lib/auth-token.ts']),
      r(0,'Service：送出 POST','以 token 送 POST /v1/actions，帶 action／payload；寫入再帶 operationId。開始讀 NDJSON 回應。',['src/services/backend-action.ts']),
      r(2,'Worker：驗入口與身分','Origin、App Check、Firebase ID token、native ingress；registry 選 handler、accessClass 與固定 permission。'),
      r(5,'Neon / PostgreSQL：讀有效授權','經 Hyperdrive／pg 讀正式管理員、角色、分類 scope 與有效限制；每次請求重解，不依賴舊畫面角色。',[A+'auth.ts']),
      r(2,'Worker：權限與 burst','檢查 accessClass／permission／UID burst；目標 owner 與分類 scope 由業務 handler 再驗。',[A+'rate-limit.ts']),
      r(5,'寫入時：claim operation','先開交易 claim_operation；已完成重播 response，執行中／過期拒絕。新的寫入才往後走；讀取略過 mutation transaction。',[A+'execution.ts']),
      r(3,'寫入時：claim 產品額度','新的寫入需要的每日／每小時額度由 DO 原子 claim；讀取不走這個寫入額度分支。'),
      r(2,'業務 handler：驗證與執行','驗欄位、目標存取、圖片所有權、版本、狀態、deadline；以 SQL／RPC 執行該 action。',[A+'categories.ts',A+'issue-support.ts']),
      r(5,'PostgreSQL：查詢／正式提交','read 回可見資料；write 的內容／設定變更、triggers、audit、event、deliveries、complete_operation 同交易提交，任何失敗回滾。',[A+'execution.ts']),
      r(2,'Worker：回傳結果','NDJSON start／part／end 或 error；主要結果可先回應。提交後另有背景分支，見左側「提交後：Queue 如何接手工作」。',[A+'handler.ts']),
      r(0,'Service：解析正式結果','確認仍是同一 Firebase User，忽略舊帳號回應；解析資料與 policy revision。',['src/services/backend-action.ts']),
      r(0,'畫面：更新狀態與草稿','hook 更新 entity、列表、詳情與設定 baseline；成功清本次草稿，失敗保留或復原 optimistic。',['src/hooks/use-draft.ts','src/lib/content-entity-store.ts']),
    ],labels:['action、輸入欄位、目前 UID','取得／刷新 ID token＋App Check','有效身分 token → Service','POST：action、payload、token、operationId','已驗證 UID → 查 DB 授權','UID、角色、permission、scope、有效限制','寫入時：operationId、actor UID、action → claim','新的 operation → claim 產品額度；讀取略過','通過權限／配額＋payload → handler','SQL／RPC：查詢或更新目標紀錄','查詢／提交結果 → Worker','NDJSON：資料片段、結果、error → Service','正式資料、cursor／版本、成功或錯誤 → hook']},
  ],['寫入的背景工作與主回應並行；另有獨立閱讀段落，從同一次 DB 提交開始。','這是 checkout 原碼快照；沒有登入產品或查正式環境。']),
  diagram('architecture-background','提交後：Queue 如何接手工作','從已提交事件或排程訊息開始；各入口用自己的卡片。',[
    {title:'入口一：同一次寫入提交後',nodes:[
      r(5,'PostgreSQL：事件與工作已提交','domain_events、event_deliveries、background_jobs 記 payload、destination、責任與狀態。'),
      r(2,'Worker：送 drain','交易成功後喚醒 Queue；consumer 再從 DB claim 待辦。'),
      r(8,'Queue consumer：開始 sweep','載 runtime policy、執行配額，合併同批喚醒，檢查可領取工作。'),
      r(5,'PostgreSQL：claim 待辦','按到期時間與鎖期限 claim，SKIP LOCKED，產生新的 attempt UUID。',['database/migrations/0025_consumer_fencing.sql']),
      r(8,'Consumer：執行指定通道','依 destination 分別處理 Notion、in_app、Push、realtime；background job 處理刪除、政策批次、重建。'),
      r(5,'PostgreSQL：記完成／失敗／續跑','complete／fail 匹配 attempt UUID；記結果、error、retry 時間與批次 cursor，必要時由後續 drain 接續。',['database/migrations/0025_consumer_fencing.sql']),
    ],labels:['交易提交成功 → Worker 啟動喚醒','drain 訊息 → Queue consumer','destination、時間、batchSize → claim','event／job payload＋attempt UUID → consumer','處理結果、error、cursor、attempt UUID → DB']},
    {title:'入口二：每 30 分鐘的 cron',nodes:[r(7),r(8,'Queue：收到 maintenance','scheduled 只送 maintenance；consumer 執行逾期附議、完整保留清理與待辦維護。',['cloudflare/src/backend/jobs/maintenance.ts'])],labels:['maintenance 訊息 → Queue；由 consumer 執行維護']},
    {title:'入口三：Cloudinary 回報',nodes:[r(6,'Cloudinary：送 webhook','供應商回報 upload lifecycle，訊息可晚到；以原始 bytes 與 signature 驗證。'),r(2,'Worker：處理圖片回報','更新 upload 或為找不到的舊資產排清理；需要時喚醒 Queue。',['cloudflare/src/backend/cloudinary-webhook.ts'])],labels:['webhook 原始 body＋signature → Worker 驗證／處理']},
  ],['各段分別觸發，段落之間沒有接續執行的箭頭。']),
  diagram('architecture-channels','背景通道：通知、Push、Notion、圖片','每條通道重複自己的入口，逐步說明資料往哪裡去。',[
    {title:'站內通知／Realtime',nodes:[r(8,'Consumer：讀 in_app event','依事件 payload 解析收件者，按事件時間組通知。',['cloudflare/src/backend/jobs/delivery-recipients.ts']),r(9),r(10,'RealtimeHub：發布通知提示','通知寫入後 publish notification_insert；內容 realtime 另產生計數或失效訊號。'),r(0,'瀏覽器：收到提示再讀','更新水位／計數或標快取失效；需要權威內容時再讀 Worker。',['src/services/realtime-events.ts'])],labels:['通知正文、收件者 UID、事件時間 → INSERT','notification_insert＋topic／UID → publish','WebSocket event＋revision → 畫面更新／再讀']},
    {title:'FCM Push',nodes:[r(8,'Consumer：組 Push','獨立 claim Push delivery，讀裝置 token 與成功 receipt，只送未成功裝置。'),r(11),r(0,'瀏覽器／SW：顯示與開啟','前景 handler 或 SW 顯示；UID session gate 篩選，點目標再讀 Worker 驗存取權。',['src/lib/push-session.ts','src/lib/notification-target.ts'])],labels:['裝置 token＋通知 payload → FCM HTTP','FCM 正文、UID、目標 route → browser／SW']},
    {title:'Notion 外部封存',nodes:[r(8,'Consumer：讀 Notion delivery','讀 payload 與 mapping；只有供應商配置完整且啟用才出站。'),r(12),r(5,'PostgreSQL：存對映與結果','notion_pages 保存外部頁 ID；delivery／job 記完成、失敗或 cursor。')],labels:['事件內容＋page ID → Notion API','page ID、同步結果、cursor → mapping／工作狀態']},
    {title:'Cloudinary 外部刪除',nodes:[r(5,'PostgreSQL：留刪除責任','刪內容或未附著圖片到期，留下 public_id 等識別碼與 deletion job。'),r(8,'Consumer：領取 deletion job','用 job payload 呼叫供應商，失敗仍保留清理責任。'),r(6,'Cloudinary：destroy 圖片','刪除指定 public_id；外部不存在視為清理完成。'),r(5,'PostgreSQL：完成／失敗／backlog','記 attempt 與結果；過期失敗的 deletion 轉 external_cleanup_backlog 供重試。',['database/migrations/0026_external_cleanup_backlog.sql'])],labels:['job ID、public_id、payload → claim','Cloudinary public_id＋刪除參數 → destroy','供應商結果＋attempt UUID → complete／fail／backlog']},
  ]),
  diagram('source-architecture','程式目錄：一個操作經過哪些模組','按請求與回應解釋目錄；返回前端時再放一份前端卡片。',[
    {title:'page → component → hook → service → backend → 回到畫面',nodes:[m(0),m(1),m(2),m(3),m(4),m(5),m(4,'backend execution：包回應','查詢或交易完成後回傳 NDJSON；背景責任另由 jobs／shared／durable 接手。'),m(3,'src/services：解析結果','解析資料與成功／錯誤，確認當前 UID，更新或失效快取。'),m(2,'src/hooks：套正式狀態','更新 entity、列表、詳情、baseline；成功或失敗各自處理草稿。'),m(1,'src/components：呈現結果','依 hook 的正式狀態顯示畫面與操作回饋。')],labels:['route 與頁面資料 → component','點按／輸入事件與欄位 → hook','查詢條件／draft／UID → service','POST action、payload、token → Worker','SQL／RPC＋參數 → PostgreSQL','查詢／提交結果 → execution','NDJSON：資料片段、成功／錯誤 → service','正式資料、版本、結果 → hook','更新後狀態 → component 畫面']},
  ]),
  diagram('architecture-build','配置、生成、驗證與部署','修改專案後的維護流程，與一般操作分開。',[
    {title:'修改契約 → 生成 → 驗證 → 部署 → 既有分頁更新',nodes:[m(7,'config：共用契約','action、rate-limit、operations、retention JSON 定義資料與設定範圍。'),m(7,'scripts / generated：產生契約','產生 src/generated、cloudflare/generated 與完整 migrated PostgreSQL schema 型別。'),m(8,'tests / verify：核對變更','生成一致性、型別、integration、browser、build 等 gate；命令見 package.json。地圖沒有重跑產品 gate。'),m(8,'workflows：部署新版','發布 Next.js／Vercel 與 Cloudflare Worker；migrations 與環境配置依部署流程套用。'),r(0,'PWA：發現新版本','version.json 提供 build version；有草稿／sending／驗證就延後，安全時 SW update／reload 同網址。',['src/components/app-update-gate.tsx','src/app/version.json/route.ts'])],labels:['JSON 契約＋migration schema → 產生器','生成檔、原碼變更 → 驗證／build','通過 gate 的 build、配置、migration → 部署','新版 build version → version.json → 更新檢查']},
  ]),
];

// 讀取不 claim operation、不扣寫入產品額度；分開兩條實際執行路徑。
const overview=architectureFlows[0], steps=overview.nodes, handoffs=overview.edges.map(e=>e.label);
architectureFlows[0]=separatePaths({...overview,title:'整個專案：讀取與寫入如何執行'},[
  {title:'讀取：開列表、詳情或搜尋',nodes:[{...steps[0],title:'列表／詳情：要求讀取內容'},...steps.slice(1,7),{...steps[9],title:'Read handler：驗可見性並查內容',text:'驗 query、cursor 與目標可見性，執行查詢 SQL／RPC；不進寫入去重交易。'},{...steps[10],title:'PostgreSQL：回傳可見資料',text:'依 viewer、scope、狀態與分類規則篩資料，回 cursor 與內容版本。'},...steps.slice(11)],labels:[...handoffs.slice(0,6),'已驗授權與 burst＋query／cursor → read handler','查詢 SQL／RPC＋viewer → 可見資料',...handoffs.slice(10)]},
  {title:'寫入：發文、互動或管理儲存',nodes:[{...steps[0],title:'表單／互動：要求寫入變更'},...steps.slice(1,7),{...steps[7],title:'PostgreSQL：鎖定操作去重身份',text:'開交易 claim_operation。已完成就重播 response；新 operation 才執行後續變更，處理中或已過期拒絕。'},{...steps[8],title:'Rate limiter：原子扣產品額度'},steps[9],{...steps[10],title:'PostgreSQL：提交變更與事件',text:'內容／設定、DB triggers、此操作的稽核、domain event、deliveries 與 complete_operation 同交易保存；任何失敗回滾。'},...steps.slice(11)],labels:[...handoffs.slice(0,6),'operationId＋actor UID＋action → claim_operation','新操作＋units＋時間窗 key → claim 配額',...handoffs.slice(8)]},
]);
