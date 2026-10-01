# Novae 程式流程地圖

在專案根目錄執行：

```powershell
node tools/project-map/build.mjs
```

預設產生桌面的 `Novae-程式流程地圖.html`，也可指定其他絕對路徑：

```powershell
node tools/project-map/build.mjs 'C:/Users/Tavric/Desktop/Novae-程式流程地圖.html'
```

直接以瀏覽器開啟 HTML 即可。沒有 CDN、外部字型或服務依賴，也不會登入 Novae、呼叫 API、修改資料庫或查詢正式環境。

- `content.mjs`：繁體中文解說、業務流程與設定生效方式。
- `build.mjs`：對照 action registry／設定契約、盤點 migration triggers、嵌入原碼與版本、檢查產出 JavaScript 語法。
- `template.html`：卡片連線、縮放／拖曳、逐步解說、搜尋與原碼閱讀介面。

新增 action、營運政策或保留政策時，先更新對應解說。產生器發現未解說的項目會停止，避免新版地圖悄悄漏掉操作。資料來源只包含已追蹤的程式、設定與 migrations；不讀 `.env`、憑證、資料庫或 seed。Wrangler 的部署 ID／連線字串會從內嵌快照省略。

地圖標示的是建立當下的程式版本。設定表的數字是程式初值，正式 DB 的 runtime 設定可能不同；原碼快照不會自行更新。現存 trigger 清單依 migrations 的 CREATE/DROP 順序重建，沒有宣稱部署端已套齊 migration。

閱讀時先看「全貌」，再選一個操作。卡片預設以 100% 顯示目前步驟；「全圖」縮到完整連線，「目前步驟」恢復可閱讀的大小。拖曳空白移動畫布，滾輪或按鈕縮放，左右鍵切換步驟。詳情的檔名按鈕會開啟內嵌原碼，不依賴目前本機檔案仍然存在。
