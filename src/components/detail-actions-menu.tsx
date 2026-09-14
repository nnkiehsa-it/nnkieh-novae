"use client";
import { t as translate, useI18n as useLocaleSubscription } from "@/i18n";

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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { PendingAlertDialogAction } from "@/components/ui/pending-alert-dialog-action";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

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
  return (
    <DropdownMenu>
      <Tooltip>
        <DropdownMenuTrigger asChild>
          <TooltipTrigger asChild>
            <Button
              aria-label={translate("ui.common.moreActions")}
              className="size-11 md:size-9"
              size="icon"
              variant="ghost"
            >
              <MoreHorizontal />
            </Button>
          </TooltipTrigger>
        </DropdownMenuTrigger>
        <TooltipContent>{translate("ui.common.moreActions")}</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end">
        {items.map((item) => (
          <DropdownMenuItem key={item.label} onSelect={item.onSelect}>
            <item.icon />
            {item.label}
          </DropdownMenuItem>
        ))}
        {items.length > 0 ? <DropdownMenuSeparator /> : null}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <DropdownMenuItem
              className="text-destructive"
              onSelect={(event) => event.preventDefault()}
            >
              <Trash2 />
              {remove.label}
            </DropdownMenuItem>
          </AlertDialogTrigger>
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
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
