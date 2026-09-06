# 執行期政策與限制

這些數值不是文件範例。它們直接來自 `config/rate-limits.config.json`、`config/data-retention.config.json` 和 `cloudflare/wrangler.json`，generator 會把 source config 轉成前後端 contract。

## 業務操作配額

| Policy key | 上限 | 週期 | 使用情境 |
| --- | ---: | --- | --- |
| `issueCreateDaily` | 10 | 每日 / UID | 建立提案 |
| `facilityCreateDaily` | 10 | 每日 / UID | 建立設施回報 |
| `announcementCreateDaily` | 20 | 每日 / UID | 發布公告 |
| `commentCreateHourly` | 60 | 每小時 / UID | 提案與公告留言 |
| `imageUploadDaily` | 50 | 每日 / UID | 圖片 upload unit |
| `loginSyncHourly` | 20 | 每小時 / UID | Profile sync |
| `avatarCacheDaily` | 10 | 每日 / UID | 更新 avatar cache |
| `supportToggleHourly` | 120 | 每小時 / UID | 附議切換 |
| `facilityAffectedToggleHourly` | 120 | 每小時 / UID | 受影響切換 |
| `facilityStatusUpdateHourly` | 60 | 每小時 / UID | 設施狀態更新 |
| `announcementLikeHourly` | 120 | 每小時 / UID | 公告按讚 |
| `pushTokenWriteHourly` | 30 | 每小時 / UID | Push token 註冊或移除 |
| `preferenceWriteHourly` | 60 | 每小時 / UID | 個人偏好與通知已讀 |
| `moderationWriteHourly` | 120 | 每小時 / UID | 提案審核與結果 |
| `roleWriteHourly` | 120 | 每小時 / UID | 角色、scope、category 與平台設定 |
| `destructiveWriteHourly` | 30 | 每小時 / UID | 刪除與 deletion retry |

Healthcheck 另限每分鐘 12 次、每秒 2 次；Worker background run 也是每分鐘 30 次、每秒 2 次。這兩組是 Worker 內的業務限制。

## Cloudflare ingress limits

| Binding | Limit / period | 目的 |
| --- | --- | --- |
| `INVALID_AUTH_IP_RATE_LIMITER` | 300 / 60 秒 | 無效身分流量的 IP breaker |
| `READ_RATE_LIMITER` | 60 / 10 秒 | 一般讀取 |
| `WRITE_RATE_LIMITER` | 20 / 10 秒 | 一般寫入 |
| `SENSITIVE_WRITE_RATE_LIMITER` | 10 / 10 秒 | 敏感互動 |
| `ADMIN_WRITE_RATE_LIMITER` | 10 / 10 秒 | 管理寫入 |
| `UPLOAD_WRITE_RATE_LIMITER` | 6 / 10 秒 | 建立與完成 upload |
| `UPLOAD_RESOLVE_RATE_LIMITER` | 30 / 10 秒 | 解析圖片 URL |
| `SYNC_USER_RATE_LIMITER` | 10 / 60 秒 | Profile sync ingress |
| `WEBHOOK_IP_RATE_LIMITER` | 120 / 60 秒 | Cloudinary webhook 單 IP |
| `WEBHOOK_GLOBAL_RATE_LIMITER` | 300 / 60 秒 | Cloudinary webhook 全域 |
| `MEDIA_USER_RATE_LIMITER` | 1,200 / 60 秒 | 已驗證使用者媒體讀取 |
| `MEDIA_INVALID_IP_RATE_LIMITER` | 120 / 60 秒 | 無效媒體 token 的 IP breaker |
| `LOGIN_IP_RATE_LIMITER` | 300 / 60 秒 | 校園共用網路下的登入 burst |

Ingress limit 和業務 limit 會同時生效。前者保護 Worker 資源，後者限制單一 UID 的產品操作；不能只調其中一層便認為配額已改完。

## 預設資料保留

| 資料 | 預設期限 | 可停用 |
| --- | ---: | --- |
| 已關閉提案 | 365 天 | 是 |
| 已關閉設施回報 | 365 天 | 是 |
| 公告 | 730 天 | 是 |
| 站內通知 | 30 天 | 是 |
| 完成 delivery | 3 天 | 否 |
| 失敗 delivery | 14 天 | 否 |
| Operation / idempotency response | 24 小時 | 否 |
| 未活動 Push token | 60 天 | 否 |
| Push token 再確認間隔 | 7 天 | 否 |
| 未活動 avatar | 180 天 | 是 |
| 未活動 profile PII | 365 天 | 是 |
| 已過期互動限制 | 30 天 | 是 |
| 完成 background job | 3 天 | 否 |
| 失敗 background job | 30 天 | 否 |
| Role assignment audit | 365 天 | 否 |
| Platform admin audit | 365 天 | 否 |
| Category configuration audit | 365 天 | 否 |
| Access assignment audit | 365 天 | 否 |
| Pending upload | 24 小時 | 否 |
| 未附著到內容的 upload | 48 小時 | 否 |
| Failed upload | 24 小時 | 否 |

表中的值是新系統初始值。部署後，管理員可以在平台設定改 runtime retention；closed content、announcement、notification、avatar、profile PII 與 expired restriction 有獨立 enable switch。技術與安全上限仍留在程式或 Cloudflare binding，不由 UI 修改。

Retention 修改先呼叫 `estimateRetentionCleanup` 算受影響筆數，確認後才儲存設定與排入 background job。Notion 營運副本不套用這張表的刪除政策。
