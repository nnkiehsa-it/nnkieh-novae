"use client";

import type * as React from "react";

import { useI18n } from "@/i18n";
import { usePlatformSettings } from "@/hooks/use-platform-settings";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { ApplyReviewDialog } from "@/components/admin/apply-review-dialog";
import {
  IMAGE_FIELDS,
  describeSettingKey,
} from "@/components/admin/platform-setting-fields";
import { RETENTION_GROUPS, retentionLabelKey } from "@/components/admin/retention-groups";
import { ListSection } from "@/components/ui/list";
import { ListNumberRow, ListSwitchRow } from "@/components/ui/list-controls";
import { ErrorState } from "@/components/ui/page-state";
import { SaveBar } from "@/components/ui/save-bar";
import { Skeleton } from "@/components/ui/skeleton";
import type { DataRetentionSettings } from "@/types/categories";

export function PlatformSettings() {
  const { t } = useI18n();
  const { draft, error, load, loading } = usePlatformSettings();
  useUnsavedChanges(draft.changes.length, draft.reset);
  const value = draft.value;

  if (error) return <ErrorState error={error} onRetry={() => void load()} />;
  if (loading || !value) return <SettingsPlaceholder />;

  const setRetention = (key: DataRetentionSettings extends never ? never : keyof DataRetentionSettings, next: boolean | number) =>
    draft.update((current) => ({
      ...current,
      retention: { ...current.retention, [key]: next } as DataRetentionSettings,
    }));

  return (
    <div className="space-y-6">
      {RETENTION_GROUPS.map((group) => (
        <ListSection footer={t(group.descriptionKey)} header={t(group.titleKey)} key={group.titleKey}>
          {group.items.flatMap((item) => {
            const enableKey = item.enableKey;
            const enabled = enableKey ? value.retention[enableKey] === true : true;
            return [
              enableKey ? (
                <ListSwitchRow
                  checked={enabled}
                  key={enableKey}
                  label={t(retentionLabelKey(enableKey))}
                  name={t(retentionLabelKey(enableKey))}
                  onCheckedChange={(next) => setRetention(enableKey, next)}
                />
              ) : null,
              enabled ? (
                <ListNumberRow
                  key={item.key}
                  label={t(retentionLabelKey(item.key))}
                  max={item.unit === "hours" ? 87_600 : 3_650}
                  onChange={(next) => setRetention(item.key, next)}
                  unit={t(item.unit === "hours" ? "admin.unitHours" : "admin.unitDays")}
                  value={value.retention[item.key] as number}
                />
              ) : null,
            ];
          })}
        </ListSection>
      ))}

      <ListSection
        footer={t("ui.admin.imageUploadsDescription")}
        header={t("ui.admin.imageUploads")}
      >
        {IMAGE_FIELDS.map((field) => (
          <ListNumberRow
            key={field.key}
            label={t(field.labelKey)}
            max={field.max}
            min={field.min}
            onChange={(next) =>
              draft.update((current) => ({
                ...current,
                imageUploads: { ...current.imageUploads, [field.key]: next },
              }))
            }
            step={field.step ?? 1}
            unit={field.unitKey ? t(field.unitKey) : undefined}
            value={value.imageUploads[field.key]}
          />
        ))}
      </ListSection>

      <SaveBar
        changeCount={draft.changes.length}
        disabled={!draft.valid}
        onDiscard={draft.reset}
        onSave={() => void draft.submit()}
        status={draft.status}
      />
      <ApplyReviewDialog
        changes={draft.changes}
        describeChange={(key) => t(describeSettingKey(key))}
        describeImpact={(key) => t(`ui.admin.retentionImpact.${key}`)}
        impact={draft.impact}
        onCancel={draft.cancel}
        onConfirm={() => void draft.confirm()}
        open={draft.impact !== null}
      />
    </div>
  );
}

export function SettingsPlaceholder(): React.ReactElement {
  return (
    <div aria-busy="true" className="space-y-6">
      {[0, 1, 2].map((index) => (
        <Skeleton className="h-56 w-full rounded-xl" key={index} />
      ))}
    </div>
  );
}
