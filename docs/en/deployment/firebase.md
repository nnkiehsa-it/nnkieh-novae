# Firebase setup

[繁體中文](../../deployment/firebase.md) · [Deployment overview](../deployment-guide.md)

## Project and Web App

1. Sign in to [Firebase Console](https://console.firebase.google.com/), create a project, and optionally disable Analytics because Novae does not require it.
2. From Project overview, register a Web App (`</>`), nickname it `novae-web`, and do not enable Firebase Hosting.
3. Copy the displayed `firebaseConfig` values:

| Config field | GitHub secret |
| --- | --- |
| `apiKey` | `VITE_FIREBASE_API_KEY` and `FIREBASE_WEB_API_KEY` |
| `authDomain` | `VITE_FIREBASE_AUTH_DOMAIN` |
| `projectId` | `VITE_FIREBASE_PROJECT_ID` and `FIREBASE_PROJECT_ID` |
| `appId` | `VITE_FIREBASE_APP_ID` |
| `messagingSenderId` | `VITE_FIREBASE_MESSAGING_SENDER_ID` |

You can reopen them under **Project settings → General → Your apps → SDK setup and configuration → Config**. Web configuration is public by design; server private keys are not. See [Firebase web setup](https://firebase.google.com/docs/web/setup).

## Google sign-in

Go to **Build → Authentication → Get started → Sign-in method → Google**, enable it, select a support email, and save. Under **Authentication → Settings → Authorized domains**, add `localhost`, the deployed Vercel hostname, and custom domains.

An authorized domain is the website hostname. `ALLOWED_DOMAIN` is the email domain eligible to sign in; they are different concepts.

## VAPID key

Open **Project settings → Cloud Messaging → Web configuration → Web Push certificates → Generate key pair**. Copy the public key into `VITE_FIREBASE_VAPID_KEY`. See [FCM Web credentials](https://firebase.google.com/docs/cloud-messaging/web/get-started#configure_web_credentials_with_fcm).

## Service-account JSON

Open **Project settings → Service accounts → Firebase Admin SDK → Generate new private key**. Keep the download outside the repository. Open it as text and paste the entire content from `{` through `}` into `GOOGLE_SERVICE_ACCOUNT_JSON`, not the filename or path. Revoke and replace the key immediately if exposed. See [Admin SDK setup](https://firebase.google.com/docs/admin/setup#initialize_the_sdk_in_non-google_environments).

## App Check

For the first deployment, set `VITE_FIREBASE_APP_CHECK_ENABLED=false` and omit the site-key secret. Later, create a score-based Website key in reCAPTCHA Enterprise, add production hostnames, register that key under Firebase **App Check**, create `VITE_RECAPTCHA_ENTERPRISE_SITE_KEY`, and switch the flag to `true`. Observe metrics before enforcing requests. See [App Check with reCAPTCHA Enterprise](https://firebase.google.com/docs/app-check/web/recaptcha-enterprise-provider).

Next: [Supabase](supabase.md).
