"use client";

import * as React from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ListActionRow, ListSection } from "@/components/ui/list";
import { useI18n } from "@/i18n";

export function NotionRebuildAction({
  busy,
  onRebuild,
}: {
  busy: boolean;
  onRebuild: () => void;
}) {
  const { t } = useI18n();
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <ListSection header={t("ui.operations.notionArchive")}>
        <ListActionRow
          busy={busy}
          detail={t("ui.operations.notionRebuildDescription")}
          label={t("ui.operations.notionRebuild")}
          onClick={() => setOpen(true)}
          value={t("ui.operations.notionRebuildAction")}
        />
      </ListSection>
      <AlertDialog onOpenChange={setOpen} open={open}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("ui.operations.notionRebuildTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("ui.operations.notionRebuildConfirm")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("ui.common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={onRebuild}>{t("ui.operations.notionRebuildAction")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
