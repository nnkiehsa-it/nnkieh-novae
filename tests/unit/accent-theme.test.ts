import { describe, expect, it } from "vitest";
import {
  ACCENT_PRESETS,
  DEFAULT_ACCENT_DARK,
  DEFAULT_ACCENT_LIGHT,
  accentButtonColors,
  accentContentColor,
  accentForeground,
  colorContrastRatio,
  normalizeAccentColor,
} from "../../src/theme/accent-theme";

describe("accent theme", () => {
  it("normalizes supported hex colors and rejects invalid values", () => {
    expect(normalizeAccentColor("#abc")).toBe("#AABBCC");
    expect(normalizeAccentColor(" #3b82f6 ")).toBe("#3B82F6");
    expect(normalizeAccentColor("rgb(59 130 246)")).toBeNull();
  });

  it("keeps Novae's original monochrome accents as the adaptive default", () => {
    expect(DEFAULT_ACCENT_LIGHT).toBe("#171717");
    expect(DEFAULT_ACCENT_DARK).toBe("#F1F1F1");
  });

  it("keeps the preset palette broad enough for personalization", () => {
    expect(ACCENT_PRESETS.length).toBeGreaterThanOrEqual(10);
    expect(new Set(ACCENT_PRESETS.map((preset) => preset.color)).size).toBe(
      ACCENT_PRESETS.length,
    );
  });

  it("chooses a readable foreground for solid accent surfaces", () => {
    expect(accentForeground("#F59E0B")).toBe("#0D0D0D");
    expect(accentForeground("#6366F1")).toBe("#FFFFFF");
  });

  it("adjusts accent-colored text when the raw tint lacks contrast", () => {
    expect(accentContentColor("#111111", "#121212", "#F3F3F3")).not.toBe(
      "#111111",
    );
    expect(accentContentColor("#F59E0B", "#FDFDFD", "#0D0D0D")).not.toBe(
      "#F59E0B",
    );
    expect(accentContentColor("#2563EB", "#FDFDFD", "#0D0D0D")).toMatch(
      /^#[0-9A-F]{6}$/u,
    );
  });

  it.each(ACCENT_PRESETS)(
    "builds quiet, readable tonal buttons for $name",
    ({ color }) => {
      for (const mode of ["light", "dark"] as const) {
        const button = accentButtonColors(color, mode);
        expect(button.surface).not.toBe(color);
        expect(
          colorContrastRatio(button.foreground, button.surface),
        ).toBeGreaterThanOrEqual(4.5);
        expect(
          colorContrastRatio(button.foreground, button.hover),
        ).toBeGreaterThanOrEqual(4.5);
      }
    },
  );
});
