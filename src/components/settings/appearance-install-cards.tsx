"use client";
import { t as translate, useI18n as useLocaleSubscription } from "@/i18n";

import { Check, Download, Languages, Moon, Sun } from "lucide-react";
import type { AppLocale } from "@/i18n";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LiquidTabs } from "@/components/ui/liquid-tabs";
import { AccentThemePicker } from "@/components/settings/accent-theme-picker";

export function AppearanceInstallCards({
  canInstall,
  installed,
  locale,
  onInstall,
  onLocaleChange,
  onThemeChange,
  resolvedTheme,
  theme,
}: {
  canInstall: boolean;
  installed: boolean;
  locale: AppLocale;
  onInstall: () => void;
  onLocaleChange: (locale: AppLocale) => void;
  onThemeChange: (theme: string) => void;
  resolvedTheme?: string;
  theme?: string;
}) {
  useLocaleSubscription();
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card className="gap-3">
        <CardHeader className="pb-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sun className="size-4 text-muted-foreground" />{translate('ui.settings.appearance')}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div>
            <p className="mb-2 text-sm text-muted-foreground">
              {translate('ui.settings.displayMode')} ·{" "}
              {resolvedTheme === "dark" ? translate('ui.settings.currentDark') : translate('ui.settings.currentLight')}
            </p>
            <LiquidTabs
              ariaLabel={translate('ui.settings.displayMode')}
              onValueChange={onThemeChange}
              options={[
                {
                  icon: <Sun className="size-3.5" />,
                  label: translate('ui.settings.light'),
                  value: "light",
                },
                {
                  icon: <Moon className="size-3.5" />,
                  label: translate('ui.settings.dark'),
                  value: "dark",
                },
                { label: translate('ui.settings.system'), value: "system" },
              ]}
              value={theme || "system"}
            />
          </div>
          <AccentThemePicker resolvedTheme={resolvedTheme} />
          <div>
            <p className="mb-2 text-sm text-muted-foreground">{translate('ui.settings.language')}</p>
            <LiquidTabs
              ariaLabel={translate('ui.settings.language')}
              onValueChange={(value) => onLocaleChange(value as AppLocale)}
              options={[
                {
                  icon: <Languages className="size-3.5" />,
                  label: translate('ui.settings.zhShort'),
                  value: "zh-TW",
                },
                { label: "English", value: "en" },
              ]}
              value={locale}
            />
          </div>
        </CardContent>
      </Card>
      <Card className="gap-3">
        <CardHeader className="pb-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <Download className="size-4 text-muted-foreground" />{translate('ui.settings.install')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-6 text-muted-foreground">{translate('ui.settings.installDescription')}</p>
          <Button
            className="mt-4"
            disabled={!canInstall || installed}
            onClick={onInstall}
            variant="outline"
          >
            {installed ? <Check /> : <Download />}
            {installed
              ? translate('ui.settings.installed')
              : canInstall
                ? translate('ui.settings.installNovae')
                : translate('ui.settings.installFromMenu')}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
