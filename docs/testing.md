# 測試與驗證

## 日常驗證

| 指令 | 使用時機 | 內容 |
| --- | --- | --- |
| `bun run verify:fast` | 開發中的快速回饋 | generated drift、type / lint、boundary、unit 與 tooling checks 的快速組合 |
| `bun run verify:local` | 一般前端與重構 | 完整本機靜態、單元、架構檢查、production build、asset budget 與 dependency audit |
| `bun run check:unused` | 拆分或重構後 | TypeScript unused locals / parameters |
| `bun run verify:generated` | 修改 `config/`、generator 或字型來源後 | 重跑所有 generator，拒絕 committed artifact drift |

`check:ui` 包含在本機驗證內，會拒絕舊 dropdown、任意 shadow、手組 card、未受控 viewport gutter、UI primitive 夾帶業務 import、component 直接碰 service，以及超出 route / domain component 尺寸政策的程式碼。不要用例外繞過。

### `verify:fast` 的 11 階段

1. Generated artifacts
2. Frontend TypeScript
3. Unused declaration check
4. Translation catalog check
5. UI architecture check
6. ESLint
7. Cloudflare Worker TypeScript
8. Integration-test TypeScript
9. Unit tests
10. Architecture tests
11. Tooling policy tests

### `verify:local` 多做的工作

完整 local suite 在 fast checks 中加入 production Next.js build、build budget 和 Bun high-severity dependency audit，共 14 階段。Dependency audit 要連 npm advisory API；離線時即使前 13 階段全過，整體仍會失敗。

Build budget 會檢查 production asset、font、JS 與 CSS。達到上限 85% 時先警告，超過硬上限才失敗；警告不能當成測試失敗，但交付報告要寫出來。

## Backend 與資料庫

```bash
bun run verify:integration
```

整合 runner 會重建 PostgreSQL、驗證 populated pre-0016 upgrade、配置 `novae_runtime`、啟動 provider stub 與本機 Worker，然後測試 action、auth / scope、transaction fault injection、concurrent idempotency、jobs、retention、realtime、Notion、資料一致性與 generated database contract。

修改 backend action、權限、RPC、migration、Worker、Queue 或 Durable Object 時，除 `verify:local` 外必須加跑它。

整合環境使用 PostgreSQL 17、Wrangler local Worker，以及 port `54330` 的 Cloudinary / FCM / Notion-compatible receiver。一般 integration run 不啟動 Firebase Auth Emulator或 Next.js；測試直接準備身份與 request。完成 Vitest 後再跑 data-consistency audit 和 database-contract `--check`。

Migration 變更還會建立 populated pre-0016 database，從切換前 schema 升級到現在。這能抓到只在有舊資料時發生的 unique、foreign key、counter、event 或 role 問題。

## Browser 與完整交付

| 指令 | 內容 |
| --- | --- |
| `bun run test:e2e` | 建 production frontend，啟動完整 emulator stack，跑 Playwright desktop / mobile journeys |
| `bun run verify:stress` | 以 stress scale 8 跑多人、多分類與多權限壓力矩陣 |
| `bun run verify:all` | local、integration 與 E2E 完整交付驗證 |
| `bun run test:env` | 保留完整本機 stack 供手動測試，直到 `Ctrl+C` |

大型變更或交付前跑 `bun run verify:all`。CI 的 `Verify Changes` 先固定安裝 Bun 1.4 與 lockfile，再一律跑 fast job；只有受影響路徑才額外啟動 backend integration 或 browser E2E，以免無關文件變更浪費完整環境時間。

E2E mode 先以 deployment build environment 執行 `build:deploy`，再用 `next start` 跑 production artifact。它會啟動 Firebase Auth Emulator，Playwright 走真的登入、API、database、Worker、Queue 和 responsive UI，不把 browser journey 改成 mock service call。

`verify:stress` 把 `NOVAE_STRESS_SCALE` 設成 8。Runner 接受 2 到 20 的整數 scale；package script固定使用 8，涵蓋多人 profile sync、分類組合與 permission scope 競爭。

## CI path selection

Verify Changes 先用 git diff 判斷是否需要額外 job：

| Job | 主要觸發範圍 | 工作 |
| --- | --- | --- |
| `fast` | 每個符合 workflow paths 的變更 | `verify:generated` 後跑 `verify:fast` |
| `backend` | `cloudflare/`、`database/`、`config/`、integration tests、backend scripts、package / lockfile | Worker types、integration types、`verify:integration` |
| `browser` | App / components / hooks / lib / services / styles、public、Next config、E2E、package / lockfile | 安裝 Chromium、`test:e2e`、build budget |

Backend 與 browser job 都等 fast 成功後才執行。單純改 docs 不在 workflow path filter 內，不會消耗完整 CI stack。

## 測試目錄

- `tests/unit/`：純函式、cache、request、realtime idle、Turnstile 與資料庫 client 行為。
- `tests/architecture/`：frontend dependency direction、UI primitive purity、database ownership、provider ownership、contract 與 observability 邊界。
- `tests/tooling/`：route / version / command / CI policy、生成入口與 source hygiene。
- `tests/integration/`：真 PostgreSQL + Worker 的成功、拒絕、scope、transaction、job 與 provider 行為。
- `tests/e2e/`：使用 Firebase Auth Emulator 的真實瀏覽器流程。

新 backend action 的測試不能只呼叫一次來滿足 coverage；成功與拒絕案例都要 assertion。角色或 scope 改動還要證明跨 scope 無法操作。

## 依變更選指令

| 變更 | 最低要求 |
| --- | --- |
| README / docs | `git diff --check`，檢查相對連結；若敘述涉及指令或 config，再對照 source |
| 一般 React / CSS / hooks 重構 | `bun run verify:local` |
| 新增、刪除、搬移或拆檔 | `bun run check:unused`、`bun run verify:local`，同步 `structure.md` |
| Backend action / permission / Worker | `bun run verify:local`、`bun run verify:integration` |
| Migration / RPC / database client | 上述兩項，加 database contract 與 populated upgrade 覆蓋 |
| Realtime / Push / PWA browser flow | `bun run verify:all` |
| 大型交付 | `bun run verify:all` |
