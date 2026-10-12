"use client";
import { t as translate, useI18n as useLocaleSubscription } from "@/i18n";

import * as React from "react";
import { MoreHorizontal, Trash2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PendingAlertDialogAction } from "@/components/ui/pending-alert-dialog-action";
import { ActionMenu, type ActionMenuItem } from "@/components/ui/action-menu";

export interface DetailMenuItem {
  icon: LucideIcon;
  label: string;
  onSelect: () => void;
}

/**
 * What else can be done to the record this route is showing.
 *
 * Proposals, facility reports and announcements each wrote this out: the same
 * menu, the same red last item, the same confirmation behind it, three times.
 * Only the extra items and the wording of the deletion differ, so only those
 * are props.
 *
 * Deleting still asks the centred question rather than a second sheet: a sheet
 * invites dismissal, and this is the one thing here that cannot be undone.
 */
export function DetailActionsMenu({
  items = [],
  remove,
}: {
  items?: DetailMenuItem[];
  remove: {
    description: string;
    label: string;
    onConfirm: () => void;
    state: "idle" | "loading" | "success";
    title: string;
  };
}) {
  useLocaleSubscription();
  const [confirming, setConfirming] = React.useState(false);
  const menuItems: ActionMenuItem[] = [
    ...items.map((item) => ({
      icon: item.icon,
      key: item.label,
      label: item.label,
      onSelect: item.onSelect,
    })),
    {
      icon: Trash2,
      key: "remove",
      label: remove.label,
      onSelect: () => setConfirming(true),
      tone: "destructive" as const,
    },
  ];

  return (
    <>
      <ActionMenu
        items={menuItems}
        title={translate("ui.common.moreActions")}
        tooltip={translate("ui.common.moreActions")}
        trigger={
          <Button
            aria-label={translate("ui.common.moreActions")}
            className="size-11 md:size-9"
            size="icon"
            variant="ghost"
          >
            <MoreHorizontal />
          </Button>
        }
      />
      <AlertDialog onOpenChange={setConfirming} open={confirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{remove.title}</AlertDialogTitle>
            <AlertDialogDescription>{remove.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{translate("ui.common.cancel")}</AlertDialogCancel>
            <PendingAlertDialogAction onConfirm={remove.onConfirm} state={remove.state}>
              {translate("ui.common.confirmDelete")}
            </PendingAlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
