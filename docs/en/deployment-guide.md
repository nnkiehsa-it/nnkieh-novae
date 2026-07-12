# Deploy Novae from scratch

[繁體中文](../deployment-guide.md) · [Documentation home](../README.md)

This guide assumes no prior GitHub or cloud-platform experience. When complete, `main` deploys the production app: Vercel serves the frontend, Supabase stores data and runs backend functions, Firebase handles Google sign-in and Push, Cloudinary processes images, Notion holds an operational copy, and Upstash enforces rate limits.

## Understand the three locations first

| Location | Purpose | Browser-visible? |
| --- | --- | --- |
| Local `.env` | `VITE_*` values for local frontend testing | Yes |
| GitHub Environment secrets | All values consumed by deployment workflows | Only bundled `VITE_*` values |
| Supabase Edge secrets | Backend runtime secrets, written automatically by the workflow | No |

Never commit real values to `.env.example`, an issue, chat, or screenshot. Although `VITE_*` values are public at runtime, this repository's workflows still read them from GitHub **Environment secrets**, not Environment variables.

## Follow these lessons in order

1. [GitHub account, fork, Actions, and Environments](deployment/github.md)
2. [Firebase web app, sign-in, Push, service account, and App Check](deployment/firebase.md)
3. [Supabase database, browser/backend keys, and CLI credentials](deployment/supabase.md)
4. [Cloudinary credentials and callback signatures](deployment/cloudinary.md)
5. [Notion operational database and integration](deployment/notion.md)
6. [Upstash rate-limit database and REST token](deployment/upstash.md)
7. [Vercel, GitHub secrets, first deployment, and acceptance test](deployment/vercel-github.md)

Store values temporarily in a local password manager while setting up. Do not use an online spreadsheet for private keys.

## Production and development

| Git branch | GitHub Environment | Vercel target | Purpose |
| --- | --- | --- | --- |
| `main` | `production` | Production | School-wide live system |
| `dev` | `development` | Preview | Testing changes |

For a first release, create only `production`. Add `development` later with separate Firebase, Supabase, Cloudinary, Notion, Upstash, and Vercel resources so test data and limits never mix with production.

## Complete secret inventory

### Frontend and Vercel

| Secret | Source |
| --- | --- |
| `VITE_SCHOOL_NAME` | Your display name, such as `Example High School` |
| `VITE_ALLOWED_DOMAIN` | Text after `@` in eligible school emails |
| `VITE_FIREBASE_API_KEY` | Firebase Web App `apiKey` |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase Web App `authDomain` |
| `VITE_FIREBASE_PROJECT_ID` | Firebase Web App `projectId` |
| `VITE_FIREBASE_APP_ID` | Firebase Web App `appId` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Firebase Web App `messagingSenderId` |
| `VITE_FIREBASE_VAPID_KEY` | FCM Web Push public key |
| `VITE_FIREBASE_APP_CHECK_ENABLED` | Use `false` initially |
| `VITE_RECAPTCHA_ENTERPRISE_SITE_KEY` | Required only after enabling App Check |
| `VITE_SUPABASE_URL` | Supabase Project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key |
| `VERCEL_TOKEN` | Vercel Account Settings → Tokens |
| `VERCEL_ORG_ID` | Vercel Team/Account ID |
| `VERCEL_PROJECT_ID` | Vercel Project Settings → General |

### Backend and deployment

| Secret | Source or value |
| --- | --- |
| `SUPABASE_ACCESS_TOKEN` | Supabase Account → Access Tokens |
| `SUPABASE_PROJECT_REF` | Project Settings → General → Reference ID |
| `SUPABASE_DB_PASSWORD` | Password chosen when creating the project |
| `SUPABASE_SERVICE_ROLE_KEY` | Settings → API Keys → Legacy `service_role` |
| `FIREBASE_PROJECT_ID` | Same as `VITE_FIREBASE_PROJECT_ID` |
| `FIREBASE_WEB_API_KEY` | Same as `VITE_FIREBASE_API_KEY` |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Entire downloaded Firebase service-account JSON, not a path |
| `ALLOWED_DOMAIN` | Exactly the same as `VITE_ALLOWED_DOMAIN` |
| `ADMIN_EMAILS` | Full email addresses separated by ASCII commas |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary Product Environment cloud name |
| `CLOUDINARY_API_KEY` | API key from the same environment |
| `CLOUDINARY_API_SECRET` | API secret from the same environment |
| `CLOUDINARY_WEBHOOK_SECRET` | Same API secret for standard Cloudinary HMAC verification |
| `WEBHOOK_SECRET` | Independently generated random 32-byte value |
| `NOTION_TOKEN` | Notion internal integration secret |
| `NOTION_DATABASE_ID` | Original database shared with the integration |
| `NOTION_VERSION` | Optional; workflow defaults to `2022-06-28` |
| `UPSTASH_REDIS_REST_URL` | Upstash HTTPS REST URL |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Standard REST token |

Do not create a GitHub `SUPABASE_URL` secret: hosted Edge Functions receive it automatically. The workflow maps GitHub's `SUPABASE_SERVICE_ROLE_KEY` to the application's `APP_SUPABASE_SERVICE_ROLE_KEY` Edge secret.

Generate `WEBHOOK_SECRET` in PowerShell:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

## First release order

1. Complete all lessons and populate the `production` Environment.
2. Run **Deploy Supabase Backend** manually for `main`; wait for migrations, functions, healthcheck, and cleanup to pass.
3. Run **Deploy Frontend to Vercel** for `main`.
4. Add the Vercel hostname to Firebase authorized domains and, when enabled, reCAPTCHA/App Check domains.
5. Complete the [acceptance checklist](deployment/vercel-github.md#acceptance-test).

Do not create a global Cloudinary upload trigger. Novae supplies a per-upload `notification_url`; an additional global trigger can duplicate callbacks.

For failures, inspect the first red Actions step and see [troubleshooting](troubleshooting.md). Never use a destructive reset workflow as routine troubleshooting.
