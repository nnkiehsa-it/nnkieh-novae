// 拓樸圖與程式目錄關係；位置是畫布座標，連線不代表全部都是依序執行。
const n = (title, text, layer, x, y, refs) => ({ title, text, layer, x, y, refs });
const edge = (from, to, label, async = false) => ({ from, to, label, async });
const A = 'cloudflare/src/backend/actions/';
export const architectureFlows = [
  {
    id: 'overview', title: '整個專案：執行架構', group: '程式架構', kind: 'topology',
    summary: '依 README 與 architecture 文件，補上真實程式中的安全、資料與背景工作邊界。',
    notes: ['此圖是服務關係；同一個操作只走相關分支。實線是請求／資料關係，虛線是背景或外部事件。', 'Next.js 在 Vercel；Worker、Queue、Durable Objects、cron 在 Cloudflare；Neon 是主要資料庫。數值與配置為 checkout 快照。'],
    nodes: [
      n('瀏覽器 · Next.js / PWA', 'page、component、hook、service 與 UID 分區快取；SW 接收 Push。使用者和管理員都从這裡操作，瀏覽器不直連 Neon。', 'browser', 0, 240, ['README.md', 'src/components/app-shell.tsx', 'src/app/sw.ts']),
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
