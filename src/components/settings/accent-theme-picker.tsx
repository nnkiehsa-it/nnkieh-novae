"use client";

import {
  ColorArea,
  ColorPicker,
  ColorSlider,
  ColorSwatch,
  ColorSwatchPicker,
  Label,
} from "@heroui/react";
import { RotateCcw } from "lucide-react";
import { t as translate } from "@/i18n";
import { useAccentTheme } from "@/components/accent-theme-provider";
import { Button } from "@/components/ui/button";
import {
  ACCENT_PRESETS,
  DEFAULT_ACCENT_DARK,
  DEFAULT_ACCENT_LIGHT,
} from "@/theme/accent-theme";

export function AccentThemePicker({ resolvedTheme }: { resolvedTheme?: string }) {
  const { accentColor, resetAccentColor, setAccentColor } = useAccentTheme();
  const defaultAccent =
    resolvedTheme === "dark" ? DEFAULT_ACCENT_DARK : DEFAULT_ACCENT_LIGHT;
  const activeColor = accentColor ?? defaultAccent;

  return (
    <div className="grid gap-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium">{translate("ui.settings.accentColor")}</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {translate("ui.settings.accentDescription")}
          </p>
        </div>
        {accentColor ? (
          <Button onClick={resetAccentColor} size="sm" variant="ghost">
            <RotateCcw className="size-3.5" />
            {translate("ui.settings.resetAccent")}
          </Button>
        ) : null}
      </div>

      <ColorSwatchPicker
        aria-label={translate("ui.settings.accentPresets")}
        className="gap-2"
        onChange={(color) => {
          const next = color.toString("hex").toUpperCase();
          if (next === defaultAccent) {
            resetAccentColor();
            return;
          }
          setAccentColor(next);
        }}
        size="lg"
        value={activeColor}
      >
        <ColorSwatchPicker.Item
          aria-label={translate("ui.settings.accentDefault")}
          color={defaultAccent}
        >
          <ColorSwatchPicker.Swatch />
          <ColorSwatchPicker.Indicator />
        </ColorSwatchPicker.Item>
        {ACCENT_PRESETS.map((preset) => (
          <ColorSwatchPicker.Item
            aria-label={preset.name}
            color={preset.color}
            key={preset.color}
          >
            <ColorSwatchPicker.Swatch />
            <ColorSwatchPicker.Indicator />
          </ColorSwatchPicker.Item>
        ))}
      </ColorSwatchPicker>

      <ColorPicker
        onChange={(color) => setAccentColor(color.toString("hex"))}
        value={activeColor}
      >
        <ColorPicker.Trigger className="w-fit rounded-xl border border-input bg-card px-3 py-2 shadow-[var(--shadow-control)]">
          <ColorSwatch className="size-5" />
          <Label className="text-sm">{translate("ui.settings.customAccent")}</Label>
          <span className="font-mono text-xs text-muted-foreground">{activeColor}</span>
        </ColorPicker.Trigger>
        <ColorPicker.Popover className="w-64 rounded-xl border bg-popover p-4 text-popover-foreground shadow-[var(--shadow-floating)]">
          <ColorArea
            className="h-40 w-full rounded-lg"
            colorSpace="hsb"
            xChannel="saturation"
            yChannel="brightness"
          >
            <ColorArea.Thumb />
          </ColorArea>
          <ColorSlider channel="hue" className="mt-4" colorSpace="hsb">
            <ColorSlider.Track>
              <ColorSlider.Thumb />
            </ColorSlider.Track>
          </ColorSlider>
        </ColorPicker.Popover>
      </ColorPicker>
    </div>
  );
}
