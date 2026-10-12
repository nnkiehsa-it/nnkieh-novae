"use client";

import { useI18n } from "@/i18n";
import { DEFAULT_IMAGE_SETTINGS, IMAGE_PRESETS } from "@/lib/admin-setting-presets";
import type { ImageUploadSettings } from "@/types/categories";
import { ListGroup } from "@/ui/list";
import { NumberRow } from "@/ui/list-controls";
import { Disclosure } from "../shared/disclosure";
import { SettingPresets } from "../shared/setting-presets";
import { IMAGE_PROCESSING_FIELDS } from "./setting-fields";

/** Upload processing: presets for the common cases, and the raw numbers behind them. */
export function ImageRows({ onChange, onRestore, onReplace, value }: {
  onChange: (key: keyof ImageUploadSettings, value: number) => void;
  onReplace: (settings: ImageUploadSettings) => void;
  onRestore?: () => void;
  value: ImageUploadSettings;
}) {
  const { t } = useI18n();
  return (
    <>
      <p className="px-1 text-sm leading-relaxed text-ink-muted">{t("admin.imagePolicyLocation")}</p>
      <SettingPresets current={value} onApply={onReplace} onRestore={onRestore} presets={IMAGE_PRESETS} />
      <Disclosure defaultOpen title={t("admin.settingsImageProcessing")}>
        <ListGroup>
          {IMAGE_PROCESSING_FIELDS.map((field) => (
            <NumberRow
              key={field.key}
              label={t(field.labelKey)}
              max={field.max}
              min={field.min}
              onChange={(next) => onChange(field.key, next)}
              onReset={() => onChange(field.key, DEFAULT_IMAGE_SETTINGS[field.key])}
              step={field.step ?? 1}
              unit={field.unitKey ? t(field.unitKey) : undefined}
              value={value[field.key]}
            />
          ))}
        </ListGroup>
      </Disclosure>
    </>
  );
}
