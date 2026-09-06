# 後端及資料層

## 公開 HTTP 入口

所有入口由 `cloudflare/src/index.ts` 處理。

| Method / path | 責任 |
| --- | --- |
| `POST /v1/actions` | 讀寫、管理與設定 action 的統一入口 |
| `POST /v1/auth/login-check` | 新登入前的網域與安全檢查 |
| `POST /v1/auth/session-check` | 恢復 session 時的安全檢查 |
| `POST /v1/auth/sync` | 新登入後建立或同步 profile |
| `POST /v1/realtime/ticket` | 簽發短效 WebSocket ticket |
| `GET /v1/realtime` | Durable Object WebSocket upgrade |
| `GET /v1/media/:token/:variant` | 驗證簽名後代理 authenticated Cloudinary asset |
| `POST /v1/webhooks/cloudinary` | Cloudinary webhook 驗證與 upload lifecycle 更新 |

Browser request 必須符合 Origin policy。一般 API 還會驗證 Firebase ID token 與 App Check；首次 profile 建立使用 Turnstile。Action request 帶一個 UUID `X-Novae-Operation-Id`，後端以同一 ID 串起 response、log、transaction 與 event delivery。

### Action request

```http
POST /v1/actions
content-type: application/json
authorization: Bearer <firebase-id-token>
x-firebase-appcheck: <app-check-token>
x-novae-operation-id: <uuid-for-writes>
origin: https://school.example

{
  "action": "getSessionBootstrap",
  "payload": {}
}
```

Read action 若未帶 operation ID，Worker 會建立一個只用於 trace 的 UUID。Write action 必須由 client 提供合法 UUID；缺值回 `validation-required`，格式錯誤回 `validation-invalid`。

成功 response 使用 `{ success: true, data, operationId }`。拒絕與錯誤使用 canonical error code；5xx 另外回 `failureId`。所有 action response 都加 `cache-control: no-store`。

### 非 action endpoint

`/v1/auth/login-check` 和 `/v1/auth/session-check` 先套登入 IP rate limit，再驗證 Turnstile action `auth_login` 或 `auth_restore`。`/v1/auth/sync` 才驗 Firebase / App Check，並限制 profile sync 頻率。

`GET /v1/media/...` 和 `HEAD /v1/media/...` 是唯二不是 POST 的資料入口。其他未知路徑回 `not-found`，錯誤 method 回 `method-not-allowed`；合法 CORS preflight 回 `204`。

## Action registry

`config/backend-actions.config.json` 定義 action 名稱、基礎 rate-limit group 及額外配額，generator 產生前後端共用 registry。Action 大致分為：

- session、category catalog 與 content version
- 提案、附議、留言與審核結果
- 設施回報、受影響標記與狀態更新
- 公告、按讚與公告留言
- 通知頁、未讀狀態與 Push token
- 圖片 upload session、finalization、URL resolution 與刪除
- 分類、功能、scope、使用者限制、平台設定與 admin dashboard
- retention impact estimate、background job 與 failed media deletion recovery

新增 action 時要先更新 source config 和 generator 產物，再在 `tests/integration/` 加入具 assertion 的成功與拒絕案例。涉及 role 或 scope 時至少覆蓋 allowed、denied 與跨 scope。

### 完整 action 索引

表中的 permission 是 registry 入口條件。標示「domain rule」的 action 仍會在 handler / RPC 檢查作者、目標狀態、category scope、可見性或 platform admin。

| Domain | Read / resolve actions | Write actions | Registry permission |
| --- | --- | --- | --- |
| Category / platform | `getCategoryCatalog`, `getCategoryManagement`, `estimateCategoryPolicyChanges`, `estimateRetentionCleanup`, `listPlatformJobs` | `savePlatformSettings`, `saveCategoryManagement`, `savePlatformFeatures`, `completeInitialSetup` | Management reads/writes 要 `category.manage`；首次 setup 由 domain rule 驗 platform admin |
| Session / user | `getSessionBootstrap`, `getCurrentUserRole`, `getUserPublicProfiles` | `cacheUserAvatar` | 登入使用者；公開 profile 仍按允許欄位投影 |
| Access / audit | `listRoleAssignments`, `listAdminUsers`, `listAdminAudit`, `listAdminActivity`, `getAdminOverview` | `setUserRestriction`, `setUserAccessScope` | 前三類管理清單與 writes 要 `role.manage`；activity / overview 要 `dashboard.view` |
| Upload | `resolveUploadImageUrls` | `createImageUploadSessions`, `finalizeImageUploads`, `deleteUploadedImages` | 登入 + viewer / owner / lifecycle domain rule |
| Issue | `getIssue`, `listIssues`, `searchIssues`, `listUserIssues`, `listComments` | `createIssue`, `moderateIssueStatus`, `updateIssueResult`, `toggleSupport`, `removeSupport`, `deleteIssue`, `createComment`, `deleteComment` | Moderation / result 要 `proposal.manage`；其餘由 author、category、status、restriction rule 決定 |
| Facility | `listFacilities`, `getFacility` | `createFacility`, `toggleFacilityAffected`, `updateFacilityStatus`, `deleteFacility` | Facility writes 在 domain rule 檢查 owner 或 facility scope |
| Announcement | `listAnnouncements`, `getAnnouncement`, `listAnnouncementComments` | `createAnnouncement`, `deleteAnnouncement`, `setAnnouncementLike`, `createAnnouncementComment`, `deleteAnnouncementComment` | Create/delete 要 `announcement.manage`；互動與留言刪除走 domain rule |
| Notification | `listNotificationPages`, `getNotificationSnapshot`, `getNotificationReadState`, `getNotificationUnreadHint`, `getPushNotificationPreference` | `markNotificationsOpened`, `registerPushToken`, `unregisterPushToken`, `updatePushNotificationPreferences` | 只允許操作自己的 read state、device 與 token |
| Dashboard / recovery | `getPlatformDashboard`, `listDeletionJobs` | `retryDeletionJob` | Reads 要 `dashboard.view`；retry 要 `role.manage` |

Action rate-limit group 分成 `read`、`general-write`、`sensitive-write`、`admin-write`、`upload-write`、`upload-resolve`。詳細數值見[執行期政策與限制](runtime-policies.md)。

## PostgreSQL 邊界

Migration 建立 `app_private` 資料與 `app_api` 函式介面。Worker 透過 `cloudflare/src/backend/database/client.ts` 使用 parameterized query 和 transaction；手寫 row projection 會對 `schema.generated.ts` 做 compile-time 檢查。

正式部署分開兩組 credential：

- owner URL 只在 deployment / migration 使用。
- `novae_runtime` 經 `scripts/configure-database-runtime.mjs` 建立或 rotate，只取得必要的 DML、sequence 與 function execute 權限。

`scripts/database.mjs` 在 `public.novae_schema_migrations` 記錄 migration filename、checksum 和時間，並用 PostgreSQL advisory lock 防止同時套用。遠端 schema 變更只新增 migration；修改已套用檔案會被 checksum gate 拒絕。

### Transaction API

`AppDatabaseClient.transaction(async (tx) => ...)` 為每次 write 配一條 dedicated PostgreSQL connection。Execution 順序固定：

1. `app_api.claim_operation` 原子 claim operation ID。
2. `app_api.set_operation_context` 把 ID 放進 transaction context。
3. Claim action 的 business rate limit。
4. 執行 domain handler / RPC。
5. `admin-write` 寫入 `app_private.admin_audit_log` 並產生 audit event。
6. 寫入 action 對應的 domain events 與 destination。
7. `app_api.complete_operation` 保存 canonical response。

任何一步 throw 都 rollback。已完成的重複 operation 讀出原 response；尚未完成但已被另一個 request claim 的 operation 回 `request-in-progress`。這套規則處理使用者重送、網路 timeout 後 retry，以及兩個相同 request 同時到達的情況。

### Schema ownership

| Schema / role | 責任 |
| --- | --- |
| `public` | `novae_schema_migrations` 等部署所需入口 |
| `app_private` | Tables、內部資料、audit、operation、event、delivery 與 job state |
| `app_api` | Worker 可執行的 permission-checked function |
| Neon owner | 套 migration、建立 role 與 grant；只在部署或維護腳本使用 |
| `novae_runtime` | Worker runtime；DML、sequence use、指定 function execute，無 DDL / role management |

`scripts/configure-database-runtime.mjs` 每次部署建立或 rotate runtime password，套用最小 grant，最後真的用 runtime credential 查一張 application table。驗證成功的 connection string 才交給 Hyperdrive。

## Migration 歷程

Migration 依 filename 排序，每個檔案各自包一個 transaction。

| Migration | 內容 |
| --- | --- |
| `0001_baseline.sql` | PostgreSQL 17 fresh schema baseline |
| `0002_bootstrap.sql` | 初始 role、permission 與 setup |
| `0003_realtime_batch_completion.sql` | Realtime batch 完成狀態 |
| `0004_worker_database_boundary.sql` | 封閉 browser database path，確立 Worker-only 邊界 |
| `0005_support_expiry_job.sql` | 到期附議處理 |
| `0006_platform_runtime_settings.sql` | Platform runtime setting |
| `0007_admin_console.sql` | Admin overview、互動限制、audit data / function |
| `0008_admin_console_consistency.sql` | Admin user / activity visibility 與 audit cleanup |
| `0009_retention_lifecycle.sql` | Retention lifecycle |
| `0010_admin_activity_notion_archive.sql` | 永久 Notion activity archive mapping |
| `0011_content_version_reset_identity.sql` | 由 migration time 初始化 content version |
| `0012_deletion_job_recovery.sql` | Failed Cloudinary deletion recovery 與權限 |
| `0013_observable_policy_jobs.sql` | 有進度的 bounded platform policy job |
| `0014_runtime_retention_batches.sql` | 完整 retention surface 與批次清理 |
| `0015_retention_runtime_authority.sql` | Runtime retention authority 與 orphaned Notion mapping cleanup |
| `0015_z_quiesce_legacy_projection_triggers.sql` | 停止舊 projection trigger，準備一致性切換 |
| `0015_zz_bootstrap_runtime_role.sql` | 在 fresh / populated cluster 建立 no-login runtime role shell |
| `0016_system_data_consistency.sql` | Atomic operation、domain event、unified delivery、background job、aggregate revision、counter invariant 與舊表退場 |

`verify:integration` 不是只測 fresh database。它會另外建一套 populated pre-0016 database，再一路升到目前 migration，驗證既有資料能通過一致性切換。

## 一致性與非同步工作

寫入 transaction 同時記錄 canonical operation、aggregate revision、domain event 與 delivery。Queue consumer 執行：

- 站內通知
- Firebase Cloud Messaging
- Durable Object realtime broadcast
- 選用 Notion 營運副本
- retention、全域 category policy 變更等 bounded background job

批次工作把進度和結果存回 PostgreSQL，可在管理介面觀察。Queue retry 不會改變 source of record；operation key 和 delivery key 用來避免重複寫入或重複投遞。

Delivery、job、notification、revision 和 aggregate counter 的異常會由 `scripts/verify-data-consistency.mjs` 做 read-only audit。Critical / High finding 會讓 verification 失敗；檢查也包含 RBAC、upload、Notion、Firebase profile coverage、API / event registry drift 和 browser cache namespace。

## 資料保留

`config/data-retention.config.json` 提供首次部署的預設值，之後由平台 runtime settings 掌管可調政策。內容、通知、delivery、operation、Push token、avatar / profile PII、restriction、audit、background job 和 upload lifecycle 都有獨立期限；會刪除使用者內容的政策另有 enable switch。

Cron 每 30 分鐘觸發維護入口，但真正工作拆成有上限的 background batch，避免單次長 transaction。Notion 的資料生命週期不跟著這些 retention policy 刪除。

所有預設天數、可停用項目、圖片限制和兩層 rate limit 已整理在[執行期政策與限制](runtime-policies.md)。

## Generated contract

資料庫完成 migration 後，以下指令 introspect `app_private` columns 與 `app_api` signatures：

```bash
bun run generate:database-contracts
bun run verify:database-contracts
```

`cloudflare/src/backend/database/schema.generated.ts` 是 committed artifact，不手動編輯。

Database generator 會連到完整 migration 後的 PostgreSQL，introspect `app_private` column 和 `app_api` signature，再輸出 TypeScript contract。`--check` 模式不接受 schema 與 committed type 不一致。修改 SQL 後若 contract 沒變，也要讓這項檢查證明它確實沒變。
