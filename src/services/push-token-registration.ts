import "client-only";

import { ensureFirebaseAppCheck } from "@/lib/firebase-app-check";
import { auth, firebaseVapidKey } from "@/lib/firebase";
import { setPushSession } from "@/lib/push-session";
import { loadFirebaseMessaging } from "@/lib/firebase-messaging";
import {
  readLocalStorage,
  writeLocalStorage,
} from "@/lib/browser-storage";
import {
  registerPushToken,
  unregisterPushToken,
  type PushNotificationPreference,
} from "@/services/push-notifications";
import { getPushTokenConfirmationIntervalMs } from "@/services/runtime-settings";

const DEVICE_KEY = "novae:push-device-id";
const CONFIRMED_AT_KEY = "novae:push-confirmed-at";
const CONFIRMED_TOKEN_KEY = "novae:push-confirmed-token";
const CONFIRMED_UID_KEY = "novae:push-confirmed-uid";
type PushTokenConfirmation = {
  preference: PushNotificationPreference;
  token: string;
} | null;
const pendingConfirmations = new Map<string, Promise<PushTokenConfirmation>>();
let registrationRevision = 0;

export async function revokeCurrentDevicePush() {
  registrationRevision += 1;
  await setPushSession(null).catch(() => undefined);
  const deviceId = readLocalStorage(DEVICE_KEY);
  writeLocalStorage(CONFIRMED_UID_KEY, "");
  writeLocalStorage(CONFIRMED_TOKEN_KEY, "");
  writeLocalStorage(CONFIRMED_AT_KEY, "");
  if (deviceId) await unregisterPushToken(deviceId);
}

export function getPushDeviceId() {
  const stored = readLocalStorage(DEVICE_KEY);
  if (stored) return stored;
  const value = crypto.randomUUID();
  writeLocalStorage(DEVICE_KEY, value);
  return value;
}

function shouldConfirm(uid: string, token: string, force: boolean) {
  if (force) return true;
  if (readLocalStorage(CONFIRMED_UID_KEY) !== uid) return true;
  if (readLocalStorage(CONFIRMED_TOKEN_KEY) !== token) return true;
  const confirmedAt = Number(readLocalStorage(CONFIRMED_AT_KEY));
  return !Number.isFinite(confirmedAt)
    || Date.now() - confirmedAt >= getPushTokenConfirmationIntervalMs();
}

function rememberConfirmation(uid: string, token: string) {
  writeLocalStorage(CONFIRMED_UID_KEY, uid);
  writeLocalStorage(CONFIRMED_TOKEN_KEY, token);
  writeLocalStorage(CONFIRMED_AT_KEY, String(Date.now()));
}

export async function getCurrentPushToken() {
  if (
    !firebaseVapidKey
    || !("Notification" in window)
    || !("serviceWorker" in navigator)
    || Notification.permission !== "granted"
  ) return null;
  await ensureFirebaseAppCheck();
  const bundle = await loadFirebaseMessaging();
  if (!bundle) return null;
  const token = await bundle.sdk.getToken(bundle.messaging, {
    serviceWorkerRegistration: await navigator.serviceWorker.ready,
    vapidKey: firebaseVapidKey,
  });
  return token ? { bundle, token } : null;
}

export function confirmCurrentPushToken(
  uid: string,
  force = false,
): Promise<PushTokenConfirmation> {
  const pending = pendingConfirmations.get(uid);
  if (pending) return pending;

  const revision = registrationRevision;
  const currentSession = () => registrationRevision === revision && auth?.currentUser?.uid === uid;
  const confirmation = (async () => {
    try {
      const current = await getCurrentPushToken();
      if (!current || !currentSession()) return null;
      if (!shouldConfirm(uid, current.token, force)) {
        await setPushSession(uid);
        return null;
      }
      const preference = await registerPushToken({
        deviceId: getPushDeviceId(),
        permission: "granted",
        platform: navigator.platform,
        token: current.token,
        userAgent: navigator.userAgent,
      });
      if (!currentSession()) return null;
      await setPushSession(uid);
      rememberConfirmation(uid, current.token);
      return { preference, token: current.token };
    } finally {
      pendingConfirmations.delete(uid);
    }
  })();
  pendingConfirmations.set(uid, confirmation);
  return confirmation;
}

export async function enableCurrentDevicePushNotifications(uid: string) {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return { permission, registration: null };
  }
  const registration = await confirmCurrentPushToken(uid, true);
  if (!registration) throw new Error("notification.pushTokenUnavailable");
  return { permission, registration };
}
