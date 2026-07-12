# Upstash：建立限流資料庫

[English](../en/deployment/upstash.md) · [回到部署總覽](../deployment-guide.md)

Novae 用 Upstash Redis 記錄短時間操作次數，避免登入同步、發文、留言、圖片與敏感操作被濫用。它不保存提案正文。

## 1. 註冊與建立 Redis database

1. 到 [Upstash Console](https://console.upstash.com/) 使用 GitHub 或 Google 註冊。
2. 選 **Redis → Create database**。
3. Name 填 `novae-production`。
4. 選離 Supabase project 較近的 primary region；不確定時選相同大區域。
5. 初次校園部署可選 free plan。不要啟用會在容量不足時無聲移除限流鍵的 eviction，除非你理解影響。
6. 按 **Create**。

官方參考：[Create an Upstash Redis database](https://upstash.com/docs/redis/overall/getstarted)。

## 2. 複製 REST URL 與 Standard token

開啟 database 的 **Details / REST API** 區塊：

| Upstash 畫面 | GitHub secret |
| --- | --- |
| HTTPS / `UPSTASH_REDIS_REST_URL` | `UPSTASH_REDIS_REST_URL` |
| Token / `UPSTASH_REDIS_REST_TOKEN` | `UPSTASH_REDIS_REST_TOKEN` |

Novae 需要寫入與遞增計數，所以必須使用 **Standard** token，不可使用 Read-only token。URL 應是 `https://...upstash.io`，不是 `redis://` TCP endpoint。官方參考：[Upstash REST API credentials](https://upstash.com/docs/redis/features/restapi#get-started)。

## 3. production 與 development 分開

如果兩個環境共用 Redis，測試操作會消耗正式使用者的限流額度，而且相同 UID/action 的計數可能互相影響。建立第二個 `novae-development` database，分別填入 GitHub `development` Environment。

## 4. 安全與重設

Standard token 可寫入資料，不可放入任何 `VITE_*` 或前端。若外洩，在 Upstash reset database password/token，更新 GitHub secret 並重跑 backend deployment。重設只會清除／失效限流狀態，不應拿來調高產品允許次數；要調整政策請修改 `config/rate-limits.config.json`。

## 完成檢查

- URL 與 token 來自同一個 database。
- 使用 HTTPS REST URL 與 Standard token。
- development 不會共用 production database。

下一步：[連結 Vercel、填 GitHub secrets 並部署](vercel-github.md)。
