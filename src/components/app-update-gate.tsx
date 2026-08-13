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

export function AppUpdateGate() {
  useLocaleSubscription();
  const [availableVersion, setAvailableVersion] = React.useState("");
  const [reloading, setReloading] = React.useState(false);
  const [promptVisible, setPromptVisible] = React.useState(false);

  const check = React.useCallback(async () => {
    try {
      const response = await fetch("/version.json", { cache: "no-store" });
      const data = (await response.json()) as { version?: string };
      if (data.version && data.version !== currentVersion)
        setAvailableVersion(data.version);
    } catch {
      // Version checks are opportunistic and must never block the app.
    }
  }, []);

  React.useEffect(() => {
    void check();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void check();
    }, 5 * 60_000);
    const online = () => void check();
    window.addEventListener("online", online);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("online", online);
    };
  }, [check]);

  React.useEffect(() => {
    if (!availableVersion) return;
    if (sessionStorage.getItem(AUTO_RELOAD_KEY) === availableVersion) {
      setPromptVisible(true);
      return;
    }
    sessionStorage.setItem(AUTO_RELOAD_KEY, availableVersion);
    void reload();
    // The first unseen version automatically reloads once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableVersion]);

  async function reload() {
    if (reloading) return;
    setReloading(true);
    try {
      const registration = await navigator.serviceWorker?.getRegistration();
      await registration?.update();
      registration?.waiting?.postMessage({ type: "SKIP_WAITING" });
    } finally {
      window.location.replace(window.location.href);
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
