# Firebase：Google 登入、推播與後端憑證

[English](../en/deployment/firebase.md) · [回到部署總覽](../deployment-guide.md)

Novae 使用 Firebase Authentication 登入、Cloud Messaging 推播，並由 Supabase Edge Functions 使用 service account 驗證使用者及傳送通知。

## 1. 註冊與建立 project

1. 使用 Google 帳號登入 [Firebase Console](https://console.firebase.google.com/)。
2. 按 **Create a project**，輸入例如 `novae-你的學校`。Project ID 建立後難以更改，避免放學生姓名。
3. Google Analytics 對 Novae 不是必要；不確定時可關閉。
4. 建立完成後進入 project overview。

## 2. 註冊 Web App 並取得六個值

1. Project overview 按 Web 圖示 `</>`；或 **Project settings → General → Your apps → Add app → Web**。
2. App nickname 輸入 `novae-web`；不需要勾 Firebase Hosting。
3. 按 **Register app**，畫面會顯示 `firebaseConfig`。
4. 逐一複製，不要複製引號或逗號：

| firebaseConfig 欄位 | GitHub secret |
| --- | --- |
| `apiKey` | `VITE_FIREBASE_API_KEY` 與 `FIREBASE_WEB_API_KEY`（同一值） |
| `authDomain` | `VITE_FIREBASE_AUTH_DOMAIN` |
| `projectId` | `VITE_FIREBASE_PROJECT_ID` 與 `FIREBASE_PROJECT_ID`（同一值） |
| `appId` | `VITE_FIREBASE_APP_ID` |
| `messagingSenderId` | `VITE_FIREBASE_MESSAGING_SENDER_ID` |

之後找不到設定時，到 **Project settings → General → Your apps → novae-web → SDK setup and configuration → Config**。Firebase Web config 本來就會出現在瀏覽器；真正的保護來自授權規則與後端驗證，不要把 service-account 私鑰誤放入 `VITE_*`。官方參考：[Add Firebase to a web app](https://firebase.google.com/docs/web/setup)。

## 3. 啟用 Google 登入

1. 左側 **Build → Authentication → Get started**。
2. **Sign-in method → Add new provider → Google**。
3. 開啟 **Enable**，選擇 project support email，按 **Save**。
4. **Authentication → Settings → Authorized domains** 加入：
   - 本機測試用 `localhost`（通常已存在）；
   - 部署後的 `<project>.vercel.app`；
   - 之後使用的自訂網域。

`VITE_ALLOWED_DOMAIN` / `ALLOWED_DOMAIN` 是「允許登入者的 email 網域」，例如 `student.school.edu.tw`；Firebase authorized domain 則是「Novae 網站所在 hostname」，兩者不是同一件事。

## 4. 建立 Web Push VAPID public key

1. **Project settings → Cloud Messaging**。
2. 找到 **Web configuration → Web Push certificates**。
3. 按 **Generate key pair**。
4. 複製顯示的 public key 到 `VITE_FIREBASE_VAPID_KEY`。

這是公開金鑰，不能用 private key 或 Firebase API key 代替。Web Push 正式環境需要 HTTPS，Vercel 會自動提供。官方參考：[FCM Web credentials](https://firebase.google.com/docs/cloud-messaging/web/get-started#configure_web_credentials_with_fcm)。

## 5. 下載 service account JSON

1. **Project settings → Service accounts**。
2. 選 **Firebase Admin SDK**，按 **Generate new private key → Generate key**。
3. 瀏覽器會下載 `.json`。將檔案保存在安全位置，不要移入 repository。
4. 用純文字編輯器開啟，從第一個 `{` 到最後一個 `}` 全選複製。
5. GitHub `production` secret `GOOGLE_SERVICE_ACCOUNT_JSON` 的值貼「完整 JSON 內容」。不要填檔名、Windows 路徑，也不要只貼 `private_key`。

JSON 內換行可直接貼入 GitHub secret。此私鑰可取得高權限；若外洩，到 Google Cloud IAM/Service Accounts 撤銷該 key 並產生新 key。官方參考：[Firebase Admin SDK setup](https://firebase.google.com/docs/admin/setup#initialize_the_sdk_in_non-google_environments)。

## 6. App Check：先關閉，再安全啟用

第一次部署先建立 `VITE_FIREBASE_APP_CHECK_ENABLED=false`，不要建立空白或假的 site key。網站其餘功能可以先完成。

準備啟用時：

1. 在相同 Google Cloud project 開啟 [reCAPTCHA Enterprise](https://console.cloud.google.com/security/recaptcha)。
2. 建立 **Website**、**Score based** key，加入 Vercel 正式 hostname 與自訂網域；複製 site key。
3. Firebase Console → **Build → App Check → Apps**，選 Web App 並註冊 reCAPTCHA Enterprise provider。
4. GitHub 建立 `VITE_RECAPTCHA_ENTERPRISE_SITE_KEY=<site key>`，再把 `VITE_FIREBASE_APP_CHECK_ENABLED` 改成 `true`。
5. 重新部署，先在 App Check metrics 觀察合法流量，再逐項開 enforcement。不要在未驗證前直接阻擋所有請求。

官方參考：[App Check with reCAPTCHA Enterprise](https://firebase.google.com/docs/app-check/web/recaptcha-enterprise-provider)。

## 完成檢查

- 兩組重複值確實相同：API key 與 project ID。
- Google provider 已 Enable，Vercel hostname 部署後會加入 authorized domains。
- VAPID 複製的是 Web Push public key。
- `GOOGLE_SERVICE_ACCOUNT_JSON` 是整份 JSON，未進入 Git。
- 初次部署 App Check 為 `false`。

下一步：[設定 Supabase](supabase.md)。
