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
  onCancel,
  onConfirm,
  open,
}: {
  changes: DraftChange[];
  describeChange: (key: string) => React.ReactNode;
  /** Estimated rows the change will disturb, keyed the way the backend reports. */
  impact?: { details: Record<string, number>; totalEstimatedRows: number } | null;
  describeImpact?: (key: string) => React.ReactNode;
  onCancel: () => void;
  onConfirm: () => void;
  open: boolean;
}) {
  const { t } = useI18n();
  const affected = Object.entries(impact?.details ?? {}).filter(([, count]) => count > 0);
  return (
    <AlertDialog onOpenChange={(next) => !next && onCancel()} open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia>
            <DatabaseZap />
          </AlertDialogMedia>
          <AlertDialogTitle>{t("admin.reviewTitle")}</AlertDialogTitle>
          <AlertDialogDescription>
            {impact && impact.totalEstimatedRows > 0
              ? t("admin.reviewImpactDescription", { count: impact.totalEstimatedRows })
              : t("admin.reviewDescription", { count: changes.length })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="max-h-64 overflow-y-auto rounded-xl border bg-[var(--surface-inset)]">
          {changes.map((change) => (
            <div className="flex items-center gap-3 border-b px-4 py-2.5 last:border-b-0" key={change.key}>
              <span className="min-w-0 flex-1 text-sm">{describeChange(change.key)}</span>
              <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
                {formatValue(change.before, t)}
                <span aria-hidden className="px-1.5">→</span>
                <span className="font-medium text-foreground">{formatValue(change.after, t)}</span>
              </span>
            </div>
          ))}
        </div>
        {affected.length > 0 ? (
          <div className="rounded-xl border bg-[var(--surface-inset)]">
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
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>{t("common.cancel")}</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>
            {t(affected.length > 0 ? "admin.reviewQueue" : "ui.common.save")}
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
