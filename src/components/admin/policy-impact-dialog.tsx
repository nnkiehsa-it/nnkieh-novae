"use client";

import { Gauge } from "lucide-react";

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
import type { PolicyImpactEstimate } from "@/types/categories";

export function PolicyImpactDialog({
  estimates,
  onCancel,
  onConfirm,
  open,
  totalEstimatedRows,
}: {
  estimates: PolicyImpactEstimate[];
  onCancel: () => void;
  onConfirm: () => void;
  open: boolean;
  totalEstimatedRows: number;
}) {
  const { t } = useI18n();
  return (
    <AlertDialog onOpenChange={(nextOpen) => { if (!nextOpen) onCancel(); }} open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia><Gauge /></AlertDialogMedia>
          <AlertDialogTitle>{t("ui.admin.policyImpactTitle")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("ui.admin.policyImpactDescription", { count: totalEstimatedRows })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="overflow-hidden rounded-xl border bg-muted/30">
          {estimates.map((estimate) => (
            <div className="flex items-center gap-3 border-b px-4 py-3 last:border-b-0" key={`${estimate.jobType}:${estimate.scopeId}`}>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">
                  {estimate.jobType === "announcement-comments"
                    ? t("ui.admin.announcementCommentPolicy")
                    : t("ui.admin.issueCommentPolicy", { scope: estimate.scopeId })}
                </p>
                <p className="truncate font-mono text-xs text-muted-foreground">{estimate.scopeId}</p>
              </div>
              <span className="font-mono text-sm font-semibold tabular-nums">
                {estimate.estimatedRows}
              </span>
            </div>
          ))}
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>{t("common.cancel")}</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>{t("ui.admin.queueBackgroundChange")}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
