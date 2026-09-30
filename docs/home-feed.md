# 內容列表維護說明

本文件記錄 2026-09-30 的程式狀態。`/home` 是首頁概覽，`/feed` 是提案、公告、設備共用的「列表」（Feed）。產品規則仍以 `docs/PRODUCT.md` 與後端權限為準。

## 入口與網址

- `/` 導向 `/home`；登入完成且沒有指定目的頁時也使用 `/home`。
- `/feed` 在提案功能開啟時預設顯示提案，否則顯示公告。`?view=issues` 顯示啟用中的提案，`?view=announcements` 明確顯示公告，`?view=facilities` 顯示啟用中的設備；未知值或已關閉功能的值回到目前預設列表。
- 分頁順序為提案、公告、設備。`issuesEnabled`、`facilitiesEnabled` 決定是否出現相應分頁。這是呈現規則，不能代替既有 route gate 與後端授權。
- 提案的 `category` 接受既有分類 ID 或 `my-proposals`；其他值使用既有預設分類。設施分類由 `useFacilityFeed` 解析。
- 切換內容分頁會清除 `category`、`q`、`bucket`、`sort`、`status`，避免把上一類列表的條件帶入另一類。切到目前預設列表時移除 `view`；其他列表保留明確的 `view`，因此提案啟用時公告使用 `?view=announcements`。
- 提案分類切換留在 `/feed`，更新 `category` 並清除搜尋、bucket 與排序。獨立提案列表仍可使用原有分類 route。
- 搜尋輸入與已提交搜尋仍由 `useFeedUrlState` 分開管理：提交才更新網址；網址變動會恢復已套用的搜尋。不要在 `HomeFeed` 另建一套列表篩選狀態。

## 元件責任與外觀邊界

`HomeFeed` 負責選擇內容、持續掛載外層 header 與 `LiquidTabs`、更新網址及內容淡入。三個抽出的 `AnnouncementFeed`、`IssueFeed`、`FacilityFeed` 保留列表、標題操作、空畫面、重試與分頁；資料讀取和反應狀態仍位於既有 feed hooks。選中的 feed 透過 portal 將分類與操作控制項放進外層 header 的 host。獨立列表 route 仍可使用各 feed 原有的 `PageHeader`。

分頁在手機與桌面都依內容寬度排列，按鈕高 2rem（32px），不撐滿整列。外層 header 內部間距為 0.5rem（8px）。切換時只有內容區重新掛載並淡入，分頁本身保留穩定 ID、鍵盤焦點及 LiquidTabs 選取滑塊動畫。內容淡入為 0.18 秒，reduced motion 時不使用初始淡入。這些是列表局部規則，不應擴寫為全產品的新設計規範。

`AppShell` 保留桌面側欄：`md` 起使用 15rem 導覽欄與右側內容欄。桌面與手機共用首頁、列表、通知、設定四個目的地；手機使用既有浮動底部導覽。提案、設備及公告 route 的主導覽高亮歸到列表，管理區歸到設定；詳細頁與編輯頁是否顯示手機主導覽仍由 `route-hierarchy` 決定。

公告建立按鈕繼續依 `announcement.manage` 顯示；「我的提案」不顯示新增提案操作。其他業務限制仍由原 feed、services 與後端處理。不要因列表合併而放寬權限或把所有讀取搬到 `HomeFeed`。

外層 header 繼續使用原有 `HeaderBackdrop progressive`，包含狀態列背景及 strong／medium／soft 三層；分頁與 portal host 共用這個持續掛載的 header。本次未修改 `header-backdrop.tsx` 與其既有 CSS，也沒有另建 blur 或遮罩。

## 本次驗證

首頁 `HomeOverview` 是所有角色一致的產品引導入口，不載入使用統計或個人計數。依 `issuesEnabled`／`facilitiesEnabled` 切換主題文字與主操作：優先提出想法，其次回報設備問題，兩者皆關閉時引導查看公告。其他入口只顯示啟用中的功能，不留空區塊。統計、活躍度、期間活動、分布與維運資訊已移回管理區，仍依既有權限讀取。

插圖 `public/home-start.webp` 為內建 imagegen 生成的黑色手繪線稿，透明背景，使用 CSS invert 適應深色主題。檔案約 20KB；提示詞保留於 `docs/assets/home-start.md`。

依使用者要求，首頁這批只做必要型別檢查與測試伺服器的 production 建置，不追加動畫驗證。

先前的列表調整已通過建置、TypeScript、lint 與 i18n 檢查。當時查看手機 319×675 與桌面 1280×720 畫面，切換保留分頁 ID 與焦點，console 沒有警告或錯誤；這是列表那批的紀錄，不代表首頁已做完整 UI 測試或完成正式部署。

## 舊改善報告的適用範圍

### 手機本機預覽

手機分享用 `bun run preview:phone`，狀態／探測／停止分別用 `preview:phone:status`、`preview:phone:verify`、`preview:phone:stop`。腳本自動取得 Tailscale 裝置網址並在背景運行；日誌與狀態放在 `.novae-phone-preview/`。專案 skill 位於 `.agents/skills/novae-phone-preview/SKILL.md`，可用 `$novae-phone-preview` 呼叫。需要新版本時停止再啟動。

底層使用 `node scripts/verify-integration.mjs --serve --preview`，先建置，再用 `next start` 提供 production 預覽，停用測試 service worker；產物放在 `.next-local-preview`。一般 `--serve` 的開發產物放在 `.next-local-dev`，兩者都與正式建置的 `.next` 分離，避免共享產物與遠端熱更新打斷載入。

測試環境支援 `NOVAE_TEST_PUBLIC_ORIGIN=https://<device>.<tailnet>.ts.net`，只接受 `--serve` 與 Tailscale HTTPS 裝置網址。Tailscale Serve 將 443 代理至前端連接埠、8443 至本機 Worker 8787、9443 至 Auth emulator 9099。手機須連同一個 tailnet；預覽自動登入種子測試管理員，不使用正式資料。停用代理時分別執行 `tailscale serve --https=443 off`、`--https=8443 off`、`--https=9443 off`。

`docs/improvement-audit.md` 是 2026-09-29 的完成紀錄。其中「導覽與畫面」與「品牌與介面」寫的是桌面頂部導覽；目前 `app-shell.tsx` 明確使用固定側欄，因此該兩處不能用來描述現在的桌面配置。手機抽屜的描述也不等於現在 `AppShell` 的三項底部導覽。此文件保留舊報告作為歷史紀錄，沒有回寫或重新背書其中的驗證數字。

舊報告對共用 hook、entity store、pending／樂觀更新、重試與草稿等方向，和列表重用既有 feed 的做法一致；但舊有 235 項單元測試、85 項 E2E 及後端 65 項整合測試是該批修改的紀錄，不能當成本次列表整合已通過的證據。實際測試與部署結果應以本次執行輸出為準。

## 後續可接續的工作

- 若後續要加入所有成員可見的全校進度摘要或個人待辦／追蹤，先界定資料來源與授權；目前全站使用統計仍僅供有 `dashboard.view` 權限的使用者。
- 後續列表整合驗證以 `/feed` 為入口，包含功能開關、分類／搜尋網址與詳情返回；本批不擴增動畫驗證。
- 若要改善公告的查找方式，先確認需求；目前公告 feed 只有列表與分頁，提案及設施才有搜尋和排序工具列。不要為了讓三個分頁長得一致而新增無需求的控制項。
- 若後續需修訂全站設計文件，另開範圍盤點既有 token 與共用元件。目前缺少根目錄 `DESIGN.md` 是既有狀況，本次未建立新規範或修復其他文件漂移。

主要維護位置：`src/components/home/home-feed.tsx`、`home-feed.module.css`、三個 `*-feed.tsx`、`src/components/app-shell.tsx`、`src/hooks/use-feed-url-state.ts`、`src/lib/route-hierarchy.ts`。修改資料或業務流程時，再往對應 hook、service 與後端追查。
