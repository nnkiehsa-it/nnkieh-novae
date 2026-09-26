# 部署與維運

## Environment 對應

GitHub branch 決定部署環境：

| Branch | GitHub Environment | Vercel target | Worker / Queue naming |
| --- | --- | --- | --- |
| `main` | `production` | production | 預設 `novae-api` / `novae-jobs` |
| `dev` | `development` | preview | 名稱由 renderer 加上 environment，或使用 Environment variables 覆寫 |

所有 secret 和 variable 都設在相應 GitHub Environment。完整清單見[設定參考](configuration.md)。

`main` 與 `dev` 都會觸發驗證；不是所有變更都觸發部署。單一 `Verify and Deploy` workflow 監看 app、backend、測試、設定、scripts、package / lockfile 與 workflow 變更，再由 changes job 分流 backend 與 browser job。

只改 README 或 `docs/` 不會部署 production，也不會啟動 CI verification workflow。

## Backend deployment

`.github/workflows/verify-and-deploy.yml` 在 backend 相關檔案 push 到 `main` / `dev` 時執行，也可以手動啟動。Push 與 manual deployment 都先經過同一 workflow 的 `fast` 與 `backend_verify` job；成功後直接進入 `deploy_backend`，不再透過另一個 workflow 輪詢同一 commit。

整個 workflow 的 concurrency group 是 `verify-deploy-${github.ref}`，`cancel-in-progress: false`。同一 branch 的 migration / Worker deployment 會排隊，不會讓新 push 中止正在套 schema 的 job。

部署順序固定為：

1. 驗證必填設定與選用 Notion 組合。
2. 對 Neon owner connection 套用 forward migration。
3. 建立或 rotate 最低權限 `novae_runtime`。
4. idempotently 設定 Cloudinary authenticated upload preset。
5. render environment-specific Wrangler config。
6. 把 runtime connection 同步到 Hyperdrive，確保 Queue 存在。
7. 以 ephemeral secrets file 部署 Worker，隨後刪除該檔。
8. 驗證未授權 action 回傳 `401`，受保護 healthcheck 回傳 `200` 和 `ok: true`。

Backend deployment 不回改 migration，也不把 owner URL 交給 Worker。

### 手動 dispatch 的差異

手動啟動時在 `deploy_target` 選 `all`、`backend` 或 `frontend`。選取的部署路徑會依然先跑其所需的 verify job；`all` 會平行驗證 backend 與 browser，之後 frontend deploy job 會在同一 runner 完成 build 與 publish。

### Backend smoke test

部署後 workflow 最多嘗試 12 次，每次間隔 5 秒：

- 不帶 auth 呼叫 `getCurrentUserRole` 必須回 `401`。
- 帶 `x-healthcheck-secret` 呼叫 `healthcheck` 必須回 `200`，body 包含 `"ok":true`。

Origin 使用 `ALLOWED_ORIGINS` 的第一個值。任一條件一直不成立，deployment 失敗，不會把健康狀態只判斷成 Worker URL 能連線。

## Frontend deployment

同一個 `.github/workflows/verify-and-deploy.yml` 的 `deploy_frontend` 會驗證所有 Firebase / App Check / Vercel 值，且部署環境必須設定 `NEXT_PUBLIC_FIREBASE_APP_CHECK_ENABLED=true`，接著在同一 runner 用固定的 Vercel CLI 版本 build 並直接 publish prebuilt output。

若同一 commit 也改動 backend、database 或 generated config，workflow 會等 `deploy_backend` 成功後才開始 frontend build 與 publish。這避免新前端先接到舊 action 或 schema，也避免跨 runner 傳遞 `.vercel` / `.next` 內容。

流程使用 Vercel CLI `58.9.0`：先 `pull` project info，再 `build`，最後在同一 job 直接 `deploy --prebuilt`；`main` 會加 `--prod`，`dev` 使用 preview environment。

若 diff 沒碰 `cloudflare/`、`database/`、`config/` 或 backend generator / renderer，frontend publish 不會等待 backend deployment job。

## 排程工作

Worker 的 cron 是 `*/30 * * * *`，負責啟動到期支援、retention 與其他 maintenance 工作；大量異動會切成 Queue batch。

Queue producer 與 consumer 都使用相同環境的 queue。Production 預設 `novae-jobs`；development 若沒指定名稱，renderer 使用帶環境尾碼的 queue。Consumer 參數是 batch size 10、batch timeout 5 秒、max retries 5。

資料庫復原使用 Neon 原生 Backup & Restore。Neon Free 方案包含最多 6 小時或 1 GB 變更量的即時還原歷史，以及 1 個手動快照；排程快照不適用於 Free。實際保留窗與可用功能依 Neon 專案方案為準。從 Neon Console 的 Backup & Restore 預覽並選擇還原時間；還原會替換所選 branch 的資料，執行前需確認 branch 與時間點。這是同一個 Neon 帳戶內的復原能力，不是異地副本。

## 災難重設

`Reset Database and Cloudinary` 是手動、破壞性 workflow，只有輸入完全相符的 `RESET_DATABASE_AND_CLOUDINARY` 才會繼續。它會刪除 `app_api`、`app_private` 與 `public` schema，重新套用 migration、恢復 runtime role、清空 Cloudinary resources，再重建 upload preset。

資料庫復原透過 Neon Backup & Restore 完成；受保護重設 workflow 不會還原資料庫。

重設流程依 branch 選 `production` 或 `development` Environment，且同一 ref 不允許並行。它會永久刪 application schema 和 Cloudinary asset；這是唯一內建的完整資料清除入口。

## 發布後檢查

- Backend workflow 的 auth / database smoke test 必須通過。
- Frontend 應能完成 Google 登入、session bootstrap 和首次設定判斷。
- 管理介面確認 Queue job 沒有持續失敗，Cloudinary deletion job 沒有堆積。
- Web Push 和 realtime 要用允許的 production Origin 實測；本機成功不代表瀏覽器已授予通知權限。

### 可從 dashboard 判讀的狀態

`overall_status` 會綜合 delivery、Push、upload、cleanup 和 scheduled maintenance。維運時至少檢查：pending / failed Notion sync、failed delivery、failed Push、stuck upload、cleanup backlog、maintenance 的 failed task code、recent failure 的 `failure_id` 和 retry time。

如果 API response 已有 `failureId`，先用相同 `operationId` 找 Worker structured log，再比對 dashboard 的 delivery / job failure。不要先重送不同 operation ID 的 write，否則會建立第二個合法 operation。
