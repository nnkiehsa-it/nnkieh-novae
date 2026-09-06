# 產品與使用流程

## 使用者

Novae 服務同一學校網域內的三類使用者：

- 一般成員提出議題、附議、留言、回報設施、閱讀公告並接收通知。
- 分類管理員在獲授權的 category scope 內審核與處理內容。
- 平台管理員設定功能、分類、權限、資料保留政策並查看系統狀態。平台管理員名單只來自 Worker 的 `ADMIN_EMAILS`。

## 內容流程

### 公共提案與權益案件

提案分類決定可見性、作者是否匿名、附議門檻與時限、管理回覆期限，以及是否開放留言。列表和詳細頁共用 normalized entity store；附議先在畫面上更新，失敗時會還原。提案結案後顯示管理方的處理結果。

提案狀態由後端控制，前端認得下列七種值：

| Status | 意義 |
| --- | --- |
| `under-review` | 等待管理方決定是否公開 |
| `pending` | 已進入提案流程，等待附議或處理 |
| `processing` | 管理方處理中 |
| `auto-rejected` | 附議期限結束且未達門檻 |
| `review-rejected` | 審核未通過 |
| `infeasible` | 管理方判定無法執行，需附處理結果 |
| `completed` | 已完成並提供結果 |

Feed 可依最新、最多附議、即將截止排序；`my-proposals` 是獨立 route filter，不是 category。若 category 開啟附議，回覆期限從達標時計算；沒有附議流程時則從建立時間算起。

### 設施回報

成員提交位置、內容及圖片，也能標記自己受到影響。具權限的管理員更新案件狀態與結案說明，列表、詳細頁及通知會由 content version 與 realtime event 重新同步。

設施狀態是 `pending`、`processing`、`completed` 或 `unable-to-handle`。列表可按最新或受影響人數排序。管理員的 scope 綁定 facility category，不因能進管理頁就自動取得所有設施案件權限。

### 公告

管理員發布公告，成員可按讚與留言。公告和留言使用與提案相同的媒體、作者資料解析、optimistic reaction 與討論元件。

### 通知

通知來源包含 domain event 對應的站內訊息與 Firebase Cloud Messaging。通知點擊會直接解析到目標 route，由目的頁自行載入 authoritative data，不先做額外 lookup。

通知 feed 會合併全校 broadcast、管理員通知、個人通知；每個來源維持自己的 cursor。使用者可以分別關閉留言、提案進度、設施進度的個人 Push，但站內通知仍由事件規則建立。

## 可設定項目

### Platform feature

| Setting | 影響 |
| --- | --- |
| `issuesEnabled` | 導覽與整個 `/issues` route family |
| `facilitiesEnabled` | 導覽與整個 `/facilities` route family |
| `announcementCommentsEnabled` | 公告留言寫入與呈現 |

### 提案 category

每個 category 保存穩定 ID、雙語介面顯示用 label、排序、是否預設，以及下列業務規則：

- `readAccess`：`school`、`reviewed-school` 或 `owner-admin`
- `authorVisible`：公開畫面是否顯示作者；後端仍保存真實 UID
- `supportEnabled`、`supportGoal`、`supportDeadlineDays`
- `responseDeadlineDays`
- `commentsEnabled`

設施 category 只負責 ID、label、排序與預設值；案件管理 scope 同樣以 category ID 指派。

## 首次設定

登入後先選擇介面語言。尚未完成系統設定時，平台管理員會進入 `/setup`，至少建立一個提案分類與一個設施分類；流程可安全重試，完成狀態由後端決定。

若一般成員比管理員更早登入，會停在等待畫面。平台管理員完成設定後，其他已登入裝置不靠舊 session cache 猜狀態，會重新取得 bootstrap 並進入主程式。

## 管理範圍

管理介面包括分類與功能開關、category-scoped access、使用者限制、平台資料保留設定、失敗媒體刪除重試、背景工作進度、稽核紀錄與 dashboard。前端隱藏按鈕只是呈現行為，真正的允許或拒絕由 Worker action 與資料庫函式判斷。

Dashboard 的統計包含使用者、提案、留言、附議新增／移除與刪除計數，也會顯示 Notion backlog、failed delivery、failed Push、stuck upload、cleanup backlog、最近失敗與上次 scheduled maintenance。這些讀取要求 `dashboard.view`。

## 介面原則

應用支援繁體中文與英文、亮暗色、鍵盤操作、reduced motion、手機 safe area 與 PWA standalone viewport。手機是主要使用情境；桌面則提供較密集的設定與管理畫面。

所有 domain copy 在 `src/i18n/messages/en` 與 `src/i18n/messages/zh-TW` 成對維護。`check:i18n` 會檢查 catalog shape、interpolation、API error reference、直接 `t()` key，以及 React source 裡未納管的漢字。

## 目前明確不做的事

- 不提供多租戶切換；一個 deployment 對應一個學校網域。
- 不讓前端或資料表欄位授予平台管理員。
- 不把 PostgreSQL、Durable Object 或 Notion 當作 browser 可直接存取的服務。
- 不接入生成式 AI；內容、審核與管理決策都由使用者完成。
