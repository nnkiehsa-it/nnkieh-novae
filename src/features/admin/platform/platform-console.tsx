import { useAdminView } from "@/hooks/use-admin-view";
import { usePlatformSettings } from "@/hooks/use-platform-settings";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { useI18n } from "@/i18n";
import { RETENTION_PRESETS } from "@/lib/admin-setting-presets";
import type { DataRetentionSettings } from "@/types/categories";
import { LoadingList } from "@/ui/page";
import { DraftBar } from "../shared/draft-bar";
import { LoadError } from "../shared/feedback";
import { SectionTabs } from "../shared/section-tabs";
import { SettingPresets } from "../shared/setting-presets";
import { ImageRows } from "./image-rows";
import { RETENTION_GROUPS } from "./retention-groups";
import { RetentionRows } from "./retention-rows";
import { describeSettingKey } from "./setting-fields";

const PRESETS = "retention";
const IMAGES = "images";
const VIEWS = [...RETENTION_GROUPS.map((group) => group.value), PRESETS, IMAGES];
const LIFECYCLE_GROUP = "retention-operations";

/**
 * How long the platform keeps what it stores, and how it treats uploads. One
 * draft covers every section, so a preset or a single lifetime is reviewed
 * and saved the same way.
 */
export function PlatformConsole() {
  const { t } = useI18n();
  const { draft, error, load, loading } = usePlatformSettings();
  const [view, setView] = useAdminView(VIEWS);
  useUnsavedChanges(draft.changes.length, draft.reset, undefined, draft.status === "saving");
  const value = draft.value;
  const baseline = draft.baseline;

  if (error) return <LoadError message={error} onRetry={() => void load()} />;
  if (loading || !value) return <LoadingList label={t("common.loading")} rows={3} />;

  const setRetention = (key: keyof DataRetentionSettings, next: boolean | number) =>
    draft.update((current) => ({ ...current, retention: { ...current.retention, [key]: next } as DataRetentionSettings }));
  const group = RETENTION_GROUPS.find((candidate) => candidate.value === view);

  return (
    <div className="grid gap-6">
      <SectionTabs
        label={t("admin.platformTitle")}
        onChange={setView}
        sections={[
          ...RETENTION_GROUPS.map((candidate) => ({
            detail: t(candidate.detailKey),
            label: t(candidate.titleKey),
            unsaved: draft.changes.some((change) =>
              candidate.items.some((item) => change.key === `retention.${item.key}` || change.key === `retention.${item.enableKey}`)),
            value: candidate.value,
          })),
          { detail: t("admin.summary.retention"), label: t("admin.retentionPresetsTitle"), value: PRESETS },
          {
            detail: t("admin.summary.images"),
            label: t("ui.admin.imageUploads"),
            unsaved: draft.changes.some((change) => change.key.startsWith("imageUploads.")),
            value: IMAGES,
          },
        ]}
        value={view}
      />
      {view === PRESETS ? (
        <>
          <p className="px-1 text-sm leading-relaxed text-ink-muted">{t("admin.retentionPresetScope")}</p>
          <SettingPresets
            current={value.retention}
            onApply={(retention) => draft.update((current) => ({ ...current, retention }))}
            onRestore={baseline ? () => draft.update((current) => ({ ...current, retention: baseline.retention })) : undefined}
            presets={RETENTION_PRESETS}
          />
        </>
      ) : null}
      {group ? (
        <RetentionRows
          footer={group.value === LIFECYCLE_GROUP ? t("admin.retentionLifecycleHelp") : undefined}
          items={group.items}
          onChange={setRetention}
          onRestore={baseline ? () => draft.update((current) => ({
            ...current,
            retention: {
              ...current.retention,
              ...Object.fromEntries(group.items.flatMap((item) =>
                [item.key, ...(item.enableKey ? [item.enableKey] : [])].map((key) => [key, baseline.retention[key]]))),
            },
          })) : undefined}
          value={value.retention}
        />
      ) : null}
      {view === IMAGES ? (
        <ImageRows
          onChange={(key, next) => draft.update((current) => ({ ...current, imageUploads: { ...current.imageUploads, [key]: next } }))}
          onReplace={(imageUploads) => draft.update((current) => ({ ...current, imageUploads }))}
          onRestore={baseline ? () => draft.update((current) => ({ ...current, imageUploads: baseline.imageUploads })) : undefined}
          value={value.imageUploads}
        />
      ) : null}
      <DraftBar
        changes={draft.changes}
        describeChange={(key) => t(describeSettingKey(key))}
        describeImpact={(key) => t(`ui.admin.retentionImpact.${key}`)}
        draft={draft}
        reload={load}
      />
    </div>
  );
}
