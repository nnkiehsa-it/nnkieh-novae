"use client";

import { RotateCcw } from "lucide-react";
import { useI18n } from "@/i18n";
import { SettingsGroup } from "@/components/admin/settings-group";
import { ListActionRow, ListNavRow, ListSection } from "@/components/ui/list";
import type { SettingPreset } from "@/lib/admin-setting-presets";

/** Applying a preset only changes the local draft. The page owns the final save. */
export function SettingPresets<T extends object>({
  current, onApply, onRestore, presets,
}: {
  current: T;
  onApply: (values: T) => void;
  onRestore?: () => void;
  presets: SettingPreset<T>[];
}) {
  const { t } = useI18n();
  return (
    <SettingsGroup title={t("admin.quickSettings")}>
      <p className="mb-3 text-sm leading-6 text-muted-foreground">{t("admin.presetHelp")}</p>
      <ListSection>
        {presets.map((preset) => (
          <ListNavRow
            detail={t(preset.detailKey)}
            key={preset.id}
            label={t(preset.labelKey)}
            onClick={() => onApply(preset.values)}
            value={Object.entries(preset.values).every(([key, value]) => current[key as keyof T] === value)
              ? t("admin.presetMatching") : undefined}
          />
        ))}
        {onRestore ? <ListActionRow icon={RotateCcw} label={t("admin.restoreSection")} onClick={onRestore} /> : null}
      </ListSection>
    </SettingsGroup>
  );
}
