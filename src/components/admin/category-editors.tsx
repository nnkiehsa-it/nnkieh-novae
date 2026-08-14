"use client";
import { t as translate, useI18n as useLocaleSubscription } from "@/i18n";

import { GripVertical } from "lucide-react";
import type {
  FacilityCategoryConfig,
  IssueCategoryConfig,
} from "@/types/categories";
import { CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  CategoryDeleteButton,
  CategoryIdentityFields,
  DefaultToggle,
  ToggleField,
} from "@/components/admin/category-editor-controls";

export function CategoryFeatureHeader({
  description = translate('ui.admin.navDescription'),
  enabled,
  onChange,
  title,
}: {
  description?: string;
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  title: string;
}) {
  useLocaleSubscription();
  return (
    <CardHeader className="flex-row items-center justify-between border-b py-4">
      <div>
        <CardTitle className="text-base">{title}</CardTitle>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      <Switch
        aria-label={title}
        checked={enabled}
        onCheckedChange={onChange}
      />
    </CardHeader>
  );
}

interface FacilityCategoryEditorProps {
  identifierLocked: boolean;
  index: number;
  item: FacilityCategoryConfig;
  onChange: (item: FacilityCategoryConfig) => void;
  onDefault: () => void;
  onDelete: () => void;
}

export function FacilityCategoryEditor({
  identifierLocked,
  index,
  item,
  onChange,
  onDefault,
  onDelete,
}: FacilityCategoryEditorProps) {
  return (
    <div
      aria-label={
        item.label || `${translate('ui.access.facilityCategory')} ${index + 1}`
      }
      className="grid gap-5 border-b py-6 first:pt-0 sm:grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end"
      role="group"
    >
      <GripVertical className="mb-2 hidden size-4 text-muted-foreground sm:block" />
      <CategoryIdentityFields
        idPrefix={`facility-category-${index}`}
        identifierLocked={identifierLocked}
        item={item}
        onChange={onChange}
      />
      <CategoryDeleteButton
        disabled={item.isDefault}
        name={item.label}
        onDelete={onDelete}
        persisted={identifierLocked}
      />
      <DefaultToggle
        checked={item.isDefault}
        index={index}
        onCheckedChange={onDefault}
      />
    </div>
  );
}

interface IssueCategoryEditorProps {
  identifierLocked: boolean;
  index: number;
  item: IssueCategoryConfig;
  onChange: (item: IssueCategoryConfig) => void;
  onDefault: () => void;
  onDelete: () => void;
}

export function IssueCategoryEditor({
  identifierLocked,
  index,
  item,
  onChange,
  onDefault,
  onDelete,
}: IssueCategoryEditorProps) {
  return (
    <div
      aria-label={
        item.label || `${translate('ui.access.issueCategory')} ${index + 1}`
      }
      className="grid gap-6 border-b py-6 first:pt-0"
      role="group"
    >
      <div className="grid gap-3 sm:grid-cols-[auto_1fr_1fr_auto] sm:items-end">
        <GripVertical className="mb-2 hidden size-4 text-muted-foreground sm:block" />
        <CategoryIdentityFields
          idPrefix={`issue-category-${index}`}
          identifierLocked={identifierLocked}
          item={item}
          onChange={onChange}
        />
        <CategoryDeleteButton
          disabled={item.isDefault}
          name={item.label}
          onDelete={onDelete}
          persisted={identifierLocked}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor={`issue-category-${index}-read-access`}>
            {translate('ui.admin.readAccess')}
          </Label>
          <Select
            onValueChange={(value) =>
              onChange({
                ...item,
                readAccess: value as IssueCategoryConfig["readAccess"],
              })
            }
            value={item.readAccess}
          >
            <SelectTrigger id={`issue-category-${index}-read-access`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="school">{translate('ui.admin.schoolVisible')}</SelectItem>
              <SelectItem value="reviewed-school">{translate('ui.admin.reviewedVisible')}</SelectItem>
              <SelectItem value="owner-admin">{translate('ui.admin.ownerAdminOnly')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <ToggleField
          checked={item.authorVisible}
          label={translate('ui.admin.showAuthor')}
          onCheckedChange={(checked) =>
            onChange({ ...item, authorVisible: checked })
          }
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <ToggleField
          checked={item.commentsEnabled}
          label={translate('ui.admin.allowComments')}
          onCheckedChange={(checked) =>
            onChange({ ...item, commentsEnabled: checked })
          }
        />
        <ToggleField
          checked={item.supportEnabled}
          label={translate('ui.admin.enableSupport')}
          onCheckedChange={(checked) =>
            onChange({ ...item, supportEnabled: checked })
          }
        />
        {item.supportEnabled ? (
          <div className="grid grid-cols-2 gap-2">
            <Input
              aria-label={translate('ui.admin.supportGoal')}
              min={1}
              onChange={(event) =>
                onChange({
                  ...item,
                  supportGoal: Number(event.target.value) || null,
                })
              }
              placeholder={translate('ui.admin.goalPlaceholder')}
              type="number"
              value={item.supportGoal ?? ""}
            />
            <Input
              aria-label={translate('ui.admin.supportDays')}
              min={1}
              onChange={(event) =>
                onChange({
                  ...item,
                  supportDeadlineDays: Number(event.target.value) || null,
                })
              }
              placeholder={translate('ui.admin.daysPlaceholder')}
              type="number"
              value={item.supportDeadlineDays ?? ""}
            />
          </div>
        ) : null}
      </div>
      <DefaultToggle
        checked={item.isDefault}
        index={index}
        onCheckedChange={onDefault}
      />
    </div>
  );
}
