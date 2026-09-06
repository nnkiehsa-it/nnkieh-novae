# Novae 文件

這裡記錄目前 repository 內程式的運作方式。設定名稱、指令與部署順序都以原始碼、`package.json` 和 GitHub Actions 為準。

| 文件 | 內容 |
| --- | --- |
| [產品與使用流程](product.md) | 內容狀態、category 規則、平台功能、首次設定與 dashboard |
| [路由、角色與權限](routes-and-permissions.md) | 完整 route map、role / permission、scope、授權順序與互動限制 |
| [系統架構](architecture.md) | 啟動流程、前端分層、快取、Worker、transaction、PWA 與部署拓撲 |
| [後端及資料層](backend-and-data.md) | HTTP contract、完整 action 索引、transaction、schema role、migration 與 generated contract |
| [事件、即時更新、通知與圖片](events-realtime-and-media.md) | Event destination、Queue、WebSocket topic、Push preference 與 Cloudinary lifecycle |
| [執行期政策與限制](runtime-policies.md) | 業務與 Cloudflare rate limit、圖片限制、完整 retention defaults |
| [設定參考](configuration.md) | 設定存放位置、required values、格式、Cloudflare bindings 與變更後驗證 |
| [本機開發](local-development.md) | 完整啟動順序、固定 port、資料庫指令、generated artifacts 與常見失敗 |
| [部署與維運](deployment-and-operations.md) | Workflow path、部署 gate、smoke test、cron、Queue、加密備份與災難重設 |
| [測試與驗證](testing.md) | 14 階段 local verification、integration / E2E / stress、CI path selection |

程式責任的逐目錄索引另見根目錄的 [`structure.md`](../structure.md)。

## 建議閱讀順序

第一次看專案，先讀產品、路由權限與架構。準備本機修改時，再看本機開發和測試。負責部署的人應從設定參考開始，接著讀後端資料層、事件投遞、執行期政策與部署維運。

文件描述的是當前程式，不另維護第二套命令或部署流程。路由、binding、環境變數、action 或 migration 改名時，對應文件和 `structure.md` 要在同一個變更更新。
