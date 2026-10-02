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

- `content.mjs`：操作、共用流程、設定與自動觸發的繁體中文解說。
- `architecture.mjs`：依 README／程式碼整理整個專案與目錄依賴。
- `models.mjs`：每張資料表／view 的用途、身份鍵、生命周期與關係；完整欄位由生成 schema 取得。
- `settings.mjs`：管理員修改設定 → 提交 → 資料 → 自動工作 → 生效時機的流程。
- `build.mjs`：對照 registry／設定／模型，盤點 triggers 與 FK，嵌入原碼及版本，檢查 inline JavaScript。
- `template.html`、`map.css`、`map.js`：側欄、畫布與互動；產生時全部內嵌成單一 HTML。

新增 action、營運政策或保留政策時，先更新對應解說。產生器發現未解說的項目會停止，避免新版地圖悄悄漏掉操作。資料來源只包含已追蹤的程式、設定與 migrations；不讀 `.env`、憑證、資料庫或 seed。Wrangler 的部署 ID／連線字串會從內嵌快照省略。

地圖標示的是建立當下的程式版本。設定表的數字是程式初值，正式 DB 的 runtime 設定可能不同；原碼快照不會自行更新。現存 trigger 清單依 migrations 的 CREATE/DROP 順序重建，沒有宣稱部署端已套齊 migration。

所有分類、事件、設定與原碼由左側選。中央沒有頂部頁籤或底部步驟列；選取卡片才開浮動解說，叉叉關閉，上／下一步位於浮動面板。面板覆蓋畫布，不改變畫布寬高。

卡片以 100% 從起點閱讀：桌面一直往右，手機一直往下，沒有蛇形折返。「適合畫面」縮到整圖，「定位卡片」回到閱讀大小。拖曳空白平移、滾輪／雙指縮放，畫布聚焦時左右鍵切步驟。卡片選取與面板開啟有短動畫，支援減少動態偏好。來源按鈕開啟內嵌原碼，不依賴原本本機檔案仍然存在。
