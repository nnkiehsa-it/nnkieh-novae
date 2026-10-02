"use client";

import { DatabaseZap } from "lucide-react";
import type * as React from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useI18n } from "@/i18n";
import type { DraftChange } from "@/lib/draft-diff";
import type { DraftImpact } from "@/hooks/use-draft";

/**
 * The last thing shown before a change is made.
 *
 * It says two things a bare confirmation cannot: which settings are actually
 * moving, and how much stored data that will disturb. One dialog serves every
 * administration screen, because the question is the same everywhere.
 */
export function ApplyReviewDialog({
  changes,
  describeChange,
  impact,
  describeImpact,
  formatChangeValue,
  onCancel,
  onConfirm,
  open,
}: {
  changes: DraftChange[];
  describeChange: (key: string) => React.ReactNode;
  /** Estimated rows the change will disturb, keyed the way the backend reports. */
  impact?: DraftImpact | null;
  describeImpact?: (key: string) => React.ReactNode;
  formatChangeValue?: (change: DraftChange, value: unknown) => React.ReactNode;
  onCancel: () => void;
  onConfirm: () => void;
  open: boolean;
}) {
  const { t } = useI18n();
  const affected = Object.entries(impact?.details ?? {}).filter(([, count]) => count > 0);
  const updated = Object.entries(impact?.updatedDetails ?? {}).filter(([, count]) => count > 0);
  const retention = impact?.totalDeletedRows !== undefined;
  return (
    <AlertDialog onOpenChange={(next) => !next && onCancel()} open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia>
            <DatabaseZap />
          </AlertDialogMedia>
          <AlertDialogTitle>{t("admin.reviewTitle")}</AlertDialogTitle>
          <AlertDialogDescription>
            {retention && impact.totalDeletedRows! > 0
              ? t("admin.reviewImpactDescription", { count: impact.totalDeletedRows! })
              : impact && impact.totalEstimatedRows > 0
                ? t(retention ? "admin.reviewExpiryDescription" : "admin.reviewUpdateDescription", { count: impact.totalUpdatedRows ?? impact.totalEstimatedRows })
              : t("admin.reviewDescription", { count: changes.length })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="max-h-64 overflow-y-auto rounded-xl bg-[var(--surface-inset)]">
          {changes.map((change) => (
            <div className="grid grid-cols-1 gap-1 border-b px-4 py-2.5 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-3" key={change.key}>
              <span className="min-w-0 flex-1 text-sm">{describeChange(change.key)}</span>
              <span className="min-w-0 max-w-full break-words text-sm tabular-nums text-muted-foreground">
                {formatChangeValue?.(change, change.before) ?? formatValue(change.before, t)}
                <span aria-hidden className="px-1.5">→</span>
                <span className="font-medium text-foreground">{formatChangeValue?.(change, change.after) ?? formatValue(change.after, t)}</span>
              </span>
            </div>
          ))}
        </div>
        {retention && impact.totalDeletedRows! > 0 && (impact.totalUpdatedRows ?? 0) > 0 ? (
          <p className="text-sm leading-6 text-muted-foreground">{t("admin.reviewExpiryDescription", { count: impact.totalUpdatedRows! })}</p>
        ) : null}
        {affected.length > 0 ? (
          <div className="rounded-xl bg-[var(--surface-inset)]">
            {affected.map(([key, count]) => (
              <div className="flex items-center gap-3 border-b px-4 py-2.5 last:border-b-0" key={key}>
                <span className="min-w-0 flex-1 text-sm">
                  {describeImpact ? describeImpact(key) : key}
                </span>
                <span className="font-mono text-sm font-semibold tabular-nums">{count}</span>
              </div>
            ))}
          </div>
        ) : null}
        {updated.length > 0 ? (
          <div className="rounded-xl bg-[var(--surface-inset)]">
            {updated.map(([key, count]) => (
              <div className="flex items-center gap-3 border-b px-4 py-2.5 last:border-b-0" key={key}>
                <span className="min-w-0 flex-1 text-sm">{describeImpact ? describeImpact(key) : key}</span>
                <span className="text-sm font-semibold tabular-nums">{count}</span>
              </div>
            ))}
          </div>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>{t("common.cancel")}</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>
            {t(impact && impact.totalEstimatedRows > 0 ? "admin.reviewQueue" : "ui.common.save")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function formatValue(value: unknown, t: (key: string) => string) {
  if (typeof value === "boolean") return t(value ? "admin.valueOn" : "admin.valueOff");
  if (Array.isArray(value)) return String(value.length);
  if (value === null || value === undefined) return "—";
  return String(value);
}
