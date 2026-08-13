"use client";
import { t as translate, useI18n as useLocaleSubscription } from "@/i18n";

import type * as React from "react";
import { Plus, Trash2 } from "lucide-react";
import type {
  FacilityCategoryDraft,
  IssueCategoryDraft,
} from "@/types/categories";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface CategorySetupPanelProps {
  children: React.ReactNode;
  enabled: boolean;
  onAdd: () => void;
  onEnabledChange: (enabled: boolean) => void;
  title: string;
}

export function CategorySetupPanel({
  children,
  enabled,
  onAdd,
  onEnabledChange,
  title,
}: CategorySetupPanelProps) {
  useLocaleSubscription();
  return (
    <Card className="gap-0 py-0">
      <CardHeader className="flex-row items-center justify-between border-b py-4">
        <div>
          <CardTitle>{title}</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">{translate('ui.setup.navHint')}</p>
        </div>
        <Switch
          aria-label={title}
          checked={enabled}
          onCheckedChange={onEnabledChange}
        />
      </CardHeader>
      <CardContent className="grid gap-3 py-4">
        {children}
        <Button
          className="justify-start"
          disabled={!enabled}
          onClick={onAdd}
          variant="ghost"
        >
          <Plus />{translate('ui.setup.addCategory')}</Button>
      </CardContent>
    </Card>
  );
}

interface FacilityDraftEditorProps {
  draft: FacilityCategoryDraft;
  index: number;
  onChange: (draft: FacilityCategoryDraft) => void;
  onRemove?: () => void;
}

export function FacilityDraftEditor({
  draft,
  index,
  onChange,
  onRemove,
}: FacilityDraftEditorProps) {
  const nameId = `setup-facility-${index}-name`;
  const identifierId = `setup-facility-${index}-identifier`;

  return (
    <div className="grid gap-4 rounded-xl border bg-[var(--surface-inset)] p-5 sm:grid-cols-[1fr_1fr_auto] sm:items-end sm:p-6">
      <div className="grid gap-1.5">
        <Label htmlFor={nameId}>{translate('ui.setup.categoryName')}</Label>
        <Input
          id={nameId}
          onChange={(event) =>
            onChange({ ...draft, label: event.target.value })
          }
          placeholder={translate('ui.setup.facilityExample')}
          value={draft.label}
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={identifierId}>{translate('ui.common.slug')}</Label>
        <Input
          id={identifierId}
          onChange={(event) =>
            onChange({ ...draft, id: normalizeCategoryId(event.target.value) })
          }
          placeholder="classroom-equipment"
          value={draft.id}
        />
      </div>
      {onRemove ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              aria-label={translate('ui.admin.deleteCategory')}
              onClick={onRemove}
              size="icon"
              variant="ghost"
            >
              <Trash2 />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{translate('ui.admin.deleteCategory')}</TooltipContent>
        </Tooltip>
      ) : (
        <span className="pb-2 text-xs text-muted-foreground">{translate('ui.common.default')}</span>
      )}
      <p className="text-xs text-muted-foreground sm:col-span-full">
        {translate('ui.setup.slugHint', { order: index + 1 })}
      </p>
    </div>
  );
}

interface IssueDraftEditorProps {
  draft: IssueCategoryDraft;
  index: number;
  onChange: (draft: IssueCategoryDraft) => void;
  onRemove?: () => void;
}

export function IssueDraftEditor({
  draft,
  index,
  onChange,
  onRemove,
}: IssueDraftEditorProps) {
  const nameId = `setup-issue-${index}-name`;
  const identifierId = `setup-issue-${index}-identifier`;

  return (
    <div className="grid gap-5 rounded-xl border bg-[var(--surface-inset)] p-5 sm:p-6">
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <div className="grid gap-1.5">
          <Label htmlFor={nameId}>{translate('ui.setup.categoryName')}</Label>
          <Input
            id={nameId}
            onChange={(event) =>
              onChange({ ...draft, label: event.target.value })
            }
            placeholder={translate('ui.setup.issueExample')}
            value={draft.label}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={identifierId}>{translate('ui.common.slug')}</Label>
          <Input
            id={identifierId}
            onChange={(event) =>
              onChange({
                ...draft,
                id: normalizeCategoryId(event.target.value),
              })
            }
            placeholder="campus-life"
            value={draft.id}
          />
        </div>
        {onRemove ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                aria-label={translate('ui.admin.deleteCategory')}
                onClick={onRemove}
                size="icon"
                variant="ghost"
              >
                <Trash2 />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{translate('ui.admin.deleteCategory')}</TooltipContent>
          </Tooltip>
        ) : (
          <span className="pb-2 text-xs text-muted-foreground">{translate('ui.common.default')}</span>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label>{translate('ui.admin.readAccess')}</Label>
          <Select
            onValueChange={(value) =>
              onChange({
                ...draft,
                readAccess: value as IssueCategoryDraft["readAccess"],
              })
            }
            value={draft.readAccess}
          >
            <SelectTrigger>
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
          checked={draft.authorVisible === true}
          label={translate('ui.admin.showAuthor')}
          onCheckedChange={(checked) =>
            onChange({ ...draft, authorVisible: checked })
          }
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <ToggleField
          checked={draft.commentsEnabled}
          label={translate('ui.admin.allowComments')}
          onCheckedChange={(checked) =>
            onChange({ ...draft, commentsEnabled: checked })
          }
        />
        <ToggleField
          checked={draft.supportEnabled === true}
          label={translate('ui.admin.enableSupport')}
          onCheckedChange={(checked) =>
            onChange({ ...draft, supportEnabled: checked })
          }
        />
        {draft.supportEnabled ? (
          <div className="grid grid-cols-2 gap-2">
            <Input
              aria-label={translate('ui.admin.supportGoal')}
              min={1}
              onChange={(event) =>
                onChange({
                  ...draft,
                  supportGoal: Number(event.target.value) || null,
                })
              }
              placeholder={translate('ui.admin.goalPlaceholder')}
              type="number"
              value={draft.supportGoal ?? ""}
            />
            <Input
              aria-label={translate('ui.admin.supportDays')}
              min={1}
              onChange={(event) =>
                onChange({
                  ...draft,
                  supportDeadlineDays: Number(event.target.value) || null,
                })
              }
              placeholder={translate('ui.admin.daysPlaceholder')}
              type="number"
              value={draft.supportDeadlineDays ?? ""}
            />
          </div>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">{translate('ui.access.issueCategory')}{index + 1}</p>
    </div>
  );
}

function ToggleField({
  checked,
  label,
  onCheckedChange,
}: {
  checked: boolean;
  label: string;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex min-h-9 items-center justify-between gap-3 rounded-lg border bg-card px-3 text-sm">
      <span>{label}</span>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </label>
  );
}

function normalizeCategoryId(value: string) {
  return value.toLowerCase().replace(/\s+/gu, "-");
}
