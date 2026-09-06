# 部署與維運

## Environment 對應

GitHub branch 決定部署環境：

| Branch | GitHub Environment | Vercel target | Worker / Queue naming |
| --- | --- | --- | --- |
| `main` | `production` | production | 預設 `novae-api` / `novae-jobs` |
| `dev` | `development` | preview | 名稱由 renderer 加上 environment，或使用 Environment variables 覆寫 |

所有 secret 和 variable 都設在相應 GitHub Environment。完整清單見[設定參考](configuration.md)。

`main` 與 `dev` 都會觸發驗證；不是所有變更都觸發部署。Frontend workflow 監看 `src/`、公開資產、四份 generated source config、Next / TypeScript / Vercel 設定、generator、package 與 lockfile。Backend workflow 監看 `cloudflare/`、`database/`、`config/`、database / provider / Worker config 腳本、package、lockfile 和自身 workflow。

只改 README 或 `docs/` 不會部署 production，也不會啟動 CI verification workflow。

## Backend deployment

`.github/workflows/deploy-backend.yml` 在 backend 相關檔案 push 到 `main` / `dev` 時執行，也可以手動啟動。Push deployment 會等待同一 commit 的 `Verify Changes` 成功；手動執行因為沒有對應 push gate，會自行跑 generated contract、type、architecture 與 integration verification。

Backend concurrency group 是 `backend-${github.ref}`，`cancel-in-progress: false`。同一 branch 的 migration / Worker deployment 會排隊，不會讓新 push 中止正在套 schema 的 job。

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

手動 backend deployment 會額外執行：

- 四個 config generator 並要求 `git diff --exit-code`
- Worker typecheck 與 integration-test typecheck
- Architecture tests
- 完整 `verify:integration`

Push deployment 已等待同一 commit 的 Verify Changes，因此不重跑這套 backend integration。兩條路最後都會做相同的設定驗證、migration、runtime role、provider configuration、Worker deploy 與 smoke test。

### Backend smoke test

部署後 workflow 最多嘗試 12 次，每次間隔 5 秒：

- 不帶 auth 呼叫 `getCurrentUserRole` 必須回 `401`。
- 帶 `x-healthcheck-secret` 呼叫 `healthcheck` 必須回 `200`，body 包含 `"ok":true`。

Origin 使用 `ALLOWED_ORIGINS` 的第一個值。任一條件一直不成立，deployment 失敗，不會把健康狀態只判斷成 Worker URL 能連線。

## Frontend deployment

`.github/workflows/deploy-frontend.yml` 同樣等待該 commit 的 verification。它驗證所有 Firebase / App Check / Vercel 值，且部署環境必須設定 `NEXT_PUBLIC_FIREBASE_APP_CHECK_ENABLED=true`，接著用固定的 Vercel CLI 版本 build prebuilt artifact。

若同一 commit 也改動 backend、database 或 generated config，workflow 會等 matching backend deployment 成功後才發布前端 artifact。這避免新前端先接到舊 action 或 schema。

Frontend concurrency group 是 `frontend-${github.ref}`，`cancel-in-progress: true`。新的同 branch push 可以取消尚未完成的舊前端 build。流程使用 Vercel CLI `58.9.0`：先 `pull` project info，再 `build`，最後 `deploy --prebuilt`；`main` 會加 `--prod`，`dev` 使用 preview environment。

Build artifact 完成後才檢查 matching backend deployment。若 diff 沒碰 `cloudflare/`、`database/`、`config/` 或 backend generator / renderer，frontend 不等待 backend workflow。

## 排程工作

Worker 的 cron 是 `*/30 * * * *`，負責啟動到期支援、retention 與其他 maintenance 工作；大量異動會切成 Queue batch。

Queue producer 與 consumer 都使用相同環境的 queue。Production 預設 `novae-jobs`；development 若沒指定名稱，renderer 使用帶環境尾碼的 queue。Consumer 參數是 batch size 10、batch timeout 5 秒、max retries 5。

資料庫備份 workflow 每天 `18:20 UTC` 檢查一次，只有距離最近備份至少 72 小時才建立新檔。它使用 PostgreSQL 18 `pg_dump` 產生 custom-format backup，先以 `age` 公鑰加密，再連同 SHA-256 checksum 上傳為保存 7 天的 GitHub artifact；repository 只保留最新兩份 Novae backup artifact。也可用 workflow dispatch 強制執行一次。

備份 job 固定使用 `production` Environment，concurrency group 是 `neon-database-backup` 且不取消進行中的工作。Schedule 每天檢查的原因是 GitHub 排程可能延遲；真正 cadence 由 artifact timestamp 的 259,200 秒門檻決定。Manual dispatch 跳過 cadence 判斷，直接建立新備份。

備份內容使用 `--no-owner --no-privileges`，方便還原到重新建立的 role 配置。Plaintext `novae.dump` 在 runner 內加密後立刻刪除，只上傳 `.dump.age` 和 `.sha256`。

## 災難重設

`Reset Database and Cloudinary` 是手動、破壞性 workflow，只有輸入完全相符的 `RESET_DATABASE_AND_CLOUDINARY` 才會繼續。它會刪除 `app_api`、`app_private` 與 `public` schema，重新套用 migration、恢復 runtime role、清空 Cloudinary resources，再重建 upload preset。

這個 workflow 不會還原備份。需要復原資料時，應先下載加密 backup artifact、驗證 `.sha256`，以持有的 age private key 解密，再使用相容的 PostgreSQL 工具還原。

重設流程依 branch 選 `production` 或 `development` Environment，且同一 ref 不允許並行。它會永久刪 application schema 和 Cloudinary asset；這是唯一內建的完整資料清除入口。

## 發布後檢查

- Backend workflow 的 auth / database smoke test 必須通過。
- Frontend 應能完成 Google 登入、session bootstrap 和首次設定判斷。
- 管理介面確認 Queue job 沒有持續失敗，Cloudinary deletion job 沒有堆積。
- Web Push 和 realtime 要用允許的 production Origin 實測；本機成功不代表瀏覽器已授予通知權限。

### 可從 dashboard 判讀的狀態

`overall_status` 會綜合 delivery、Push、upload、cleanup 和 scheduled maintenance。維運時至少檢查：pending / failed Notion sync、failed delivery、failed Push、stuck upload、cleanup backlog、maintenance 的 failed task code、recent failure 的 `failure_id` 和 retry time。

如果 API response 已有 `failureId`，先用相同 `operationId` 找 Worker structured log，再比對 dashboard 的 delivery / job failure。不要先重送不同 operation ID 的 write，否則會建立第二個合法 operation。
