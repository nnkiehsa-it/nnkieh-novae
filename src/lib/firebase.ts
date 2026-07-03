import { FirebaseError, initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getMessaging, isSupported as isMessagingSupported, type Messaging } from 'firebase/messaging';
import {
  getToken,
  initializeAppCheck,
  ReCaptchaEnterpriseProvider,
  type AppCheck,
} from 'firebase/app-check';
import { withRequestTimeout } from '@/lib/request';

const allowedDomain = String(import.meta.env.VITE_ALLOWED_DOMAIN ?? '').trim().toLowerCase();
const firebaseVapidKey = readEnv('VITE_FIREBASE_VAPID_KEY');
const appCheckEnabled = readEnv('VITE_FIREBASE_APP_CHECK_ENABLED') === 'true';

function readEnv(name: string) {
  return String(import.meta.env[name as keyof ImportMetaEnv] ?? '').trim();
}

const firebaseConfig = {
  apiKey: readEnv('VITE_FIREBASE_API_KEY'),
  authDomain: readEnv('VITE_FIREBASE_AUTH_DOMAIN'),
  projectId: readEnv('VITE_FIREBASE_PROJECT_ID'),
  appId: readEnv('VITE_FIREBASE_APP_ID'),
  messagingSenderId: readEnv('VITE_FIREBASE_MESSAGING_SENDER_ID'),
};

const requiredConfig = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_APP_ID',
] as const;

const missingConfig = requiredConfig.filter((key) => !readEnv(key));

const firebaseInitError = missingConfig.length
  ? `Firebase 設定缺少：${missingConfig.join(', ')}。請在本機 .env 或部署環境變數中補齊。`
  : '';

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let appCheck: AppCheck | null = null;
let appCheckInitError = '';

if (!firebaseInitError) {
  app = initializeApp(firebaseConfig);
  const appCheckSiteKey = readEnv('VITE_RECAPTCHA_ENTERPRISE_SITE_KEY');
  if (appCheckEnabled && appCheckSiteKey) {
    try {
      appCheck = initializeAppCheck(app, {
        provider: new ReCaptchaEnterpriseProvider(appCheckSiteKey),
        isTokenAutoRefreshEnabled: true,
      });
    } catch (error) {
      appCheckInitError = error instanceof Error ? error.message : 'App Check 初始化失敗。';
    }
  }
  auth = getAuth(app);
}

export const messagingPromise: Promise<Messaging | null> = !firebaseInitError && firebaseVapidKey
  ? isMessagingSupported()
    .then((supported) => (supported && app ? getMessaging(app) : null))
    .catch(() => null)
  : Promise.resolve(null);

export { allowedDomain, auth, firebaseVapidKey };
