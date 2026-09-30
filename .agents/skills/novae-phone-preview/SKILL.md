---
name: novae-phone-preview
description: "透過 Tailscale 啟動、查詢或停止 Novae 本機手機預覽。使用於開手機測試、分享本機 Novae 或重開測試網址；不處理正式部署或其他專案。"
---

# Novae 手機預覽

在本 skill 所屬 Novae 根目錄執行，Windows 使用 PowerShell 7。由 skill 目錄往上三層即可得到根目錄，不依賴聊天的 cwd 或固定使用者路徑。

## 啟動與重用

執行 `bun run preview:phone`。腳本自動讀取 Tailscale 裝置 DNS，使用背景程序建置並啟動 production 預覽；預設前端 3002，可用 `node scripts/tailscale-preview.mjs start 3003` 指定其他前端連接埠。已有本腳本啟動的服務時會重用，不重新清空資料。

以 `bun run preview:phone:status` 查詢，`phase: ready` 且 `running: true` 才代表建置與登入探測已完成。建置中可讀 `.novae-phone-preview/preview.log`；不要頻繁輪詢。接著執行 `bun run preview:phone:verify`，驗證實際 HTTPS 首頁、模擬登入與 API。將輸出的 `/home` 網址給使用者，提醒手機須連同一個 tailnet、電腦須保持開機。

HTTP 探測不代表 UI 已驗證。第一次啟動、程式變更或使用者回報問題時，用受控瀏覽器開啟**輸出的 Tailscale 網址**，確認實際手機寬度、資料顯示、分頁與詳情返回，並讀取 console warning/error。若瀏覽器無法操作，明確說明缺少這項驗證，不以登入 probe 代替。

## 停止或重開

停止用 `bun run preview:phone:stop`：通知測試環境正常清理，僅關閉仍匹配本服務的 443／8443／9443 Serve 代理。需要最新程式或重新建置時，先 stop，再 start。每次新啟動會重置本機種子測試資料；不使用正式資料。

## 此專案的必要邊界

- 手機分享使用 `--serve --preview`；不要改成 `next dev`，也不要把 `.next` 建置和開發共用。預覽產物位於 `.next-local-preview`，測試 service worker 停用。
- 443 是前端，8443 是本機 Worker 8787，9443 是 Firebase Auth emulator 9099。三者都需啟動，不能只分享頁面；手機的 localhost 是手機本身。
- 使用 Tailscale Serve，僅限同一個 tailnet；不開 Funnel、不公開到網際網路，不覆寫既有不同用途的 Serve 設定。代理衝突時先回報實際連接埠與現有用途。
- Tailscale 尚未 connected 時先讀狀態。此機曾因 WARP 與 Tailscale 同時連線失敗；不要自行停用 VPN、防火牆或重設登入，先說明阻塞原因讓使用者處理。
- 預覽自動登入 `admin@integration.invalid` 種子管理員，模擬登入只允許既有 loopback emulator 或明確配置的同一 Tailscale HTTPS 測試 origin；不要放寬正式登入驗證。

實作入口：[scripts/tailscale-preview.mjs](../../../scripts/tailscale-preview.mjs)。狀態與日誌位於 `.novae-phone-preview/`，不提交 Git。
