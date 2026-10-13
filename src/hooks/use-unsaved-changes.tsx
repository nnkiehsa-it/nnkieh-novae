"use client";

import { useAppNavigate } from "@/hooks/use-app-location";
import * as React from "react";

import { t as translate, useI18n as useLocaleSubscription } from "@/i18n";
import { ConfirmDialog } from "@/ui/confirm-dialog";
import {
  getUnsavedChanges,
  setUnsavedChanges,
  subscribeUnsavedChanges,
} from "@/hooks/unsaved-changes-store";

/** Declares what this screen would lose, for as long as it is on screen. */
export function useUnsavedChanges(count: number, discard: () => void, group?: string, busy = false) {
  const [owner] = React.useState(() => Symbol("draft"));
  const discardRef = React.useRef(discard);
  React.useEffect(() => {
    discardRef.current = discard;
  });

  React.useEffect(() => {
    setUnsavedChanges({ count, busy, discard: () => discardRef.current() }, owner, group);
    return () => setUnsavedChanges(null, owner);
  }, [busy, count, group, owner]);

  React.useEffect(() => {
    if (count === 0 && !busy) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [busy, count]);
}

/**
 * Stops a link from throwing away an unsaved draft.
 *
 * It catches the click before the router sees it, which covers every way out of
 * a screen except the browser's own Back button -- the App Router has no
 * cancellable navigation event, and the only way to fake one is to push a
 * sentinel onto the history stack, which is worse than the problem.
 */
export function UnsavedChangesGuard() {
  useLocaleSubscription();
  const navigate = useAppNavigate();
  const [pending, setPending] = React.useState<string | null>(null);
  const unsaved = React.useSyncExternalStore(
    subscribeUnsavedChanges,
    getUnsavedChanges,
    getUnsavedChanges,
  );

  React.useEffect(() => {
    if (unsaved.count === 0 && !unsaved.busy) return;
    const intercept = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest?.("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.origin !== window.location.origin) return;
      if (anchor.pathname === window.location.pathname) return;
      event.preventDefault();
      event.stopPropagation();
      setPending(`${anchor.pathname}${anchor.search}`);
    };
    document.addEventListener("click", intercept, true);
    return () => document.removeEventListener("click", intercept, true);
  }, [unsaved.busy, unsaved.count]);

  React.useEffect(() => {
    if (!pending || unsaved.count > 0 || unsaved.busy) return;
    setPending(null);
    navigate(pending);
  }, [navigate, pending, unsaved.busy, unsaved.count]);

  return (
    <ConfirmDialog
      cancelLabel={translate("admin.leaveStay")}
        confirmLabel={translate("admin.leaveDiscard")}
      description={unsaved.busy ? translate("admin.savingBeforeLeaving") : translate("admin.leaveMessage", { count: unsaved.count })}
      onConfirm={() => {
        const target = pending;
        unsaved.discard();
        setPending(null);
        if (target) navigate(target);
      }}
      onOpenChange={(open) => { if (!open) setPending(null); }}
      open={pending !== null}
      status={unsaved.busy ? "loading" : "idle"}
      title={translate("admin.leaveTitle")}
      tone="danger"
    />
  );
}
