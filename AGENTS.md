# 永遠別說什麼兼容舊代碼或者 fallback!!!! 我要求是一步到位，僅在我要求時做一次性遷移，我不需要你做防御性編程!!
- structure.md當作指引不大規模掃描 一定要更新此文件
- 搜尋避開產物。
- 不做 in-app browser preview。
- 不覆蓋、不回復無關的工作樹變更。
- 官方網站、完整文件與更新紀錄位於 `tavricccc/novae-website`，此 repo 只保留主程式必要入口。
- 禁止在未提到的情況下建立PR或branch，如被要求push，直接commit and push.
- Neon/PostgreSQL schema 與 RPC；已部署檔案不可回改，只能新增 migration

# 拆分與共用

- 相同 UI／流程出現兩次且差異僅 props／slots／callback → 抽共用。
- 視覺元件僅視覺。
- 單檔 ≳250 行檢查責任；≳400 行須能說明不拆理由。
- 不為單一呼叫點的簡單片段建抽象。
- 新增／刪除／搬移／拆分檔案時同步更新 `structure.md`。
- 新流程接手後刪舊 API／props／CSS／轉場／註解，不留相容殘留。
- 重構後用 `bun run check:unused`（或等效）確認無未使用宣告。
- 遵守組件化開發，如有成熟免費組件可以優先考慮使用。

# 安全

- 不因重構改路由名、Storage path、部署設定。
- 權限在 Worker action 與資料庫；前端只負責顯示。資料庫 runtime role 保持最低權限且不得持有 DDL 權限。
- 平台總管理員只由後端 `ADMIN_EMAILS` 環境變數決定；不得新增 UI、action、RPC 或資料表欄位來授予或撤銷平台總管理員。

# 驗證

一般前端／重構：`bun run verify:local`。
其中 `check:ui` 會拒絕舊 dropdown、任意陰影、手組卡片與自行管理 viewport gutter；不要跳過或以例外規避。
後端 action、權限、RPC、migration、Worker、Queue、Durable Object：加跑 `bun run verify:integration`；Windows 入口會透過 WSL Docker 啟動 PostgreSQL，不手動維護第二套流程。
大型變更／交付前：`bun run verify:all`。
完整本地測試環境：`bun run test:env`，Ready 後可用 Auth Emulator 建立任意測試帳號；以 `Ctrl+C` 關閉全部本地服務。多人、多分類、多權限壓力矩陣使用 `bun run verify:stress`。
新增 backend action 必須在 `tests/integration/` 加入有 assertion 的成功與拒絕案例；角色／scope 變更至少驗證 allowed、denied、跨 scope。`action-coverage.test.ts` 只作漏測防線，不得用無 assertion 呼叫敷衍。
失敗與 warning 能修就修，否則在報告說明。

# 注意:代碼追求簡潔乾淨 好維護 盡量不要打補丁式 要以可以復用為目標

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
