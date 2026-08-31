"use client";

import * as React from "react";
import { firebaseVapidKey } from "@/lib/firebase";
import {
  requestAppInstallPrompt,
  shouldInstallPwaBeforePush,
} from "@/lib/pwa-install";
import {
  getPushNotificationPreference,
  unregisterPushToken,
  updatePushNotificationPreferences,
  type PersonalPushPreferenceKey,
  type PersonalPushPreferences,
  type PushNotificationPermission,
} from "@/services/notifications";
import {
  confirmCurrentPushToken,
  forgetPushTokenConfirmation,
  getCurrentPushToken,
  getPushDeviceId,
} from "@/services/push-token-registration";
import { useSession } from "@/hooks/use-session";
import { getViewMemory, setViewMemory } from "@/lib/view-memory-cache";

export type {
  PersonalPushPreferenceKey,
  PersonalPushPreferences,
  PushNotificationPermission,
} from "@/services/notifications";

const defaultPreferences: PersonalPushPreferences = {
  comments: true,
  facilityUpdates: true,
  issueUpdates: true,
};

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
    deviceIdRef.current = getPushDeviceId();
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
      let result = await getPushNotificationPreference({
        deviceId: deviceIdRef.current,
        permission: currentPermission,
      });
      if (currentPermission === "granted") {
        const confirmed = await confirmCurrentPushToken(session.user.uid);
        if (confirmed) {
          tokenRef.current = confirmed.token;
          result = confirmed.preference;
        }
      }
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
      requestAppInstallPrompt("notifications");
      return false;
    }
    setLoading(true);
    setError("");
    try {
      const nextPermission = await Notification.requestPermission();
      setPermission(nextPermission);
      if (nextPermission !== "granted") return false;
      const confirmed = await confirmCurrentPushToken(session.user.uid, true);
      if (!confirmed) throw new Error("notification.pushTokenUnavailable");
      tokenRef.current = confirmed.token;
      setEnabled(confirmed.preference.deviceEnabled);
      setPreferences(confirmed.preference.personalPreferences);
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
      const current = await getCurrentPushToken();
      if (current) {
        tokenRef.current ||= current.token;
        await current.bundle.sdk.deleteToken(current.bundle.messaging).catch(() => undefined);
      }
      const result = await unregisterPushToken({
        deviceId: deviceIdRef.current,
        permission,
        token: tokenRef.current || undefined,
      });
      tokenRef.current = "";
      forgetPushTokenConfirmation();
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
