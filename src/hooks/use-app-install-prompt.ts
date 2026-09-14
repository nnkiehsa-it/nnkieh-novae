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
import { useShareEntry } from "@/hooks/use-share-entry";
import { clearShareEntryMarker } from "@/lib/share";

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
  const shareEntry = useShareEntry();

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
    setReason(requestedReason ?? "default");
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
    clearShareEntryMarker();
  }, []);

  // A messaging app's own browser cannot complete a Google sign-in, so the
  // reader is handed to the system browser the moment they land rather than
  // being asked to read an instruction first. Only the apps that offer no way
  // out programmatically fall through to the dialog.
  useEffect(() => {
    if (!hydrated || isStandaloneMode()) return;
    tryRedirectToExternalBrowser(navigator.userAgent);
  }, [hydrated]);

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
    // Someone who followed a shared link came for the page, not for Novae.
    // Getting them out of an in-app browser is still the only way they can
    // sign in and read it; everything about installing waits until they ask
    // for more of the app than the one page they were sent.
    if (browserName) return "in-app-browser";
    if (shareEntry && reason === "default") return null;
    if (iosBrowserGuide) return "ios-open-safari";
    if (isAndroid || (deferredPrompt && isTouchPrimaryDevice())) return "native-install";
    if (isIosSafari(navigator.userAgent, navigator.platform, navigator.maxTouchPoints)) {
      return "ios-install";
    }
    return null;
  }, [
    browserName,
    deferredPrompt,
    dismissed,
    hydrated,
    iosBrowserGuide,
    isAndroid,
    reason,
    shareEntry,
  ]);

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

  return {
    browserName,
    canInstallNatively: deferredPrompt !== null,
    copyInstallUrl,
    dismiss,
    iosBrowserGuide,
    isPrompting,
    mode,
    open: mode !== null,
    promptInstall,
    reason,
  };
}
