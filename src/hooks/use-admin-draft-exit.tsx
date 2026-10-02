"use client";

import * as React from "react";
import { getUnsavedChanges } from "@/hooks/unsaved-changes-store";
import { useI18n } from "@/i18n";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

/** Closing one account editor only discards that editor's unsaved changes. */
export function useAdminDraftExit(group: string, busy: boolean, close: () => void) {
  const { t } = useI18n();
  const [confirming, setConfirming] = React.useState(false);
  return {
    requestClose: () => {
      if (busy) return;
      if (getUnsavedChanges(group).count > 0) setConfirming(true);
      else close();
    },
    prompt: <AlertDialog open={confirming} onOpenChange={setConfirming}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("admin.leaveTitle")}</AlertDialogTitle>
          <AlertDialogDescription>{t("admin.leaveMessage", { count: getUnsavedChanges(group).count })}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("admin.leaveStay")}</AlertDialogCancel>
          <AlertDialogAction disabled={busy} onClick={() => {
            getUnsavedChanges(group).discard();
            setConfirming(false);
            close();
          }}>{t("admin.leaveDiscard")}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>,
  };
}
