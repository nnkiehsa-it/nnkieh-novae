"use client";
import { t as translate, useI18n as useLocaleSubscription } from "@/i18n";

import * as React from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const currentVersion = process.env.NEXT_PUBLIC_APP_VERSION || "development";
const AUTO_RELOAD_KEY = "novae:auto-update-reloaded-version";
const AUTO_RELOAD_COUNT_KEY = "novae:auto-update-reloaded-count";
const VERSION_CHECK_TIMEOUT_MS = 2_000;
const SERVICE_WORKER_PREPARE_TIMEOUT_MS = 2_000;
const RELOAD_NAVIGATION_RETRY_MS = 4_000;
const RELOAD_RECOVERY_TIMEOUT_MS = 10_000;
const MAX_AUTO_RELOAD_ATTEMPTS = 2;

function rejectWhenAborted(signal: AbortSignal) {
  return new Promise<never>((_, reject) => {
    signal.addEventListener(
      "abort",
      () => reject(new Error("service worker update timed out")),
      { once: true },
    );
  });
}

export function AppUpdateGate() {
  useLocaleSubscription();
  const [availableVersion, setAvailableVersion] = React.useState("");
  const [reloading, setReloading] = React.useState(false);
  const [promptVisible, setPromptVisible] = React.useState(false);
  const lastCheckedAt = React.useRef(0);
  const checking = React.useRef(false);
  const reloadInFlight = React.useRef(false);

  const check = React.useCallback(async () => {
    if (checking.current || Date.now() - lastCheckedAt.current < 60_000) return;
    checking.current = true;
    lastCheckedAt.current = Date.now();
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), VERSION_CHECK_TIMEOUT_MS);
    try {
      const response = await fetch("/version.json", {
        cache: "no-store",
        signal: controller.signal,
      });
      if (!response.ok) return;
      const data = (await response.json()) as { version?: string };
      if (data.version && data.version !== currentVersion)
        setAvailableVersion(data.version);
    } catch {
      // Version checks are opportunistic and must never block the app.
    } finally {
      window.clearTimeout(timeout);
      checking.current = false;
    }
  }, []);

  React.useEffect(() => {
    void check();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void check();
    }, 5 * 60_000);
    const online = () => void check();
    const resume = () => {
      if (Date.now() - lastCheckedAt.current >= 5 * 60_000) void check();
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

  React.useEffect(() => {
    if (!availableVersion) return;
    if (!canAutoReload(availableVersion)) {
      setPromptVisible(true);
      return;
    }
    void reload({ automatic: true });
    // The first unseen version automatically reloads once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableVersion]);

  function readReloadCount(version: string) {
    try {
      const storedVersion = sessionStorage.getItem(AUTO_RELOAD_KEY);
      if (storedVersion !== version) return 0;
      const count = Number.parseInt(sessionStorage.getItem(AUTO_RELOAD_COUNT_KEY) || "0", 10);
      return Number.isFinite(count) && count > 0 ? count : 0;
    } catch {
      return 0;
    }
  }

  function canAutoReload(version: string) {
    return readReloadCount(version) < MAX_AUTO_RELOAD_ATTEMPTS;
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

  async function prepareServiceWorker() {
    if (!("serviceWorker" in navigator)) return;
    const controller = new AbortController();
    const timeout = window.setTimeout(
      () => controller.abort(),
      SERVICE_WORKER_PREPARE_TIMEOUT_MS,
    );
    try {
      const registration = await Promise.race([
        navigator.serviceWorker.register("/sw.js", {
          scope: "/",
          type: "module",
          updateViaCache: "none",
        }),
        rejectWhenAborted(controller.signal),
      ]);
      await Promise.race([
        registration.update(),
        rejectWhenAborted(controller.signal),
      ]);
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
      // A failed SW update must not prevent the document from refreshing.
    } finally {
      window.clearTimeout(timeout);
    }
  }

  async function reload(options: { automatic?: boolean } = {}) {
    if (reloadInFlight.current) return;
    reloadInFlight.current = true;
    setReloading(true);
    if (options.automatic && availableVersion) markAutoReload(availableVersion);
    await prepareServiceWorker();
    window.setTimeout(() => {
      try {
        window.location.reload();
      } catch {
        setPromptVisible(true);
        reloadInFlight.current = false;
        setReloading(false);
      }
    }, RELOAD_NAVIGATION_RETRY_MS);
    window.setTimeout(() => {
      setPromptVisible(true);
      reloadInFlight.current = false;
      setReloading(false);
    }, RELOAD_RECOVERY_TIMEOUT_MS);
    try {
      window.location.replace(window.location.href);
    } catch {
      window.location.reload();
    }
  }

  return (
    <>
      <Dialog open={promptVisible && !reloading}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>{translate('ui.update.title')}</DialogTitle>
            <DialogDescription>{translate('ui.update.description')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => void reload()}>
              <RefreshCw />{translate('ui.update.action')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {reloading ? (
        <div
          aria-live="assertive"
          className="fixed inset-0 z-[100] grid place-items-center bg-background/72 backdrop-blur-md"
        >
          <div className="flex flex-col items-center gap-3">
            <RefreshCw className="t-spinner size-6" />
            <p
              className="t-shimmer text-sm font-medium"
              data-text={translate('ui.update.loading')}
            >{translate('ui.update.loading')}</p>
          </div>
        </div>
      ) : null}
    </>
  );
}
