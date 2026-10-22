# 本機開發

## 需求

- Node.js 24
- Bun 1.4
- Docker
- Windows：可使用的 WSL distribution；腳本會在 WSL 內啟動 Docker，並在完成後清理自己啟動的服務

版本由 repository 固定：`package.json` 要求 Node `>=24 <25`、Bun `>=1.4 <2`，package manager 是 `bun@1.4.0`。CI 也使用 Node 24 與 Bun 1.4.0。

先安裝 lockfile 固定的依賴：

```bash
bun install --frozen-lockfile
```

## 完整本機環境

日常看功能最直接的入口是：

```bash
bun run test:env
```

它會重建 PostgreSQL 17 測試資料庫、套用所有 migration、加入 deterministic local seed，配置最低權限 runtime role，再啟動：

| 服務 | 位址 |
| --- | --- |
| 前端（Vite dev server） | `http://127.0.0.1:3000` |
| Cloudflare Worker | `http://127.0.0.1:8787` |
| Firebase Auth Emulator UI | `http://127.0.0.1:4000/auth` |
| PostgreSQL owner connection | `postgresql://novae:novae-local@127.0.0.1:55432/novae` |

本流程使用本機 provider stub，不需要真實 Cloudinary、FCM 或 Notion credential。預設管理員帳號是 `admin@integration.invalid`，Auth Emulator 可另外建立任意 `@integration.invalid` 帳號。用 `Ctrl+C` 結束全部服務。

執行前請先釋放 `3000`、`4000`、`4400`、`4500`、`8787`、`9099` 與 `54330`。腳本偵測到占用時會直接停止，避免關掉不屬於它的 process。

### 啟動順序

`scripts/verify-integration.mjs --serve` 實際會做以下工作：

1. Windows 選定 WSL distribution，關閉 Docker systemd autostart；若 Docker 未啟動則由這次流程啟動。
2. 重建 `novae` database，套用全部 migration 和 `database/seed.local.sql`。
3. 建立只有 runtime 權限的 `novae_runtime`。
4. 啟動 port `54330` 的 Cloudinary / FCM / Notion provider stub，並設定本機 upload preset。
5. 以固定的 `firebase-tools@15.24.0` 啟動 Auth Emulator。
6. 用 `cloudflare/wrangler.json` 在 local mode 啟動 Worker。
7. 啟動 Vite dev server，確認 `/login` 回 `200`，再跑一次登入與 API routing probe。

任一 child process 提早退出時，錯誤會附上對應暫存 log 的尾端。`--serve` 會把整個環境放進一個 detached session：`bun run` 在 Ctrl+C 時會直接砍掉自己的 child，收尾根本來不及跑，因此 session 改以「launcher 消失」當作停止訊號。按下 `Ctrl+C` 後 shell prompt 會先回來，session 才反向停止自己建立的服務並把清理訊息印在同一個 terminal；Windows 上若 WSL 與 Docker 原本都沒啟動，清理後也會釋放該 WSL runtime。

### 本機資料

Local seed 適合手動瀏覽；integration verification 改用 `database/seed.integration.sql`。兩者都不會用在 production deployment。完整測試環境的固定連線如下：

| 身分 | Connection string | 用途 |
| --- | --- | --- |
| Owner | `postgresql://novae:novae-local@127.0.0.1:55432/novae` | Migration、seed、測試檢查 |
| Runtime | `postgresql://novae_runtime:novae-runtime-local@127.0.0.1:55432/novae` | Worker 實際查詢 |

## 只啟動前端

若要連到已存在的 Worker 與 Firebase project：

1. 將 `.env.example` 的 frontend 區段複製到 `.env.local`。
2. 填入 `NEXT_PUBLIC_*` 值。
3. 啟動開發伺服器。

```bash
bun run dev
```

Serwist 在 dev server 停用，因此開發時不會讓舊 service worker cache 干擾畫面。`NEXT_PUBLIC_LOCAL_DEV_AUTH` 只供 emulator flow 使用，部署環境不可開啟。

只跑 `bun run dev` 不會替你啟動 Worker、PostgreSQL 或 Auth Emulator。若 `.env.local` 的 `NEXT_PUBLIC_API_BASE_URL` 指到 `http://127.0.0.1:8787`，要自行確定 Worker 已在該 port 運作；要完整且一致的本機資料，直接使用 `bun run test:env`。

## 只操作資料庫

```bash
bun run db:start
bun run db:reset:local
bun run db:status
bun run db:stop
```

`db:reset:local` 會刪除並重建名為 `novae` 的本機資料庫，再套用 migration 和 local seed。`db:migrate` 則使用 `DATABASE_URL`；未提供時才連到專案固定的本機 owner URL。

各指令的實際差異：

| 指令 | 是否啟動 container | 是否刪資料 | Migration | Seed |
| --- | --- | --- | --- | --- |
| `db:start` | 是 | 否 | 否 | 否 |
| `db:reset:local` | 是 | 是 | 全部 | `seed.local.sql` |
| `db:migrate` | 否 | 否 | 只套未執行檔 | 否 |
| `db:seed:local` | 否 | 否 | 否 | `seed.local.sql` |
| `db:status` | 否 | 否 | 列出已套用檔 | 否 |
| `db:stop` | 停止既有 local container | 否 | 否 | 否 |

新增 schema 變更時，在 `database/migrations/` 新增依序命名的 SQL migration。已套用的檔案有 checksum 驗證，不修改舊 migration。接著執行 `bun run generate:database-contracts` 更新 Worker 使用的 generated contract。

## 手機預覽

手機分享用 `bun run preview:phone`，狀態／探測／停止分別用 `preview:phone:status`、`preview:phone:verify`、`preview:phone:stop`。腳本自動取得 Tailscale 裝置網址並在背景運行；日誌與狀態放在 `.novae-phone-preview/`。專案 skill 位於 `.agents/skills/novae-phone-preview/SKILL.md`，可用 `$novae-phone-preview` 呼叫。需要新版本時停止再啟動。

底層使用 `node scripts/verify-integration.mjs --serve --preview`，先建置，再用 `vite preview` 提供 production 預覽（帶與部署相同的 CSP，另加測試 stack 的 loopback 來源），停用測試 service worker；產物放在 `dist-local-preview`。一般 `--serve` 直接跑 Vite dev server，不寫產物。兩者都不碰正式建置的 `dist`，因為測試 build 的 CSP 允許 loopback，不能被誤部署。

測試環境支援 `NOVAE_TEST_PUBLIC_ORIGIN=https://<device>.<tailnet>.ts.net`，只接受 `--serve` 與 Tailscale HTTPS 裝置網址。Tailscale Serve 將 443 代理至前端連接埠、8443 至本機 Worker 8787、9443 至 Auth emulator 9099。手機須連同一個 tailnet；預覽自動登入種子測試管理員，不使用正式資料。停用代理時分別執行 `tailscale serve --https=443 off`、`--https=8443 off`、`--https=9443 off`。

## Generated artifacts

Action、錯誤碼、rate limit、營運政策與資料保留預設值直接寫在 `shared/` 的 TypeScript，前端與 Worker 共用同一份，不需要產生。`config/motion.config.json` 是 motion token 的來源；改動後執行：

```bash
bun run generate:all
```

生成內容會提交到 repository；`bun run verify:generated` 會重跑 generator 並拒絕 drift。

Generator 有 lock，`generate:all` 依序執行 motion token 與 HarmonyOS Sans TC subset。字型 subset 只收集目前 source 用到的繁中文字，生成後仍需通過 build budget。Database contract（`schema.generated.ts`）另由 `bun run generate:database-contracts` 對已 migrate 的資料庫產生。

## 常見失敗

### Port already occupied

Runner 會列出占用整合服務 port 的 PID。先關掉該程序再重跑；runner 不會替你終止啟動前已存在的服務。

### Docker / WSL 無法啟動

Windows 腳本需要至少一個可用的 WSL distribution。有多個 distribution 時會進行互動式選擇；非互動環境可用 `NOVAE_WSL_DISTRO` 指定名稱。Docker daemon 必須能在選定 distribution 以 root 執行。

### Generated drift

先確認改的是 `config/motion.config.json`、database migration 或字型來源，而不是 `src/generated/` 或 `schema.generated.ts`。執行 `bun run generate:all` 後檢查 diff，生成檔和來源檔一起提交。

### Firebase Emulator 第一次啟動較慢

Runner 透過 npm resolution 啟動固定版本的 Firebase tools，第一次可能需要下載。CI 與本機 cache 命中後才會明顯加快。
