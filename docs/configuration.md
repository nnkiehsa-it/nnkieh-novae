# 設定參考

`.env.example` 是所有部署值的 checklist；本機手動前端開發只把 browser-visible 區段放進 `.env.local`。GitHub Actions 從 `development` 或 `production` Environment 讀取正式值。

## 設定放在哪裡

| 情境 | 位置 | 讀取者 |
| --- | --- | --- |
| 手動 Next.js 開發 | `.env.local` | `next dev` / `next build` |
| 手動 Worker 開發 | `cloudflare/.dev.vars` | Wrangler；可從 `.dev.vars.example` 建立 |
| `test:env` / integration / E2E | Runner 在 child process 注入 | Next.js、Worker、Vitest、Playwright |
| `main` production | GitHub `production` Environment | deploy workflows |
| `dev` preview | GitHub `development` Environment | deploy workflows |

正式 Worker 的 Wrangler 設定由 `scripts/render-worker-config.mjs` 產生到暫存路徑。不要手動把 production binding 寫回 `cloudflare/wrangler.json`；該檔保留 local/default binding 名稱。

## 前端公開值

所有 `NEXT_PUBLIC_*` 都會進入 browser bundle，不可放私密 credential。

| 名稱 | 用途 |
| --- | --- |
| `NEXT_PUBLIC_SCHOOL_NAME` | 介面顯示的學校名稱 |
| `NEXT_PUBLIC_ALLOWED_DOMAIN` | 登入畫面與前端驗證使用的學校網域 |
| `NEXT_PUBLIC_API_BASE_URL` | Cloudflare Worker 公開 URL |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase Web API key |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase Auth domain |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Firebase project ID |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Firebase web app ID |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | FCM sender / project number |
| `NEXT_PUBLIC_FIREBASE_VAPID_KEY` | Web Push VAPID public key |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `NEXT_PUBLIC_FIREBASE_APP_CHECK_ENABLED` | 部署環境必須為 `true` |
| `NEXT_PUBLIC_RECAPTCHA_ENTERPRISE_SITE_KEY` | Firebase App Check 的 reCAPTCHA Enterprise site key |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Managed Turnstile site key |

`NEXT_PUBLIC_LOCAL_DEV_AUTH` 與 `NEXT_PUBLIC_LOCAL_DEV_AUTH_EMAIL` 只給 Auth Emulator。本機整合 runner 也會注入 `NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_URL` 和 `NEXT_PUBLIC_CONTENT_REALTIME_ENABLED`，一般部署不用自行設定。

Frontend workflow 視下列項目為必填：Firebase API key、Auth domain、project ID、app ID、messaging sender ID、VAPID key、Google client ID、App Check 開關、reCAPTCHA Enterprise site key、Turnstile site key、Worker URL、allowed domain，以及三個 Vercel credential。`NEXT_PUBLIC_SCHOOL_NAME` 會在 build 時注入，但目前 workflow 不把它列入缺值 gate。

`NEXT_PUBLIC_APP_VERSION` 不需手動設定。Next config 依序使用 `NEXT_PUBLIC_APP_VERSION`、`VERCEL_GIT_COMMIT_SHA`、`GITHUB_SHA`、package version，最後才用 `development`。

## Worker 存取與身分

| 名稱 | 用途 |
| --- | --- |
| `ALLOWED_DOMAIN` | 後端接受的 Google email domain |
| `ALLOWED_ORIGINS` | 允許呼叫 Worker 的逗號分隔 Origin |
| `ADMIN_EMAILS` | 平台管理員 email 清單；唯一的 super-admin authority |
| `FIREBASE_PROJECT_ID` | Firebase token 驗證 project |
| `FIREBASE_PROJECT_NUMBER` | App Check / app identity 驗證使用的 project number |
| `FIREBASE_APP_IDS` | Worker 接受的 Firebase app ID |
| `FIREBASE_WEB_API_KEY` | Firebase backend flow 使用的 Web API key |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Firebase / FCM service account JSON |
| `TURNSTILE_SECRET_KEY` | Cloudflare Turnstile Siteverify secret |
| `HEALTHCHECK_SECRET` | 受保護 healthcheck 的 header secret |
| `MEDIA_SIGNING_SECRET` | 簽署媒體 delivery URL，至少 32 random bytes |
| `REALTIME_TICKET_SECRET` | 簽署短效 WebSocket ticket，至少 32 random bytes |
| `CLOUDFLARE_WORKER_URL` | 部署及 smoke test 使用的 Worker URL；Worker 內映射為 `PUBLIC_API_URL` |

`NEXT_PUBLIC_ALLOWED_DOMAIN` 和 `ALLOWED_DOMAIN` 應設成同一值；真正的拒絕判斷以後端為準。

Backend deployment 對這組值做缺值檢查：`ADMIN_EMAILS`、`ALLOWED_DOMAIN`、`ALLOWED_ORIGINS`、Cloudflare account / token / Worker URL、三個 Cloudinary credential、四個 Firebase backend identity 值、service account JSON、healthcheck / media / realtime / Turnstile secret、Neon owner URL 與 runtime password。

### 值的格式

- `ALLOWED_ORIGINS` 可以放多個逗號分隔的完整 Origin；smoke test 使用第一個。
- `ADMIN_EMAILS` 是後端解析的管理員 email 集合。名單是唯一授權來源，不在前端或資料表另設開關。
- `FIREBASE_APP_IDS` 可以列出 Worker 接受的 Firebase app identity；要與實際 web app 相符。
- `GOOGLE_SERVICE_ACCOUNT_JSON` 保存完整 JSON。GitHub Secret 內保留合法 JSON 字串，不拆成數個欄位。
- `MEDIA_SIGNING_SECRET`、`REALTIME_TICKET_SECRET` 至少 32 random bytes。
- `CLOUDFLARE_WORKER_URL`、`NEXT_PUBLIC_API_BASE_URL` 與 Worker 的 `PUBLIC_API_URL` 應指向同一部署；render workflow 會完成後兩者的映射。

## 資料庫與 Cloudflare

| 名稱 | 用途 |
| --- | --- |
| `NEON_DATABASE_URL` | Neon direct、SSL-enabled owner URL，不使用 pooled URL |
| `NEON_RUNTIME_PASSWORD` | 獨立的 `novae_runtime` password |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account |
| `CLOUDFLARE_API_TOKEN` | GitHub Actions 部署 Worker / Queue / Hyperdrive |
| `CLOUDFLARE_HYPERDRIVE_ID` | 32 位小寫 hex Hyperdrive ID |
| `CLOUDFLARE_WORKER_NAME` | 選用 Environment variable；production 預設 `novae-api` |
| `CLOUDFLARE_QUEUE_NAME` | 選用 Environment variable；production 預設 `novae-jobs` |

GitHub Actions 每次 backend deployment 都重新配置 runtime role，把驗證後的 runtime URL 同步到 Hyperdrive，並關閉 Hyperdrive query cache。

`NEON_DATABASE_URL` 必須是 direct、SSL-enabled owner connection。Migration script 會把 `sslmode=prefer`、`require` 或 `verify-ca` 強制提升成 `verify-full`。不要把 pooled URL 或 `novae_runtime` URL 放在這個 secret。

`CLOUDFLARE_HYPERDRIVE_ID` 必須是 32 個小寫十六進位字元。`CLOUDFLARE_WORKER_NAME` 與 `CLOUDFLARE_QUEUE_NAME` 是 GitHub Environment variables，不是 secrets；留空時 renderer 依 production / development 命名。

## 媒體與選用整合

| 名稱 | 用途 |
| --- | --- |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud |
| `CLOUDINARY_API_KEY` | 建立 signed upload session 與部署 upload preset |
| `CLOUDINARY_API_SECRET` | API / webhook signature 驗證 |
| `NOTION_TOKEN` | 選用的 Notion integration token |
| `NOTION_DATABASE_ID` | Notion database；與 token 一起提供或一起省略 |
| `NOTION_DATA_SOURCE_ID` | 選用 data source；提供時前兩者也必須存在 |

Notion 完全不使用時，三個值全部留空。只要提供 `NOTION_TOKEN` 或 `NOTION_DATABASE_ID` 其中一個，workflow 就會拒絕部署；`NOTION_DATA_SOURCE_ID` 不能單獨存在。Renderer 依 token 是否存在設定 `NOTION_ENABLED`。

Cloudinary 三個值是 backend deployment 必填，因為圖片 session、authenticated delivery、webhook 與 deletion recovery 都依賴它。部署流程會用這組 credential idempotently 建立專案要求的 upload preset。

## Vercel 與備份

| 名稱 | 儲存位置 | 用途 |
| --- | --- | --- |
| `VERCEL_TOKEN` | GitHub Environment secret | Vercel CLI authentication |
| `VERCEL_PROJECT_ID` | GitHub Environment secret | Vercel project |
| `VERCEL_ORG_ID` | GitHub Environment secret | Vercel team / account |
| `BACKUP_AGE_RECIPIENT` | production Environment variable | age 公鑰，用於加密資料庫備份 |

不要把 `.env.local` 或 `cloudflare/.dev.vars` 提交進 git；repository 只保留 example 檔。

## Cloudflare bindings

除了環境變數，Worker 還需要這些 binding：

| 類型 | Binding |
| --- | --- |
| Hyperdrive | `HYPERDRIVE` |
| Queue producer | `JOBS` |
| Durable Object | `BUSINESS_RATE_LIMITS`、`REALTIME` |
| Native rate limit | `INVALID_AUTH_IP_RATE_LIMITER`、`READ_RATE_LIMITER`、`WRITE_RATE_LIMITER`、`SENSITIVE_WRITE_RATE_LIMITER`、`ADMIN_WRITE_RATE_LIMITER`、`UPLOAD_WRITE_RATE_LIMITER`、`UPLOAD_RESOLVE_RATE_LIMITER`、`SYNC_USER_RATE_LIMITER`、`WEBHOOK_IP_RATE_LIMITER`、`WEBHOOK_GLOBAL_RATE_LIMITER`、`MEDIA_USER_RATE_LIMITER`、`MEDIA_INVALID_IP_RATE_LIMITER`、`LOGIN_IP_RATE_LIMITER` |

Durable Object migration tag 是 `v1`，建立 SQLite-backed `BusinessRateLimiter` 與 `RealtimeHub`。Cron 固定每 30 分鐘觸發一次。

## 設定改完怎麼驗證

| 改動 | 驗證 |
| --- | --- |
| `.env.local` 的 frontend 值 | `bun run dev`，完成登入與一次 API read |
| `config/*.config.json` | `bun run generate:all`、`bun run verify:local` |
| Worker secret / binding | `bun run verify:integration`，再由 development Environment 手動 dispatch backend workflow |
| Firebase App Check / Turnstile | Development deployment 完成 login-check、session restore 與 profile sync |
| Neon credential | Backend workflow 的 runtime role query 與最後 healthcheck |
| Cloudinary | Upload preset configuration、上傳一張圖、解析 full / thumbnail，再刪除 |
| Push | 真實 HTTPS Origin 上註冊 token並觸發一個符合 preference 的事件 |
