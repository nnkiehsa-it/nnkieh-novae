"use client";

import * as React from "react";
import { getUnsavedChanges, subscribeUnsavedChanges } from "@/hooks/unsaved-changes-store";
import { useI18n } from "@/i18n";
import { ConfirmDialog } from "@/ui/confirm-dialog";

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
    prompt: (
      <ConfirmDialog
        cancelLabel={t("admin.leaveStay")}
        confirmLabel={t("admin.leaveDiscard")}
        description={blocked ? t("admin.savingBeforeLeaving") : t("admin.leaveMessage", { count: changes.count })}
        onConfirm={() => {
          getUnsavedChanges(group).discard();
          setConfirming(false);
          pendingClose.current();
        }}
        onOpenChange={setConfirming}
        open={confirming}
        status={blocked ? "loading" : "idle"}
        title={t("admin.leaveTitle")}
        tone="danger"
      />
    ),
  };
}
