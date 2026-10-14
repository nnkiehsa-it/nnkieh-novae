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
import { useRememberedState } from "@/hooks/use-remembered-state";

export type {
  PlatformAdminNotificationPreferences,
} from "@/services/push-notifications";

export function usePushNotifications() {
  const session = useSession();
  const memory = useRememberedState<{
    enabled: boolean;
    permission: PushNotificationPermission;
    adminPreferences: PlatformAdminNotificationPreferences | null;
    supported: boolean;
  } | null>("push-settings", null);
  const viewMemory = memory.value;
  const rememberSettings = memory.remember;
  const [enabled, setEnabled] = React.useState(viewMemory?.enabled ?? false);
  const [supported, setSupported] = React.useState(viewMemory?.supported ?? false);
  const [permission, setPermission] =
    React.useState<PushNotificationPermission>(viewMemory?.permission ?? "default");
  const [adminPreferences, setAdminPreferences] =
    React.useState<PlatformAdminNotificationPreferences | null>(viewMemory?.adminPreferences ?? null);
  const [loading, setLoading] = React.useState(!viewMemory);
  const readSucceeded = React.useRef(false);
  const [error, setError] = React.useState("");
  const deviceIdRef = React.useRef("");

  React.useEffect(() => {
    deviceIdRef.current = getPushDeviceId();
  }, []);

  const refresh = React.useCallback(async () => {
    if (!session.user || !deviceIdRef.current) return;
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
      let result = await getPushNotificationPreference(deviceIdRef.current, currentPermission);
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
      readSucceeded.current = true;
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
    if (loading || !readSucceeded.current) return;
    rememberSettings({ adminPreferences, enabled, permission, supported });
  }, [adminPreferences, enabled, loading, permission, rememberSettings, supported]);

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
