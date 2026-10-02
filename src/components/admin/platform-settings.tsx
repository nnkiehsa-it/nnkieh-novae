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
import { ListActionRow, ListRowGroup, ListSection } from "@/components/ui/list";
import { ListNumberRow, ListSwitchRow } from "@/components/ui/list-controls";
import { AdminAreaNavigation } from "@/components/admin/admin-area-navigation";
import { ErrorState } from "@/components/ui/page-state";
import { SaveBar } from "@/components/ui/save-bar";
import { Skeleton } from "@/components/ui/skeleton";
import type { DataRetentionSettings, ImageUploadSettings } from "@/types/categories";

export function PlatformSettings() {
  const { t } = useI18n();
  const { draft, error, load, loading } = usePlatformSettings();
  const [area, setArea] = useAdminView(["overview", "retention", "images", ...RETENTION_GROUPS.map((group) => group.value)]);
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
      <AdminAreaNavigation
        onSelect={setArea}
        areas={[
          ...RETENTION_GROUPS.map((group) => ({ value: group.value, label: t(group.titleKey), detail: t(group.detailKey),
            changeCount: draft.changes.filter((change) => group.items.some((item) => change.key === `retention.${item.key}` || change.key === `retention.${item.enableKey}`)).length })),
          { label: t("admin.retentionPresetsTitle"), value: "retention", detail: t("admin.summary.retention") },
          { label: t("ui.admin.imageUploads"), value: "images", detail: t("admin.summary.images"), changeCount: draft.changes.filter((change) => change.key.startsWith("imageUploads.")).length },
        ]}
        value={area}
      />

      {area !== "overview" && area !== "images" ? (
        <div className="space-y-4">
          {area === "retention" ? <><p className="text-sm leading-6 text-muted-foreground">{t("admin.retentionPresetScope")}</p><SettingPresets current={value.retention} presets={RETENTION_PRESETS}
            onApply={(retention) => draft.update((current) => ({ ...current, retention }))}
            onRestore={() => draft.update((current) => ({ ...current, retention: draft.baseline!.retention }))} /></> : null}
          {RETENTION_GROUPS.filter((group) => group.value === area).map((group) => (
            <div className="space-y-4" key={group.value}>
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
              <ListSection><ListActionRow label={t("admin.restoreSection")} onClick={() => draft.update((current) => ({
                ...current, retention: { ...current.retention, ...Object.fromEntries(group.items.flatMap((item) =>
                  [item.key, ...(item.enableKey ? [item.enableKey] : [])].map((key) => [key, draft.baseline!.retention[key]]))) },
              }))} /></ListSection>
            </div>
          ))}
        </div>
      ) : area === "images" ? (
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
      ) : null}

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
