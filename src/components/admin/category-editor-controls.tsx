"use client";

import { Trash2 } from "lucide-react";
import { t as translate } from "@/i18n";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function CategoryIdentityFields<
  T extends { id: string; label: string },
>({
  idPrefix,
  identifierLocked,
  item,
  onChange,
}: {
  idPrefix: string;
  identifierLocked: boolean;
  item: T;
  onChange: (item: T) => void;
}) {
  const nameId = `${idPrefix}-name`;
  const identifierId = `${idPrefix}-identifier`;
  return (
    <>
      <div className="grid gap-1.5">
        <Label htmlFor={nameId}>{translate('ui.common.name')}</Label>
        <Input
          id={nameId}
          onChange={(event) => onChange({ ...item, label: event.target.value })}
          value={item.label}
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={identifierId}>{translate('ui.common.slug')}</Label>
        <Input
          disabled={identifierLocked}
          id={identifierId}
          onChange={(event) =>
            onChange({
              ...item,
              id: event.target.value.toLowerCase().replace(/\s+/gu, "-"),
            })
          }
          value={item.id}
        />
      </div>
    </>
  );
}

export function DefaultToggle({
  checked,
  index,
  onCheckedChange,
}: {
  checked: boolean;
  index: number;
  onCheckedChange: () => void;
}) {
  return (
    <label className="flex items-center gap-2 text-xs text-muted-foreground sm:col-start-2 sm:col-span-2">
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
      {translate('ui.admin.setDefaultOrder', { order: index + 1 })}
    </label>
  );
}

export function ToggleField({
  checked,
  label,
  onCheckedChange,
}: {
  checked: boolean;
  label: string;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex min-h-9 items-center justify-between rounded-lg border bg-card px-3 text-sm">
      {label}
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </label>
  );
}

export function CategoryDeleteButton({
  disabled,
  name,
  onDelete,
  persisted,
}: {
  disabled: boolean;
  name: string;
  onDelete: () => void;
  persisted: boolean;
}) {
  return (
    <AlertDialog>
      <Tooltip>
        <AlertDialogTrigger asChild>
          <TooltipTrigger asChild>
            <Button
              aria-label={translate('ui.admin.deleteCategory')}
              disabled={disabled}
              size="icon"
              variant="ghost"
            >
              <Trash2 />
            </Button>
          </TooltipTrigger>
        </AlertDialogTrigger>
        <TooltipContent>{translate('ui.admin.deleteCategory')}</TooltipContent>
      </Tooltip>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {translate('categoryAdmin.deleteConfirmTitle', { name })}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {translate(
              persisted
                ? 'categoryAdmin.deleteConfirmMessage'
                : 'categoryAdmin.deleteDraftConfirmMessage',
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{translate('ui.common.cancel')}</AlertDialogCancel>
          <AlertDialogAction onClick={onDelete}>
            {translate('ui.common.confirmDelete')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
