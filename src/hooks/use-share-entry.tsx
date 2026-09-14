"use client";

import { useCallback, useSyncExternalStore } from "react";
import { requestAppInstallPrompt } from "@/lib/pwa-install";
import {
  getShareEntry,
  requestShareExit,
  subscribeShareEntry,
} from "@/hooks/share-entry-store";

/** Whether the reader arrived here from a shared link in a browser tab. */
export function useShareEntry() {
  return useSyncExternalStore(subscribeShareEntry, getShareEntry, () => false);
}

/**
 * Wraps a way out of a shared page.
 *
 * The reader was sent one page and has now asked for the rest of Novae, which
 * is the first moment installing the app is worth their attention — so the
 * navigation waits behind the prompt instead of happening under it.
 */
export function useShareExitGuard() {
  return useCallback((exit: () => void) => {
    if (!requestShareExit(exit)) {
      exit();
      return;
    }
    requestAppInstallPrompt("share-exit");
  }, []);
}
