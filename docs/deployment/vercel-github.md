# Vercel、GitHub secrets 與第一次部署

[English](../en/deployment/vercel-github.md) · [回到部署總覽](../deployment-guide.md)

先完成 Firebase、Supabase、Cloudinary、Notion、Upstash 教材。這一頁會建立 Vercel project、取得三個部署憑證、把全部值填入 GitHub `production`，然後執行第一次發布。

## 1. 註冊 Vercel 並匯入 fork

1. 到 [Vercel](https://vercel.com/signup) 選 **Continue with GitHub**。
2. GitHub 要求安裝 Vercel App 時，只授權自己的 `novae` fork 即可。
3. Dashboard → **Add New → Project**，在自己的 `<帳號>/novae` 旁按 **Import**。
4. Framework preset 應辨識為 Vite；Root Directory 保持 repository root。
5. 這次可先按 **Deploy** 建立 project。即使因缺少環境值而失敗，project ID 仍會建立；正式部署由 GitHub Actions 完成。

## 2. 避免 Vercel 與 Actions 重複部署

Vercel Git integration 預設會在 push 時自動部署，而本 repository 已有專用 Actions workflow。Novae 的 `vercel.json` 已設定 `git.deploymentEnabled: false`，fork 匯入後會保留 repository 連結但不因 Git push 另起部署；之後以 GitHub Actions run 為準。不要在 Vercel 設定 **Ignored Build Step → Don't build anything**，那會連 Actions 的預建部署也一起取消。官方參考：[停用 Vercel Git 自動部署](https://vercel.com/docs/project-configuration/git-configuration#turning-off-all-automatic-deployments)。

## 3. 取得 VERCEL_TOKEN

1. 右上頭像 → **Account Settings → Tokens**，或開 [Vercel Tokens](https://vercel.com/account/tokens)。
2. 按 **Create Token**，名稱 `novae-github`。
3. Scope 選擁有該 project 的個人帳號／team；設定合理到期日並保存。
4. 複製只顯示一次的值到 GitHub `VERCEL_TOKEN`。

官方參考：[Vercel access token](https://vercel.com/kb/guide/how-do-i-use-a-vercel-api-access-token)。

## 4. 取得 Project ID 與 Org ID

- `VERCEL_PROJECT_ID`：Project → **Settings → General**，找到 **Project ID**，通常以 `prj_` 開頭。
- `VERCEL_ORG_ID`：右上切到擁有 project 的 team／個人 scope → **Settings → General**，找到 **Team ID**；個人帳號也由 Vercel CLI 使用對應 owner ID，通常以 `team_` 開頭。

三個值的 scope 必須一致。常見 `project not found` 是 token 屬於個人 scope，但 project 在 team，或 Org ID 抄自另一個 team。

## 5. 把 secrets 填進 production

進 GitHub fork → **Settings → Environments → production → Environment secrets**。依[部署總覽完整表](../deployment-guide.md#完整變數總表)逐項新增。

特別檢查：

- `VITE_ALLOWED_DOMAIN` 與 `ALLOWED_DOMAIN` 完全相同，只填 `school.edu.tw`，不要 `@school.edu.tw`、`https://` 或路徑。
- `ADMIN_EMAILS` 必須是完整信箱，例如 `admin@school.edu.tw,backup@school.edu.tw`，中間用半形逗號。
- `GOOGLE_SERVICE_ACCOUNT_JSON` 是完整 `{...}`，不是檔案名稱。
- `CLOUDINARY_WEBHOOK_SECRET` 等於 `CLOUDINARY_API_SECRET`。
- `WEBHOOK_SECRET` 是獨立隨機值。
- 初次部署 `VITE_FIREBASE_APP_CHECK_ENABLED` 填 `false`；不用建立空白的 `VITE_RECAPTCHA_ENTERPRISE_SITE_KEY`。
- 不要建立 `SUPABASE_URL`；`NOTION_VERSION` 也可不建立。

## 6. 第一次部署後端

1. GitHub → **Actions → Deploy Supabase Backend**。
2. 右側 **Run workflow**，branch 選 `main`，再按綠色 **Run workflow**。
3. 點進該 run，確認以下 steps 全為綠色：驗證架構、Link Supabase、Push migrations、Set Edge Function secrets、Deploy Functions、healthcheck、maintenance cleanup。
4. 若失敗，展開第一個紅色 step；修正 GitHub secret 後按 **Re-run failed jobs**。不要重設資料庫。

workflow 會建立資料表、套用 RLS、寫入 Edge secrets 並部署所有 Functions。之後修改 `supabase/**` 或 `config/**` 並 push `main` 會自動再部署。

## 7. 第一次部署前端

1. **Actions → Deploy Frontend to Vercel → Run workflow → main**。
2. 等待 Build 與 Deploy 綠色。
3. Vercel project → **Deployments** 開啟最新 Production deployment，記下 `<name>.vercel.app` hostname。
4. 回 Firebase Authentication authorized domains 加入該 hostname，不要包含 `https://`。
5. 如果 App Check 已啟用，也把 hostname 加入 reCAPTCHA Enterprise key 的 allowed domains。

之後修改前端相關路徑並 push `main` 會自動發布。GitHub Pages 的 `website/` 是產品介紹／文件站，不是 Novae 應用程式本體，也不需要上述應用 secrets。

## 上線驗收

建議使用一個管理員帳號與一個一般校內帳號：

1. 開啟正式網址，確認學校名稱正確，瀏覽器 console 沒有設定缺失。
2. Google 登入；非允許網域應被拒絕，校內 email 應成功。
3. `ADMIN_EMAILS` 中帳號登出再登入後應有管理功能；一般帳號不應看到管理操作。
4. 建立測試提案、留言、附議；管理員完成審核與狀態更新。
5. 上傳一張圖片，等待 callback，重新整理後仍可顯示。
6. 在允許通知的 HTTPS 瀏覽器註冊 Web Push，觸發通知並確認站內／系統通知。
7. 打開 Notion database，確認出現同步資料與日期欄位。
8. Supabase Dashboard → Edge Functions → Logs，確認沒有持續 401/500；Upstash metrics 應有少量 commands。
9. 在瀏覽器 Network/Source 確認看不到 service role、service-account private key、Cloudinary secret、Upstash token 或 Notion token。

## 建議的正式保護

- GitHub production Environment 設 required reviewer，限制 deployment branch 為 `main`。
- Firebase App Check 先觀察 metrics 再啟用 enforcement。
- 將所有供應商帳號加入密碼管理器與備援管理員，記錄學生交接流程。
- token 到期或人員離校時輪替，不要直接刪除仍被 production 使用的 key。
- 執行[維運手冊](../operations.md)的定期檢查與備份演練。
