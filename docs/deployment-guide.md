# 從零部署 Novae

[English](en/deployment-guide.md) · [文件首頁](README.md)

這份指南不預設你熟悉 GitHub、環境變數或任何雲端服務。完成後，`main` 會自動部署正式環境：Vercel 顯示網頁，Supabase 保存資料與執行後端，Firebase 負責 Google 登入及推播，Cloudinary 處理圖片，Notion保存營運副本，Upstash 執行限流。

## 先理解三個放置位置

| 位置 | 放什麼 | 是否進入瀏覽器 |
| --- | --- | --- |
| 本機 `.env` | 本機測試用的 `VITE_*` 公開設定 | 是 |
| GitHub Environment secrets | Actions 部署時需要的全部值 | 只有 `VITE_*` 會被打包 |
| Supabase Edge secrets | 後端執行時使用；workflow 會由 GitHub 自動寫入 | 否 |

不要把真實值填回 `.env.example`、commit 到 Git，或貼在 issue、聊天與截圖中。名稱含 `VITE_` 只表示它會公開給瀏覽器，並不表示 GitHub 畫面要填在 **Variables**；本專案 workflow 全部從 **Environment secrets** 讀取。

## 你要完成的教材

依序開啟，每一頁都有註冊、點擊路徑、要複製的值與自我檢查：

1. [GitHub 帳號、Fork、Actions 與 Environment](deployment/github.md)
2. [Firebase：登入、Web App、推播、Service Account、App Check](deployment/firebase.md)
3. [Supabase：資料庫、前後端金鑰與 CLI 部署憑證](deployment/supabase.md)
4. [Cloudinary：圖片憑證與 callback 簽章](deployment/cloudinary.md)
5. [Notion：營運副本資料庫與 integration](deployment/notion.md)
6. [Upstash：限流資料庫與 REST token](deployment/upstash.md)
7. [Vercel、GitHub secrets、第一次部署與驗收](deployment/vercel-github.md)

建議先建立一份只存在自己電腦的暫存表，逐項取得後立刻填入 GitHub，再刪除暫存表。不要使用線上試算表保存私密金鑰。

## production 與 development 是什麼

工作流程依 branch 自動選擇 GitHub Environment：

| Git branch | GitHub Environment | Vercel 類型 | 用途 |
| --- | --- | --- | --- |
| `main` | `production` | Production | 真正給全校使用 |
| `dev` | `development` | Preview | 測試更新 |

第一次只想完成正式站，可以先只建立 `production`。要使用 `dev` 時，再建立 `development`，並為它準備另一組 Supabase、Firebase、Cloudinary、Notion、Upstash 資源。不要讓測試資料、限流計數或圖片混進正式環境。

## 完整變數總表

### 前端與 Vercel

| GitHub secret | 從哪裡取得 |
| --- | --- |
| `VITE_SCHOOL_NAME` | 自己輸入，例如 `範例高中` |
| `VITE_ALLOWED_DOMAIN` | 學校信箱 `@` 後面的網域，例如 `school.edu.tw` |
| `VITE_FIREBASE_API_KEY` | Firebase Web App 的 `apiKey` |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase Web App 的 `authDomain` |
| `VITE_FIREBASE_PROJECT_ID` | Firebase Web App 的 `projectId` |
| `VITE_FIREBASE_APP_ID` | Firebase Web App 的 `appId` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Firebase Web App 的 `messagingSenderId` |
| `VITE_FIREBASE_VAPID_KEY` | Firebase Cloud Messaging 的 Web Push public key |
| `VITE_FIREBASE_APP_CHECK_ENABLED` | 初次部署填 `false`；完成 App Check 後才改 `true` |
| `VITE_RECAPTCHA_ENTERPRISE_SITE_KEY` | 啟用 App Check 時的 reCAPTCHA Enterprise site key；否則可留空不建 |
| `VITE_SUPABASE_URL` | Supabase Connect 顯示的 Project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key，不是 secret/service role key |
| `VERCEL_TOKEN` | Vercel Account Settings → Tokens |
| `VERCEL_ORG_ID` | Vercel Team/Account Settings 的 ID |
| `VERCEL_PROJECT_ID` | Vercel Project Settings → General 的 Project ID |

### 後端與部署

| GitHub secret | 從哪裡取得或怎麼填 |
| --- | --- |
| `SUPABASE_ACCESS_TOKEN` | Supabase Account → Access Tokens |
| `SUPABASE_PROJECT_REF` | Supabase Project Settings → General → Reference ID |
| `SUPABASE_DB_PASSWORD` | 建立 Supabase project 時設定的 database password |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Settings → API Keys → Legacy → `service_role` |
| `FIREBASE_PROJECT_ID` | 與 `VITE_FIREBASE_PROJECT_ID` 相同 |
| `FIREBASE_WEB_API_KEY` | 與 `VITE_FIREBASE_API_KEY` 相同 |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Firebase Service accounts 下載檔案的完整 JSON 內容，不是檔案路徑 |
| `ALLOWED_DOMAIN` | 與 `VITE_ALLOWED_DOMAIN` 完全相同 |
| `ADMIN_EMAILS` | 完整管理員信箱；多人用半形逗號分隔 |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary Product Environment 的 cloud name |
| `CLOUDINARY_API_KEY` | 同一 Product Environment 的 API key |
| `CLOUDINARY_API_SECRET` | 同一 Product Environment 的 API secret |
| `CLOUDINARY_WEBHOOK_SECRET` | 標準 Cloudinary HMAC 驗證填同一個 API secret |
| `WEBHOOK_SECRET` | 自行產生的 32-byte 隨機值 |
| `NOTION_TOKEN` | Notion internal integration secret |
| `NOTION_DATABASE_ID` | 已分享給 integration 的 database ID |
| `NOTION_VERSION` | 選填；不建立時 workflow 使用 `2022-06-28` |
| `UPSTASH_REDIS_REST_URL` | Upstash database 的 HTTPS REST URL |
| `UPSTASH_REDIS_REST_TOKEN` | 同一 database 的 Standard REST token |

`SUPABASE_URL` 不在表內：Supabase 託管的 Edge Functions 會自動提供它。不要建立名為 `SUPABASE_URL` 的 GitHub secret。workflow 會把 GitHub 的 `SUPABASE_SERVICE_ROLE_KEY` 以應用程式實際使用的 `APP_SUPABASE_SERVICE_ROLE_KEY` 名稱寫入 Edge secrets。

## 產生 WEBHOOK_SECRET

在 PowerShell 執行下列指令，複製輸出的 64 個十六進位字元。它只用於 Novae 內部 healthcheck 與 worker，不要與任何供應商密碼共用。

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

## 第一次發布的正確順序

1. 完成七份教材，建立 GitHub `production` Environment 的全部必填 secrets。
2. GitHub repository → **Actions** → **Deploy Supabase Backend** → **Run workflow** → branch 選 `main`。
3. 等 migrations、Edge Functions、healthcheck、maintenance 全部綠色。
4. **Actions** → **Deploy Frontend to Vercel** → **Run workflow** → `main`。
5. 從 Vercel 開啟正式網址，再把該 hostname 加入 Firebase Authentication authorized domains 與 reCAPTCHA/App Check allowed domains。
6. 依[Vercel 與第一次部署](deployment/vercel-github.md#上線驗收)逐項驗收。

Cloudinary 不需要另外建立全域 webhook trigger：Novae 每次上傳會自動傳入該次的 `notification_url`。額外建立全域 upload trigger 可能造成重複 callback。

## 常見第一次失敗

| 畫面訊息 | 最先檢查 |
| --- | --- |
| `Missing deployment secrets` | secret 是否建在 `production` 的 **Environment secrets**，名稱是否完全相同 |
| `Missing Supabase backend secrets` | `ADMIN_EMAILS`、Notion、Upstash 與 `GOOGLE_SERVICE_ACCOUNT_JSON` 是否漏填 |
| Supabase link/database password failed | project ref 與 database password 是否屬於同一專案；必要時重設密碼 |
| Firebase 401/登入失敗 | Web config 是否來自同一 Web App、Google provider 與 authorized domain 是否啟用 |
| Cloudinary 401 | 四個 Cloudinary 值是否取自同一 Product Environment；webhook secret 是否等於 API secret |
| 網頁成功但資料操作失敗 | 先確認 backend workflow 已成功，再確認前端 Supabase URL/key 指向同一 production 專案 |

仍無法排除時，前往[故障排除](troubleshooting.md)。資料庫 reset 與 Cloudinary reset 會刪除資料，不能當成一般修復步驟。
