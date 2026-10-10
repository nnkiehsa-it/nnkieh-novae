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
import { ListRow, ListSection } from "@/components/ui/list";

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
  description,
  confirmLabel,
  impact,
  describeImpact,
  formatChangeValue,
  onCancel,
  onConfirm,
  open,
}: {
  changes: DraftChange[];
  describeChange: (key: string) => React.ReactNode;
  description?: React.ReactNode;
  confirmLabel?: string;
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
            {description ?? (retention && impact.totalDeletedRows! > 0
              ? t("admin.reviewImpactDescription", { count: impact.totalDeletedRows! })
              : impact && impact.totalEstimatedRows > 0
                ? t(retention ? "admin.reviewExpiryDescription" : "admin.reviewUpdateDescription", { count: impact.totalUpdatedRows ?? impact.totalEstimatedRows })
              : t("admin.reviewDescription", { count: changes.length }))}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <ListSection className="mt-4 text-left">
          {changes.map((change) => (
            <ListRow key={change.key} label={describeChange(change.key)} detail={
              <span className="break-words tabular-nums">
                {formatChangeValue?.(change, change.before) ?? formatValue(change.before, t)}
                <span aria-hidden className="px-1.5">→</span>
                <span className="font-medium text-foreground">{formatChangeValue?.(change, change.after) ?? formatValue(change.after, t)}</span>
              </span>
            } />
          ))}
        </ListSection>
        {retention && impact.totalDeletedRows! > 0 && (impact.totalUpdatedRows ?? 0) > 0 ? (
          <p className="text-sm leading-6 text-muted-foreground">{t("admin.reviewExpiryDescription", { count: impact.totalUpdatedRows! })}</p>
        ) : null}
        {affected.length > 0 ? (
          <ListSection className="mt-4 text-left">
            {affected.map(([key, count]) => (
              <ListRow key={key} label={describeImpact ? describeImpact(key) : key} value={count} />
            ))}
          </ListSection>
        ) : null}
        {updated.length > 0 ? (
          <ListSection className="mt-4 text-left">
            {updated.map(([key, count]) => (
              <ListRow key={key} label={describeImpact ? describeImpact(key) : key} value={count} />
            ))}
          </ListSection>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>{t("common.cancel")}</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>
            {confirmLabel ?? t(impact && impact.totalEstimatedRows > 0 ? "admin.reviewQueue" : "ui.common.save")}
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
