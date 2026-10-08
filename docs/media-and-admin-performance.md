# 圖片顯示與管理佇列效能

快取回復原本只帶回頭像網址。`AvatarImage` 掛載後仍立即顯示 spinner，附件也會把等待 `decode()` 的時間顯示成 spinner。2026-10-08 的調整改成頭像先顯示文字替代圖，附件延遲 100 ms 才顯示靜態占位；實際圖片在完整解碼後才淡入。

## 圖片顯示與快取

[`use-decoded-image.ts`](../src/components/ui/use-decoded-image.ts) 控制實際顯示的圖片元素。已經 `complete` 且有尺寸的快取圖片直接開始解碼，不必等另一個 `load` event。切換來源或卸載後，舊解碼結果不會更新新圖片；解碼失敗保留替代畫面。[`decode()` 文件](https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement/decode) 說明這個 Promise 完成時圖片才適合顯示。

頭像網址包含不覆寫的 Cloudinary public ID。來源更新會建立新 ID，因此同一版頭像可使用 `immutable`。管理員可在「執行期政策 → 用戶端」調整這兩個新欄位：

| 政策 | 預設秒數 | 用途 |
| --- | ---: | --- |
| `avatarBrowserSeconds` | 31,536,000 | 公開頭像的瀏覽器快取 |
| `avatarEdgeSeconds` | 86,400 | 頭像的 Worker 邊緣快取 |
| `mediaBrowserSeconds` | 60 | 公開內容附件的瀏覽器快取 |
| `mediaEdgeSeconds` | 60 | 內容附件的 Worker 邊緣快取 |

私密圖片一律回傳 `private, no-store`。Service Worker 的 API 路徑使用 `NetworkOnly`，不把這些圖片放進 CacheStorage。公開附件可能隨內容可見性改變，仍使用短快取和重新驗證，沒有套用頭像的一年期限。所有內容附件的簽章網址採十五分鐘期限、五分鐘 expiry bucket，實際有效時間最多二十分鐘；過期後須重新確認內容存取權限。Worker 同時限制瀏覽器快取不超過剩餘授權時間，拒絕舊的永久附件 token。已發出的短效網址在到期前仍有效。

Google `photoURL` 只用作頭像同步來源。介面及後端公開人物資料不再回退讀取 Google 原圖；Cloudinary 頭像尚未建立時顯示姓名首字，避免先下載 Google 圖片、再下載 Cloudinary 圖片。人物快取改用 `user-profile-v2`，不沿用可能含有 Google 原圖網址的舊紀錄。

Worker 使用 `ctx.waitUntil()` 在背景寫入圖片邊緣快取，首個 response 可以先送給瀏覽器。[Cloudflare Cache API 文件](https://developers.cloudflare.com/workers/runtime-apis/cache/) 有背景寫入的使用方式。讀取 Cloudinary 仍由 Worker 簽章，頭像與縮圖繼續由 Cloudflare 調整尺寸；完整圖片沿用已在上傳前壓縮的 WebP。

附件網址解析放在 [`upload-delivery.ts`](../src/services/upload-delivery.ts)。後端明確回傳 `privateByUploadId`；只有公開網址寫入既有的帳號隔離 IndexedDB 快取，有效時間為十分鐘，並於簽章到期前六十秒失效。參照使用 `upload-media-v2`，不回復舊永久網址。私密網址只放記憶體，內容、分類變動和登出會清除參照。逾期大圖重新解析後，lightbox 使用新的 full URL。附件和作者資料超過 50 個 ID 時分批讀取，相同批次的並行請求會合併。

選圖仍沿用 WebP 壓縮與 Cloudinary signed upload。每張圖處理結束會清掉來源元素及 canvas backing store，讓下一張照片不必等待垃圾回收才釋放這些資源。這項修改沒有把編碼移到 Worker，也沒有量測實體手機的記憶體峰值。

## 管理員診斷與佇列

供應商診斷沿用共用管理員讀取控制，Cloudinary、Cloudflare 和日誌各有獨立請求狀態。同一查詢不重複發送；較舊搜尋、已卸載畫面及舊帳號的回應不能覆蓋目前讀取。日誌下一頁失敗會留下原資料和游標，可直接重試。

`0060_admin_queue_indexes.sql` 為工作列表、失敗投遞、外部清理及錯誤列表補上符合現有排序的索引。沒有改資料內容或佇列執行規則。

2026-10-08 在 Windows、WSL PostgreSQL 17、Node.js 24 的隔離資料庫量測，每個相關表有 50,000 筆合成資料。查詢第一頁 101 筆，先暖機一次，再取三次 `EXPLAIN (ANALYZE, BUFFERS)` 執行時間中位數。套用 migration 前後核對完整結果相同，planner 自行選用新增索引。

| 查詢 | 原本 | 新索引 |
| --- | ---: | ---: |
| 工作列表 | 12.410 ms | 0.051 ms |
| 失敗投遞 | 25.512 ms | 0.170 ms |
| 外部清理 | 4.545 ms | 0.041 ms |
| 錯誤列表 | 6.070 ms | 0.039 ms |

這些數字是單連線 SQL 暖快取時間，未包含網路、Worker、深頁 OFFSET 或正式資料分布。索引也增加儲存與寫入成本。重新量測使用：

```powershell
bun run verify:admin-performance
```

未指定 `DATABASE_OWNER_URL` 時，腳本啟動本機 PostgreSQL、建立 `novae_admin_verify_<pid>`，量測後刪除該隔離資料庫。Windows 執行期間維持 WSL 活動，避免 PostgreSQL 因閒置關閉。指定 URL 時，目標 owner 必須有建立資料庫及匯入 fixture 的權限。

## 部署與驗證

部署先套用 migration 0060、0061，再發布 Worker 和前端；附件解析 response 新增欄位，因此兩端需一起更新。0061 補上頭像快取政策，保留既有營運設定。降低瀏覽器快取期限不會回收裝置已保存的舊版 response，新頭像需使用新的 public ID。

```powershell
bun run verify:all
```

完整 gate 涵蓋 production build、型別、翻譯、UI 邊界、單元測試、依賴稽核、後端整合、既有資料升級，以及桌面／手機瀏覽器流程。Cloudinary、Notion、FCM 使用本機替身；這些結果不代表正式服務或實體 iPhone 已驗證。

2026-10-08 本機驗證結果：13 階段 local 通過、76 項後端整合測試通過、既有資料升級及資料庫契約檢查通過。完整 Chromium E2E 為 100 項通過、一項本機自動登入情境略過；最後的附件授權與長數字欄位調整，再重建並通過 63 項 E2E（包含管理頁、上傳及私密圖片快取，另含相關唯讀流程依賴）。390 px 和 1280 px 管理頁截圖已確認秒數完整顯示。

新增營運政策 key 時需附上同批資料庫 migration。0061 尚未套用時，Worker 的政策完整欄位驗證會回傳 `validation-invalid`；先核對 migration 紀錄與生成的政策契約，再更新 Worker。

本次正式建置的全站 JavaScript 產物為 3,130,176 bytes，接近 3 MiB 上限，build budget 仍有警告。後續增加套件或功能時先查看 `.next-verify/build-budget-report.json`；這是全站產物總量，不是單一頁面初始下載量。

本次安全稽核要求更新 Next.js 至 `16.3.8`、sharp 至 `0.35.5`，並固定 source-map-js `1.2.2`。對應公告為 [Next.js 圖片優化 SSRF](https://github.com/advisories/GHSA-cjq9-62q9-8jv4)、[sharp 的 librsvg 漏洞](https://github.com/advisories/GHSA-wq5f-xc86-pv6w)及 [source-map-js 阻斷服務](https://github.com/advisories/GHSA-68fv-2mgg-jv7q)。版本與 lockfile 已一起更新。
