"use client";

import * as React from "react";
import { Trash } from "@phosphor-icons/react/ssr";
import { useI18n } from "@/i18n";
import { ConfirmDialog } from "@/ui/confirm-dialog";
import { ListRow } from "@/ui/list";

/**
 * Removing a category is the one destructive thing in the editor, so it says
 * what it will cost first. It is still only a draft until the screen is saved.
 */
export function CategoryDeleteAction({ disabled, name, onDelete, persisted }: {
  disabled: boolean;
  name: string;
  onDelete: () => void;
  /** Whether the backend already holds this category, as opposed to a draft that was never saved. */
  persisted: boolean;
}) {
  const { t } = useI18n();
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <ListRow disabled={disabled} icon={<Trash />} label={t("ui.admin.deleteCategory")} onClick={() => setOpen(true)} tone="danger" />
      <ConfirmDialog
        confirmLabel={t("ui.common.confirmDelete")}
        description={t(persisted ? "categoryAdmin.deleteConfirmMessage" : "categoryAdmin.deleteDraftConfirmMessage")}
        onConfirm={() => { setOpen(false); onDelete(); }}
        onOpenChange={setOpen}
        open={open}
        title={t("categoryAdmin.deleteConfirmTitle", { name })}
        tone="danger"
      />
    </>
  );
}
