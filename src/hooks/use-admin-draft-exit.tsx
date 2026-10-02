"use client";

import * as React from "react";
import { getUnsavedChanges, subscribeUnsavedChanges } from "@/hooks/unsaved-changes-store";
import { useI18n } from "@/i18n";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

/** Closing one account editor only discards that editor's unsaved changes. */
export function useAdminDraftExit(group: string | undefined, busy: boolean, close: () => void) {
  const { t } = useI18n();
  const [confirming, setConfirming] = React.useState(false);
  const pendingClose = React.useRef(close);
  React.useSyncExternalStore(subscribeUnsavedChanges, getUnsavedChanges, getUnsavedChanges);
  const changes = getUnsavedChanges(group);
  const blocked = busy || Boolean(changes.busy);
  return {
    blocked,
    requestClose: (complete = close) => {
      if (blocked) return;
      if (getUnsavedChanges(group).count > 0) {
        pendingClose.current = complete;
        setConfirming(true);
      } else complete();
    },
    prompt: <AlertDialog open={confirming} onOpenChange={setConfirming}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("admin.leaveTitle")}</AlertDialogTitle>
          <AlertDialogDescription>{blocked ? t("admin.savingBeforeLeaving") : t("admin.leaveMessage", { count: changes.count })}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("admin.leaveStay")}</AlertDialogCancel>
          <AlertDialogAction disabled={blocked} onClick={() => {
            getUnsavedChanges(group).discard();
            setConfirming(false);
            pendingClose.current();
          }}>{t("admin.leaveDiscard")}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>,
  };
}
