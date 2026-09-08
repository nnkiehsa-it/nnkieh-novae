# Novae：介面連貫性驗證交接

## 任務與目前狀態

- 交接日期：2026-09-08。
- 專案：`C:\Users\tavri\Documents\projects\novae`。
- 分支：`main`；已推送 commit：`c688a7d`，`Unify Novae design and preserve loading surface continuity`。
- 本輪已統一頁面、卡片、內容狀態與動態清單的進出／尺寸轉場；後續工作應以驗證實際問題為主，不再擴大設計或增加功能。
- 使用者重視效率，不要反覆跑沒有新增資訊的測試，也不要大量輸出原始紀錄。
- 先閱讀 `AGENTS.md` 和 `structure.md`。不要覆蓋工作樹中既有的 `skills-lock.json` 或 `.agents/skills/` 變更，它們不是本次介面工作的內容。

## 使用者的驗收要求

1. 延續 `novae-website` 的設計，但維持足夠的資訊密度。
2. LiquidTabs 的 active 要清楚，只有選取項目使用強調色；自訂顏色功能已移除。
3. 列表標題要有層級，目前為 18px、28px 行高。
4. 載入、成功、無內容與錯誤要連貫；同一個邏輯卡片的外框應持續存在，不能靠消失、重建、重新淡入假裝轉場。
5. 固定外框內的 loading、空白、錯誤與內容有進出動畫；需要改變高度的外框使用 180ms resize，文字不被縮放，動畫能穩定結束；route 與 viewport reflow 不參與尺寸動畫。
6. 骨架只表達未知資料，外框與已知控制項不應一起閃動。
7. **保留 preload／prefetch**。不要為了讓測試簡單而移除預載、快取或樂觀更新。
8. 手機、桌面、深淺色和 reduced motion 都要正常。

## 已完成的主要變更

- `src/components/ui/feed-list.tsx`：以位置識別外框，讓骨架、資料、空狀態和錯誤共用持續掛載的 Card；資料內部仍以 entity ID 識別。
- `src/components/ui/feed-card.tsx`：共用列表內容結構，外框由 FeedList 擁有。
- `src/components/ui/detail-layout.tsx`：共用並保留詳情主卡、reaction 與 timeline 卡片。
- `src/components/motion/resize-motion.tsx`、`state-transition.tsx`、`stagger.tsx`：只觀察明確 opt-in 的內容狀態容器，以高度-only 轉場處理 intrinsic size；所有內容替換與動態清單有共用 entry／exit，視窗 reflow 立即重設量測，不會被當成內容動畫，並處理 reduced motion 與清理。
- `src/styles/motion.css`：Grid 採 `align-content: start`，避免容器縮放期間把卡片撐高造成回授；所有 Card 有一致的首次出現，LiquidTabs 的非選取 rail 保留中性灰底，選取項使用較柔和的品牌色。
- `route-surface.tsx` 不再用 pathname 作為 React key；`state-transition.tsx` 不再按 loading identity 重建區塊。切頁只做輕微透明度過渡，不從完全透明開始。
- `skeleton.tsx` 將動畫對齊 document clock；移除部分手寫／整張卡片脈動的骨架。
- 通知、儀表板、分類設定、平台設定、管理列表與留言等改為保留容器，資料抵達時替換內部。
- 移除 AccentThemeProvider、AccentThemePicker、accent-theme 模組及獨立 ResizableCard。一般 Card 使用一致的 entrance；保留外框的 feed、通知、詳情、留言、dashboard 與管理內容按需要使用共用 resize／presence 機制。
- 預載入口 `use-route-preload.ts` 未移除。

## 已驗證與尚未驗證：請分清楚

### 已完成

- 初版視覺改版曾完整通過 `verify:all`，包含當時的 25 項瀏覽器流程。**這不能當成最終連貫性重構也完整通過。**
- 連貫性重構中途，`verify:fast` 曾通過全部 11 階段；之後仍有少量修改。
- 最後收尾跑過 `bun run check:unused`，TypeScript 與未使用宣告檢查通過。
- 最後 `git diff --check` 通過。
- 本輪已通過 `bun run verify:local` 全部 14 個階段；僅有既有 build budget 接近門檻警告。
- 本輪已通過 `bun run test:e2e`：38/38 browser journeys，包含 retained feed card 的 entry／exit 與中間高度 resize、通知表面、詳情重試、管理切換與深淺／行動版導覽。
- 以本機真實頁面做過三個有 assertion 的案例：暖啟動列表 loading → content、loading → empty、延遲提案詳情資料。三者均保留原卡片節點；列表 resize 能結束，沒有殘留 size animation。
- 空卡片案例觀察到 203px → 151px 的中間尺寸，且無反覆撐高。

### 尚未完成

- 三個 ad hoc 案例與正式 browser suite 不能取代使用者實機對所有內容長度、圖片抵達與網路節奏的視覺檢查。
- 前一輪 Lighthouse 是本機登入頁的檢查，不代表整個產品，也不代表最終改動的冷啟動效能。

## 建議接續順序

1. 查看工作樹與上述核心檔案，只追查和目前任務有關的差異。
2. 跑一次 `bun run verify:fast`，先處理型別、失效引用與測試契約問題。
3. 用官方本機環境檢查下列連貫性矩陣；優先驗證新的 browser specs。
4. 有問題先修最小必要範圍，再重跑受影響案例。
5. 最後依 `AGENTS.md` 跑一次完整 `bun run verify:all`。若只是環境收尾失敗，分別報告測試結果與清理結果，不要把它描述成產品功能失敗，也不能稱整個指令成功。

### 現有指令與環境注意

- `bun run test:env`：建立本機 seed、Worker、Auth Emulator 與開發前端，適合手動檢查。
- `bun run test:e2e`：官方正式建置與多帳號瀏覽器測試流程。
- `bun run verify:all`：本地檢查、整合與 E2E 的完整入口。
- 已有正確 E2E 服務時，可用 `bun run test:e2e:runner tests/e2e/feed-layout.spec.ts tests/e2e/loading-continuity.spec.ts tests/e2e/motion-system.spec.ts --project=chromium-desktop` 聚焦執行；它仍有 bootstrap 相依。
- 不要假設 `test:env` 的自動登入 admin 模式等同正式多帳號 E2E 環境。先前新建 context 的自動登入會造成 startup／setup 短暫切換，干擾節點量測。
- 測試結束時服務已關閉，需要重新啟動。不要同時讓 test:env 占用完整驗證所需的 port。
- 曾遇 Windows 清理 timeout：所有案例通過後，wrapper 報子程序未停止，而該 PID 稍後已退出。只清理確認屬於本次測試的程序，不要任意殺掉其他服務。

## 必要連貫性矩陣

| 區域 | 必測情況 | 重點 |
| --- | --- | --- |
| 三種 feed | cold load → 有資料／空資料／錯誤；重試 | 第一張外框同一 DOM node；沒有整區 opacity 0；resize 能結束 |
| feed 更新 | 搜尋、清除、排序、active/closed、分類切換、載入更多、返回列表 | 既有資料不無故閃掉；反應按鈕狀態不跟錯 entity；快取和捲動體驗正常 |
| 三種詳情 | 延遲 record、成功、錯誤、重試、長文／圖片抵達 | 主卡與 sidebar 的 key／外框延续；尺寸變化不縮放文字或裁掉最後內容 |
| 提案變體 | 支援附議開／關、期限有／無、作者隱藏、不同狀態 | 骨架不猜錯權限；不顯示不存在的操作；空間變化可理解 |
| 通知 | skeleton → 列表／空／錯誤；分頁、開啟通知 | 同一容器；沒有空白閃爍或巢狀空狀態卡 |
| 儀表板 | 延遲統計、刷新、空分類、無失敗紀錄、API error | 未知值不先顯示成 0；各 metric card 保留；error 不造成整頁空白 |
| 管理區 | 概況、使用者、audit、成員權限、分類、平台設定 | 載入與空結果有佔位；tab 切換合理 resize；表單資料抵達不重置使用者輸入 |
| 留言 | 初載／無留言、排序刷新、新增／刪除、展開回覆、輸入框 | 留言卡不消失；已有留言不被刷新骨架蓋掉；鍵盤與固定 composer 不跳動 |
| LiquidTabs | pointer down、快速連點、鍵盤、深淺色 | 始終只有一個顯示 active；文字可讀；inactive 與 rail 不一起著色 |
| 導覽與 preload | 預載後切頁、第一次進入、返回、快速連續切頁 | 保持單一路由 surface；導覽可點；prefetch 還在，且不提早執行 domain 讀取 |
| 全域動態 | 390px／1440px、長標題、窄欄、旋轉、reduced motion | 無水平溢出；resize 無振盪、永久固定尺寸或殘留 animation／observer |

## 高優先風險與量測方法

- **Next loading boundary 與頁面內載入要分別測。** 共用元件不等於跨 Suspense 的 DOM identity 一定相同。正式測試等待 domain request 開始，再檢查頁面內的 pending → resolved；另用慢速載入路由 bundle 檢查 preload fallback → page 是否仍有可見閃爍。不要把前者通過誇大成後者也已通過。
- **父子容器同時 resize。** 曾發生列表縮小時卡片被撐到約 633px，再反覆縮回；已用 Grid start alignment 和先讀取自然尺寸改善。需要在 dashboard、巢狀卡片、圖片到達與快速連續變更再確認。
- **保留外框不等於保留錯誤資料。** FeedList 外框按位置識別、內容按 entity ID 識別；排序後要確認支持／按讚／busy／局部狀態不串到別筆。
- 骨架測試應保存 element handle，資料抵達後比較是否仍是目前卡片，不只比較 screenshot 或尺寸。
- 取樣 resize 的中間高度、起點／終點和完成後 animation 數量；確認沒有超出合理範圍、反覆變大或永久 clip。
- reduced motion 應立即完成，不能用「一定存在中間影格」的 assertion 測這個模式。
- 新增的測試若抓到 framework fallback 而不是實際頁面骨架，先修正等待條件；不要刪掉身份／連貫性 assertion 來讓它變綠。

## 收尾交付

- 簡短列出：通過的必要案例、修正的問題、仍未驗證或環境阻塞的項目。
- 保留使用者無關的 skill 變更。
- 不建立新分支或 PR；若使用者要求推送，直接在既有分支 commit and push。
- 不主張「所有動畫都連貫」除非驗證範圍足以支持；明確區分已測案例與未測範圍。
