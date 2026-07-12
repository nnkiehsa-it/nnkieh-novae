# Supabase：資料庫、金鑰與部署憑證

[English](../en/deployment/supabase.md) · [回到部署總覽](../deployment-guide.md)

## 1. 註冊與建立 project

1. 到 [Supabase Dashboard](https://supabase.com/dashboard) 使用 GitHub 登入。
2. 建立 organization，再按 **New project**。
3. Name 可填 `novae-production`；選離主要使用者較近且符合資料政策的 region。
4. 產生一組獨立、長且隨機的 database password，立即保存到密碼管理器。這不是 Supabase 登入密碼。
5. 選方案後建立，等待 project ready。不要手動建立 Novae tables；第一次 backend workflow 會執行 migrations。

## 2. Project URL 與 publishable key

Project 上方按 **Connect**，或到 **Settings → API Keys**：

| 畫面值 | GitHub secret |
| --- | --- |
| Project URL，例如 `https://abc.supabase.co` | `VITE_SUPABASE_URL` |
| Publishable key，例如 `sb_publishable_...` | `VITE_SUPABASE_PUBLISHABLE_KEY` |

Publishable key 會進入瀏覽器，Novae 仍靠 RLS 與後端驗證保護資料。不要把 secret key 或 `service_role` 填入 `VITE_SUPABASE_PUBLISHABLE_KEY`。官方參考：[Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys)。

## 3. Project ref

到 **Settings → General** 複製 **Reference ID**，填 `SUPABASE_PROJECT_REF`。它通常也是 Project URL 的子網域部分，例如 URL 是 `https://abcdefgh.supabase.co`，ref 就是 `abcdefgh`；仍建議從設定頁複製，避免抄錯。

## 4. Database password

將建立 project 時保存的密碼填入 `SUPABASE_DB_PASSWORD`。若忘記：

1. **Settings → Database**（部分新版介面為 **Database → Settings**）。
2. 找 **Database password → Reset database password**。
3. 產生並保存新密碼，再更新 GitHub secret。

重設後舊的連線字串會失效。官方參考：[Reset a database password](https://supabase.com/docs/guides/troubleshooting/how-do-i-reset-my-supabase-database-password-oTs5sB)。

## 5. service_role key

目前部署流程需要 JWT 格式的 legacy `service_role`：

1. **Settings → API Keys → Legacy API Keys**。
2. 顯示 `service_role` secret，複製到 `SUPABASE_SERVICE_ROLE_KEY`。
3. 不要使用 `anon`、publishable 或新的 `sb_secret_...` 代替，也不要放在任何 `VITE_*`。

它會繞過 RLS，只能存 GitHub secret／Edge secret。workflow 會以 `APP_SUPABASE_SERVICE_ROLE_KEY` 名稱傳給應用程式，學生不需要另外建立該 GitHub secret。

## 6. Supabase access token

1. 點 Dashboard 左下帳號圖示 → **Account Preferences / Access Tokens**，或直接開 [Access Tokens](https://supabase.com/dashboard/account/tokens)。
2. **Generate new token**，名稱填 `novae-github-production`。
3. 複製只顯示一次的 token 到 `SUPABASE_ACCESS_TOKEN`。

這是 GitHub Actions 代表你執行 CLI 部署的權限，不是 project API key。外洩時從同一頁 revoke。

## 7. SUPABASE_URL 為什麼不用填

Supabase 託管的 Edge Functions 自動提供 `SUPABASE_URL` 與平台預設金鑰。根目錄 `.env.example` 列出 `SUPABASE_URL` 只是方便「自行在 Supabase 以外手動執行 Edge code」的特殊情境；標準 GitHub 部署不要建立它。官方參考：[Edge Function environment variables](https://supabase.com/docs/guides/functions/secrets#default-secrets)。

## 完成檢查

- `VITE_SUPABASE_URL` 與兩個 key 都屬於同一個 production project。
- publishable 與 `service_role` 沒有填反。
- database password 與 access token 已放入密碼管理器。
- 沒有手動執行 schema SQL 或修改既有 migrations。

下一步：[設定 Cloudinary](cloudinary.md)。
