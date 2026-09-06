# 路由、角色與權限

這份文件回答兩件事：使用者能進哪些頁面，以及後端最後用什麼規則決定一項操作能不能執行。前端 route guard 只負責導向和畫面呈現，不能取代 Worker 與 PostgreSQL 的授權。

## Route map

所有 `(protected)` route 都先經過 `ProtectedApp`。Session 尚未恢復時顯示啟動畫面；未登入會轉到 `/login?redirect=...`。首次設定沒完成時，所有受保護頁面都轉到 `/setup`；設定完成後再次進入 `/setup` 則轉到 `/issues`。

| Route | 用途 | 額外條件 |
| --- | --- | --- |
| `/` | 入口 redirect | 直接轉到 `/issues` |
| `/login` | Google 登入與 session restore | 公開頁面 |
| `/setup` | 語言與初始 category 設定 | 未完成 setup；只有平台管理員可編輯，其他人看到等待狀態 |
| `/issues` | 提案入口 | 依 catalog 轉到預設 category；沒有預設值時轉到 `/issues/my-proposals` |
| `/issues/[filter]` | category feed 或「我的提案」 | `issues` feature 必須開啟 |
| `/issues/[filter]/new` | 新增提案 | category 規則、互動限制與後端驗證 |
| `/issues/[filter]/[issueId]` | 提案內容、附議、留言與處理結果 | 可見性與 category scope 由後端判斷 |
| `/facilities` | 設施回報列表 | `facilities` feature 必須開啟 |
| `/facilities/new` | 新增設施回報 | 互動限制與後端驗證 |
| `/facilities/[facilityId]` | 設施詳情、受影響標記與狀態 | 管理操作依 facility scope |
| `/announcements` | 公告列表 | 登入即可閱讀 |
| `/announcements/new` | 發布公告 | `announcement.manage` |
| `/announcements/[announcementId]` | 公告、按讚與留言 | 寫入仍受互動限制 |
| `/notifications` | 合併 broadcast、admin、user 通知 | admin source 只回給具管理身分的使用者 |
| `/settings` | 帳號、語言、外觀、安裝、Push 與管理入口 | 管理連結依 permission 顯示 |
| `/dashboard` | 平台統計與營運診斷 | `dashboard.view` |
| `/admin/management` | Overview、使用者、分類、成員 scope、audit | 至少具 `dashboard.view`、`category.manage` 或 `role.manage` 之一；tab 再依個別權限顯示 |
| `/admin/categories` | 舊入口名稱的固定 redirect | 轉到 `/admin/management?tab=categories` |
| `/admin/access` | 成員管理入口 | 轉到 `/admin/management?tab=members` |

`issues` 或 `facilities` feature 關閉時，對應 route family 由 `FeatureRouteGuard` 轉到 `/announcements`。公告、通知與設定不受這兩個 feature flag 影響。

## Role code

Session bootstrap 回傳 role、permission，以及可管理的 category ID。

| Role code | 意義 |
| --- | --- |
| `platform-admin` | 平台管理員；後端依 `ADMIN_EMAILS` 建立，涵蓋所有 category 與平台權限 |
| `proposal-manager` | 管理獲指派的提案 category |
| `general-affairs` | 管理獲指派的設施 category |
| `announcement-manager` | 發布與刪除公告 |

`SessionRole` 的 `admin` / `user` 是介面使用的粗粒度狀態；真正的操作能力看下面的 permission 和 category scope。

## Permission code

| Permission | 主要用途 |
| --- | --- |
| `proposal.manage` | 審核提案狀態、更新處理結果；實際提案仍要符合 category scope |
| `facility.manage` | 管理設施回報；實際案件仍要符合 facility category scope |
| `announcement.manage` | 發布、刪除公告 |
| `category.manage` | 讀寫 category、feature、retention、影響估算與 platform job |
| `role.manage` | 搜尋使用者、調整限制、設定 category scope、看角色稽核與重試 deletion job |
| `dashboard.view` | Dashboard、管理 overview、activity 與 deletion job 列表 |

Platform admin 不需要逐一加入 category ID。`canManageIssueCategory` 和 `canManageFacilityCategory` 先看是否含 `platform-admin`，否則要求目標 category ID 出現在 session bootstrap 回傳的 managed list。

## 授權檢查的實際順序

一個 browser action 會依序經過：

1. `ALLOWED_ORIGINS` 檢查。
2. Firebase App Check 與 Firebase ID token 驗證。
3. Cloudflare native rate limit 和 Durable Object business limit。
4. 從 PostgreSQL 載入使用者、role、permission、scope 與 restriction。
5. Action registry 的 `requiredPermission`。
6. Domain handler 與 `app_api` RPC 的擁有者、category scope、狀態轉移及資料可見性規則。

前端即使手動呼叫隱藏的 action，也會走完整檢查。資料庫 runtime role 本身沒有 DDL 權限，不能繞過 RPC 去改 schema 或 role。

## 使用者限制

受限制帳號仍能登入和讀取獲准內容，但下列互動會在 action execution 階段回傳 `user-muted`：

- 建立提案、設施回報、一般留言或公告留言
- 附議、設施受影響標記、公告按讚
- 建立或 finalize 圖片 upload session

平台管理員不能在管理介面被設為互動限制。平台管理員名單若要調整，修改部署環境的 `ADMIN_EMAILS`，下一次後端 profile reconciliation 會套用結果。

## 提案 category 的資料可見性

提案 category 的 `readAccess` 決定讀取範圍：

| 值 | 行為 |
| --- | --- |
| 公開型 | 校內成員可讀，是否顯示作者由 `authorVisible` 決定 |
| `reviewed-school` | 審核前只給作者與管理方，通過後進入校內可讀流程 |
| `owner-admin` | 只給作者與具該 category scope 的管理方 |

已完成、不可行、審核拒絕或自動拒絕的提案不再接受留言。`reviewed-school` category 只在 `pending` 或 `processing` 接受留言；其他 category 在 `under-review` 階段關閉留言。
