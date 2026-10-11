# 依賴維護

`package.json` 使用相容版本範圍，`bun.lock` 記錄實際驗證過的安裝版本。CI 與部署使用 `bun install --frozen-lockfile`，更新範圍放寬後，部署仍會安裝已提交的版本。

## 日常更新

```bash
bun run deps:status
bun run deps:update
bun run generate:all
bun run verify:all
```

`deps:update` 使用 Bun 原生更新指令，限制在 manifest 的版本範圍內。一般套件使用 `^`，允許同一主版本的更新；部分 `0.x` 套件使用 `~`，避免跨次版本。需要跨主版本時，先讀上游 migration guide，再更新 manifest。`generate:all` 同步 Framework7 等依賴產生的樣式與資產，避免 generated drift；檢查 diff 後一起提交 manifest、lockfile 與有變化的 generated artifacts。

`bunfig.toml` 延續 hoisted 安裝，允許使用上游帶入的間接依賴。新解析版本至少發布三天；已提交的 lockfile 不受這個時間限制。若需要立即安裝指定的安全修補，可用 Bun 的 `--minimum-release-age 0` 明確略過等待，再跑驗證。

## 上游依賴

不要把每個間接依賴重新列成直接依賴，也不要維護全域覆寫或本機替換套件來追上游版本。Wrangler 帶入 Miniflare，Framework7 帶入其樣式依賴；沿用上游的配套版本。是否使用預發版以整組上游工具的實際需求為準。

audit 保留原本的高風險檢查。若上游固定的間接依賴仍有 advisory，報告會失敗；這與功能、建置或 E2E 是否通過分開記錄。確認 advisory 的使用條件和實際部署路徑，優先更新擁有該依賴的套件，不為消除警報修改整棵依賴樹。

## 自動更新

`.github/dependabot.yml` 設定每週二台灣時間 09:00 檢查 Bun 套件與 GitHub Actions。一般版本發布七天後才納入更新，安全更新不受這個等待期限制。相容更新分成 framework、Cloudflare 與其餘套件三組；跨主版本的更新各自審查。Node 型別的主版本隨 Node runtime 一起升級。

設定檔必須進入 GitHub 的預設分支，遠端更新工作才會使用。Dependabot 提出 PR 後，檢查變更與驗證結果再合併；設定不包含自動合併。

## 工具版本來源

| 工具 | 修改位置 |
| --- | --- |
| Node | `.node-version`，升主版本時一起調整 `engines.node` 與 `@types/node` |
| Bun | `package.json` 的 `packageManager`；超出支援範圍時一起調整 `engines.bun` |
| Firebase CLI | `scripts/verify-integration.mjs` 的 emulator 啟動指令 |
| Vercel CLI | `.github/workflows/verify-and-deploy.yml` 的 `deploy_frontend.env.VERCEL_CLI_VERSION` |

兩個 workflow 直接讀取 Node 與 Bun 的來源檔案。Next build cache 納入 Node 版本；Firebase emulator cache 納入啟動腳本，不需另外同步 cache key 裡的版本字串。

套件升級至少跑完整 local、backend integration 與 E2E；只修改 workflow 或更新設定時，檢查 YAML、path selection 與既有 tooling policy 即可。遠端 Actions、正式部署和本機驗證的結果分開記錄。
