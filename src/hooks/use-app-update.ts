"use client";

import * as React from "react";
import { raceWithAbort } from "@/lib/abort-signal";
import { readLocalStorage, removeLocalStorage, writeLocalStorage } from "@/lib/browser-storage";
import { hasUpdateDeferral, useUpdateDeferral } from "@/hooks/use-update-deferral";

const currentVersion = process.env.NEXT_PUBLIC_APP_VERSION || "development";
const AUTO_RELOAD_KEY = "novae:auto-update-reloaded-version";
const AUTO_RELOAD_COUNT_KEY = "novae:auto-update-reloaded-count";
const LAST_VERSION_CHECK_KEY = "novae:last-version-check-at";
const VERSION_CHECK_INTERVAL_MS = 30 * 60_000;
const VERSION_CHECK_TIMEOUT_MS = 2_000;
const SERVICE_WORKER_PREPARE_TIMEOUT_MS = 2_000;
const RELOAD_NAVIGATION_RETRY_MS = 4_000;
const RELOAD_RECOVERY_TIMEOUT_MS = 10_000;
const MAX_AUTO_RELOAD_ATTEMPTS = 2;
const UPDATE_SUCCESS_HOLD_MS = 500;

function readReloadCount(version: string) {
  try {
    if (sessionStorage.getItem(AUTO_RELOAD_KEY) !== version) return 0;
    const count = Number.parseInt(sessionStorage.getItem(AUTO_RELOAD_COUNT_KEY) || "0", 10);
    return Number.isFinite(count) && count > 0 ? count : 0;
  } catch {
    return 0;
  }
}

function markAutoReload(version: string) {
  try {
    const count = readReloadCount(version);
    sessionStorage.setItem(AUTO_RELOAD_KEY, version);
    sessionStorage.setItem(AUTO_RELOAD_COUNT_KEY, String(count + 1));
  } catch {
    // Storage is optional; the navigation remains the source of truth.
  }
}

/** Fetches the deployed version, at most once per interval across every tab. */
async function fetchNewerVersion(lastCheckedAt: React.RefObject<number>): Promise<string | null> {
  const now = Date.now();
  const stored = Number.parseInt(readLocalStorage(LAST_VERSION_CHECK_KEY) ?? "0", 10);
  if (now - Math.max(lastCheckedAt.current, Number.isFinite(stored) ? stored : 0) < VERSION_CHECK_INTERVAL_MS) return null;
  lastCheckedAt.current = now;
  // The shared timestamp doubles as a cross-tab lease. It is kept only after a
  // successful check, so an offline failure does not suppress the next retry.
  writeLocalStorage(LAST_VERSION_CHECK_KEY, String(now));
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), VERSION_CHECK_TIMEOUT_MS);
  let completed = false;
  try {
    const response = await fetch("/version.json", { cache: "no-store", signal: controller.signal });
    if (!response.ok) return null;
    const data = (await response.json()) as { version?: string };
    completed = true;
    return data.version && data.version !== currentVersion ? data.version : null;
  } catch {
    // Version checks are opportunistic and must never block the app.
    return null;
  } finally {
    window.clearTimeout(timeout);
    if (!completed) {
      if (readLocalStorage(LAST_VERSION_CHECK_KEY) === String(now)) removeLocalStorage(LAST_VERSION_CHECK_KEY);
      if (lastCheckedAt.current === now) lastCheckedAt.current = 0;
    }
  }
}

/** Lets a waiting service worker take over before the page reloads into it. */
async function prepareServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), SERVICE_WORKER_PREPARE_TIMEOUT_MS);
  const timeoutError = () => new Error("service worker update timed out");
  try {
    const registration = await raceWithAbort(
      controller.signal,
      () => navigator.serviceWorker.register("/sw.js", { scope: "/", type: "module", updateViaCache: "none" }),
      timeoutError,
    );
    await raceWithAbort(controller.signal, () => registration.update(), timeoutError);
    const candidate = registration.waiting ?? registration.installing;
    if (!candidate || controller.signal.aborted) return;
    await new Promise<void>((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        candidate.removeEventListener("statechange", handleStateChange);
        navigator.serviceWorker.removeEventListener("controllerchange", finish);
        resolve();
      };
      const handleStateChange = () => {
        if (candidate.state === "activated" || candidate.state === "redundant") finish();
      };
      candidate.addEventListener("statechange", handleStateChange);
      navigator.serviceWorker.addEventListener("controllerchange", finish, { once: true });
      controller.signal.addEventListener("abort", finish, { once: true });
      registration.waiting?.postMessage({ type: "SKIP_WAITING" });
      handleStateChange();
    });
  } catch {
    // A failed service worker update must not prevent the document refreshing.
  } finally {
    window.clearTimeout(timeout);
  }
}

type AppUpdatePhase = "idle" | "prompt" | "reloading" | "reloaded";

/**
 * Watches for a newer deployment. The first time a version is seen the app
 * reloads into it on its own (twice at most, in case the first try is served
 * stale); after that, or while `held` (a security check is on screen), it asks.
 * Unsaved work, open sheets and being offline all defer the switch.
 */
export function useAppUpdate(held: boolean) {
  const [availableVersion, setAvailableVersion] = React.useState("");
  const [phase, setPhase] = React.useState<AppUpdatePhase>("idle");
  const deferred = useUpdateDeferral();
  const lastCheckedAt = React.useRef(0);
  const checking = React.useRef(false);
  const reloadInFlight = React.useRef(false);

  const check = React.useCallback(async () => {
    if (checking.current) return;
    checking.current = true;
    try {
      const version = await fetchNewerVersion(lastCheckedAt);
      if (version) setAvailableVersion(version);
    } finally {
      checking.current = false;
    }
  }, []);

  React.useEffect(() => {
    void check();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void check();
    }, VERSION_CHECK_INTERVAL_MS);
    const online = () => void check();
    const resume = () => {
      if (Date.now() - lastCheckedAt.current >= VERSION_CHECK_INTERVAL_MS) void check();
    };
    window.addEventListener("online", online);
    window.addEventListener("pageshow", resume);
    document.addEventListener("visibilitychange", resume);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("online", online);
      window.removeEventListener("pageshow", resume);
      document.removeEventListener("visibilitychange", resume);
    };
  }, [check]);

  const reload = React.useCallback(async (automaticVersion?: string) => {
    if (reloadInFlight.current) return;
    reloadInFlight.current = true;
    setPhase("reloading");
    await prepareServiceWorker();
    if (automaticVersion && hasUpdateDeferral()) {
      reloadInFlight.current = false;
      setPhase("idle");
      return;
    }
    if (automaticVersion) markAutoReload(automaticVersion);
    setPhase("reloaded");
    await new Promise((resolve) => window.setTimeout(resolve, UPDATE_SUCCESS_HOLD_MS));
    const recover = () => {
      reloadInFlight.current = false;
      setPhase("prompt");
    };
    window.setTimeout(() => {
      try {
        window.location.reload();
      } catch {
        recover();
      }
    }, RELOAD_NAVIGATION_RETRY_MS);
    window.setTimeout(recover, RELOAD_RECOVERY_TIMEOUT_MS);
    try {
      window.location.replace(window.location.href);
    } catch {
      window.location.reload();
    }
  }, []);

  React.useEffect(() => {
    if (!availableVersion || held || deferred || reloadInFlight.current) return;
    if (readReloadCount(availableVersion) < MAX_AUTO_RELOAD_ATTEMPTS) void reload(availableVersion);
    else setPhase("prompt");
  }, [availableVersion, deferred, held, reload]);

  return {
    phase,
    promptOpen: phase === "prompt" && !held && !deferred,
    reload: () => void reload(),
  };
}
