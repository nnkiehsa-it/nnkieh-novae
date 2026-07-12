# Cloudinary：圖片服務與 callback 簽章

[English](../en/deployment/cloudinary.md) · [回到部署總覽](../deployment-guide.md)

Novae 由後端簽發上傳參數，瀏覽器把壓縮後圖片送到 Cloudinary，Cloudinary 再 callback 通知後端確認完成。

## 1. 註冊與建立 Product Environment

1. 到 [Cloudinary](https://cloudinary.com/users/register_free) 建立帳號並驗證 email。
2. 登入 Console。免費帳號通常已建立一個 Product Environment；如果介面要求，建立名稱如 `novae-production` 的 environment。
3. 切換到正確 environment 後，再開 **Settings → API Keys**。正式與測試環境不要共用。

## 2. 取得三個相配的值

| Cloudinary 畫面 | GitHub secret |
| --- | --- |
| Cloud name | `CLOUDINARY_CLOUD_NAME` |
| API key | `CLOUDINARY_API_KEY` |
| API secret（按眼睛／Reveal） | `CLOUDINARY_API_SECRET` |

三項必須來自同一個 Product Environment。不要複製整段 `CLOUDINARY_URL`，也不要把 URL 內的符號誤當成 secret。官方參考：[Find Cloudinary credentials](https://cloudinary.com/documentation/developer_onboarding_faq_find_credentials)。

## 3. CLOUDINARY_WEBHOOK_SECRET 要填什麼

目前 Novae 驗證 `X-Cld-Signature` 的 legacy HMAC-SHA1，Cloudinary 的標準簽章使用該 Product Environment 的 API secret。因此：

```text
CLOUDINARY_WEBHOOK_SECRET = CLOUDINARY_API_SECRET
```

不要另外產生隨機值，否則每次 callback 都會得到 `401 Invalid signature`。只有 Cloudinary Enterprise 另行配置專用 webhook signing key 且程式同步支援時，才會不同。官方參考：[Cloudinary webhook signature verification](https://cloudinary.com/documentation/notifications#verifying_notification_signatures)。

## 4. 不要另外建立全域 webhook trigger

Novae 的每次 upload request 已自動帶入：

```text
https://<SUPABASE_PROJECT_REF>.supabase.co/functions/v1/cloudinaryWebhook
```

Cloudinary 支援每次操作的 `notification_url`，所以你不需要在 Console 建立全域 upload trigger。全域 trigger 可能讓同一事件送達兩次。先完成 backend 部署，endpoint 才會存在。官方參考：[Per-operation notification URL](https://cloudinary.com/documentation/notifications#notification_urls_for_specific_api_calls)。

## 5. 安全與重設

- API secret 絕不放入 `.env` 的 `VITE_*`、前端程式或公開文件。
- 若 secret 外洩，在 API Keys 頁建立／切換新 key，更新 GitHub secrets 並重新部署 backend；確認新版本正常後撤銷舊 key。
- 刪除 Cloudinary assets 會讓既有提案圖片永久失效；不要用 reset workflow 排除一般上傳問題。

## 完成檢查

- 四個 Cloudinary secrets 已建立，其中兩個 secret 值相同是刻意的。
- cloud name、key、secret 來自同一 environment。
- 沒有建立額外全域 webhook trigger。

下一步：[設定 Notion](notion.md)。
