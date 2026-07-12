# GitHub：帳號、Fork、Actions 與 Environment

[English](../en/deployment/github.md) · [回到部署總覽](../deployment-guide.md)

## 1. 註冊與驗證 GitHub

1. 開啟 [GitHub 註冊頁](https://github.com/signup)，建立個人帳號並完成 email 驗證。
2. 建議開啟兩步驟驗證：右上角頭像 → **Settings → Password and authentication → Two-factor authentication**。
3. 登入後開啟 [Novae repository](https://github.com/tavricccc/novae)。

## 2. Fork 成自己的 repository

1. 右上角按 **Fork**。
2. Owner 選自己的帳號；Repository name 保留 `novae` 即可。
3. 保留 **Copy the main branch only**；按 **Create fork**。
4. 確認網址已變成 `https://github.com/<你的帳號>/novae`。之後所有 Settings 都必須在自己的 fork 操作。

官方參考：[Fork a repository](https://docs.github.com/en/get-started/quickstart/fork-a-repo)。

## 3. 啟用 Actions

1. 在自己的 fork 點 **Actions**。
2. 若看到 workflows disabled，按 **I understand my workflows, go ahead and enable them**。
3. 到 **Settings → Actions → General**，在 **Actions permissions** 保留允許 GitHub Actions 執行 repository 內的 actions。
4. 不要開啟「把 secrets 傳給外部 fork pull request」之類的選項。

## 4. 建立 production Environment

1. repository → **Settings**。
2. 左側 **Environments** → **New environment**。
3. 名稱輸入小寫 `production`，按 **Configure environment**。
4. 在 **Deployment branches and tags** 可限制只允許 `main`。
5. 若帳號方案支援，可在 **Required reviewers** 加入維護者；之後每次正式部署需人工核准。
6. 在頁面下方 **Environment secrets** 按 **Add environment secret**。不要填到 **Environment variables**。

GitHub Free 的 private repository 可能不能使用 environment secrets；最簡單的教學配置是維持 fork 為 public，或升級支援的方案。官方參考：[Managing environments](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments)。

## 5. development 何時建立

如果你會使用 `dev` branch，重複上面步驟建立名稱完全相同於 workflow 的 `development`。兩個 Environment 中即使 secret 名稱相同，值也應指向各自的測試／正式資源。

## 6. 如何新增一個 secret

1. 進入 **Settings → Environments → production**。
2. **Environment secrets → Add environment secret**。
3. Name 貼上文件中的大寫名稱，例如 `VITE_SCHOOL_NAME`。
4. Secret 貼上值，不要加引號、前後空白或 Markdown code fence。
5. 按 **Add secret**。儲存後 GitHub 不會再顯示原值，這是正常的。

若填錯，點同名 secret 的更新按鈕重新貼值。不要為了檢查而把 secret 印到 Actions log。

## 完成檢查

- 網址是自己的 `<帳號>/novae`，不是上游 repository。
- Actions 已啟用。
- 已有小寫 `production` Environment。
- 你知道所有值都要加入 Environment **secrets**，不是 repository variables。

下一步：[設定 Firebase](firebase.md)。
