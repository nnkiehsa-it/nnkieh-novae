# 首頁與內容列表

`/home` 是首頁概覽，`/feed` 是提案、公告、設備共用的「列表」。產品規則以 [product.md](product.md) 與後端權限為準；這裡只描述畫面怎麼組成、讀什麼。

## 入口與網址

- `/` 導向 `/home`；登入完成且沒有指定目的頁時也到 `/home`。
- `/feed` 在提案功能開啟時預設顯示提案，否則顯示公告。`?view=announcements` 明確顯示公告，`?view=facilities` 在設備功能開啟時顯示設備；未知值或已關閉功能的值回到預設列表。
- 切到預設列表時移除 `view`；切換列表或分類一律清除 `bucket`、`q`、`sort`、`status`，不把上一個列表的條件帶過去。
- 提案的 `category` 接受啟用中的分類 ID 或 `my-proposals`，其他值用預設分類；設備的 `category` 只接受啟用中的設備分類。
- 搜尋框的輸入與已提交的搜尋分開：按搜尋才寫入網址，網址改變（含返回）會恢復已提交的搜尋。這由 `useFeedUrlState` 負責，列表不另建篩選狀態。

## 畫面組成

`FeedPage` 只決定顯示哪個列表、哪個分類，並把切換列表的 `Segmented` 與分類 chips 交給 `IssueFeed`、`FacilityFeed`、`AnnouncementFeed`。三個列表各自負責標題列、搜尋與排序工具、空畫面、重試與分頁；資料都經 hooks 與 services 讀取，存在 query cache 中。公告只有列表與分頁，沒有搜尋與排序工具；不要為了三個列表外觀一致而加上沒有需求的控制項。

`AppShell` 在 `md` 以上顯示固定的玻璃側欄，以下改用底部導覽。四個目的地是首頁、列表、通知、設定；通知帶未讀標記。

## 首頁

首頁是所有角色共用的入口：

- 開頭面板依 `issuesEnabled`／`facilitiesEnabled` 與是否有分類開放附議，切換說明文字與前往各列表的按鈕。
- 「整體狀態」為每個啟用中的分類各讀一次第一頁的狀態件數（`useHomeStatusCounts`），全部到齊後才加總顯示，避免數字逐一跳動。狀態件數是分類層級的計數，不受內容可見性限制。
- 「待辦」只對可能負責某些事的人顯示：管理提案分類的人看到待審核件數，管理設備分類的人看到待處理件數（只算自己管理的分類），平台管理員另看到失敗中的背景工作。

## 主要維護位置

`src/features/home/`、`src/features/feed/feed-page.tsx`、三個 `*-feed.tsx`、`src/features/shell/app-shell.tsx`、`src/hooks/use-feed-url-state.ts`、`src/hooks/use-home-status-counts.ts`、`src/lib/route-hierarchy.ts`。修改資料或業務流程時，再往對應的 hook、service 與後端追。
