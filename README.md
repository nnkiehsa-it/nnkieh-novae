# Novae

[繁體中文](#繁體中文) · [English](#english)

## 繁體中文

Novae 是一套供校內社群提出、審核、附議與追蹤公共議題的開源 PWA，也支援私密權益案件、公告、留言、站內通知、Web Push、圖片與管理 Dashboard。

### 主要特色

- 限定校內 Google 帳號的 Firebase Authentication。
- 可設定公開、審核後公開或僅作者／管理員可見的提案分類。
- 可按分類設定匿名顯示、附議門檻、附議期限與回覆期限。
- Supabase RLS、Edge Functions、outbox、Realtime 與維護排程。
- Cloudinary 簽名圖片流程、選用的 Notion 營運副本與 Upstash 限流。
- 由 GitHub Actions 控制的前端／後端部署與完整自動驗證。

### 從部署開始

正式上線不需要先執行本機開發環境。請先按[部署準備與服務設定](https://tavricccc.github.io/novae-website/docs/quick-start.html)建立七項服務，再填入 GitHub `production` Environment secrets、設定並推送分類檔；所有前置項目完成後，才依[最後發布與驗收](https://tavricccc.github.io/novae-website/docs/deployment-guide.html)發布 Supabase 後端與 Vercel 前端。本機指令只保留在[貢獻指南](CONTRIBUTING.md)供開發與除錯使用。

### 文件與社群

- [Novae 官方網站](https://tavricccc.github.io/novae-website/)
- [完整文件索引](https://tavricccc.github.io/novae-website/docs/)
- [產品規則設定](https://tavricccc.github.io/novae-website/docs/configuration.html)與[環境憑證參考](https://tavricccc.github.io/novae-website/docs/environment-configuration.html)
- [分類設定產生器](https://tavricccc.github.io/novae-website/category-builder.html)
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
- Supabase RLS, Edge Functions, outbox, Realtime, and maintenance schedules.
- Signed Cloudinary media, an optional Notion operational copy, and Upstash rate limiting.
- GitHub Actions-controlled frontend/backend delivery with full automated verification.

### Start with deployment

A production release does not require a local development setup. First use [preparation and service setup](https://tavricccc.github.io/novae-website/docs/en/quick-start.html) to create the seven service setups, then add GitHub `production` Environment secrets and commit and push category policy. Only after those prerequisites are complete should [final release and acceptance](https://tavricccc.github.io/novae-website/docs/en/deployment-guide.html) publish the Supabase backend before the Vercel frontend. Local commands live only in the [contributing guide](CONTRIBUTING.md) for development and troubleshooting.

### Documentation and community

- [Novae official website](https://tavricccc.github.io/novae-website/)
- [Documentation index](https://tavricccc.github.io/novae-website/docs/en/)
- [Product rules](https://tavricccc.github.io/novae-website/docs/en/configuration.html) and [environment credentials](https://tavricccc.github.io/novae-website/docs/en/environment-configuration.html)
- [Category configuration builder](https://tavricccc.github.io/novae-website/category-builder.html)
- [Architecture](https://tavricccc.github.io/novae-website/docs/en/architecture.html)
- [Security policy](SECURITY.md#english)
- [Contributing](CONTRIBUTING.md#english)
- [Code of conduct](CODE_OF_CONDUCT.md#english)

## License

Released under the [MIT License](LICENSE).
