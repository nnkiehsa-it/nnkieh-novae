# 測試與驗證

## 日常驗證

| 指令 | 使用時機 | 內容 |
| --- | --- | --- |
| `bun run verify:fast` | 開發中的快速回饋 | generated drift、type / lint、boundary、unit 與 tooling checks 的快速組合 |
| `bun run verify:local` | 交付前完整本機驗證 | 在快速檢查外加入 production build、asset budget 與 dependency audit |
| `bun run verify:generated` | 修改 `config/`、generator 或字型來源後 | 重跑所有 generator，拒絕 committed artifact drift |

`check:ui` 包含在本機驗證內，會拒絕舊 dropdown、任意 shadow、手組 card、未受控 viewport gutter、UI primitive 夾帶業務 import、component 直接碰 service，以及超出 route / domain component 尺寸政策的程式碼。不要用例外繞過。

### `verify:fast` 的 10 階段

1. Generated artifacts
2. Frontend TypeScript
3. Translation catalog check
4. UI architecture check
5. ESLint
6. Cloudflare Worker TypeScript
7. Integration-test TypeScript
8. Unit tests
9. Architecture tests
10. Tooling policy tests

### `verify:local` 多做的工作

完整 local suite 在 fast checks 中加入 production Next.js build、build budget 和 Bun high-severity dependency audit。Dependency audit 要連 npm advisory API；離線時即使前面階段全過，整體仍會失敗。

Next.js lint 的根目錄 glob 透過 scoped override 使用 `tools/next-root-glob`，由 Node 24 原生 `fs.globSync` 處理。此替換只作用於 Next plugin 的 `globSync(pattern, { onlyDirectories })` 用法，移除 `fast-glob → micromatch → braces` 依賴鏈；Next lint 規則和安全稽核仍全部保留。更新 Next plugin 或 Node 版本時，要重跑 `tests/tooling/next-root-glob.test.mjs` 與完整 gate。

本機 gate 使用 `.next-verify`，其 Service Worker 也輸出到 `.next-verify/service-worker/`，避免與瀏覽器測試或預覽重寫同一個 `public/sw.js`，混用不同的 API 環境。可執行的正式與 E2E build 仍使用 `public/sw.js`。

Build budget 的上限集中在 `config/build-budget.config.json`，達到 85% 時警告，超過硬上限才失敗。警告不能當成測試失敗，但交付報告要寫出來。

CSS 依 production 的 Next.js client reference manifest，計算每個頁面初始載入的檔案；同一檔案只算一次。一般介面樣式與 `@font-face` 宣告分開衡量，中文字型的 unicode range 不會擠掉介面樣式的空間。gzip 估算仍包含完整字型宣告，不是正式服務的實際傳輸量。另檢查每個 CSS chunk，涵蓋按需載入的編輯器樣式。JS 與 WOFF2 暫時維持全站產物總量上限。

| 指標 | 上限 | 用途 |
| --- | --- | --- |
| 單頁介面 CSS，未壓縮 | 256 KiB | 控制樣式解析量；排除字型宣告 |
| 單頁初始 CSS，gzip level 9 估算 | 160 KiB | 控制頁面初始下載；包含字型宣告 |
| 單個 CSS chunk，gzip 估算 | 128 KiB | 避免按需載入的樣式包過大 |
| 全站字型 CSS 宣告，未壓縮 | 320 KiB | 獨立管理中文字型的 unicode range |
| 全站 WOFF2 / JS 產物 | 8 MiB / 3 MiB | 保留既有字型與程式碼總量檢查 |

每次檢查會在目前 build 目錄產生 `build-budget-report.json`，列出各頁面、所需 CSS、未壓縮與 gzip 估算大小。調整前先查看報告：只使用 Card、Input、Label 的 HeroUI 樣式已集中在 `src/styles/heroui.css`；新增其他 HeroUI 元件時，在這裡加入它的 CSS。拆開原始碼檔案不等於減少輸出，應先移除未使用的樣式或把頁面專用樣式保留在該頁面的 import。

完整本機檢查後，可單獨重新查看報告：

```powershell
$env:NOVAE_NEXT_DIST_DIR = '.next-verify'
bun run check:build-budget
Remove-Item Env:NOVAE_NEXT_DIST_DIR
```

環境變數 `NOVAE_CSS_BUDGET_BYTES` 已移除。需要暫時覆寫時，使用 `NOVAE_ROUTE_CSS_UI_BUDGET_BYTES`、`NOVAE_ROUTE_CSS_GZIP_BUDGET_BYTES`、`NOVAE_CSS_CHUNK_GZIP_BUDGET_BYTES` 或 `NOVAE_FONT_FACE_CSS_BUDGET_BYTES`；字型和 JS 原有覆寫名稱仍有效。一般維護應直接修改 config，並在 commit 中交代實測大小與調整原因。

## Backend 與資料庫

```bash
bun run verify:integration
```

整合 runner 會重建 PostgreSQL、驗證 populated pre-0016 upgrade、配置 `novae_runtime`、啟動 provider stub 與本機 Worker，然後測試 action、auth / scope、transaction fault injection、concurrent idempotency、jobs、retention、realtime、Notion、資料一致性與 generated database contract。

修改 backend action、權限、RPC、migration、Worker、Queue 或 Durable Object 時，除 `verify:local` 外必須加跑它。

整合環境使用 PostgreSQL 17、Wrangler local Worker，以及 port `54330` 的 Cloudinary / FCM / Notion-compatible receiver。一般 integration run 不啟動 Firebase Auth Emulator或 Next.js；測試直接準備身份與 request。完成 Vitest 後再跑 data-consistency audit 和 database-contract `--check`。

Migration 變更還會建立 populated pre-0016 database，從切換前 schema 升級到現在。這能抓到只在有舊資料時發生的 unique、foreign key、counter、event 或 role 問題。

修改本文或作者搜尋查詢時，另跑 `bun run verify:search-performance`。它會建立並清理獨立測試資料庫，量測 migration 前後的 `EXPLAIN ANALYZE`、檢查索引計畫及搜尋權限回歸；資料量、重跑條件及量測限制見[搜尋效能紀錄](search-performance.md)。

## Browser 與完整交付

| 指令 | 內容 |
| --- | --- |
| `bun run test:e2e` | 建 production frontend，啟動完整 emulator stack，跑 Playwright desktop / mobile journeys |
| `bun run verify:stress` | 以 stress scale 8 跑多人、多分類與多權限壓力矩陣 |
| `bun run verify:all` | local、integration 與 E2E 完整交付驗證 |
| `bun run test:env` | 保留完整本機 stack 供手動測試，直到 `Ctrl+C` |

大型變更或交付前跑 `bun run verify:all`。CI 的 `Verify and Deploy` 先固定安裝 Bun 1.4 與 lockfile，再一律跑 fast job；只有受影響路徑才額外啟動 backend integration 或 browser E2E。Push 成功後沿用同一 workflow 的驗證結果直接進入對應部署 job，避免另外啟動 workflow 再輪詢等待。

E2E mode 先以 deployment build environment 執行 `build:deploy`，再用 `next start` 跑 production artifact。它會啟動 Firebase Auth Emulator，Playwright 走真的登入、API、database、Worker、Queue 和 responsive UI，不把 browser journey 改成 mock service call。

`test:env` 是手動操作環境，會啟用本機管理員自動登入，不適合直接執行需要切換帳號的 Playwright 測試。使用 `test:e2e` 可停用這項便利功能，避免登入狀態干擾案例。整合 runner 使用本機連接埠鎖阻止同時重建測試環境，並直接透過 Node 啟動 Next.js 與 Playwright。

只驗證特定流程時，在 `--` 後傳入 Playwright 的檔名或 `--grep`；這些參數只套用到瀏覽器案例，不會略過環境建置。以下先準備共用帳號與內容，再只跑上傳流程：

```bash
node scripts/verify-integration.mjs --e2e --project chromium-stateful -- tests/e2e/upload-operations.spec.ts
```

省略 `--project` 時會保留 Playwright 專案依賴，所以相關 bootstrap／唯讀案例仍可能一併執行。只有前端程式未改且已有相同環境的 production build 時才使用 `--skip-build`。

需要檢查 WebKit 的草稿、列表、詳情與多分頁行為時，可安裝 `bunx playwright install webkit`，設定 `NOVAE_E2E_SURFACE_BROWSER=webkit` 後執行 `bun run test:e2e`。這是 WebKit 引擎與響應式畫面的驗證，不等同於實體 iPhone 測試。不同 Playwright 程序若共用已啟動的環境，必須各自指定 `--output`，避免覆寫對方的 trace 與截圖。

`verify:stress` 把 `NOVAE_STRESS_SCALE` 設成 8。Runner 接受 2 到 20 的整數 scale；package script固定使用 8，涵蓋多人 profile sync、分類組合與 permission scope 競爭。

## CI path selection

Verify and Deploy 先用 git diff 判斷是否需要額外 job：

| Job | 主要觸發範圍 | 工作 |
| --- | --- | --- |
| `fast` | 每個符合 workflow paths 的變更 | `verify:fast`（第一個 stage 即 generated drift gate）|
| `backend_verify` | `cloudflare/`、`database/`、`config/`、integration tests、backend scripts、package / lockfile | Worker types、integration types、`verify:integration` |
| `browser_verify` | App / components / hooks / lib / services / styles、public、Next config、E2E、package / lockfile | 安裝 Chromium、`test:e2e`；build budget 只在 shard 1 跑 |
| `deploy_backend` | push / manual 且 backend 受影響 | forward migration、runtime role、Worker / Queue / provider 設定與 smoke test |
| `deploy_frontend` | push / manual 且 browser 受影響 | 驗證 Vercel secrets，在同一 runner 建立並直接發布 prebuilt output；必要時等待 backend deploy |

`fast`、`backend_verify` 與 `browser_verify` 都只依賴 `changes`，符合範圍時平行執行。部署等所有相關驗證成功；同次有 backend 變更時，frontend 再等 backend 部署成功。Vercel build 的 `.next`／`node_modules` 保留在同一 runner 直到 publish。`workflow_dispatch` 可選 `all`、`backend` 或 `frontend`。README、docs 與 `tools/project-map/` 單獨變更不在 workflow path filter 內。

## 測試目錄

- `tests/unit/`：純函式、cache、request、realtime idle、Markdown 淨化與資料庫 client 行為。只斷言可觀察行為，不比對原始碼文字；結構性規則放 `check:ui` 或 `tests/architecture/`。
- `tests/architecture/`：frontend dependency direction、UI primitive purity、database ownership、provider ownership、contract 與 observability 邊界。
- `tests/tooling/`：package-management、生成入口與 source hygiene 等穩定 tooling policy。
- `tests/integration/`：真 PostgreSQL + Worker 的成功、拒絕、scope、transaction、job 與 provider 行為。
- `tests/e2e/`：使用 Firebase Auth Emulator 的真實瀏覽器流程。

新 backend action 的測試不能只呼叫一次來滿足 coverage；成功與拒絕案例都要 assertion。角色或 scope 改動還要證明跨 scope 無法操作。

## 依變更選指令

| 變更 | 最低要求 |
| --- | --- |
| README / docs | `git diff --check`，檢查相對連結；若敘述涉及指令或 config，再對照 source |
| 一般 React / CSS / hooks 重構 | `bun run verify:fast` |
| 新增、刪除、搬移或拆檔 | `bun run verify:fast`，同步 `structure.md` |
| Backend action / permission / Worker | `bun run verify:local`、`bun run verify:integration` |
| Migration / RPC / database client | 上述兩項，加 database contract 與 populated upgrade 覆蓋 |
| Realtime / Push / PWA browser flow | `bun run verify:all` |
| 大型交付 | `bun run verify:all` |
