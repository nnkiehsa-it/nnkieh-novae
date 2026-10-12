"use client";

import * as React from "react";
import { AlertDialog } from "radix-ui";
import { useI18n } from "@/i18n";
import { Button, type ActionStatus } from "./button";

/**
 * A question that has to be answered before something irreversible happens.
 * The dialog stays open while the action runs, so a failure can be read and
 * retried in place; `status` reaching `success` is the caller's cue to close it.
 */
export function ConfirmDialog({
  children,
  confirmLabel,
  description,
  onConfirm,
  onOpenChange,
  open,
  status = "idle",
  title,
  tone = "default",
  trigger,
}: {
  /** Anything the decision needs besides the description, such as a reason field. */
  children?: React.ReactNode;
  confirmLabel: string;
  description?: React.ReactNode;
  onConfirm: () => void;
  onOpenChange?: (open: boolean) => void;
  open?: boolean;
  status?: ActionStatus;
  title: React.ReactNode;
  tone?: "default" | "danger";
  trigger?: React.ReactNode;
}) {
  const { t } = useI18n();
  const busy = status !== "idle";
  return (
    <AlertDialog.Root onOpenChange={(next) => { if (!busy) onOpenChange?.(next); }} open={open}>
      {trigger ? <AlertDialog.Trigger asChild>{trigger}</AlertDialog.Trigger> : null}
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-50 bg-[var(--scrim)]" />
        <AlertDialog.Content className="fixed left-1/2 top-1/2 z-50 grid w-[min(24rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 gap-5 rounded-panel border border-line bg-surface-solid p-6 text-ink shadow-float outline-none">
          <div className="grid gap-2">
            <AlertDialog.Title className="text-lg font-semibold">{title}</AlertDialog.Title>
            {description ? <AlertDialog.Description className="text-[0.9375rem] leading-relaxed text-ink-muted">{description}</AlertDialog.Description> : null}
          </div>
          {children}
          <div className="grid grid-cols-2 gap-2">
            <AlertDialog.Cancel asChild>
              <Button disabled={busy}>{t("ui.common.cancel")}</Button>
            </AlertDialog.Cancel>
            <Button
              onClick={onConfirm}
              status={status}
              variant={tone === "danger" ? "danger" : "primary"}
            >
              {confirmLabel}
            </Button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
