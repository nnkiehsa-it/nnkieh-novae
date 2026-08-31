"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  detectInAppBrowser,
  tryRedirectToExternalBrowser,
  type InAppBrowserName,
} from "@/lib/in-app-browser";
import {
  APP_INSTALL_PROMPT_DISMISSED_KEY,
  REQUEST_APP_INSTALL_PROMPT_EVENT,
  detectIosBrowserGuide,
  isAndroidDevice,
  isIosSafari,
  isMobilePwaRequiredPlatform,
  isStandaloneMode,
  isTouchPrimaryDevice,
  type AppInstallPromptReason,
  type IosBrowserGuide,
} from "@/lib/pwa-install";
import {
  readSessionStorage,
  writeSessionStorage,
} from "@/lib/browser-storage";

export type AppInstallPromptMode =
  | "in-app-browser"
  | "native-install"
  | "ios-install"
  | "ios-open-safari";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform?: string }>;
}

interface AppInstallPromptRequestDetail {
  reason?: AppInstallPromptReason;
}

function hasDismissedPrompt() {
  return readSessionStorage(APP_INSTALL_PROMPT_DISMISSED_KEY) === "1";
}

function rememberDismissedPrompt() {
  writeSessionStorage(APP_INSTALL_PROMPT_DISMISSED_KEY, "1");
}

export function useAppInstallPrompt() {
  const [hydrated, setHydrated] = useState(false);
  const [browserName, setBrowserName] = useState<InAppBrowserName | null>(null);
  const [iosBrowserGuide, setIosBrowserGuide] = useState<IosBrowserGuide | null>(null);
  const [isAndroid, setIsAndroid] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(true);
  const [isPrompting, setIsPrompting] = useState(false);
  const [reason, setReason] = useState<AppInstallPromptReason>("default");

  const handleBeforeInstallPrompt = useCallback((event: Event) => {
    if (isStandaloneMode()) return;
    event.preventDefault();
    setDeferredPrompt(event as BeforeInstallPromptEvent);
  }, []);

  const handleAppInstalled = useCallback(() => {
    setDeferredPrompt(null);
    setDismissed(true);
    rememberDismissedPrompt();
  }, []);

  const handleInstallPromptRequest = useCallback((event: Event) => {
    if (!isMobilePwaRequiredPlatform(
      navigator.userAgent,
      navigator.platform,
      navigator.maxTouchPoints,
    )) return;
    const requestedReason = (event as CustomEvent<AppInstallPromptRequestDetail>).detail?.reason;
    setReason(requestedReason === "notifications" ? "notifications" : "default");
    setDismissed(false);
  }, []);

  useEffect(() => {
    const userAgent = navigator.userAgent;
    setBrowserName(detectInAppBrowser(userAgent));
    setIosBrowserGuide(
      detectIosBrowserGuide(userAgent, navigator.platform, navigator.maxTouchPoints),
    );
    setIsAndroid(isAndroidDevice(userAgent));
    setDismissed(hasDismissedPrompt());
    setHydrated(true);
  }, []);

  useEffect(() => {
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);
    window.addEventListener(REQUEST_APP_INSTALL_PROMPT_EVENT, handleInstallPromptRequest);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
      window.removeEventListener(REQUEST_APP_INSTALL_PROMPT_EVENT, handleInstallPromptRequest);
    };
  }, [handleAppInstalled, handleBeforeInstallPrompt, handleInstallPromptRequest]);

  const mode = useMemo<AppInstallPromptMode | null>(() => {
    if (
      !hydrated
      || (dismissed && reason === "default")
      || isStandaloneMode()
      || !isMobilePwaRequiredPlatform(navigator.userAgent, navigator.platform, navigator.maxTouchPoints)
    ) return null;
    if (iosBrowserGuide) return "ios-open-safari";
    if (browserName) return "in-app-browser";
    if (isAndroid || (deferredPrompt && isTouchPrimaryDevice())) return "native-install";
    if (isIosSafari(navigator.userAgent, navigator.platform, navigator.maxTouchPoints)) {
      return "ios-install";
    }
    return null;
  }, [browserName, deferredPrompt, dismissed, hydrated, iosBrowserGuide, isAndroid, reason]);

  const dismiss = useCallback(() => {
    setDismissed(true);
    setReason("default");
    rememberDismissedPrompt();
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt || isPrompting) return;
    setDeferredPrompt(null);
    setIsPrompting(true);
    try {
      await deferredPrompt.prompt();
      await deferredPrompt.userChoice.catch(() => null);
    } finally {
      setIsPrompting(false);
      dismiss();
    }
  }, [deferredPrompt, dismiss, isPrompting]);

  const copyInstallUrl = useCallback(async () => {
    if (isPrompting) return;
    setIsPrompting(true);
    try {
      await navigator.clipboard?.writeText(window.location.href);
    } finally {
      setIsPrompting(false);
    }
  }, [isPrompting]);

  const openExternalBrowser = useCallback(() => {
    return tryRedirectToExternalBrowser(navigator.userAgent);
  }, []);

  return {
    browserName,
    canInstallNatively: deferredPrompt !== null,
    copyInstallUrl,
    dismiss,
    iosBrowserGuide,
    isAndroid,
    isPrompting,
    mode,
    open: mode !== null,
    openExternalBrowser,
    promptInstall,
    reason,
  };
}
