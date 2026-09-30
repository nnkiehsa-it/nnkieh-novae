# 首頁內容列表維護說明

本文件記錄 2026-09-30 的程式狀態。這次沿用 Novae 的既有介面與內容流程，將公告、提案、設施列表放進同一個首頁入口；不是另建視覺系統。產品規則仍以 `docs/PRODUCT.md` 與後端權限為準。

## 入口與網址

- `/` 導向 `/home`；登入完成且沒有指定目的頁時也使用 `/home`。
- `/home` 預設顯示公告。`?view=issues` 顯示提案，`?view=facilities` 顯示設施；未知值或已關閉功能的值會顯示公告。
- `issuesEnabled`、`facilitiesEnabled` 決定首頁是否出現相應分頁。這是呈現規則，不能代替既有 route gate 與後端授權。
- 提案的 `category` 接受既有分類 ID 或 `my-proposals`；其他值使用既有預設分類。設施分類由 `useFacilityFeed` 解析。
- 切換內容分頁會清除 `category`、`q`、`bucket`、`sort`、`status`，避免把上一類列表的條件帶入另一類。公告分頁移除 `view`，保留簡潔的預設網址。
- 提案分類切換留在 `/home`，更新 `category` 並清除搜尋、bucket 與排序。獨立提案列表仍可使用原有分類 route。
- 搜尋輸入與已提交搜尋仍由 `useFeedUrlState` 分開管理：提交才更新網址；網址變動會恢復已套用的搜尋。不要在 `HomeFeed` 另建一套列表篩選狀態。

## 元件責任與外觀邊界

`HomeFeed` 只負責選擇內容、組合 `LiquidTabs`、更新網址與短暫淡入。三個抽出的 `AnnouncementFeed`、`IssueFeed`、`FacilityFeed` 保留列表、標題操作、空畫面、重試與分頁；資料讀取和反應狀態仍位於既有 feed hooks。首頁以 `lead` 將內容分頁放進各 feed 的 `PageHeader`。

分頁在窄畫面等寬排列，按鈕高 2.75rem；48rem 起改為依內容寬度排列、高 2.25rem。切換淡入為 0.18 秒，reduced motion 時不使用初始淡入。這些是首頁局部規則，不應擴寫為全產品的新設計規範。

`AppShell` 保留桌面側欄：`md` 起使用 15rem 導覽欄與右側內容欄。桌面與手機共用首頁、通知、設定三個目的地；手機使用既有浮動底部導覽。提案、設施及公告 route 的主導覽高亮歸到首頁，管理區歸到設定；詳細頁與編輯頁是否顯示手機主導覽仍由 `route-hierarchy` 決定。

公告建立按鈕繼續依 `announcement.manage` 顯示；「我的提案」不顯示新增提案操作。其他業務限制仍由原 feed、services 與後端處理。不要因首頁合併而放寬權限或把所有讀取搬到首頁。

`PageHeader` 繼續使用原有 `HeaderBackdrop progressive`，包含狀態列背景及 strong／medium／soft 三層；首頁分頁加入 header 的前置列，不另建 blur、遮罩或 fixed header。本次未修改 `header-backdrop.tsx` 與其既有 CSS。

## 舊改善報告的適用範圍

### 手機本機預覽

測試環境支援 `NOVAE_TEST_PUBLIC_ORIGIN=https://<device>.<tailnet>.ts.net`，只接受 `--serve` 與 Tailscale HTTPS 裝置網址。Tailscale Serve 將 443 代理至前端連接埠、8443 至本機 Worker 8787、9443 至 Auth emulator 9099。手機須連同一個 tailnet；預覽自動登入種子測試管理員，不使用正式資料。停用代理時分別執行 `tailscale serve --https=443 off`、`--https=8443 off`、`--https=9443 off`。

`docs/improvement-audit.md` 是 2026-09-29 的完成紀錄。其中「導覽與畫面」與「品牌與介面」寫的是桌面頂部導覽；目前 `app-shell.tsx` 明確使用固定側欄，因此該兩處不能用來描述現在的桌面配置。手機抽屜的描述也不等於現在 `AppShell` 的三項底部導覽。此文件保留舊報告作為歷史紀錄，沒有回寫或重新背書其中的驗證數字。

舊報告對共用 hook、entity store、pending／樂觀更新、重試與草稿等方向，和首頁重用既有 feed 的做法一致；但舊有 235 項單元測試、85 項 E2E 及後端 65 項整合測試是該批修改的紀錄，不能當成本次首頁整合已通過的證據。實際測試與部署結果應以本次執行輸出為準。

## 後續可接續的工作

- 針對 `/home` 補足必要的整合驗證：直接開啟各 `view`、功能關閉、分類與搜尋網址、上一頁恢復，以及既有詳細頁返回。此處列的是驗證重點，不代表尚未查看的測試缺少覆蓋。
- 若要改善公告的查找方式，先確認需求；目前公告 feed 只有列表與分頁，提案及設施才有搜尋和排序工具列。不要為了讓三個分頁長得一致而新增無需求的控制項。
- 若後續需修訂全站設計文件，另開範圍盤點既有 token 與共用元件。目前缺少根目錄 `DESIGN.md` 是既有狀況，本次未建立新規範或修復其他文件漂移。

主要維護位置：`src/components/home/home-feed.tsx`、`home-feed.module.css`、三個 `*-feed.tsx`、`src/components/app-shell.tsx`、`src/hooks/use-feed-url-state.ts`、`src/lib/route-hierarchy.ts`。修改資料或業務流程時，再往對應 hook、service 與後端追查。
