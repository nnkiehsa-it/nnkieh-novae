# Novae — 修改本專案前必讀

先讀本檔，再讀 `structure.md`（檔案地圖，說明每個檔案負責什麼）。
不要為了找東西大規模掃描 repo；先查 `structure.md`，搜尋時避開 `node_modules/`、`.next/`、`.next-verify/`、`src/generated/`、`cloudflare/generated/`、`src/assets/fonts/`。

## 一、絕對規則

1. **不做 fallback、不做相容舊代碼、不做防禦性編程。** 一步到位。遷移只在我明講時做一次。
2. **舊流程換新流程後，把舊的 API、props、CSS、轉場、註解、環境變數全部刪掉。** 不留死程式碼、不留「以防萬一」的分支。
3. **不建 PR、不開 branch**，除非我明講。我說 push 就直接 commit and push 到當前分支。
4. **不覆蓋、不回復工作樹裡跟本次任務無關的變更。**
5. **不改路由名、Storage path、部署設定**，即使是重構。
6. **已部署的 migration 檔不可修改**，只能新增下一個編號的 migration。
7. **平台總管理員只由後端環境變數 `ADMIN_EMAILS` 決定。** 不得新增任何 UI、action、RPC 或資料表欄位來授予或撤銷它。
8. 新增／刪除／搬移／拆分檔案時，**同步更新 `structure.md`**。

## 二、東西放哪

### 前端 `src/`

| 要寫的東西 | 放這裡 | 規則 |
|---|---|---|
| 路由頁面 | `src/app/<route>/page.tsx` | 只組裝畫面、轉發事件。不可 `import "@/services/..."` |
| 路由載入骨架 | `src/app/<route>/loading.tsx` | 與 `page.tsx` 共用同一組 domain component |
| 無業務邏輯的共用元件（button、dialog、card…） | `src/components/ui/` | 純視覺。不可 import `@/services/`、`@/hooks/` |
| 有業務語意的元件（issue-card、access-management…） | `src/components/<domain>/` | 不可 `import "@/services/..."`，資料要透過 hook 拿 |
| 元件的狀態與流程 | `src/hooks/use-*.ts(x)` | 唯一可以呼叫 `@/services/` 的前端層 |
| 不含 React 的全域 store | `src/hooks/<name>-store.ts` | 對應的 React 介面放同名 `use-<name>.tsx` |
| 呼叫後端 API、realtime、上傳、session | `src/services/` | 不可 import `react`、`@/app/`、`@/components/`、`@/hooks/` |
| 純函式工具（格式化、快取、解析、計算） | `src/lib/` | 不可 import `react`、`@/app/`、`@/components/`、`@/hooks/` |
| 固定常數與其判定 helper（分類、狀態、長度上限） | `src/constants/` | 不呼叫 API、不碰 React |
| 跨模組共用的型別 | `src/types/` | 只被一個模組用的型別就留在該模組 |
| 只給 E2E 用的執行期 helper | `src/testing/` | 只能由 `e2e-auth-bridge.tsx` 在 emulator 環境下動態 import，不可靜態 import 進產品路徑 |
| 文案 | `src/i18n/messages/{en,zh-TW}/` | 兩種語言都要加，`check:i18n` 會擋漏譯 |
| 全域 CSS token、版面 | `src/app/globals.css` | 顏色／圓角／陰影一律用 token，不寫死色碼 |
| 動畫 token 與 recipe | `src/styles/motion.css` | `:hover` 必須包在 `@media (hover: hover)` 內 |

### 後端 `cloudflare/`

| 要寫的東西 | 放這裡 |
|---|---|
| 一個後端 action | `cloudflare/src/backend/actions/`，並在 `action-registry.ts` 註冊 |
| 跨 action 共用（DB、媒體、外部服務、observability） | `cloudflare/src/backend/shared/` |
| 排程／佇列工作 | `cloudflare/src/backend/jobs/` |
| Durable Object | `cloudflare/src/durable/` |

`cloudflare/src/` **不可** import 任何 `@/` 或前端路徑。
`jobs/`、`actions/handler.ts`、`sync-user.ts`、`cloudinary-webhook.ts` 必須 import `shared/observability.ts`。

### 資料庫

資料庫是 Neon 上的 PostgreSQL；schema 與 RPC 都由 migration 管理。

- schema 或 RPC 變更 → `database/migrations/` 新增一個編號檔，不修改既有檔案。
- 前端 `src/` 內**絕對不可**出現 `.sql`，也不可 import `pg`、`@neondatabase/serverless`、`firebase/firestore`、`firebase/database`、`firebase/storage`。
- 前端只允許 `firebase/app`、`firebase/app-check`、`firebase/auth`、`firebase/messaging`。

### 設定改了要重跑產生器

`config/*.config.json` 是這些檔案的唯一來源，**不要手改產出檔**：

| 改了 | 跑 | 會重寫 |
|---|---|---|
| `config/api-errors.config.json` | `bun run generate:all` | `src/generated/api-errors.ts`、`cloudflare/src/backend/shared/api-errors.ts`、`cloudflare/generated/` |
| `config/backend-actions.config.json` | `bun run generate:all` | `src/services/backend-action-contract.ts`、`cloudflare/src/backend/shared/backend-action-policies.ts` |
| `config/rate-limits.config.json`、`config/data-retention.config.json` | `bun run generate:all` | 同上對應檔 |

產出檔要一起 commit；`verify:fast` 第一關就會擋住沒重跑的 drift。

### 文件

| 內容 | 放這裡 |
|---|---|
| 檔案地圖 | `structure.md` |
| 架構、後端、部署、測試、設定說明 | `docs/` |
| 官網、對外更新紀錄 | 另一個 repo `tavricccc/novae-website` |

不要新增一次性的 `handoff.md`／`IMPLEMENTATION.md` 這類進度檔，會過期誤導後續 agent。

## 三、依賴方向

```
app / components  →  hooks  →  services  →  (Worker API)
       ↓                ↓          ↓
      ui              lib        lib
```

箭頭反向就是錯的。`tests/architecture/` 和 `check:ui` 會擋。

## 四、拆分與共用

- 相同 UI／流程出現兩次，差異只有 props／slots／callback → 抽共用。
- **不要**為只有一個呼叫點的簡單片段建抽象。
- TS/TSX 單檔 **>300 行** `check:ui` 會警告，確認它只做一件事；**>400 行直接失敗**，必須拆。CSS 與產生檔不受此限。
- 有成熟的免費現成元件就優先用，不要自己重造。

## 五、測試放哪

| 要驗證的東西 | 放這裡 | 說明 |
|---|---|---|
| 純函式、cache、request、資料轉換 | `tests/unit/` | Vitest，2 秒內跑完 |
| 依賴方向、層級邊界 | `tests/architecture/` | 寫成通用規則 |
| 套件管理、CI 設定、產出物政策 | `tests/tooling/` | |
| 後端 action、權限、RPC、job、Worker | `tests/integration/` | 需要真的 PostgreSQL |
| 使用者實際操作流程 | `tests/e2e/` | Playwright + Firebase Auth Emulator |
| 樣式／結構規則（禁止某種寫法） | `scripts/check-ui-primitives.mjs` | 不要寫成測試 |

**測試只斷言可觀察行為**：回傳值、DOM、資料庫狀態、真實瀏覽器量測。
**禁止** `expect(source).toContain("某段原始碼")` 這種比對實作字串的寫法——它抓不到 bug，只會在你改實作時假性失敗。

新增 backend action 必須在 `tests/integration/` 加**有 assertion** 的成功與拒絕案例；角色／scope 變更至少驗證 allowed、denied、跨 scope。`action-coverage.test.ts` 只是漏測防線，不得用無 assertion 的呼叫敷衍。

E2E 共用 6 個固定帳號與一組共享內容，`workers: 1` 是刻意的，不要改成並行。

## 六、安全

- 權限判斷在 Worker action 與資料庫，**前端只負責顯示**。前端擋不住的東西後端一定要擋。
- 資料庫 runtime role 保持最低權限，不得持有 DDL 權限。
- 不要把後端 secret 讀進 `src/`（`client-env-boundary.test.ts` 會擋）。

## 七、驗證

| 指令 | 什麼時候跑 | 內容 |
|---|---|---|
| `bun run verify:fast` | **每次前端／重構改動後，一定要跑** | drift、型別（含未使用宣告）、i18n、`check:ui`、lint、Worker/integration 型別、unit、architecture、tooling |
| `bun run verify:integration` | 改了 backend action、權限、migration、Worker、Queue、Durable Object | 真的起 PostgreSQL 跑 |
| `bun run verify:local` | 交付前 | fast + production build + build budget + 相依套件稽核 |
| `bun run verify:all` | 大型變更／交付前 | local + integration + E2E |
| `bun run test:env` | 要手動操作完整本地環境 | Ready 後可用 Auth Emulator 建測試帳號，`Ctrl+C` 全部關閉 |
| `bun run verify:stress` | 多人／多分類／多權限壓力矩陣 | |

Windows 會自動透過 WSL Docker 起 PostgreSQL，不要另外手動維護第二套流程。

`check:ui` 會擋下：`transition-all`、elevation token 以外的任意陰影、Vue 殘留、未用 `(hover: hover)` 包住的 `:hover`、UI primitive 引入業務資料、`app/`／`components/` 直接 import service、孤兒 CSS class selector、超過行數上限的模組。**不要跳過，也不要加例外規避。**

失敗與 warning 能修就修，修不掉要在回報裡說明原因。

## 八、程式風格

代碼追求簡潔、乾淨、好維護。不要打補丁式修改，以可復用為目標。

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
