import {
  readSessionStorage,
  removeSessionStorage,
  writeSessionStorage,
} from "@/lib/browser-storage";
import { isMobilePwaRequiredPlatform, isStandaloneMode } from "@/lib/pwa-install";
import { hasShareEntryMarker, looksLikeSharedArrival } from "@/lib/share";

const SHARE_ENTRY_KEY = "novae:share-entry";

let active = false;
let pendingExit: (() => void) | null = null;
const listeners = new Set<() => void>();

function publish() {
  for (const listener of listeners) listener();
}

/**
 * Whether this tab was opened from a link somebody shared.
 *
 * The marker is read at module load, before the session has decided where to
 * send the reader, because signing in rewrites the route and would otherwise
 * take the marker with it. It only means anything on a phone that is not
 * already running the installed app.
 */
function initialise() {
  if (typeof window === "undefined") return;
  const marked = hasShareEntryMarker() || looksLikeSharedArrival();
  if (
    isStandaloneMode()
    || !isMobilePwaRequiredPlatform(
      navigator.userAgent,
      navigator.platform,
      navigator.maxTouchPoints,
    )
  ) return;
  if (marked) writeSessionStorage(SHARE_ENTRY_KEY, "1");
  active = readSessionStorage(SHARE_ENTRY_KEY) === "1";
}

initialise();

export function getShareEntry() {
  return active;
}

export function getPendingShareExit() {
  return pendingExit;
}

export function subscribeShareEntry(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Holds a reader's way out of a shared page until they have said where they
 * want to carry on. Answers whether the exit was taken over.
 */
export function requestShareExit(exit: () => void) {
  if (!active) return false;
  pendingExit = exit;
  publish();
  return true;
}

/** Ends the shared-link visit, optionally letting the held exit happen. */
export function resolveShareExit(proceed: boolean) {
  const exit = pendingExit;
  active = false;
  pendingExit = null;
  removeSessionStorage(SHARE_ENTRY_KEY);
  publish();
  if (proceed) exit?.();
}
