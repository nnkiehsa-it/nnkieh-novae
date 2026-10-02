"use client";

import * as React from "react";

import { useI18n } from "@/i18n";
import { usePlatformSettings } from "@/hooks/use-platform-settings";
import { useAdminView } from "@/hooks/use-admin-view";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { ApplyReviewDialog } from "@/components/admin/apply-review-dialog";
import {
  IMAGE_PROCESSING_FIELDS,
  describeSettingKey,
} from "@/components/admin/platform-setting-fields";
import { SettingsGroup } from "@/components/admin/settings-group";
import { SettingPresets } from "@/components/admin/setting-presets";
import { DEFAULT_IMAGE_SETTINGS, IMAGE_PRESETS, RETENTION_PRESETS } from "@/lib/admin-setting-presets";
import { DATA_RETENTION } from "@/generated/data-retention";
import { RETENTION_GROUPS, retentionLabelKey } from "@/components/admin/retention-groups";
import { ListRowGroup, ListSection } from "@/components/ui/list";
import { ListNumberRow, ListSwitchRow } from "@/components/ui/list-controls";
import { LiquidTabs } from "@/components/ui/liquid-tabs";
import { ErrorState } from "@/components/ui/page-state";
import { SaveBar } from "@/components/ui/save-bar";
import { Skeleton } from "@/components/ui/skeleton";
import type { DataRetentionSettings, ImageUploadSettings } from "@/types/categories";

export function PlatformSettings() {
  const { t } = useI18n();
  const { draft, error, load, loading } = usePlatformSettings();
  const [area, setArea] = useAdminView(["retention", "images"] as const);
  const [reviewing, setReviewing] = React.useState(false);
  useUnsavedChanges(draft.changes.length, draft.reset);
  const value = draft.value;

  if (error) return <ErrorState error={error} onRetry={() => void load()} />;
  if (loading || !value) return <SettingsPlaceholder />;

  const setRetention = (key: keyof DataRetentionSettings, next: boolean | number) =>
    draft.update((current) => ({
      ...current,
      retention: { ...current.retention, [key]: next } as DataRetentionSettings,
    }));

  return (
    <div className="space-y-6">
      <LiquidTabs
        ariaLabel={t("admin.settingsArea")}
        onValueChange={setArea}
        options={[
          { label: t("admin.settingsRetention"), value: "retention" },
          { label: t("ui.admin.imageUploads"), value: "images" },
        ]}
        value={area}
      />

      {area === "retention" ? (
        <div className="space-y-4">
          <SettingPresets current={value.retention} presets={RETENTION_PRESETS}
            onApply={(retention) => draft.update((current) => ({ ...current, retention }))}
            onRestore={() => draft.update((current) => ({ ...current, retention: draft.baseline!.retention }))} />
          {RETENTION_GROUPS.map((group, index) => (
            <SettingsGroup defaultOpen={index === 0} key={group.titleKey} title={t(group.titleKey)}>
              {group.titleKey === "ui.admin.retentionOperations" ? (
                <p className="mb-3 text-sm leading-6 text-muted-foreground">{t("admin.retentionLifecycleHelp")}</p>
              ) : null}
              <ListSection>
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
                    <ListRowGroup key={item.key} show={enabled}>
                      <ListNumberRow
                        label={t(retentionLabelKey(item.key))}
                        max={item.unit === "hours" ? 87_600 : 3_650}
                        onChange={(next) => setRetention(item.key, next)}
                        onReset={() => setRetention(item.key, DATA_RETENTION[item.key])}
                        unit={t(item.unit === "hours" ? "admin.unitHours" : "admin.unitDays")}
                        value={value.retention[item.key] as number}
                      />
                    </ListRowGroup>,
                  ];
                })}
              </ListSection>
            </SettingsGroup>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{t("admin.imagePolicyLocation")}</p>
          <SettingPresets current={value.imageUploads} presets={IMAGE_PRESETS}
            onApply={(imageUploads) => draft.update((current) => ({ ...current, imageUploads }))}
            onRestore={() => draft.update((current) => ({ ...current, imageUploads: draft.baseline!.imageUploads }))} />
          <SettingsGroup defaultOpen title={t("admin.settingsImageProcessing")}>
            <ListSection>
              <ImageFields fields={IMAGE_PROCESSING_FIELDS} settings={value.imageUploads} update={(key, next) =>
                draft.update((current) => ({ ...current, imageUploads: { ...current.imageUploads, [key]: next } }))
              } />
            </ListSection>
          </SettingsGroup>
        </div>
      )}

      <SaveBar
        changeCount={draft.changes.length}
        disabled={!draft.valid}
        error={draft.error}
        onDiscard={draft.reset}
        onReload={() => { draft.reset(); void load(); }}
        onSave={() => void draft.submit()}
        onReview={() => setReviewing(true)}
        status={draft.status}
      />
      <ApplyReviewDialog
        changes={draft.changes}
        describeChange={(key) => t(describeSettingKey(key))}
        describeImpact={(key) => t(`ui.admin.retentionImpact.${key}`)}
        impact={draft.impact}
        onCancel={() => { setReviewing(false); draft.cancel(); }}
        onConfirm={() => { setReviewing(false); void (draft.impact ? draft.confirm() : draft.submit()); }}
        open={reviewing || draft.impact !== null}
      />
    </div>
  );
}

function ImageFields({
  fields,
  settings,
  update,
}: {
  fields: typeof IMAGE_PROCESSING_FIELDS;
  settings: ImageUploadSettings;
  update: (key: keyof ImageUploadSettings, value: number) => void;
}) {
  const { t } = useI18n();
  return fields.map((field) => (
    <ListNumberRow
      key={field.key}
      label={t(field.labelKey)}
      max={field.max}
      min={field.min}
      onChange={(next) => update(field.key, next)}
      onReset={() => update(field.key, DEFAULT_IMAGE_SETTINGS[field.key])}
      step={field.step ?? 1}
      unit={field.unitKey ? t(field.unitKey) : undefined}
      value={settings[field.key]}
    />
  ));
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
