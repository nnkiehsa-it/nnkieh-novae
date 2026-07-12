# 成本指南

[English](en/costs.md) · [文件首頁](README.md)

> 本頁免費額度更新至 2026-07-12。以下以單一學校的常態使用量估算。

## 先說結論

以每月約 1,000 名活躍使用者、每日約 300 人登入的校內平台來看，Novae 的主要服務目前都能落在免費額度內，**每月雲端服務成本可維持 NT$0**。

這個結論包含前端、資料庫、登入、推播、圖片、限流與 Notion 同步。自訂網域的購買費用不包含在內。

## 試算情境

以下不是系統限制，而是一所學校可直接拿來對照的月用量：

| 項目 | 每月估算 |
| --- | ---: |
| 月活躍使用者 | 1,000 人 |
| 每日活躍使用者 | 約 300 人 |
| 新提案 | 300 件 |
| 留言 | 3,000 則 |
| 附議操作 | 12,000 次 |
| 圖片上傳 | 500 張，每張壓縮後約 300 KB |
| 圖片瀏覽流量 | 約 5 GB |
| Web Push | 30,000 則 |
| 後端請求 | 約 180,000 次 |
| Realtime 訊息 | 約 300,000 則，尖峰 50 個連線 |
| 限流檢查 | 約 250,000 次 Redis 指令 |
| Notion 同步 | 約 8,000 次請求 |

## 免費額度實際占用

| 服務 | 目前免費額度 | 上述情境估算 | 結果 |
| --- | ---: | ---: | --- |
| Vercel | 100 GB Fast Data Transfer／月 | 約 8 GB | 約 8%，可免費 |
| Supabase database | 500 MB／project | 約 120 MB | 約 24%，可免費 |
| Supabase egress | 5 GB／月 | 約 1.5 GB | 約 30%，可免費 |
| Supabase Edge Functions | 500,000 次／月 | 約 180,000 次 | 約 36%，可免費 |
| Supabase Realtime | 2,000,000 則／月、尖峰 200 連線 | 約 300,000 則、尖峰 50 連線 | 約 15%／25%，可免費 |
| Firebase Authentication | Spark 方案 50,000 MAU | 約 1,000 MAU | 約 2%，可免費 |
| Firebase Cloud Messaging | 免費 | 約 30,000 則 | 免費 |
| Cloudinary | 每月 25 credits | 約 7.2 credits | 約 29%，可免費 |
| Upstash Redis | 500,000 commands／月、256 MB | 約 250,000 commands、遠低於 1 MB | 約 50%，可免費 |
| Notion | 單一成員 Free workspace 可使用無限 pages／blocks | 約 8,000 次同步請求 | 可免費 |

Cloudinary 的 credit 是合併計算：1 GB 儲存、1 GB 圖片流量或 1,000 次 transformation 各消耗 1 credit。這份試算以約 0.15 GB 新增儲存、5 GB 圖片流量及約 2,000 次 transformation 計算，共約 7.2 credits。圖片會持續累積，因此長期使用時要把既有圖片儲存量一起算進去。

Notion API 沒有按次收費；目前平均速率限制為每秒 3 次。Novae 透過非同步工作處理同步，一個月 8,000 次的總量不會形成成本。

## 什麼情況可能開始付費

依上面的用量，最先需要注意的是下列三項：

1. **Upstash 超過每月 500,000 commands**：大量登入、發文、留言與附議都會觸發限流檢查。以這份試算約 250,000 次來看，約還有一倍空間。
2. **Cloudinary 超過每月 25 credits**：最容易受大量圖片瀏覽影響。若每月圖片流量接近 20 GB，再加上儲存與轉換，就應開始觀察用量。
3. **Supabase database 接近 500 MB**：純文字提案與留言成長較慢；圖片不存進 database，因此通常可使用很長一段時間。Dashboard 顯示接近 400 MB 時再規劃清理或升級即可。

Vercel 的前端是靜態網站，通常不會先成為成本瓶頸。Hobby 方案本身為免費方案，若部署用途不符合其使用範圍，可改用符合組織需求的方案；這不影響其他服務的免費額度試算。

## 如何代入自己的學校

如果實際人數不同，可以先用以下比例快速換算：

```text
自己的估算 = 表格中的用量 ×（自己的月活躍使用者 ÷ 1,000）
```

例如每月 2,000 名活躍使用者，且每人的操作頻率相近，可先把後端請求、Realtime、限流指令、推播與圖片流量乘以 2。資料庫與圖片儲存則會隨使用月份持續累積，不應只看單月新增量。

官方額度來源：[Vercel Pricing](https://vercel.com/pricing)、[Supabase Billing](https://supabase.com/docs/guides/platform/billing-on-supabase)、[Firebase Pricing](https://firebase.google.com/pricing)、[Cloudinary Billing](https://cloudinary.com/documentation/billing_and_plans)、[Upstash Redis Pricing](https://upstash.com/pricing/redis)、[Notion Pricing](https://www.notion.com/pricing)、[Notion API Limits](https://developers.notion.com/reference/request-limits)。
