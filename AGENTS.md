# AI 代理人開發指引

# structure.md當作指引不大規模掃描 一定要更新此文件

## 工作前提

0. Node.js 統一使用 24 LTS；不得為繞過依賴警告降到 Node 20 或降級主要 runtime 套件。
1. 修改依既有模組擴充，不另起平行實作。
2. 搜尋避開 `node_modules`、`dist`、`.vercel`、`.wrangler` 等產物。
3. 不做 in-app browser preview；以 typecheck / lint / build 驗證。
4. 不覆蓋、不回復無關的工作樹變更。
5. Staging 用 `git add .`，不要逐檔 add。
6. 官方網站、完整文件與更新紀錄位於 `tavricccc/novae-website`，此 repo 只保留主程式必要入口。

## 架構邊界

| 層 | 職責 |
|---|---|
| `app/` | Next App Router 路由頁組裝，不直接存取 service |
| `components/` | 應用 UI 與事件轉發；流程進 hook |
| `components/ui/` | 無業務資料的共用 UI；**不** import service / session |
| `hooks/` | React 狀態與流程；不重複純函式／正規化 |
| `lib/` | 無 React 相依的純工具 |
| `services/` | Cloudflare Workers API 與即時傳輸邊界；元件不直查資料庫、不自組 action |
| `types/` | 跨模組型別；共通欄位先 base 再擴充 |
| `cloudflare/src/` | Worker 路由、CORS、Firebase token 驗證、原生限流、Queue／排程入口 |
| `cloudflare/src/backend/` | action、資料庫 adapter、登入同步、webhook、outbox、刪除與維護流程 |
| `cloudflare/src/durable/` | SQLite Durable Objects 業務限流與 WebSocket Hibernation 即時廣播 |
| `database/migrations/` | Neon/PostgreSQL schema 與 RPC；已部署檔案不可回改，只能新增 migration |

## 拆分與共用

1. 相同 UI／流程出現兩次且差異僅 props／slots／callback → 抽共用。
2. 元件同時扛讀取、權限、流程與大模板 → 流程進 hook，再拆展示。
3. 單檔 ≳250 行檢查責任；≳400 行須能說明不拆理由。
4. 不為單一呼叫點的簡單片段建抽象。
5. 新增／刪除／搬移／拆分檔案時同步更新 `structure.md`。
6. 新流程接手後刪舊 API／props／CSS／轉場／註解，不留相容殘留。
7. 重構後用 `npm run check:unused`（或等效）確認無未使用宣告。

## 命名與 TypeScript

- hook `useXxx`；元件 PascalCase；純函式描述輸入輸出。
- Props／callback／request／response 明確型別；邊界資料先 `unknown`，不用 `any` 穿透。
- 重複 union／label 放 types 或 constants；魔法數字用具名常數。

## React 與 UI

- `src/app/globals.css`、`src/styles/motion.css` 與 `components/ui/` 是 UI 規範的單一來源；重複 dialog／empty／action 優先既有共用元件。
- 互動狀態單一來源；手機桌機同資料流、只切 layout。
- viewport 左右留白由 `AppShell` 統一負責；route page 不自行建立另一套 viewport gutter。
- 卡片、控制項、浮動層只使用 control／card／floating 三階陰影 token。卡片、按鈕、dropdown 與輸入優先使用 `components/ui/` 既有 primitive。
- 相同結構若只差字串、icon、狀態或 callback，必須以 props／children 共用；不得複製近似 button、dropdown、card、list、shadow、control 或 viewport 樣式。
- 新 UI primitive 必須有至少兩個合理使用點，加入 `globals.css`／`motion.css`／`components/ui`，同步更新 `structure.md`、架構測試與官方貢獻文件；不得在領域元件建立平行設計系統。
- 維持必要 `aria-label`／label／alt。

## 安全

- 不因重構改路由名、table／RPC、backend action、Storage path、部署設定。
- 權限在 Worker action 與資料庫函式；前端條件只負責顯示。資料庫 runtime role 保持最低權限且不得持有 DDL 權限。
- 平台總管理員只由後端 `ADMIN_EMAILS` 環境變數決定；不得新增 UI、action、RPC 或資料表欄位來授予或撤銷平台總管理員。
- 提案與設備管理權限以分類指派為範圍；平台總管理員可跨分類處理，但一般分類管理員不得靠全域 permission 繞過分類檢查。管理介面採「先選分類，再查看／新增／修改／撤銷該分類負責人」。
- 新提案與新設備回報只通知該分類明確指派的負責人並排除作者；不得因平台總管理員身分自動收件。個人通知使用 user scope，避免混入管理員廣播。
- 已部署 migration 不回改；只新增後續 migration。
- 通知、outbox、刪除工作等高風險不順手改。

## 路由與初始設定

- `issues/[filter]` 路由必須帶合法 `filter`；需要預設值時使用共用的預設分類 helper，不得組出缺少 required segment 的導航。
- Setup 先讓使用者確認語言，再設定至少一個提案分類與設備分類；完成操作必須可安全重試，若資料庫已提交而回應中斷，前端刷新狀態後直接進入已完成流程。

## 驗證

一般前端／重構：`npm run verify:local`。
其中 `check:ui` 會拒絕舊 dropdown、任意陰影、手組卡片與自行管理 viewport gutter；不要跳過或以例外規避。
後端 action、權限、RPC、migration、Worker、Queue、Durable Object：加跑 `npm run verify:integration`；Windows 入口會透過 WSL Docker 啟動 PostgreSQL，不手動維護第二套流程。
大型變更／交付前：`npm run verify:all`。
完整本地測試環境：`npm run test:env`，Ready 後可用 Auth Emulator 建立任意測試帳號；以 `Ctrl+C` 關閉全部本地服務。多人、多分類、多權限壓力矩陣使用 `npm run verify:stress`。
新增 backend action 必須在 `tests/integration/` 加入有 assertion 的成功與拒絕案例；角色／scope 變更至少驗證 allowed、denied、跨 scope。`action-coverage.test.ts` 只作漏測防線，不得用無 assertion 呼叫敷衍。
失敗與 warning 能修就修，否則在報告說明。

# 注意:代碼追求簡潔乾淨 好維護 盡量不要打補丁式 要以可以復用為目標

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
