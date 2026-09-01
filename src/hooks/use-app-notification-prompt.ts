"use client";

import * as React from "react";
import { firebaseVapidKey } from "@/lib/firebase";
import {
  isMobilePwaRequiredPlatform,
  isStandaloneMode,
  shouldOfferPushNotificationPrompt,
} from "@/lib/pwa-install";
import { readSessionStorage, writeSessionStorage } from "@/lib/browser-storage";
import { enableCurrentDevicePushNotifications } from "@/services/push-token-registration";

const DISMISSED_KEY_PREFIX = "novae:notification-prompt-dismissed:";

export type AppNotificationPromptResult = "declined" | "enabled" | "failed";

export function useAppNotificationPrompt(uid: string | undefined) {
  const [hydrated, setHydrated] = React.useState(false);
  const [dismissed, setDismissed] = React.useState(true);
  const [isPrompting, setIsPrompting] = React.useState(false);

  React.useEffect(() => {
    if (!uid) {
      setDismissed(true);
      setHydrated(true);
      return;
    }
    setDismissed(readSessionStorage(`${DISMISSED_KEY_PREFIX}${uid}`) === "1");
    setHydrated(true);
  }, [uid]);

  const dismiss = React.useCallback(() => {
    setDismissed(true);
    if (uid) writeSessionStorage(`${DISMISSED_KEY_PREFIX}${uid}`, "1");
  }, [uid]);

  const open = React.useMemo(() => {
    if (!hydrated || dismissed || !uid) return false;
    const supported = Boolean(
      firebaseVapidKey
        && "Notification" in window
        && "serviceWorker" in navigator,
    );
    return shouldOfferPushNotificationPrompt({
      isMobilePlatform: isMobilePwaRequiredPlatform(
        navigator.userAgent,
        navigator.platform,
        navigator.maxTouchPoints,
      ),
      isStandalone: isStandaloneMode(),
      permission: supported ? Notification.permission : "denied",
      supported,
    });
  }, [dismissed, hydrated, uid]);

  const enable = React.useCallback(async (): Promise<AppNotificationPromptResult> => {
    if (!uid || isPrompting) return "failed";
    setIsPrompting(true);
    try {
      const result = await enableCurrentDevicePushNotifications(uid);
      dismiss();
      return result.registration ? "enabled" : "declined";
    } catch {
      dismiss();
      return "failed";
    } finally {
      setIsPrompting(false);
    }
  }, [dismiss, isPrompting, uid]);

  return { dismiss, enable, isPrompting, open };
}
