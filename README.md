# Novae

[繁體中文](#繁體中文) · [English](#english)

## 繁體中文

Novae 是一套供校內社群提出、審核、附議與追蹤公共議題的開源 PWA，也支援私密權益案件、公告、留言、站內通知、Web Push、圖片與管理 Dashboard。

### 主要特色

- 限定校內 Google 帳號的 Firebase Authentication。
- 可設定公開、審核後公開或僅作者／管理員可見的提案分類。
- 可按分類設定匿名顯示、附議門檻、附議期限與回覆期限。
- Neon PostgreSQL 與最低權限資料庫角色；瀏覽器不直接接觸資料庫。
- Cloudflare Workers API、Hyperdrive、Queues、Durable Objects 即時推送與維護排程。
- Cloudinary 簽名圖片流程與選用的 Notion 營運副本。
- 由 GitHub Actions 控制的前端／後端部署與完整自動驗證。

### 從部署開始

正式上線不需要先執行本機開發環境。請先按[部署準備與服務設定](https://tavricccc.github.io/novae-website/docs/quick-start.html)建立服務，再填入 GitHub `production` Environment secrets；GitHub Actions 會先套用 Neon migrations 並部署 Cloudflare Workers API，再發布 Vercel 前端。由 `ADMIN_EMAILS` 指定的管理員在程式內完成首次分類設定。本機指令只保留在[貢獻指南](CONTRIBUTING.md)供開發與除錯使用。

### 文件與社群

- [Novae 官方網站](https://tavricccc.github.io/novae-website/)
- [完整文件索引](https://tavricccc.github.io/novae-website/docs/)
- [產品規則設定](https://tavricccc.github.io/novae-website/docs/configuration.html)與[環境憑證參考](https://tavricccc.github.io/novae-website/docs/environment-configuration.html)
- [系統架構](https://tavricccc.github.io/novae-website/docs/architecture.html)
- [安全政策](SECURITY.md)
- [貢獻指南](CONTRIBUTING.md)
- [社群行為準則](CODE_OF_CONDUCT.md)

## English

Novae is an open-source PWA for school communities to submit, review, support, and track public issues. It also supports private rights cases, announcements, discussions, in-app notifications, Web Push, images, and an operations dashboard.

### Highlights

- Firebase Google Authentication restricted to a school domain.
- Configurable school-wide, reviewed, or author-and-admin-only categories.
- Per-category author display, support thresholds, support windows, and response deadlines.
- Neon PostgreSQL with a least-privilege runtime role; browsers never connect to the database.
- A Cloudflare Workers API with Hyperdrive, Queues, Durable Objects realtime delivery, and scheduled maintenance.
- Signed Cloudinary media and an optional Notion operational copy.
- GitHub Actions-controlled frontend/backend delivery with full automated verification.

### Start with deployment

A production release does not require a local development setup. First use [preparation and service setup](https://tavricccc.github.io/novae-website/docs/en/quick-start.html) to create the services and add the GitHub `production` Environment secrets. GitHub Actions applies Neon migrations and deploys the Cloudflare Workers API before publishing the Vercel frontend. An administrator listed in `ADMIN_EMAILS` then completes initial category setup in the app. Local commands live only in the [contributing guide](CONTRIBUTING.md) for development and troubleshooting.

### Documentation and community

- [Novae official website](https://tavricccc.github.io/novae-website/)
- [Documentation index](https://tavricccc.github.io/novae-website/docs/en/)
- [Product rules](https://tavricccc.github.io/novae-website/docs/en/configuration.html) and [environment credentials](https://tavricccc.github.io/novae-website/docs/en/environment-configuration.html)
- [Architecture](https://tavricccc.github.io/novae-website/docs/en/architecture.html)
- [Security policy](SECURITY.md#english)
- [Contributing](CONTRIBUTING.md#english)
- [Code of conduct](CODE_OF_CONDUCT.md#english)

## License

Released under the [MIT License](LICENSE).
