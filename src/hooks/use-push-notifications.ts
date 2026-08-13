"use client";

import * as React from "react";
import { firebaseVapidKey } from "@/lib/firebase";
import { loadFirebaseMessaging } from "@/lib/firebase-messaging";
import { ensureFirebaseAppCheck } from "@/lib/firebase-app-check";
import { shouldInstallPwaBeforePush } from "@/lib/pwa-install";
import { readLocalStorage, writeLocalStorage } from "@/lib/browser-storage";
import {
  getPushNotificationPreference,
  registerPushToken,
  unregisterPushToken,
  updatePushNotificationPreferences,
  type PersonalPushPreferenceKey,
  type PersonalPushPreferences,
  type PushNotificationPermission,
} from "@/services/notifications";
import { useSession } from "@/hooks/use-session";
import { getViewMemory, setViewMemory } from "@/lib/view-memory-cache";

export type {
  PersonalPushPreferenceKey,
  PersonalPushPreferences,
  PushNotificationPermission,
} from "@/services/notifications";

const DEVICE_KEY = "novae:push-device-id";
const defaultPreferences: PersonalPushPreferences = {
  comments: true,
  facilityUpdates: true,
  issueUpdates: true,
};

function getDeviceId() {
  const stored = readLocalStorage(DEVICE_KEY);
  if (stored) return stored;
  const value = crypto.randomUUID();
  writeLocalStorage(DEVICE_KEY, value);
  return value;
}

export function usePushNotifications() {
  const session = useSession();
  const viewMemory = getViewMemory<{
    enabled: boolean;
    permission: PushNotificationPermission;
    preferences: PersonalPushPreferences;
    supported: boolean;
  }>(session.user?.uid, "push-settings");
  const [enabled, setEnabled] = React.useState(viewMemory?.enabled ?? false);
  const [supported, setSupported] = React.useState(viewMemory?.supported ?? false);
  const [permission, setPermission] =
    React.useState<PushNotificationPermission>(viewMemory?.permission ?? "default");
  const [preferences, setPreferences] =
    React.useState<PersonalPushPreferences>(viewMemory?.preferences ?? defaultPreferences);
  const [loading, setLoading] = React.useState(!viewMemory);
  const [error, setError] = React.useState("");
  const tokenRef = React.useRef("");
  const deviceIdRef = React.useRef("");

  React.useEffect(() => {
    deviceIdRef.current = getDeviceId();
  }, []);

  const refresh = React.useCallback(async () => {
    if (!session.user || !deviceIdRef.current) return;
    setLoading(true);
    setError("");
    try {
      const canPush = Boolean(
        firebaseVapidKey &&
          "Notification" in window &&
          "serviceWorker" in navigator,
      );
      setSupported(canPush);
      const currentPermission: PushNotificationPermission = canPush
        ? Notification.permission
        : "unsupported";
      setPermission(currentPermission);
      const result = await getPushNotificationPreference({
        deviceId: deviceIdRef.current,
        permission: currentPermission,
      });
      setEnabled(result.deviceEnabled && currentPermission === "granted");
      setPreferences(result.personalPreferences);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "notification.pushSetupFailed",
      );
    } finally {
      setLoading(false);
    }
  }, [session.user]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  React.useEffect(() => {
    if (loading) return;
    setViewMemory(
      session.user?.uid,
      "push-settings",
      { enabled, permission, preferences, supported },
      ["push-notification-preference|"],
    );
  }, [enabled, loading, permission, preferences, session.user?.uid, supported]);

  async function messagingBundle() {
    if (!firebaseVapidKey) return null;
    await ensureFirebaseAppCheck();
    return await loadFirebaseMessaging();
  }

  async function enable() {
    if (!session.user) return false;
    if (
      shouldInstallPwaBeforePush(
        navigator.userAgent,
        navigator.platform,
        navigator.maxTouchPoints,
      )
    ) {
      setError("app.install.enableNotificationsAfterInstall");
      return false;
    }
    setLoading(true);
    setError("");
    try {
      const bundle = await messagingBundle();
      if (!bundle) throw new Error("notification.pushUnavailable");
      const nextPermission = await Notification.requestPermission();
      setPermission(nextPermission);
      if (nextPermission !== "granted") return false;
      const registration = await navigator.serviceWorker.ready;
      const token = await bundle.sdk.getToken(bundle.messaging, {
        serviceWorkerRegistration: registration,
        vapidKey: firebaseVapidKey,
      });
      if (!token) throw new Error("notification.pushTokenUnavailable");
      tokenRef.current = token;
      const result = await registerPushToken({
        deviceId: deviceIdRef.current,
        permission: "granted",
        platform: navigator.platform,
        token,
        userAgent: navigator.userAgent,
      });
      setEnabled(result.deviceEnabled);
      setPreferences(result.personalPreferences);
      return true;
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "notification.pushSetupFailed",
      );
      return false;
    } finally {
      setLoading(false);
    }
  }

  async function disable() {
    setLoading(true);
    setError("");
    try {
      const bundle = await messagingBundle();
      if (bundle && permission === "granted") {
        tokenRef.current ||= await bundle.sdk.getToken(bundle.messaging, {
          serviceWorkerRegistration: await navigator.serviceWorker.ready,
          vapidKey: firebaseVapidKey,
        });
        await bundle.sdk.deleteToken(bundle.messaging).catch(() => undefined);
      }
      const result = await unregisterPushToken({
        deviceId: deviceIdRef.current,
        permission,
        token: tokenRef.current || undefined,
      });
      tokenRef.current = "";
      setEnabled(false);
      setPreferences(result.personalPreferences);
      return true;
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "notification.pushSetupFailed",
      );
      return false;
    } finally {
      setLoading(false);
    }
  }

  async function setPreference(key: PersonalPushPreferenceKey, value: boolean) {
    const previous = preferences;
    setPreferences((current) => ({ ...current, [key]: value }));
    setLoading(true);
    setError("");
    try {
      const result = await updatePushNotificationPreferences({
        deviceId: deviceIdRef.current,
        permission,
        preferences: { [key]: value },
        token: tokenRef.current || undefined,
      });
      setPreferences(result.personalPreferences);
      return true;
    } catch (caught) {
      setPreferences(previous);
      setError(
        caught instanceof Error
          ? caught.message
          : "notification.preferencesSaveFailed",
      );
      return false;
    } finally {
      setLoading(false);
    }
  }

  return {
    disable,
    enable,
    enabled,
    error,
    loading,
    permission,
    preferences,
    refresh,
    setPreference,
    supported,
  };
}
