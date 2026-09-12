# Novae / Lexiro 前端交接

更新：2026-09-12 15:01（Asia/Taipei）

本文件依使用者「快速收尾並給我 handoff 文件」的明確要求建立，記錄目前工作樹；不是完整驗收或可直接部署的聲明。

## 15:25 後續接手結果

- 已 fetch 兩個 repo；Novae 與 Lexiro 的本地 `main` 都與最新 `origin/main` 相同，所有本次成果仍是未提交工作樹。
- 已撤回未經同意的 Lexiro 藍色改版，依 `origin/main` 恢復森林墨綠、霧白／鼠尾草畫布、暗色綠 ramp、主按鈕、導覽選取與 segmented selection；動畫和導覽行為改進保留。
- Lexiro 已通過 `npm run typecheck`、`npm run lint`、23 個測試檔共 160 個測試，以及 production build；並在正式建置中目視確認淺色 `#2f5d4a` 與暗色 `#8ecdab` 主色，測試後已恢復「跟隨系統」。
- Novae 第一輪 `verify:all` 為 42/43：唯一失敗是延遲導覽測試的頁面 route 被 Service Worker 旁路，trace 與失敗截圖都顯示 Settings 已實際完成呈現，並非選取狀態與頁面不一致。測試 context 改為阻擋 Service Worker 後，第二輪 `verify:all` 全數通過：local 13 stages、integration 9 檔 28 測試、E2E 43/43。
- 快速連點（390px／1440px）、pending selection、取消觸控、primary route 零 document snapshot、mobile dock hit-test、detail push/back、reduced motion 均已在最新正式建置覆驗。尚未在實體 iPhone 上驗收。

## 任務與邊界

- 改進兩個專案的既有前端，不增加功能。
- 動畫偏向 iOS 的自然減速、連續性與舒服的節奏，不以縮短時間為目標。
- 修正快速切換底部 Tab 時選取狀態與實際頁面不同步。
- Lexiro 保留自己的森林綠視覺、名稱和圖示，只採用與 Novae 一致的 Tab 行為與動畫原則。
- 保留頂部模糊效果：Novae 的 sticky header / progressive blur 與 Lexiro 的 app-top-blur 規則、捲動控制均未改動；模糊時序所用的 control / move token 未變。
- 未改後端、資料庫、路由名稱、Storage path 或部署設定。

## 專案與 Git 狀態

| 專案 | 路徑 |
| --- | --- |
| Novae | C:/Users/tavri/Documents/projects/novae |
| Lexiro | C:/Users/tavri/Documents/projects/lexiro |

開始時兩個工作樹均乾淨；本次修改全部留在原分支，尚未 commit / push，沒有開 branch 或 PR。請保留工作樹。

Novae 修改前須讀 AGENTS.md、structure.md；Lexiro 也有自己的 AGENTS.md。兩個專案都要求查閱已安裝 Next 的本地文件。已讀過本機 Next 16.3 的 linking / view-transition / useLinkStatus 文件。

## 已實作

### 兩個專案共有

1. LiquidNav 移除 pointerdown 提前切換選取狀態與 2.5 秒重置計時器。選取及 aria-current 只根據實際 pathname。
2. 等待導覽改由 Next Link 的 useLinkStatus 驅動，與選取底色分離。全域 NavigationFeedback 不再重複標記 primary navigation。
3. 導覽選取底色改為 Motion shared-layout 移動；按壓回饋集中在圖示。最後一輪調整了堆疊，讓移動底色在文字下方，並移除會裁切底色的 link overflow。
4. LiquidTabs 移除 pointerdown 推測選取與重置計時器，跟隨受控 value。Lexiro 另移除舊的 offsetLeft / width 量測、強制 reflow 和 resize listener，改用與 Novae 相同的 shared-layout 動畫。
5. 主 Tab 頁面直接渲染 live route surface，不進入 React ViewTransition。切頁用 460ms 的原位淡入，最後一輪把起始 opacity 調為 0.6，保留切換當下的可讀性。
6. 細節頁仍使用方向性 ViewTransition；導覽列不再宣告 view-transition-name，避免它在快照期間失去點擊能力。
7. 動畫設定：touch 100ms、control 250ms 保留；nav 460ms、sheet 560ms、controlExit 190ms、sheetExit 380ms。調整 arrive 曲線、減少移動與縮放幅度，減弱頁面 parallax / dim。
8. 選單、對話框使用更長的減速；置中對話框減少垂直位移；sheet 離場及 switch 移動使用 nav 曲線；輸入框 focus 不再上下漂移；點擊卡片內部控制不再讓整張卡跟著縮放。
9. 產生器已執行，generated CSS / TS 與 config 同步；reduced motion 規則保留並涵蓋新的 live route reveal。

### Lexiro 視覺與導覽

- 森林墨綠、霧白／鼠尾草畫布與暗色綠 ramp 依遠端基線保留；導覽與 segmented selection 沿用原品牌語意。
- Primary button 維持遠端基線的綠色 brand fill。
- 調整內容最大寬度、頁面 gutter、段落間距與標題字級／字重。
- 桌面 sidebar 保持 Lexiro 品牌；PageHeader 在內容區顯示真正 h1、actions、back。移除 UI store 的 pageTitle / setPageTitle 舊流程。
- 修正首頁空 hierarchy 導致「今天 → 我的單字」被判成進入子頁：四個主頁現在是 peers。
- sets / questions 歸屬 library，practice 歸屬 home，sync 歸屬 me；導覽高亮使用 adopted parent。
- 已同步 PRODUCT.md、docs/design-system.md 與 structure.md 的主要敘述。

## 主要程式入口

| 範圍 | Novae | Lexiro |
| --- | --- | --- |
| 導覽 | src/components/liquid-nav.tsx | components/liquid-nav.tsx |
| 分段 Tab | src/components/ui/liquid-tabs.tsx | components/ui/liquid-tabs.tsx |
| 路由表面 | src/components/motion/route-surface.tsx | components/motion/route-surface.tsx |
| 路由層級 | src/lib/route-hierarchy.ts | lib/navigation-memory.ts |
| 全域導覽回饋 | src/components/motion/navigation-feedback.tsx | components/motion/navigation-feedback.tsx |
| 動畫樣式 | src/styles/motion.css | app/styles/motion.css |
| Token | config/motion.config.json | config/motion.config.json |
| 全域樣式 | src/app/globals.css | app/globals.css |

Lexiro 另修改 components/app-shell.tsx、components/ui/page-header.tsx、components/ui/button.tsx、stores/ui-store.ts。

## 驗證結果：注意版本範圍

### 最新工作樹，收尾時重跑

- Novae：bun run verify:fast，10 stages 通過。
- Lexiro：npm run typecheck、npm run lint、npm run test 全通過；23 個測試檔、160 個測試。
- 兩個專案：git diff --check 通過。

### 較早的工作樹版本

- Novae：verify:all 的 local 階段 13 stages 通過，含 production build、build budget 與 dependency audit。
- Novae：integration 階段通過，9 個測試檔、28 個測試；資料一致性與 database contract drift 檢查通過。
- Novae：同一次完整 E2E 為 40 passed / 3 failed，詳見下節。不能宣稱 verify:all 通過。
- Lexiro：production build 多次通過。最後通過的 build 已包含「主 Tab 完全避開 ViewTransition」修正，但早於最後的選取底色堆疊、opacity 0.6 與格式整理。
- Lexiro：上述正式建置在 Chromium 與 WebKit 26.6，以 390px / 1440px 各做 40 次、間隔 35ms 的真實座標點擊，共 160 次全部送達；最終 URL、route surface、aria-current 一致，主 Tab document view-transition 次數為 0。取消觸控、reduced motion、水平 overflow 也通過。
- 尚未在實體 iPhone 上驗收。

## 接手後完成的驗收

- `tests/e2e/primary-navigation.spec.ts` 現在驗證 390px／1440px 快速連點、完整 click 序列、最終 URL、route surface、`aria-current`、零 primary document snapshot、取消觸控、pending selection 與 reduced motion。
- 延遲 Settings 案例阻擋 Service Worker，確保 Playwright route 真正控制 RSC 回應；這修正了測試旁路，沒有刪除或放寬產品行為斷言。
- `tests/e2e/mobile-access.spec.ts` 已在最新正式建置證明 dock 不被 transition snapshot 捕捉，且整段動畫都保持在 route 之上、可 hit-test。
- `tests/e2e/motion-system.spec.ts` 已覆驗 committed selection、detail push/back、單一 route surface 與 reduced motion。
- Novae `bun run verify:all` 全數通過；Lexiro typecheck、lint、test、build 全數通過。之後每次再改 Novae 前端仍須跑 `bun run verify:fast`。
- 唯一未做的是實體 iPhone 驗收；這不是自動化或桌面瀏覽器結果的替代品。

## 保留的警告

- Novae check:ui 的既有行數警告：session-store.ts 329、use-issue-detail.ts 346、use-issue-feed.ts 324、services/notifications.ts 340。這四個檔案未修改。
- 先前 build budget 通過但顯示 >=85% warning；驗證器摘要未列出具體資產。未調整 budget。
- Playwright 曾顯示 NO_COLOR / FORCE_COLOR 環境警告，與產品行為無關。

## 測試資料與服務

- Lexiro browser 檢查程式：C:/Users/tavri/AppData/Local/Temp/check-lexiro-navigation.mjs。使用 Novae 的 Playwright dependency，預期 Lexiro 在 localhost:3001；可傳 chromium 或 webkit。
- Novae 最近失敗的 trace / screenshot 位於 test-results/e2e/；下次測試可能覆寫。
- 供診斷的 trace 解壓本：C:/Users/tavri/AppData/Local/Temp/novae-navigation-trace-1。含 emulator 測試 session 資料，不應 commit 或公開散佈。
- 收尾已停止 Lexiro 的臨時 server；Novae verify:all 已執行自己的 teardown。最後檢查 3000 / 3001 無 listener。
- WebKit 26.6 已透過 Playwright 安裝於本機瀏覽器快取；未新增任何專案 dependency。
