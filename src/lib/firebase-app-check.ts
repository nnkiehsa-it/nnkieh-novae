import { app } from '@/lib/firebase';

let initialization: Promise<void> | null = null;

export function ensureFirebaseAppCheck() {
  if (initialization) return initialization;
  initialization = (async () => {
    const isAppCheckEnabled = String(import.meta.env.VITE_FIREBASE_APP_CHECK_ENABLED ?? '').trim() === 'true';
    if (!app || !isAppCheckEnabled) return;
    const siteKey = String(import.meta.env.VITE_RECAPTCHA_ENTERPRISE_SITE_KEY ?? '').trim();
    if (!siteKey) return;
    const { initializeAppCheck, ReCaptchaEnterpriseProvider } = await import('firebase/app-check');
    initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(siteKey),
      isTokenAutoRefreshEnabled: true,
    });
  })();
  return initialization;
}
