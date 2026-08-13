import { app } from "@/lib/firebase";

let initialization: Promise<void> | null = null;

export function ensureFirebaseAppCheck() {
  if (initialization) return initialization;
  initialization = (async () => {
    const isAppCheckEnabled =
      String(
        process.env.NEXT_PUBLIC_FIREBASE_APP_CHECK_ENABLED ?? "",
      ).trim() === "true";
    if (!app || !isAppCheckEnabled) return;
    const siteKey = String(
      process.env.NEXT_PUBLIC_RECAPTCHA_ENTERPRISE_SITE_KEY ?? "",
    ).trim();
    if (!siteKey) return;
    const { initializeAppCheck, ReCaptchaEnterpriseProvider } = await import(
      "firebase/app-check"
    );
    initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(siteKey),
      isTokenAutoRefreshEnabled: true,
    });
  })();
  return initialization;
}
