"use client";

import { ArrowCounterClockwise } from "@phosphor-icons/react/ssr";
import { useI18n } from "@/i18n";
import type { SettingPreset } from "@/lib/admin-setting-presets";
import { ListGroup, ListRow } from "@/ui/list";
import { ChoiceRow } from "@/ui/list-controls";
import { Disclosure } from "./disclosure";

/** Applying a preset only changes the local draft; the screen's own save bar owns the write. */
export function SettingPresets<T extends object>({ current, onApply, onRestore, presets }: {
  current: T;
  onApply: (values: T) => void;
  /** Returns this section to its saved settings. */
  onRestore?: () => void;
  presets: SettingPreset<T>[];
}) {
  const { t } = useI18n();
  return (
    <Disclosure title={t("admin.quickSettings")}>
      <ListGroup footer={t("admin.presetHelp")} label={t("admin.quickSettings")} role="radiogroup">
        {presets.map((preset) => (
          <ChoiceRow
            detail={t(preset.detailKey)}
            key={preset.id}
            label={t(preset.labelKey)}
            onSelect={() => onApply(preset.values)}
            selected={Object.entries(preset.values).every(([key, value]) => current[key as keyof T] === value)}
          />
        ))}
      </ListGroup>
      {onRestore ? (
        <ListGroup label={t("admin.restoreSection")}>
          <ListRow icon={<ArrowCounterClockwise />} label={t("admin.restoreSection")} onClick={onRestore} />
        </ListGroup>
      ) : null}
    </Disclosure>
  );
}
