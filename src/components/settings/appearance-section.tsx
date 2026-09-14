"use client";
import { t as translate, useI18n as useLocaleSubscription } from "@/i18n";

import type { AppLocale } from "@/i18n";
import { ListActionRow, ListSection } from "@/components/ui/list";
import { ListPicker } from "@/components/ui/list-controls";

/**
 * How the app looks and reads, and whether it is installed.
 *
 * Installing used to be a half-width card holding one button that is disabled
 * more often than not; it is a row now, in the same group as the other two
 * decisions about how this device presents the app.
 */
export function AppearanceSection({
  canInstall,
  installed,
  locale,
  onInstall,
  onLocaleChange,
  onThemeChange,
  theme,
}: {
  canInstall: boolean;
  installed: boolean;
  locale: AppLocale;
  onInstall: () => void;
  onLocaleChange: (locale: AppLocale) => void;
  onThemeChange: (theme: string) => void;
  theme?: string;
}) {
  useLocaleSubscription();
  return (
    <ListSection header={translate("ui.settings.appearance")}>
      <ListPicker
        label={translate("ui.settings.displayMode")}
        onChange={onThemeChange}
        options={[
          { label: translate("ui.settings.light"), value: "light" },
          { label: translate("ui.settings.dark"), value: "dark" },
          { label: translate("ui.settings.system"), value: "system" },
        ]}
        value={theme || "system"}
      />
      <ListPicker
        label={translate("ui.settings.language")}
        onChange={(value) => onLocaleChange(value as AppLocale)}
        options={[
          { label: translate("ui.settings.zhShort"), value: "zh-TW" },
          { label: "English", value: "en" },
        ]}
        value={locale}
      />
      <ListActionRow
        disabled={!canInstall || installed}
        label={translate("ui.settings.installNovae")}
        onClick={onInstall}
        value={
          installed
            ? translate("ui.settings.installed")
            : canInstall
              ? undefined
              : translate("ui.settings.installFromMenu")
        }
      />
    </ListSection>
  );
}
