import { app } from "@/lib/firebase";
import type { AppCheck } from "firebase/app-check";

let initialization: Promise<void> | null = null;
let appCheck: AppCheck | null = null;

export function ensureFirebaseAppCheck() {
  if (initialization) return initialization;
  const attempt = (async () => {
    const isAppCheckEnabled =
      String(
        process.env.NEXT_PUBLIC_FIREBASE_APP_CHECK_ENABLED ?? "",
      ).trim() === "true";
    if (!app || !isAppCheckEnabled) return;
    const siteKey = String(
      process.env.NEXT_PUBLIC_RECAPTCHA_ENTERPRISE_SITE_KEY ?? "",
    ).trim();
    if (!siteKey) throw new Error("app-check-not-configured");
    const { initializeAppCheck, ReCaptchaEnterpriseProvider } = await import(
      "firebase/app-check"
    );
    const globalState = globalThis as typeof globalThis & {
      __novaeFirebaseAppCheck?: AppCheck;
    };
    appCheck = globalState.__novaeFirebaseAppCheck ?? initializeAppCheck(app, {
        provider: new ReCaptchaEnterpriseProvider(siteKey),
        isTokenAutoRefreshEnabled: true,
      });
    globalState.__novaeFirebaseAppCheck = appCheck;
  })();
  initialization = attempt.catch((error: unknown) => {
    initialization = null;
    throw error;
  });
  return initialization;
}

export async function getFirebaseAppCheckToken(forceRefresh = false) {
  await ensureFirebaseAppCheck();
  if (!appCheck) return null;
  const { getToken } = await import("firebase/app-check");
  return (await getToken(appCheck, forceRefresh)).token;
}
