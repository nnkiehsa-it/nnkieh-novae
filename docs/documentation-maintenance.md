# 文件與程式地圖維護

README 是專案入口，`docs/` 說明目前行為，`structure.md` 對應程式責任。維護時先確認 checkout，再從負責該功能的程式找事實；操作手冊中的截圖只證明擷取時的畫面。

## 變更對應

| 程式變動 | 一起更新的文件 |
| --- | --- |
| 首頁、列表、發文、通知 | `product.md`、`home-feed.md`、一般成員手冊 |
| Route、permission、scope | `routes-and-permissions.md`、分類／平台管理手冊 |
| Worker action、HTTP contract | `backend-and-data.md`、`tools/project-map/content.mjs` |
| Migration、資料表、RPC | `backend-and-data.md`、`structure.md`、地圖 `models.mjs` |
| 政策、保留期限、圖片限制 | `runtime-policies.md`、`configuration.md`、地圖 `settings.mjs`／`content.mjs` |
| Queue、event、Realtime | `events-realtime-and-media.md`、`architecture.md` |
| 指令、port、workflow | `local-development.md`、`testing.md`、`deployment-and-operations.md` |

設定表描述程式初值及可調範圍。正式環境目前的 runtime 值由管理介面讀取；migration 檔案存在也不等於遠端已套用。

## 更新地圖

在專案根目錄使用 PowerShell 7：

```powershell
git status --short
git log -1 --oneline
node tools/project-map/build.mjs
```

預設輸出桌面的 `Novae-程式流程地圖.html`。可將絕對輸出路徑放在命令最後；畫面、原碼、版本與時間都封裝在同一份 HTML。搬到其他電腦仍可閱讀，更新程式後必須重新產生。

產生器會核對 action、設定、模型、trigger 解說及來源行數；有缺漏就停止。增加 migration 時要檢查 CREATE／DROP 之後的現存 trigger 與 foreign key，不能把歷史宣告加總當成目前數量。地圖來源清單排除環境檔、credential、資料庫和 seed。

## 文件驗證

```powershell
git diff --check
```

再檢查相對連結、程式路徑和 `package.json` 的指令。修改地圖要重新產生，開啟搜尋、設定、資料模型與原碼，並在桌面／手機及亮暗色各確認一次。只有修改產品程式或測試工具時，才依 [testing.md](testing.md) 加跑相應 gate。

`improvement-audit.md`、`admin-console-review.md` 與 `search-performance.md` 是帶日期的工作證據。保留原本測試數和量測條件；新驗證另記版本、命令及環境，避免把舊結果寫成現行保證。
