# 產品介面與操作連續性

控制項與視覺規範以 [Framework7 維護說明](framework7.md) 和 [DESIGN.md](../DESIGN.md) 為準。全站固定使用 Framework7 iOS theme、上游樣式與原生動畫，不延續舊版自訂字型、圓角、陰影、HeaderBackdrop、Tabbar 或按壓時間。

## 保留的產品責任

- 列表保留網址篩選、排序、分頁、session feed memory 與目前的權限判斷。
- 詳情路由保留來源頁的 DOM、載入結果和捲動位置；直接開啟的詳情關閉後回到對應列表。
- 送出、附議與按讚維持既有樂觀更新與操作 idempotency；視覺成功回饋不阻擋導航或下一個操作。
- 草稿儲存、管理表單 review／discard 與分享入口的離開檢查維持原本流程。原生面板按鈕、Escape、遮罩及下拉手勢經過同一個關閉入口。
- 載入、空白、錯誤與內容狀態使用同一組元件結構；未知欄位使用 SkeletonBlock，錯誤保留既有內容與重試入口。
- 使用者偏好減少動態效果時，停用不必要的位移與持續動畫。Native 控件的尺寸與動畫來自 Framework7，不再自行重建。

## 維護與驗證

正常欄位、列表、選單、搜尋與導航先使用 Framework7 對應元件。圖表、Markdown 原始編輯與 domain 狀態回饋依實際用途保留。新增頁面時同時確認手機／桌面、亮／暗色、長文字、safe area、鍵盤、捲動標題收合及返回位置。

主要捲動容器是 PageContent。共用 Navbar host 提供搜尋入口給所有嵌入式列表，React 操作按鈕由 Next／產品 callback 處理，Framework7 hash 控件由其原生模組處理。不要在事件進入產品 callback 前攔截預設事件。
