"use client";

import * as React from "react";
import { firebaseVapidKey } from "@/lib/firebase";
import {
  requestAppInstallPrompt,
  shouldInstallPwaBeforePush,
} from "@/lib/pwa-install";
import {
  getPlatformAdminNotificationPreferences,
  getPushNotificationPreference,
  updatePlatformAdminNotificationPreferences,
  type PlatformAdminNotificationPreferences,
  type PushNotificationPermission,
} from "@/services/push-notifications";
import {
  confirmCurrentPushToken,
  enableCurrentDevicePushNotifications,
  getPushDeviceId,
} from "@/services/push-token-registration";
import { useSession } from "@/hooks/use-session";
import { getViewMemory, setViewMemory } from "@/lib/view-memory-cache";

export type {
  PlatformAdminNotificationPreferenceKey,
  PlatformAdminNotificationPreferences,
  PushNotificationPermission,
} from "@/services/push-notifications";

export function usePushNotifications() {
  const session = useSession();
  const viewMemory = getViewMemory<{
    enabled: boolean;
    permission: PushNotificationPermission;
    adminPreferences: PlatformAdminNotificationPreferences | null;
    supported: boolean;
  }>(session.user?.uid, "push-settings");
  const [enabled, setEnabled] = React.useState(viewMemory?.enabled ?? false);
  const [supported, setSupported] = React.useState(viewMemory?.supported ?? false);
  const [permission, setPermission] =
    React.useState<PushNotificationPermission>(viewMemory?.permission ?? "default");
  const [adminPreferences, setAdminPreferences] =
    React.useState<PlatformAdminNotificationPreferences | null>(viewMemory?.adminPreferences ?? null);
  const [loading, setLoading] = React.useState(!viewMemory);
  const [error, setError] = React.useState("");
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
          result = confirmed.preference;
        }
      }
      setEnabled(result.deviceEnabled && currentPermission === "granted");
      setAdminPreferences(
        session.isAdmin ? await getPlatformAdminNotificationPreferences() : null,
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "notification.pushSetupFailed",
      );
    } finally {
      setLoading(false);
    }
  }, [session.isAdmin, session.user]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  React.useEffect(() => {
    if (loading) return;
    setViewMemory(
      session.user?.uid,
      "push-settings",
      { adminPreferences, enabled, permission, supported },
      ["push-notification-preference|"],
    );
  }, [adminPreferences, enabled, loading, permission, session.user?.uid, supported]);

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
      const result = await enableCurrentDevicePushNotifications(session.user.uid);
      setPermission(result.permission);
      if (!result.registration) return false;
      setEnabled(result.registration.preference.deviceEnabled);
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

  async function saveAdminPreferences(next: PlatformAdminNotificationPreferences) {
    const result = await updatePlatformAdminNotificationPreferences(next);
    setAdminPreferences(result);
    return result;
  }

  return {
    adminPreferences,
    enable,
    enabled,
    error,
    loading,
    permission,
    refresh,
    saveAdminPreferences,
    supported,
  };
}
