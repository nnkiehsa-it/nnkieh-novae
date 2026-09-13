"use client";

import type { LucideIcon } from "lucide-react";

import { useI18n } from "@/i18n";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ListActionRow } from "@/components/ui/list";

/**
 * Removing a category is the one destructive thing on the screen, so it says
 * what it will cost before it is added to the draft -- and it is still only a
 * draft until the screen is saved.
 */
export function CategoryDeleteAction({
  disabled,
  icon,
  name,
  onDelete,
  persisted,
}: {
  disabled: boolean;
  icon: LucideIcon;
  name: string;
  onDelete: () => void;
  persisted: boolean;
}) {
  const { t } = useI18n();
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <ListActionRow
          disabled={disabled}
          icon={icon}
          label={t("ui.admin.deleteCategory")}
          tone="destructive"
        />
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("categoryAdmin.deleteConfirmTitle", { name })}</AlertDialogTitle>
          <AlertDialogDescription>
            {t(
              persisted
                ? "categoryAdmin.deleteConfirmMessage"
                : "categoryAdmin.deleteDraftConfirmMessage",
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("ui.common.cancel")}</AlertDialogCancel>
          <AlertDialogAction onClick={onDelete}>
            {t("ui.common.confirmDelete")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
