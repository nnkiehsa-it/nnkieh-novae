"use client";

import { useRouter } from "next/navigation";
import * as React from "react";

import { t as translate, useI18n as useLocaleSubscription } from "@/i18n";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  getUnsavedChanges,
  setUnsavedChanges,
  subscribeUnsavedChanges,
} from "@/hooks/unsaved-changes-store";

/** Declares what this screen would lose, for as long as it is on screen. */
export function useUnsavedChanges(count: number, discard: () => void) {
  const discardRef = React.useRef(discard);
  React.useEffect(() => {
    discardRef.current = discard;
  });

  React.useEffect(() => {
    setUnsavedChanges({ count, discard: () => discardRef.current() });
    return () => setUnsavedChanges(null);
  }, [count]);

  React.useEffect(() => {
    if (count === 0) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [count]);
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
  const router = useRouter();
  const [pending, setPending] = React.useState<string | null>(null);
  const unsaved = React.useSyncExternalStore(
    subscribeUnsavedChanges,
    getUnsavedChanges,
    getUnsavedChanges,
  );

  React.useEffect(() => {
    if (unsaved.count === 0) return;
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
  }, [unsaved.count]);

  return (
    <AlertDialog onOpenChange={(open) => !open && setPending(null)} open={pending !== null}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{translate("admin.leaveTitle")}</AlertDialogTitle>
          <AlertDialogDescription>
            {translate("admin.leaveMessage", { count: unsaved.count })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{translate("admin.leaveStay")}</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              const target = pending;
              unsaved.discard();
              setUnsavedChanges(null);
              setPending(null);
              if (target) router.push(target);
            }}
          >
            {translate("admin.leaveDiscard")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
