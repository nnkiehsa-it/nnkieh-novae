"use client";

import { DatabaseZap } from "lucide-react";

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

export function RetentionImpactDialog({
  details,
  onCancel,
  onConfirm,
  open,
  totalEstimatedRows,
}: {
  details: Record<string, number>;
  onCancel: () => void;
  onConfirm: () => void;
  open: boolean;
  totalEstimatedRows: number;
}) {
  const { t } = useI18n();
  const visible = Object.entries(details).filter(([, count]) => count > 0);
  return (
    <AlertDialog onOpenChange={(nextOpen) => { if (!nextOpen) onCancel(); }} open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia><DatabaseZap /></AlertDialogMedia>
          <AlertDialogTitle>{t("ui.admin.retentionImpactTitle")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("ui.admin.retentionImpactDescription", { count: totalEstimatedRows })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="overflow-hidden rounded-xl border bg-muted/30">
          {visible.map(([key, count]) => (
            <div className="flex items-center gap-3 border-b px-4 py-3 last:border-b-0" key={key}>
              <span className="min-w-0 flex-1 text-sm">{t(`ui.admin.retentionImpact.${key}`)}</span>
              <span className="font-mono text-sm font-semibold tabular-nums">{count}</span>
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
